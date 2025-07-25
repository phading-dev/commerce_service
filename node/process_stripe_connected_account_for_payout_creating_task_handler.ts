import Stripe from "stripe";
import {
  CONNECTED_ACCOUNT_METADATA_ACCOUNT_ID_KEY,
  MERCHANT_CATEGORY_CODE,
  PRODUCT_DESCRIPTION,
} from "../common/constants";
import { SERVICE_CLIENT } from "../common/service_client";
import { SPANNER_DATABASE } from "../common/spanner_database";
import { STRIPE_CLIENT } from "../common/stripe_client";
import { StripeConnectedAccountState } from "../db/schema";
import {
  deleteStripeConnectedAccountForPayoutCreatingTaskStatement,
  getPayoutProfile,
  getStripeConnectedAccountForPayoutCreatingTaskMetadata,
  insertStripeConnectedAccountNeedsSetupNotifyingTaskStatement,
  updatePayoutProfileConnectedAccountStatement,
  updateStripeConnectedAccountForPayoutCreatingTaskMetadataStatement,
} from "../db/sql";
import { Database } from "@google-cloud/spanner";
import { Statement } from "@google-cloud/spanner/build/src/transaction";
import { ProcessStripeConnectedAccountForPayoutCreatingTaskHandlerInterface } from "@phading/commerce_service_interface/node/handler";
import {
  ProcessStripeConnectedAccountForPayoutCreatingTaskRequestBody,
  ProcessStripeConnectedAccountForPayoutCreatingTaskResponse,
} from "@phading/commerce_service_interface/node/interface";
import { newGetAccountContactRequest } from "@phading/user_service_interface/node/client";
import {
  newBadRequestError,
  newInternalServerErrorError,
} from "@selfage/http_error";
import { NodeServiceClient } from "@selfage/node_service_client";
import { Ref } from "@selfage/ref";
import { ProcessTaskHandlerWrapper } from "@selfage/service_handler/process_task_handler_wrapper";

export class ProcessStripeConnectedAccountForPayoutCreatingTaskHandler extends ProcessStripeConnectedAccountForPayoutCreatingTaskHandlerInterface {
  public static create(): ProcessStripeConnectedAccountForPayoutCreatingTaskHandler {
    return new ProcessStripeConnectedAccountForPayoutCreatingTaskHandler(
      SPANNER_DATABASE,
      SERVICE_CLIENT,
      STRIPE_CLIENT,
      () => Date.now(),
    );
  }

  private taskHandler = ProcessTaskHandlerWrapper.create(
    this.descriptor,
    5 * 60 * 1000,
    24 * 60 * 60 * 1000,
  );

  public constructor(
    private database: Database,
    private serviceClient: NodeServiceClient,
    private stripeClient: Ref<Stripe>,
    private getNow: () => number,
  ) {
    super();
  }

  public async handle(
    loggingPrefix: string,
    body: ProcessStripeConnectedAccountForPayoutCreatingTaskRequestBody,
  ): Promise<ProcessStripeConnectedAccountForPayoutCreatingTaskResponse> {
    loggingPrefix = `${loggingPrefix} Stripe connected account creating task for payout ${body.taskId}:`;
    await this.taskHandler.wrap(
      loggingPrefix,
      () => this.claimTask(loggingPrefix, body),
      () => this.processTask(loggingPrefix, body),
    );
    return {};
  }

  public async claimTask(
    loggingPrefix: string,
    body: ProcessStripeConnectedAccountForPayoutCreatingTaskRequestBody,
  ): Promise<void> {
    await this.database.runTransactionAsync(async (transaction) => {
      let rows = await getStripeConnectedAccountForPayoutCreatingTaskMetadata(
        transaction,
        { stripeConnectedAccountForPayoutCreatingTaskTaskIdEq: body.taskId },
      );
      if (rows.length === 0) {
        throw newBadRequestError(`Task is not found.`);
      }
      let task = rows[0];
      await transaction.batchUpdate([
        updateStripeConnectedAccountForPayoutCreatingTaskMetadataStatement({
          stripeConnectedAccountForPayoutCreatingTaskTaskIdEq: body.taskId,
          setRetryCount:
            task.stripeConnectedAccountForPayoutCreatingTaskRetryCount + 1,
          setExecutionTimeMs:
            this.getNow() +
            this.taskHandler.getBackoffTime(
              task.stripeConnectedAccountForPayoutCreatingTaskRetryCount,
            ),
        }),
      ]);
      await transaction.commit();
    });
  }

  public async processTask(
    loggingPrefix: string,
    body: ProcessStripeConnectedAccountForPayoutCreatingTaskRequestBody,
  ): Promise<void> {
    let contactResponse = await this.serviceClient.send(
      newGetAccountContactRequest({
        accountId: body.accountId,
      }),
    );
    let account = await this.stripeClient.val.accounts.create(
      {
        email: contactResponse.contactEmail,
        business_profile: {
          mcc: MERCHANT_CATEGORY_CODE,
          product_description: PRODUCT_DESCRIPTION,
        },
        capabilities: {
          transfers: {
            requested: true,
          },
          tax_reporting_us_1099_misc: {
            requested: true,
          },
        },
        controller: {
          stripe_dashboard: {
            type: "express",
          },
          fees: {
            payer: "application",
          },
          losses: {
            payments: "application",
          },
        },
        metadata: {
          [CONNECTED_ACCOUNT_METADATA_ACCOUNT_ID_KEY]: body.accountId,
        },
      },
      {
        idempotencyKey: `ca${body.taskId}`,
      },
    );
    await this.database.runTransactionAsync(async (transaction) => {
      let profileRows = await getPayoutProfile(transaction, {
        payoutProfileAccountIdEq: body.accountId,
      });
      if (profileRows.length === 0) {
        throw newInternalServerErrorError(
          `Payout profile ${body.accountId} is not found.`,
        );
      }
      let profile = profileRows[0];
      let statements: Array<Statement> = [
        deleteStripeConnectedAccountForPayoutCreatingTaskStatement({
          stripeConnectedAccountForPayoutCreatingTaskTaskIdEq: body.taskId,
        }),
      ];
      if (!profile.payoutProfileStripeConnectedAccountId) {
        let now = this.getNow();
        statements.push(
          updatePayoutProfileConnectedAccountStatement({
            payoutProfileAccountIdEq: body.accountId,
            setStripeConnectedAccountId: account.id,
            setStripeConnectedAccountState:
              StripeConnectedAccountState.ONBOARDING,
          }),
          insertStripeConnectedAccountNeedsSetupNotifyingTaskStatement({
            accountId: body.accountId,
            retryCount: 0,
            executionTimeMs: now,
            createdTimeMs: now,
          }),
        );
      } else if (profile.payoutProfileStripeConnectedAccountId !== account.id) {
        throw newInternalServerErrorError(
          `Payout profile ${body.accountId} already has a stripe connected account id ${profile.payoutProfileStripeConnectedAccountId} which is different from the new one ${account.id}.`,
        );
      }
      await transaction.batchUpdate(statements);
      await transaction.commit();
    });
  }
}
