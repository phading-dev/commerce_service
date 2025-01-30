import Stripe from "stripe";
import { MERCHANT_CATEGORY_CODE, PRODUCT_DESCRIPTION } from "../common/params";
import { SERVICE_CLIENT } from "../common/service_client";
import { SPANNER_DATABASE } from "../common/spanner_database";
import { STRIPE_CLIENT } from "../common/stripe_client";
import { StripeConnectedAccountState } from "../db/schema";
import {
  deleteStripeConnectedAccountCreatingTaskStatement,
  getEarningsAccount,
  insertSetupStripeConnectedAccountNotifyingTaskStatement,
  updateEarningsAccountStatement,
  updateStripeConnectedAccountCreatingTaskStatement,
} from "../db/sql";
import { Database } from "@google-cloud/spanner";
import { ProcessStripeConnectedAccountCreatingTaskHandlerInterface } from "@phading/commerce_service_interface/node/handler";
import {
  ProcessStripeConnectedAccountCreatingTaskRequestBody,
  ProcessStripeConnectedAccountCreatingTaskResponse,
} from "@phading/commerce_service_interface/node/interface";
import { getAccountContact } from "@phading/user_service_interface/node/client";
import { newInternalServerErrorError } from "@selfage/http_error";
import { NodeServiceClient } from "@selfage/node_service_client";

export class ProcessStripeConnectedAccountCreatingTaskHandler extends ProcessStripeConnectedAccountCreatingTaskHandlerInterface {
  public static create(): ProcessStripeConnectedAccountCreatingTaskHandler {
    return new ProcessStripeConnectedAccountCreatingTaskHandler(
      SPANNER_DATABASE,
      SERVICE_CLIENT,
      STRIPE_CLIENT,
      () => Date.now(),
    );
  }

  private static RETRY_BACKOFF_MS = 5 * 60 * 1000;
  public doneCallbackFn = (): void => {};

  public constructor(
    private database: Database,
    private serviceClient: NodeServiceClient,
    private stripeClient: Stripe,
    private getNow: () => number,
  ) {
    super();
  }

  public async handle(
    loggingPrefix: string,
    body: ProcessStripeConnectedAccountCreatingTaskRequestBody,
  ): Promise<ProcessStripeConnectedAccountCreatingTaskResponse> {
    loggingPrefix = `${loggingPrefix} Stripe connected account creating task for earnings account ${body.accountId}:`;
    await this.claimTask(loggingPrefix, body.accountId);
    this.startProcessingAndCatchError(loggingPrefix, body.accountId);
    return {};
  }

  private async claimTask(
    loggingPrefix: string,
    accountId: string,
  ): Promise<void> {
    await this.database.runTransactionAsync(async (transaction) => {
      let delayedTime =
        this.getNow() +
        ProcessStripeConnectedAccountCreatingTaskHandler.RETRY_BACKOFF_MS;
      console.log(
        `${loggingPrefix} Claiming the task by delaying it to ${delayedTime}.`,
      );
      await transaction.batchUpdate([
        updateStripeConnectedAccountCreatingTaskStatement(
          accountId,
          delayedTime,
        ),
      ]);
      await transaction.commit();
    });
  }

  private async startProcessingAndCatchError(
    loggingPrefix: string,
    accountId: string,
  ): Promise<void> {
    try {
      let accountResponse = await getAccountContact(this.serviceClient, {
        accountId,
      });
      let account = await this.stripeClient.accounts.create(
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
          idempotencyKey: accountId,
        },
      );
      await this.database.runTransactionAsync(async (transaction) => {
        let accountRows = await getEarningsAccount(transaction, accountId);
        if (accountRows.length === 0) {
          throw newInternalServerErrorError(
            `Earnings account ${accountId} is not found.`,
          );
        }
        let earningsAccount = accountRows[0].earningsAccountData;
        if (earningsAccount.stripeConnectedAccountId) {
          if (earningsAccount.stripeConnectedAccountId !== account.id) {
            throw newInternalServerErrorError(
              `Earnings account ${accountId} has a different account ID ${earningsAccount.stripeConnectedAccountId}.`,
            );
          }
          return;
        } else {
          earningsAccount.stripeConnectedAccountId = account.id;
          earningsAccount.stripeConnectedAccountState =
            StripeConnectedAccountState.ONBOARDING;
          let now = this.getNow();
          await transaction.batchUpdate([
            updateEarningsAccountStatement(earningsAccount),
            insertSetupStripeConnectedAccountNotifyingTaskStatement(
              accountId,
              now,
              now,
            ),
            deleteStripeConnectedAccountCreatingTaskStatement(accountId),
          ]);
          await transaction.commit();
        }
      });
      console.log(`${loggingPrefix} Task completed.`);
    } catch (e) {
      console.error(`${loggingPrefix} Task failed! ${e.stack ?? e}`);
    }
    this.doneCallbackFn();
  }
}
