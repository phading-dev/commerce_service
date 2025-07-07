import Stripe from "stripe";
import {
  GRACE_PERIOD_DAYS_IN_MS,
  PAYMENT_METADATA_STATEMENT_ID_KEY,
} from "../common/constants";
import { LOCALIZATION } from "../common/localization";
import { SPANNER_DATABASE } from "../common/spanner_database";
import { STRIPE_CLIENT } from "../common/stripe_client";
import { PaymentState } from "../db/schema";
import {
  GetPaymentRow,
  deletePaymentMethodNeedsUpdateNotifyingTaskStatement,
  deletePaymentStripeInvoiceCreatingTaskStatement,
  getPayment,
  getPaymentProfileFromStatement,
  getPaymentProfileSuspendingDueToPastDueTask,
  getPaymentStripeInvoiceCreatingTaskMetadata,
  getTransactionStatement,
  insertPaymentMethodNeedsUpdateNotifyingTaskStatement,
  insertPaymentProfileSuspendingDueToPastDueTaskStatement,
  updatePaymentStateAndStripeInvoiceStatement,
  updatePaymentStateStatement,
  updatePaymentStripeInvoiceCreatingTaskMetadataStatement,
} from "../db/sql";
import { Database, Transaction } from "@google-cloud/spanner";
import { ProcessPaymentStripeInvoiceCreatingTaskHandlerInterface } from "@phading/commerce_service_interface/node/handler";
import {
  ProcessPaymentStripeInvoiceCreatingTaskRequestBody,
  ProcessPaymentStripeInvoiceCreatingTaskResponse,
} from "@phading/commerce_service_interface/node/interface";
import { AmountType } from "@phading/price/amount_type";
import {
  newBadRequestError,
  newInternalServerErrorError,
} from "@selfage/http_error";
import { Ref } from "@selfage/ref";
import { ProcessTaskHandlerWrapper } from "@selfage/service_handler/process_task_handler_wrapper";

