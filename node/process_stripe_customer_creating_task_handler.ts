import Stripe from "stripe";
import { SERVICE_CLIENT } from "../common/service_client";
import { SPANNER_DATABASE } from "../common/spanner_database";
import { STRIPE_CLIENT } from "../common/stripe_client";
import {
  deleteStripeCustomerCreatingTaskStatement,
  getBillingAccount,
  getStripeCustomerCreatingTaskMetadata,
  updateBillingAccountStatement,
  updateStripeCustomerCreatingTaskMetadataStatement,
} from "../db/sql";
import { Database } from "@google-cloud/spanner";
import { ProcessStripeCustomerCreatingTaskHandlerInterface } from "@phading/commerce_service_interface/node/handler";
import {
  ProcessStripeCustomerCreatingTaskRequestBody,
  ProcessStripeCustomerCreatingTaskResponse,
} from "@phading/commerce_service_interface/node/interface";
import { newGetAccountContactRequest } from "@phading/user_service_interface/node/client";
import {
  newBadRequestError,
  newInternalServerErrorError,
} from "@selfage/http_error";
import { NodeServiceClient } from "@selfage/node_service_client";
import { Ref } from "@selfage/ref";
import { ProcessTaskHandlerWrapper } from "@selfage/service_handler/process_task_handler_wrapper";

export class ProcessStripeCustomerCreatingTaskHandler extends ProcessStripeCustomerCreatingTaskHandlerInterface {
  public static create(): ProcessStripeCustomerCreatingTaskHandler {
    return new ProcessStripeCustomerCreatingTaskHandler(
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
    private testClockId?: string,
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
    body: ProcessStripeCustomerCreatingTaskRequestBody,
  ): Promise<ProcessStripeCustomerCreatingTaskResponse> {
    loggingPrefix = `${loggingPrefix} Billing customer creating task for billing account ${body.accountId}:`;
    await this.taskHandler.wrap(
      loggingPrefix,
      () => this.claimTask(loggingPrefix, body),
      () => this.processTask(loggingPrefix, body),
    );
    return {};
  }

  public async claimTask(
    loggingPrefix: string,
    body: ProcessStripeCustomerCreatingTaskRequestBody,
  ): Promise<void> {
    await this.database.runTransactionAsync(async (transaction) => {
      let rows = await getStripeCustomerCreatingTaskMetadata(
        transaction,
        body.accountId,
      );
      if (rows.length === 0) {
        throw newBadRequestError(`Task is not found.`);
      }
      let task = rows[0];
      await transaction.batchUpdate([
        updateStripeCustomerCreatingTaskMetadataStatement(
          body.accountId,
          task.stripeCustomerCreatingTaskRetryCount + 1,
          this.getNow() +
            this.taskHandler.getBackoffTime(
              task.stripeCustomerCreatingTaskRetryCount,
            ),
        ),
      ]);
      await transaction.commit();
    });
  }

  public async processTask(
    loggingPrefix: string,
    body: ProcessStripeCustomerCreatingTaskRequestBody,
  ): Promise<void> {
    let accountResponse = await this.serviceClient.send(
      newGetAccountContactRequest({
        accountId: body.accountId,
      }),
    );
    let customer = await this.stripeClient.val.customers.create(
      {
        email: accountResponse.contactEmail,
        name: accountResponse.naturalName,
        test_clock: this.testClockId,
        tax: {
          validate_location: "deferred",
        },
      },
      {
        idempotencyKey: body.accountId,
      },
    );
    await this.database.runTransactionAsync(async (transaction) => {
      let accountRows = await getBillingAccount(transaction, body.accountId);
      if (accountRows.length === 0) {
        throw newInternalServerErrorError(
          `Billing account ${body.accountId} is not found.`,
        );
      }
      let billingAccountData = accountRows[0].billingAccountData;
      if (billingAccountData.stripeCustomerId) {
        if (billingAccountData.stripeCustomerId !== customer.id) {
          throw newInternalServerErrorError(
            `Billing account ${body.accountId} already has a stripe customer id ${billingAccountData.stripeCustomerId} which is different from the new one ${customer.id}.`,
          );
        } else {
          await transaction.batchUpdate([
            deleteStripeCustomerCreatingTaskStatement(body.accountId),
          ]);
          await transaction.commit();
        }
      } else {
        billingAccountData.stripeCustomerId = customer.id;
        await transaction.batchUpdate([
          updateBillingAccountStatement(billingAccountData),
          deleteStripeCustomerCreatingTaskStatement(body.accountId),
        ]);
        await transaction.commit();
      }
    });
  }
}
