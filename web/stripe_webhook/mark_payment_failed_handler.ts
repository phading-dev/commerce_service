import getStream from "get-stream";
import Stripe from "stripe";
import { GRACE_PERIOD_DAYS_IN_MS } from "../../common/constants";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import { STRIPE_CLIENT } from "../../common/stripe_client";
import { PaymentState } from "../../db/schema";
import {
  deletePaymentMethodNeedsUpdateNotifyingTaskStatement,
  getPayment,
  getPaymentProfileSuspendingDueToPastDueTask,
  insertPaymentMethodNeedsUpdateNotifyingTaskStatement,
  insertPaymentProfileSuspendingDueToPastDueTaskStatement,
  updatePaymentStateStatement,
} from "../../db/sql";
import { Database } from "@google-cloud/spanner";
import { MarkPaymentFailedHandlerInterface } from "@phading/commerce_service_interface/web/stripe_webhook/handler";
import { EventReceivedResponse } from "@phading/commerce_service_interface/web/stripe_webhook/interface";
import {
  newBadRequestError,
  newConflictError,
  newInternalServerErrorError,
} from "@selfage/http_error";
import { Ref } from "@selfage/ref";
import { Readable } from "stream";

export class MarkPaymentFailedHandler extends MarkPaymentFailedHandlerInterface {
  public static create(
    stripePaymentIntentFailedSecretKey: string,
  ): MarkPaymentFailedHandler {
    return new MarkPaymentFailedHandler(
      SPANNER_DATABASE,
      STRIPE_CLIENT,
      stripePaymentIntentFailedSecretKey,
      () => Date.now(),
    );
  }

  public constructor(
    private database: Database,
    private stripeClient: Ref<Stripe>,
    private stripeSecretKey: string,
    private getNow: () => number,
  ) {
    super();
  }

  public async handle(
    loggingPrefix: string,
    body: Readable,
    sessionStr: string,
  ): Promise<EventReceivedResponse> {
    let event = this.stripeClient.val.webhooks.constructEvent(
      await getStream(body),
      sessionStr,
      this.stripeSecretKey,
    );
    if (event.type !== "payment_intent.payment_failed") {
      throw newBadRequestError(
        `Expecting payment_intent.payment_failed event, but got ${event.type}.`,
      );
    }
    let invoiceId = event.data.object.invoice as string;
    let invoice = await this.stripeClient.val.invoices.retrieve(invoiceId);
    await this.database.runTransactionAsync(async (transaction) => {
      let statementId = invoice.metadata.statementId;
      let [paymentRows, suspendingTaskRows] = await Promise.all([
        getPayment(transaction, { paymentStatementIdEq: statementId }),
        getPaymentProfileSuspendingDueToPastDueTask(transaction, {
          paymentProfileSuspendingDueToPastDueTaskStatementIdEq: statementId,
        }),
      ]);
      if (paymentRows.length === 0) {
        throw newInternalServerErrorError(
          `Payment ${statementId} is not found.`,
        );
      }
      let payment = paymentRows[0];
      if (payment.paymentState !== PaymentState.CHARGING_VIA_STRIPE_INVOICE) {
        throw newConflictError(
          `Payment ${statementId} is not in CHARGING_VIA_STRIPE_INVOICE state.`,
        );
      }
      let now = this.getNow();
      await transaction.batchUpdate([
        updatePaymentStateStatement({
          paymentStatementIdEq: statementId,
          setState: PaymentState.FAILED,
          setUpdatedTimeMs: now,
        }),
        deletePaymentMethodNeedsUpdateNotifyingTaskStatement({
          paymentMethodNeedsUpdateNotifyingTaskStatementIdEq: statementId,
        }),
        insertPaymentMethodNeedsUpdateNotifyingTaskStatement({
          statementId,
          retryCount: 0,
          executionTimeMs: now,
          createdTimeMs: now,
        }),
        ...(suspendingTaskRows.length === 0
          ? [
              insertPaymentProfileSuspendingDueToPastDueTaskStatement({
                statementId,
                retryCount: 0,
                executionTimeMs: now + GRACE_PERIOD_DAYS_IN_MS,
                createdTimeMs: now,
              }),
            ]
          : []),
      ]);
      await transaction.commit();
    });
    return { received: true };
  }
}
