import Stripe from "stripe";
import { GRACE_PERIOD_DAYS_IN_MS } from "../common/constants";
import { LOCALIZATION } from "../common/localization";
import { SPANNER_DATABASE } from "../common/spanner_database";
import { STRIPE_CLIENT } from "../common/stripe_client";
import { Billing, PaymentState } from "../db/schema";
import {
  deletePaymentTaskStatement,
  getBilling,
  getBillingAccountFromBilling,
  getPaymentTaskMetadata,
  insertBillingAccountSuspendingDueToPastDueTaskStatement,
  insertUpdatePaymentMethodNotifyingTaskStatement,
  updateBillingStatement,
  updatePaymentTaskMetadataStatement,
} from "../db/sql";
import { Database, Transaction } from "@google-cloud/spanner";
import { ProcessPaymentTaskHandlerInterface } from "@phading/commerce_service_interface/node/handler";
import {
  ProcessPaymentTaskRequestBody,
  ProcessPaymentTaskResponse,
} from "@phading/commerce_service_interface/node/interface";
import {
  newBadRequestError,
  newInternalServerErrorError,
} from "@selfage/http_error";
import { Ref } from "@selfage/ref";
import { ProcessTaskHandlerWrapper } from "@selfage/service_handler/process_task_handler_wrapper";

export class ProcessPaymentTaskHandler extends ProcessPaymentTaskHandlerInterface {
  public static create(): ProcessPaymentTaskHandler {
    return new ProcessPaymentTaskHandler(SPANNER_DATABASE, STRIPE_CLIENT, () =>
      Date.now(),
    );
  }

  private taskHandler: ProcessTaskHandlerWrapper;

  public constructor(
    private database: Database,
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
    body: ProcessPaymentTaskRequestBody,
  ): Promise<ProcessPaymentTaskResponse> {
    loggingPrefix = `${loggingPrefix} Payment task for billing ${body.billingId}:`;
    await this.taskHandler.wrap(
      loggingPrefix,
      () => this.claimTask(loggingPrefix, body),
      () => this.processTask(loggingPrefix, body),
    );
    return {};
  }

  public async claimTask(
    loggingPrefix: string,
    body: ProcessPaymentTaskRequestBody,
  ): Promise<void> {
    await this.database.runTransactionAsync(async (transaction) => {
      let rows = await getPaymentTaskMetadata(transaction, body.billingId);
      if (rows.length === 0) {
        throw newBadRequestError(`Task is not found.`);
      }
      let task = rows[0];
      await transaction.batchUpdate([
        updatePaymentTaskMetadataStatement(
          body.billingId,
          task.paymentTaskRetryCount + 1,
          this.getNow() +
            this.taskHandler.getBackoffTime(task.paymentTaskRetryCount),
        ),
      ]);
      await transaction.commit();
    });
  }

  public async processTask(
    loggingPrefix: string,
    body: ProcessPaymentTaskRequestBody,
  ): Promise<void> {
    let [billing, accountRows] = await Promise.all([
      this.getValidBilling(this.database, body.billingId),
      getBillingAccountFromBilling(this.database, body.billingId),
    ]);
    if (accountRows.length === 0) {
      throw newInternalServerErrorError(
        `${loggingPrefix} Billing account for billing ${body.billingId} is not found.`,
      );
    }
    let stripeCustomerId = accountRows[0].aData.stripeCustomerId;
    let stripeCustomer =
      await this.stripeClient.val.customers.retrieve(stripeCustomerId);
    if (
      !(stripeCustomer as Stripe.Customer).invoice_settings
        ?.default_payment_method
    ) {
      await this.reportFailure(loggingPrefix, billing.billingId);
      return;
    }

    let invoice = await this.stripeClient.val.invoices.create(
      {
        customer: stripeCustomerId,
        automatic_tax: {
          enabled: true,
        },
        description: billing.month,
        metadata: {
          billingId: billing.billingId,
        },
        currency: billing.currency.toLowerCase(),
      },
      {
        idempotencyKey: billing.billingId,
      },
    );
    await this.stripeClient.val.invoices.addLines(
      invoice.id,
      {
        lines: [
          {
            description: LOCALIZATION.totalUsage,
            amount: billing.totalAmount,
          },
        ],
      },
      {
        idempotencyKey: billing.billingId,
      },
    );
    invoice = await this.stripeClient.val.invoices.finalizeInvoice(
      invoice.id,
      {
        auto_advance: true,
      },
      {
        idempotencyKey: billing.billingId,
      },
    );
    await this.finalize(
      loggingPrefix,
      billing.billingId,
      invoice.id,
      invoice.hosted_invoice_url,
    );
  }

  private async reportFailure(
    loggingPrefix: string,
    billingId: string,
  ): Promise<void> {
    await this.database.runTransactionAsync(async (transaction) => {
      let billing = await this.getValidBilling(transaction, billingId);
      billing.state = PaymentState.FAILED;
      let now = this.getNow();
      await transaction.batchUpdate([
        updateBillingStatement(billing),
        insertUpdatePaymentMethodNotifyingTaskStatement(
          billing.billingId,
          0,
          now,
          now,
        ),
        insertBillingAccountSuspendingDueToPastDueTaskStatement(
          billing.billingId,
          0,
          now + GRACE_PERIOD_DAYS_IN_MS,
          now,
        ),
        deletePaymentTaskStatement(billingId),
      ]);
      await transaction.commit();
    });
  }

  private async finalize(
    loggingPrefix: string,
    billingId: string,
    invoiceId: string,
    invoiceUrl: string,
  ): Promise<void> {
    await this.database.runTransactionAsync(async (transaction) => {
      let billing = await this.getValidBilling(transaction, billingId);
      billing.state = PaymentState.CHARGING;
      billing.stripeInvoiceId = invoiceId;
      billing.stripeInvoiceUrl = invoiceUrl;
      await transaction.batchUpdate([
        updateBillingStatement(billing),
        deletePaymentTaskStatement(billingId),
      ]);
      await transaction.commit();
    });
  }

  private async getValidBilling(
    runner: Database | Transaction,
    billingId: string,
  ): Promise<Billing> {
    let rows = await getBilling(runner, billingId);
    if (rows.length === 0) {
      // Billing should almost never be deleted, or should be drained by a long lead time.
      throw newInternalServerErrorError(`Billing ${billingId} is not found.`);
    }
    let billing = rows[0].billingData;
    if (billing.state !== PaymentState.PROCESSING) {
      throw newBadRequestError(
        `Billing ${billingId} is not in PROCESSING state.`,
      );
    }
    return billing;
  }
}
