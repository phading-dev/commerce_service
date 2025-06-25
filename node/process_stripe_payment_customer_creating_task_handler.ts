import Stripe from "stripe";
import { SERVICE_CLIENT } from "../common/service_client";
import { SPANNER_DATABASE } from "../common/spanner_database";
import { STRIPE_CLIENT } from "../common/stripe_client";
import {
  deleteStripePaymentCustomerCreatingTaskStatement,
  getPaymentProfile,
  getStripePaymentCustomerCreatingTaskMetadata,
  updatePaymentProfilePaymentCustomerStatement,
  updateStripePaymentCustomerCreatingTaskMetadataStatement,
} from "../db/sql";
import { Database } from "@google-cloud/spanner";
import { ProcessStripePaymentCustomerCreatingTaskHandlerInterface } from "@phading/commerce_service_interface/node/handler";
import {
  ProcessStripePaymentCustomerCreatingTaskRequestBody,
  ProcessStripePaymentCustomerCreatingTaskResponse,
} from "@phading/commerce_service_interface/node/interface";
import { newGetAccountContactRequest } from "@phading/user_service_interface/node/client";
import {
  newBadRequestError,
  newInternalServerErrorError,
} from "@selfage/http_error";
import { NodeServiceClient } from "@selfage/node_service_client";
import { Ref } from "@selfage/ref";
import { ProcessTaskHandlerWrapper } from "@selfage/service_handler/process_task_handler_wrapper";

export class ProcessStripePaymentCustomerCreatingTaskHandler extends ProcessStripePaymentCustomerCreatingTaskHandlerInterface {
  public static create(): ProcessStripePaymentCustomerCreatingTaskHandler {
    return new ProcessStripePaymentCustomerCreatingTaskHandler(
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
    private testClockId?: string,
  ) {
    super();
  }

  public async handle(
    loggingPrefix: string,
    body: ProcessStripePaymentCustomerCreatingTaskRequestBody,
  ): Promise<ProcessStripePaymentCustomerCreatingTaskResponse> {
    loggingPrefix = `${loggingPrefix} Payment payment customer creating task for payment profile ${body.accountId}:`;
    await this.taskHandler.wrap(
      loggingPrefix,
      () => this.claimTask(loggingPrefix, body),
      () => this.processTask(loggingPrefix, body),
    );
    return {};
  }

  public async claimTask(
    loggingPrefix: string,
    body: ProcessStripePaymentCustomerCreatingTaskRequestBody,
  ): Promise<void> {
    await this.database.runTransactionAsync(async (transaction) => {
      let rows = await getStripePaymentCustomerCreatingTaskMetadata(
        transaction,
        { stripePaymentCustomerCreatingTaskAccountIdEq: body.accountId },
      );
      if (rows.length === 0) {
        throw newBadRequestError(`Task is not found.`);
      }
      let task = rows[0];
      await transaction.batchUpdate([
        updateStripePaymentCustomerCreatingTaskMetadataStatement({
          stripePaymentCustomerCreatingTaskAccountIdEq: body.accountId,
          setRetryCount: task.stripePaymentCustomerCreatingTaskRetryCount + 1,
          setExecutionTimeMs:
            this.getNow() +
            this.taskHandler.getBackoffTime(
              task.stripePaymentCustomerCreatingTaskRetryCount,
            ),
        }),
      ]);
      await transaction.commit();
    });
  }

  public async processTask(
    loggingPrefix: string,
    body: ProcessStripePaymentCustomerCreatingTaskRequestBody,
  ): Promise<void> {
    let contactResponse = await this.serviceClient.send(
      newGetAccountContactRequest({
        accountId: body.accountId,
      }),
    );
    let customer = await this.stripeClient.val.customers.create(
      {
        email: contactResponse.contactEmail,
        name: contactResponse.naturalName,
        test_clock: this.testClockId,
        tax: {
          validate_location: "deferred",
        },
      },
      {
        idempotencyKey: `c${body.accountId}`,
      },
    );
    await this.database.runTransactionAsync(async (transaction) => {
      let profileRows = await getPaymentProfile(transaction, {
        paymentProfileAccountIdEq: body.accountId,
      });
      if (profileRows.length === 0) {
        throw newInternalServerErrorError(
          `Payment profile ${body.accountId} is not found.`,
        );
      }
      let profile = profileRows[0];
      if (profile.paymentProfileStripePaymentCustomerId) {
        if (profile.paymentProfileStripePaymentCustomerId !== customer.id) {
          throw newInternalServerErrorError(
            `Payment profile ${body.accountId} already has a stripe customer id ${profile.paymentProfileStripePaymentCustomerId} which is different from the new one ${customer.id}.`,
          );
        } else {
          throw newBadRequestError(
            `Payment profile ${body.accountId} already has a stripe customer id ${profile.paymentProfileStripePaymentCustomerId}.`,
          );
        }
      } else {
        await transaction.batchUpdate([
          updatePaymentProfilePaymentCustomerStatement({
            paymentProfileAccountIdEq: body.accountId,
            setStripePaymentCustomerId: customer.id,
          }),
          deleteStripePaymentCustomerCreatingTaskStatement({
            stripePaymentCustomerCreatingTaskAccountIdEq: body.accountId,
          }),
        ]);
        await transaction.commit();
      }
    });
  }
}
