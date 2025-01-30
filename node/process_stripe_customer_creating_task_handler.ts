import Stripe from "stripe";
import { SERVICE_CLIENT } from "../common/service_client";
import { SPANNER_DATABASE } from "../common/spanner_database";
import { STRIPE_CLIENT } from "../common/stripe_client";
import {
  deleteStripeCustomerCreatingTaskStatement,
  getBillingAccount,
  updateBillingAccountStatement,
  updateStripeCustomerCreatingTaskStatement,
} from "../db/sql";
import { Database } from "@google-cloud/spanner";
import { ProcessStripeCustomerCreatingTaskHandlerInterface } from "@phading/commerce_service_interface/node/handler";
import {
  ProcessStripeCustomerCreatingTaskRequestBody,
  ProcessStripeCustomerCreatingTaskResponse,
} from "@phading/commerce_service_interface/node/interface";
import { getAccountContact } from "@phading/user_service_interface/node/client";
import { newInternalServerErrorError } from "@selfage/http_error";
import { NodeServiceClient } from "@selfage/node_service_client";

export class ProcessStripeCustomerCreatingTaskHandler extends ProcessStripeCustomerCreatingTaskHandlerInterface {
  public static create(): ProcessStripeCustomerCreatingTaskHandler {
    return new ProcessStripeCustomerCreatingTaskHandler(
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
    private testClockId?: string,
  ) {
    super();
  }

  public async handle(
    loggingPrefix: string,
    body: ProcessStripeCustomerCreatingTaskRequestBody,
  ): Promise<ProcessStripeCustomerCreatingTaskResponse> {
    loggingPrefix = `${loggingPrefix} Billing customer creating task for billing account ${body.accountId}:`;
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
        ProcessStripeCustomerCreatingTaskHandler.RETRY_BACKOFF_MS;
      console.log(
        `${loggingPrefix} Claiming the task by delaying it to ${delayedTime}.`,
      );
      await transaction.batchUpdate([
        updateStripeCustomerCreatingTaskStatement(accountId, delayedTime),
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
      let customer = await this.stripeClient.customers.create(
        {
          email: accountResponse.contactEmail,
          name: accountResponse.naturalName,
          test_clock: this.testClockId,
          tax: {
            validate_location: "deferred",
          },
        },
        {
          idempotencyKey: accountId,
        },
      );
      await this.database.runTransactionAsync(async (transaction) => {
        let accountRows = await getBillingAccount(transaction, accountId);
        if (accountRows.length === 0) {
          throw newInternalServerErrorError(
            `Billing account ${accountId} is not found.`,
          );
        }
        let billingAccountData = accountRows[0].billingAccountData;
        if (billingAccountData.stripeCustomerId) {
          if (billingAccountData.stripeCustomerId !== customer.id) {
            throw newInternalServerErrorError(
              `Billing account ${accountId} has a different customer ID ${billingAccountData.stripeCustomerId}.`,
            );
          }
        } else {
          billingAccountData.stripeCustomerId = customer.id;
          await transaction.batchUpdate([
            updateBillingAccountStatement(billingAccountData),
            deleteStripeCustomerCreatingTaskStatement(accountId),
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
