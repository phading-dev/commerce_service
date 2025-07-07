import Stripe from "stripe";
import { CUSTOMER_METADATA_ACCOUNT_ID_KEY } from "../common/constants";
import { SERVICE_CLIENT } from "../common/service_client";
import { SPANNER_DATABASE } from "../common/spanner_database";
import { STRIPE_CLIENT } from "../common/stripe_client";
import {
  deleteStripeCustomerCreatingTaskStatement,
  getPaymentProfile,
  getStripeCustomerCreatingTaskMetadata,
  updatePaymentProfilePaymentCustomerStatement,
  updateStripeCustomerCreatingTaskMetadataStatement,
} from "../db/sql";
import { Database } from "@google-cloud/spanner";
import { Statement } from "@google-cloud/spanner/build/src/transaction";
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
    body: ProcessStripeCustomerCreatingTaskRequestBody,
  ): Promise<ProcessStripeCustomerCreatingTaskResponse> {
    loggingPrefix = `${loggingPrefix} Payment Stripe customer creating task ${body.taskid}:`;
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
      let rows = await getStripeCustomerCreatingTaskMetadata(transaction, {
        stripeCustomerCreatingTaskTaskIdEq: body.taskid,
      });
      if (rows.length === 0) {
        throw newBadRequestError(`Task is not found.`);
      }
      let task = rows[0];
      await transaction.batchUpdate([
        updateStripeCustomerCreatingTaskMetadataStatement({
          stripeCustomerCreatingTaskTaskIdEq: body.taskid,
          setRetryCount: task.stripeCustomerCreatingTaskRetryCount + 1,
          setExecutionTimeMs:
            this.getNow() +
            this.taskHandler.getBackoffTime(
              task.stripeCustomerCreatingTaskRetryCount,
            ),
        }),
      ]);
      await transaction.commit();
    });
  }

  public async processTask(
    loggingPrefix: string,
    body: ProcessStripeCustomerCreatingTaskRequestBody,
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
        metadata: {
          [CUSTOMER_METADATA_ACCOUNT_ID_KEY]: body.accountId,
        },
      },
      {
        idempotencyKey: `c${body.taskid}`,
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
      let statements: Array<Statement> = [
        deleteStripeCustomerCreatingTaskStatement({
          stripeCustomerCreatingTaskTaskIdEq: body.taskid,
        }),
      ];
      if (!profile.paymentProfileStripePaymentCustomerId) {
        statements.push(
          updatePaymentProfilePaymentCustomerStatement({
            paymentProfileAccountIdEq: body.accountId,
            setStripePaymentCustomerId: customer.id,
          }),
        );
      } else if (
        profile.paymentProfileStripePaymentCustomerId !== customer.id
      ) {
        throw newInternalServerErrorError(
          `Payment profile ${body.accountId} already has a stripe customer id ${profile.paymentProfileStripePaymentCustomerId} which is different from the new one ${customer.id}.`,
        );
      }
      await transaction.batchUpdate(statements);
      await transaction.commit();
    });
  }
}
