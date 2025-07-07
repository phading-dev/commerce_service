import Stripe from "stripe";
import { SPANNER_DATABASE } from "../common/spanner_database";
import { STRIPE_CLIENT } from "../common/stripe_client";
import { PaymentState } from "../db/schema";
import {
  GetPaymentRow,
  deletePaymentStripeInvoicePayingTaskStatement,
  getPayment,
  getPaymentStripeInvoicePayingTaskMetadata,
  updatePaymentStateStatement,
  updatePaymentStripeInvoicePayingTaskMetadataStatement,
} from "../db/sql";
import { Database, Transaction } from "@google-cloud/spanner";
import { ProcessPaymentStripeInvoicePayingTaskHandlerInterface } from "@phading/commerce_service_interface/node/handler";
import {
  ProcessPaymentStripeInvoicePayingTaskRequestBody,
  ProcessPaymentStripeInvoicePayingTaskResponse,
} from "@phading/commerce_service_interface/node/interface";
import {
  newBadRequestError,
  newInternalServerErrorError,
} from "@selfage/http_error";
import { Ref } from "@selfage/ref";
import { ProcessTaskHandlerWrapper } from "@selfage/service_handler/process_task_handler_wrapper";

export class ProcessPaymentStripeInvoicePayingTaskHandler extends ProcessPaymentStripeInvoicePayingTaskHandlerInterface {
  public static create(): ProcessPaymentStripeInvoicePayingTaskHandler {
    return new ProcessPaymentStripeInvoicePayingTaskHandler(
      SPANNER_DATABASE,
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
    private stripeClient: Ref<Stripe>,
    private getNow: () => number,
  ) {
    super();
  }

  public async handle(
    loggingPrefix: string,
    body: ProcessPaymentStripeInvoicePayingTaskRequestBody,
  ): Promise<ProcessPaymentStripeInvoicePayingTaskResponse> {
    loggingPrefix = `${loggingPrefix} Payment Stripe invoice paying task ${body.taskId} with payment ${body.statementId}:`;
    await this.taskHandler.wrap(
      loggingPrefix,
      () => this.claimTask(loggingPrefix, body),
      () => this.processTask(loggingPrefix, body),
    );
    return {};
  }

  public async claimTask(
    loggingPrefix: string,
    body: ProcessPaymentStripeInvoicePayingTaskRequestBody,
  ): Promise<void> {
    await this.database.runTransactionAsync(async (transaction) => {
      let rows = await getPaymentStripeInvoicePayingTaskMetadata(transaction, {
        paymentStripeInvoicePayingTaskTaskIdEq: body.taskId,
      });
      if (rows.length === 0) {
        throw newBadRequestError(`Task is not found.`);
      }
      let task = rows[0];
      await transaction.batchUpdate([
        updatePaymentStripeInvoicePayingTaskMetadataStatement({
          paymentStripeInvoicePayingTaskTaskIdEq: body.taskId,
          setRetryCount: task.paymentStripeInvoicePayingTaskRetryCount + 1,
          setExecutionTimeMs:
            this.getNow() +
            this.taskHandler.getBackoffTime(
              task.paymentStripeInvoicePayingTaskRetryCount,
            ),
        }),
      ]);
      await transaction.commit();
    });
  }

  public async processTask(
    loggingPrefix: string,
    body: ProcessPaymentStripeInvoicePayingTaskRequestBody,
  ): Promise<void> {
    console.log(`${loggingPrefix} Processing task...`);
    let payment = await this.getValidPayment(this.database, body.statementId);
    if (!payment.paymentStripeInvoiceId) {
      throw newInternalServerErrorError(
        `Payment ${body.statementId} does not have a Stripe invoice ID.`,
      );
    }
    await this.stripeClient.val.invoices.pay(
      payment.paymentStripeInvoiceId,
      {},
      {
        idempotencyKey: `pi${body.taskId}`,
      },
    );
    await this.database.runTransactionAsync(async (transaction) => {
      await this.getValidPayment(transaction, body.statementId);
      await transaction.batchUpdate([
        updatePaymentStateStatement({
          paymentStatementIdEq: body.statementId,
          setState: PaymentState.WAITING_FOR_INVOICE_PAYMENT,
          setUpdatedTimeMs: this.getNow(),
        }),
        deletePaymentStripeInvoicePayingTaskStatement({
          paymentStripeInvoicePayingTaskTaskIdEq: body.taskId,
        }),
      ]);
      await transaction.commit();
    });
  }

  private async getValidPayment(
    runner: Database | Transaction,
    statementId: string,
  ): Promise<GetPaymentRow> {
    let rows = await getPayment(runner, { paymentStatementIdEq: statementId });
    if (rows.length === 0) {
      // Payment should almost never be deleted, or should be drained by a long lead time.
      throw newInternalServerErrorError(`Payment ${statementId} is not found.`);
    }
    let row = rows[0];
    if (row.paymentState !== PaymentState.PAYING_INVOICE) {
      throw newBadRequestError(
        `Payment ${statementId} is not in PAYING_INVOICE state.`,
      );
    }
    return row;
  }
}
