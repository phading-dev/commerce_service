import getStream from "get-stream";
import Stripe from "stripe";
import { GRACE_PERIOD_DAYS_IN_MS } from "../../common/constants";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import { STRIPE_CLIENT } from "../../common/stripe_client";
import { PaymentState } from "../../db/schema";
import {
  getPayment,
  getPaymentMethodNeedsUpdateNotifyingTaskMetadata,
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
      let [paymentRows, notifyingTasks] = await Promise.all([
        getPayment(transaction, { paymentStatementIdEq: statementId }),
        getPaymentMethodNeedsUpdateNotifyingTaskMetadata(transaction, {
          paymentMethodNeedsUpdateNotifyingTaskStatementIdEq: statementId,
        }),
      ]);
      if (paymentRows.length === 0) {
        throw newInternalServerErrorError(
          `Payment ${invoice.metadata.statementId} is not found.`,
        );
      }
      let payment = paymentRows[0];
      let now = this.getNow();
      if (payment.paymentState === PaymentState.CHARGING_VIA_STRIPE_INVOICE) {
        await transaction.batchUpdate([
          updatePaymentStateStatement({
            paymentStatementIdEq: statementId,
            setState: PaymentState.FAILED,
            setUpdatedTimeMs: now,
          }),
          insertPaymentMethodNeedsUpdateNotifyingTaskStatement({
            statementId,
            retryCount: 0,
            executionTimeMs: now,
            createdTimeMs: now,
          }),
          insertPaymentProfileSuspendingDueToPastDueTaskStatement({
            statementId,
            retryCount: 0,
            executionTimeMs: now + GRACE_PERIOD_DAYS_IN_MS,
            createdTimeMs: now,
          }),
        ]);
        await transaction.commit();
      } else if (payment.paymentState === PaymentState.FAILED) {
        if (notifyingTasks.length === 0) {
          // This may happen after payment method is updated and payment retried but failed again.
          await transaction.batchUpdate([
            insertPaymentMethodNeedsUpdateNotifyingTaskStatement({
              statementId,
              retryCount: 0,
              executionTimeMs: now,
              createdTimeMs: now,
            }),
          ]);
          await transaction.commit();
        }
      } else {
        throw newConflictError(
          `Payment ${statementId} is in unexpected state: ${PaymentState[payment.paymentState]}`,
        );
      }
    });
    return { received: true };
  }
}
