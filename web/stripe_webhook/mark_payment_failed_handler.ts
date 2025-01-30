import getStream from "get-stream";
import Stripe from "stripe";
import { STRIPE_PAYMENT_INTENT_FAILED_SECRET_KEY } from "../../common/env_vars";
import { GRACE_PERIOD_DAYS_IN_MS } from "../../common/params";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import { STRIPE_CLIENT } from "../../common/stripe_client";
import { PaymentState } from "../../db/schema";
import {
  checkUpdatePaymentMethodNotifyingTask,
  getBilling,
  insertBillingAccountSuspendingDueToPastDueTaskStatement,
  insertUpdatePaymentMethodNotifyingTaskStatement,
  updateBillingStatement,
} from "../../db/sql";
import { Database } from "@google-cloud/spanner";
import { MarkPaymentDoneHandlerInterface } from "@phading/commerce_service_interface/web/stripe_webhook/handler";
import { EventReceivedResponse } from "@phading/commerce_service_interface/web/stripe_webhook/interface";
import {
  newBadRequestError,
  newConflictError,
  newInternalServerErrorError,
} from "@selfage/http_error";
import { Readable } from "stream";

export class MarkPaymentFailedHandler extends MarkPaymentDoneHandlerInterface {
  public static create(): MarkPaymentFailedHandler {
    return new MarkPaymentFailedHandler(
      SPANNER_DATABASE,
      STRIPE_CLIENT,
      STRIPE_PAYMENT_INTENT_FAILED_SECRET_KEY,
      () => Date.now(),
    );
  }

  public constructor(
    private database: Database,
    private stripeClient: Stripe,
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
    let event = this.stripeClient.webhooks.constructEvent(
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
    let invoice = await this.stripeClient.invoices.retrieve(invoiceId);
    await this.database.runTransactionAsync(async (transaction) => {
      let billingId = invoice.metadata.billingId;
      let [billingRows, notifyingTasks] = await Promise.all([
        getBilling(transaction, billingId),
        checkUpdatePaymentMethodNotifyingTask(transaction, billingId),
      ]);
      if (billingRows.length === 0) {
        throw newInternalServerErrorError(
          `Billing ${invoice.metadata.billingId} is not found.`,
        );
      }
      let billing = billingRows[0].billingData;
      let now = this.getNow();
      if (billing.state === PaymentState.CHARGING) {
        billing.state = PaymentState.FAILED;
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
        ]);
        await transaction.commit();
      } else if (billing.state === PaymentState.FAILED) {
        if (notifyingTasks.length === 0) {
          // This may happen after payment method is updated and payment retried but failed again.
          await transaction.batchUpdate([
            insertUpdatePaymentMethodNotifyingTaskStatement(
              billing.billingId,
              now,
              now,
            ),
          ]);
          await transaction.commit();
        }
      } else {
        throw newConflictError(
          `Billing ${billing.billingId} is in unexpected state: ${PaymentState[billing.state]}`,
        );
      }
    });
    return { received: true };
  }
}