export class ProcessPaymentStripeInvoiceCreatingTaskHandler extends ProcessPaymentStripeInvoiceCreatingTaskHandlerInterface {
  public static create(): ProcessPaymentStripeInvoiceCreatingTaskHandler {
    return new ProcessPaymentStripeInvoiceCreatingTaskHandler(
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
    body: ProcessPaymentStripeInvoiceCreatingTaskRequestBody,
  ): Promise<ProcessPaymentStripeInvoiceCreatingTaskResponse> {
    loggingPrefix = `${loggingPrefix} Payment Stripe invoice creating task ${body.taskId} with payment ${body.statementId}:`;
    await this.taskHandler.wrap(
      loggingPrefix,
      () => this.claimTask(loggingPrefix, body),
      () => this.processTask(loggingPrefix, body),
    );
    return {};
  }

  public async claimTask(
    loggingPrefix: string,
    body: ProcessPaymentStripeInvoiceCreatingTaskRequestBody,
  ): Promise<void> {
    await this.database.runTransactionAsync(async (transaction) => {
      let rows = await getPaymentStripeInvoiceCreatingTaskMetadata(
        transaction,
        {
          paymentStripeInvoiceCreatingTaskTaskIdEq: body.taskId,
        },
      );
      if (rows.length === 0) {
        throw newBadRequestError(`Task is not found.`);
      }
      let task = rows[0];
      await transaction.batchUpdate([
        updatePaymentStripeInvoiceCreatingTaskMetadataStatement({
          paymentStripeInvoiceCreatingTaskTaskIdEq: body.taskId,
          setRetryCount: task.paymentStripeInvoiceCreatingTaskRetryCount + 1,
          setExecutionTimeMs:
            this.getNow() +
            this.taskHandler.getBackoffTime(
              task.paymentStripeInvoiceCreatingTaskRetryCount,
            ),
        }),
      ]);
      await transaction.commit();
    });
  }

  public async processTask(
    loggingPrefix: string,
    body: ProcessPaymentStripeInvoiceCreatingTaskRequestBody,
  ): Promise<void> {
    console.log(`${loggingPrefix} Processing task...`);
    let [profileRows, statementRows] = await Promise.all([
      getPaymentProfileFromStatement(this.database, {
        transactionStatementStatementIdEq: body.statementId,
      }),
      getTransactionStatement(this.database, {
        transactionStatementStatementIdEq: body.statementId,
      }),
      this.getValidPayment(this.database, body.statementId),
    ]);
    if (profileRows.length === 0) {
      throw newInternalServerErrorError(
        `Payment profile for statement ${body.statementId} is not found.`,
      );
    }
    let profile = profileRows[0];
    if (!profile.paymentProfileStripePaymentCustomerId) {
      throw newInternalServerErrorError(
        `Payment profile for statement ${body.statementId} does not have a Stripe customer.`,
      );
    }
    if (statementRows.length === 0) {
      throw newInternalServerErrorError(
        `Transaction statement ${body.statementId} is not found.`,
      );
    }
    let transactionStatement = statementRows[0];
    if (
      transactionStatement.transactionStatementStatement.totalAmountType !==
      AmountType.DEBIT
    ) {
      throw newInternalServerErrorError(
        `Transaction statement ${body.statementId}'s total amount is not a debit.`,
      );
    }

    let stripeCustomerId = profile.paymentProfileStripePaymentCustomerId;
    let stripeCustomer =
      await this.stripeClient.val.customers.retrieve(stripeCustomerId);
    if (
      !(stripeCustomer as Stripe.Customer).invoice_settings
        ?.default_payment_method
    ) {
      await this.reportFailure(loggingPrefix, body.taskId, body.statementId);
      return;
    }

    let invoice = await this.stripeClient.val.invoices.create(
      {
        customer: stripeCustomerId,
        automatic_tax: {
          enabled: true,
        },
        description: transactionStatement.transactionStatementMonth,
        metadata: {
          [PAYMENT_METADATA_STATEMENT_ID_KEY]: body.statementId,
        },
        currency:
          transactionStatement.transactionStatementStatement.currency.toLowerCase(),
      },
      {
        idempotencyKey: `ci${body.taskId}`,
      },
    );
    await this.stripeClient.val.invoices.addLines(
      invoice.id,
      {
        lines: [
          {
            description: LOCALIZATION.total,
            amount:
              transactionStatement.transactionStatementStatement.totalAmount,
          },
        ],
      },
      {
        idempotencyKey: `al${body.taskId}`,
      },
    );
    await this.stripeClient.val.invoices.finalizeInvoice(
      invoice.id,
      {
        auto_advance: true,
      },
      {
        idempotencyKey: `fi${body.taskId}`,
      },
    );
    await this.finalize(
      loggingPrefix,
      body.taskId,
      body.statementId,
      invoice.id,
    );
  }

  private async reportFailure(
    loggingPrefix: string,
    taskId: string,
    statementId: string,
  ): Promise<void> {
    await this.database.runTransactionAsync(async (transaction) => {
      let [_, suspendingTaskRows] = await Promise.all([
        this.getValidPayment(transaction, statementId),
        getPaymentProfileSuspendingDueToPastDueTask(transaction, {
          paymentProfileSuspendingDueToPastDueTaskStatementIdEq: statementId,
        }),
      ]);
      let now = this.getNow();
      await transaction.batchUpdate([
        updatePaymentStateStatement({
          paymentStatementIdEq: statementId,
          setState: PaymentState.FAILED_WITHOUT_INVOICE,
          setUpdatedTimeMs: now,
        }),
        deletePaymentMethodNeedsUpdateNotifyingTaskStatement({
          paymentMethodNeedsUpdateNotifyingTaskStatementIdEq: statementId,
        }),
        insertPaymentMethodNeedsUpdateNotifyingTaskStatement({
          statementId: statementId,
          retryCount: 0,
          executionTimeMs: now,
          createdTimeMs: now,
        }),
        ...(suspendingTaskRows.length === 0
          ? [
              insertPaymentProfileSuspendingDueToPastDueTaskStatement({
                statementId: statementId,
                retryCount: 0,
                executionTimeMs: now + GRACE_PERIOD_DAYS_IN_MS,
                createdTimeMs: now,
              }),
            ]
          : []),
        deletePaymentStripeInvoiceCreatingTaskStatement({
          paymentStripeInvoiceCreatingTaskTaskIdEq: taskId,
        }),
      ]);
      await transaction.commit();
    });
  }

  private async finalize(
    loggingPrefix: string,
    taskId: string,
    statementId: string,
    invoiceId: string,
  ): Promise<void> {
    await this.database.runTransactionAsync(async (transaction) => {
      await this.getValidPayment(transaction, statementId);
      await transaction.batchUpdate([
        updatePaymentStateAndStripeInvoiceStatement({
          paymentStatementIdEq: statementId,
          setState: PaymentState.WAITING_FOR_INVOICE_PAYMENT,
          setStripeInvoiceId: invoiceId,
          setUpdatedTimeMs: this.getNow(),
        }),
        deletePaymentStripeInvoiceCreatingTaskStatement({
          paymentStripeInvoiceCreatingTaskTaskIdEq: taskId,
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
    if (row.paymentState !== PaymentState.CREATING_STRIPE_INVOICE) {
      throw newBadRequestError(
        `Payment ${statementId} is not in CREATING_STRIPE_INVOICE state.`,
      );
    }
    return row;
  }
}
