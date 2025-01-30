import Stripe from "stripe";
import { LOCALIZATION } from "../common/localization";
import { GRACE_PERIOD_DAYS_IN_MS } from "../common/params";
import { SPANNER_DATABASE } from "../common/spanner_database";
import { STRIPE_CLIENT } from "../common/stripe_client";
import { Billing, PaymentState } from "../db/schema";
import {
  deletePaymentTaskStatement,
  getBilling,
  getBillingAccount,
  insertBillingAccountSuspendingDueToPastDueTaskStatement,
  insertUpdatePaymentMethodNotifyingTaskStatement,
  updateBillingStatement,
  updatePaymentTaskStatement,
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

export class ProcessPaymentTaskHandler extends ProcessPaymentTaskHandlerInterface {
  public static create(): ProcessPaymentTaskHandler {
    return new ProcessPaymentTaskHandler(SPANNER_DATABASE, STRIPE_CLIENT, () =>
      Date.now(),
    );
  }

  private static RETRY_BACKOFF_MS = 5 * 60 * 1000;
  public doneCallbackFn = (): void => {};

  public constructor(
    private database: Database,
    private stripeClient: Stripe,
    private getNow: () => number,
  ) {
    super();
  }

  public async handle(
    loggingPrefix: string,
    body: ProcessPaymentTaskRequestBody,
  ): Promise<ProcessPaymentTaskResponse> {
    loggingPrefix = `${loggingPrefix} Payment task for billing ${body.billingId}:`;
    let { billing } = await this.getPayloadAndClaimTask(
      loggingPrefix,
      body.billingId,
    );
    this.startProcessingAndCatchError(loggingPrefix, billing);
    return {};
  }

  private async getPayloadAndClaimTask(
    loggingPrefix: string,
    billingId: string,
  ): Promise<{
    billing: Billing;
  }> {
    let billing: Billing;
    await this.database.runTransactionAsync(async (transaction) => {
      billing = await this.getValidBilling(transaction, billingId);
      let delayedTimeMs =
        this.getNow() + ProcessPaymentTaskHandler.RETRY_BACKOFF_MS;
      console.log(
        `${loggingPrefix} Claiming the task by delaying it to ${delayedTimeMs}.`,
      );
      await transaction.batchUpdate([
        updatePaymentTaskStatement(billingId, delayedTimeMs),
      ]);
      await transaction.commit();
    });
    return {
      billing,
    };
  }

  private async startProcessingAndCatchError(
    loggingPrefix: string,
    billing: Billing,
  ): Promise<void> {
    try {
      await this.startProcessing(loggingPrefix, billing);
      console.log(`${loggingPrefix} Task completed.`);
    } catch (e) {
      console.error(`${loggingPrefix} Task failed! ${e.stack ?? e}`);
    }
    this.doneCallbackFn();
  }

  private async startProcessing(
    loggingPrefix: string,
    billing: Billing,
  ): Promise<void> {
    let accountRows = await getBillingAccount(this.database, billing.accountId);
    if (accountRows.length === 0) {
      throw newInternalServerErrorError(
        `${loggingPrefix} Billing account ${billing.accountId} is not found.`,
      );
    }
    let stripeCustomerId = accountRows[0].billingAccountData.stripeCustomerId;
    let stripeCustomer =
      await this.stripeClient.customers.retrieve(stripeCustomerId);
    if (
      !(stripeCustomer as Stripe.Customer).invoice_settings
        ?.default_payment_method
    ) {
      await this.reportFailure(loggingPrefix, billing.billingId);
      return;
    }

    let invoice = await this.stripeClient.invoices.create(
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
    await this.stripeClient.invoices.addLines(
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
    invoice = await this.stripeClient.invoices.finalizeInvoice(
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
          now,
          now,
        ),
        insertBillingAccountSuspendingDueToPastDueTaskStatement(
          billing.billingId,
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
    transaction: Transaction,
    billingId: string,
  ): Promise<Billing> {
    let rows = await getBilling(transaction, billingId);
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
