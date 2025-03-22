import getStream from "get-stream";
import Stripe from "stripe";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import { STRIPE_CLIENT } from "../../common/stripe_client";
import { PaymentState } from "../../db/schema";
import {
  deleteBillingProfileSuspendingDueToPastDueTaskStatement,
  deletePaymentMethodNeedsUpdateNotifyingTaskStatement,
  getPayment,
  updatePaymentStateStatement,
} from "../../db/sql";
import { Database } from "@google-cloud/spanner";
import { MarkPaymentDoneHandlerInterface } from "@phading/commerce_service_interface/web/stripe_webhook/handler";
import { EventReceivedResponse } from "@phading/commerce_service_interface/web/stripe_webhook/interface";
import {
  newBadRequestError,
  newInternalServerErrorError,
} from "@selfage/http_error";
import { Ref } from "@selfage/ref";
import { Readable } from "stream";

export class MarkPaymentDoneHandler extends MarkPaymentDoneHandlerInterface {
  public static create(
    stripePaymentIntentSuccessSecretKey: string,
  ): MarkPaymentDoneHandler {
    return new MarkPaymentDoneHandler(
      SPANNER_DATABASE,
      STRIPE_CLIENT,
      stripePaymentIntentSuccessSecretKey,
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
    if (event.type !== "payment_intent.succeeded") {
      throw newBadRequestError(
        `Expecting payment_intent.succeeded event, but got ${event.type}.`,
      );
    }
    let invoiceId = event.data.object.invoice as string;
    let invoice = await this.stripeClient.val.invoices.retrieve(invoiceId);
    await this.database.runTransactionAsync(async (transaction) => {
      let statementId = invoice.metadata.statementId;
      let rows = await getPayment(transaction, {
        paymentStatementIdEq: statementId,
      });
      if (rows.length === 0) {
        throw newInternalServerErrorError(
          `Payment ${statementId} is not found.`,
        );
      }
      let row = rows[0];
      if (row.paymentState !== PaymentState.CHARGING_VIA_STRIPE_INVOICE) {
        console.warn(
          `${loggingPrefix} Payment ${statementId} is in CHARGING state but in ${PaymentState[row.paymentState]} and yet completed.`,
        );
      }
      await transaction.batchUpdate([
        updatePaymentStateStatement({
          paymentStatementIdEq: statementId,
          setState: PaymentState.PAID,
          setUpdatedTimeMs: this.getNow(),
        }),
        deleteBillingProfileSuspendingDueToPastDueTaskStatement({
          billingProfileSuspendingDueToPastDueTaskStatementIdEq: statementId,
        }),
        deletePaymentMethodNeedsUpdateNotifyingTaskStatement({
          paymentMethodNeedsUpdateNotifyingTaskStatementIdEq: statementId,
        }),
      ]);
      await transaction.commit();
    });
    return { received: true };
  }
}
