import Stripe from "stripe";
import {
  MERCHANT_CATEGORY_CODE,
  PRODUCT_DESCRIPTION,
} from "../common/constants";
import { SERVICE_CLIENT } from "../common/service_client";
import { SPANNER_DATABASE } from "../common/spanner_database";
import { STRIPE_CLIENT } from "../common/stripe_client";
import { StripeConnectedAccountState } from "../db/schema";
import {
  deleteStripeConnectedAccountCreatingTaskStatement,
  getEarningsAccount,
  getStripeConnectedAccountCreatingTaskMetadata,
  insertSetupStripeConnectedAccountNotifyingTaskStatement,
  updateEarningsAccountStatement,
  updateStripeConnectedAccountCreatingTaskMetadataStatement,
} from "../db/sql";
import { Database } from "@google-cloud/spanner";
import { ProcessStripeConnectedAccountCreatingTaskHandlerInterface } from "@phading/commerce_service_interface/node/handler";
import {
  ProcessStripeConnectedAccountCreatingTaskRequestBody,
  ProcessStripeConnectedAccountCreatingTaskResponse,
} from "@phading/commerce_service_interface/node/interface";
import { newGetAccountContactRequest } from "@phading/user_service_interface/node/client";
import {
  newBadRequestError,
  newInternalServerErrorError,
} from "@selfage/http_error";
import { NodeServiceClient } from "@selfage/node_service_client";
import { Ref } from "@selfage/ref";
import { ProcessTaskHandlerWrapper } from "@selfage/service_handler/process_task_handler_wrapper";

export class ProcessStripeConnectedAccountCreatingTaskHandler extends ProcessStripeConnectedAccountCreatingTaskHandlerInterface {
  public static create(): ProcessStripeConnectedAccountCreatingTaskHandler {
    return new ProcessStripeConnectedAccountCreatingTaskHandler(
      SPANNER_DATABASE,
      SERVICE_CLIENT,
      STRIPE_CLIENT,
      () => Date.now(),
    );
  }

  private taskHandler: ProcessTaskHandlerWrapper;

  public constructor(
    private database: Database,
    private serviceClient: NodeServiceClient,
    private stripeClient: Ref<Stripe>,
    private getNow: () => number,
  ) {
    super();
    this.taskHandler = ProcessTaskHandlerWrapper.create(
      this.descriptor,
      5 * 60 * 1000,
      24 * 60 * 60 * 1000,
    );
  }

  public async handle(
    loggingPrefix: string,
    body: ProcessStripeConnectedAccountCreatingTaskRequestBody,
  ): Promise<ProcessStripeConnectedAccountCreatingTaskResponse> {
    loggingPrefix = `${loggingPrefix} Stripe connected account creating task for earnings account ${body.accountId}:`;
    await this.taskHandler.wrap(
      loggingPrefix,
      () => this.claimTask(loggingPrefix, body),
      () => this.processTask(loggingPrefix, body),
    );
    return {};
  }

  public async claimTask(
    loggingPrefix: string,
    body: ProcessStripeConnectedAccountCreatingTaskRequestBody,
  ): Promise<void> {
    await this.database.runTransactionAsync(async (transaction) => {
      let rows = await getStripeConnectedAccountCreatingTaskMetadata(
        transaction,
        body.accountId,
      );
      if (rows.length === 0) {
        throw newBadRequestError(`Task is not found.`);
      }
      let task = rows[0];
      await transaction.batchUpdate([
        updateStripeConnectedAccountCreatingTaskMetadataStatement(
          body.accountId,
          task.stripeConnectedAccountCreatingTaskRetryCount + 1,
          this.getNow() +
            this.taskHandler.getBackoffTime(
              task.stripeConnectedAccountCreatingTaskRetryCount,
            ),
        ),
      ]);
      await transaction.commit();
    });
  }

  public async processTask(
    loggingPrefix: string,
    body: ProcessStripeConnectedAccountCreatingTaskRequestBody,
  ): Promise<void> {
    let accountResponse = await this.serviceClient.send(
      newGetAccountContactRequest({
        accountId: body.accountId,
      }),
    );
    let account = await this.stripeClient.val.accounts.create(
      {
        email: accountResponse.contactEmail,
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
      },
      {
        idempotencyKey: body.accountId,
      },
    );
    await this.database.runTransactionAsync(async (transaction) => {
      let accountRows = await getEarningsAccount(transaction, body.accountId);
      if (accountRows.length === 0) {
        throw newInternalServerErrorError(
          `Earnings account ${body.accountId} is not found.`,
        );
      }
      let earningsAccount = accountRows[0].earningsAccountData;
      if (earningsAccount.stripeConnectedAccountId) {
        if (earningsAccount.stripeConnectedAccountId !== account.id) {
          throw newInternalServerErrorError(
            `Earnings account ${body.accountId} already has a stripe connected account id ${earningsAccount.stripeConnectedAccountId} which is different from the new one ${account.id}.`,
          );
        } else {
          await transaction.batchUpdate([
            deleteStripeConnectedAccountCreatingTaskStatement(body.accountId),
          ]);
          await transaction.commit();
        }
      } else {
        earningsAccount.stripeConnectedAccountId = account.id;
        earningsAccount.stripeConnectedAccountState =
          StripeConnectedAccountState.ONBOARDING;
        let now = this.getNow();
        await transaction.batchUpdate([
          updateEarningsAccountStatement(earningsAccount),
          insertSetupStripeConnectedAccountNotifyingTaskStatement(
            body.accountId,
            0,
            now,
            now,
          ),
          deleteStripeConnectedAccountCreatingTaskStatement(body.accountId),
        ]);
        await transaction.commit();
      }
    });
  }
}
