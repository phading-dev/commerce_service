import getStream from "get-stream";
import Stripe from "stripe";
import {
  GRACE_PERIOD_DAYS_IN_MS,
  PAYMENT_METADATA_STATEMENT_ID_KEY,
} from "../../common/constants";
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
import { Empty } from "@phading/commerce_service_interface/web/stripe_webhook/interface";
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
      () => Date.now(),
      stripePaymentIntentFailedSecretKey,
    );
  }

  public constructor(
    private database: Database,
    private stripeClient: Ref<Stripe>,
    private getNow: () => number,
    private stripeSecretKey: string,
  ) {
    super();
  }

  public async handle(
    loggingPrefix: string,
    body: Readable,
    sessionStr: string,
  ): Promise<Empty> {
    let event = this.stripeClient.val.webhooks.constructEvent(
      await getStream(body),
      sessionStr,
      this.stripeSecretKey,
    );
    if (event.type !== "invoice.payment_failed") {
      throw newBadRequestError(
        `Expecting invoice.payment_failed event, but got ${event.type}.`,
      );
    }
    let invoice = event.data.object;
    await this.database.runTransactionAsync(async (transaction) => {
      let statementId = invoice.metadata[PAYMENT_METADATA_STATEMENT_ID_KEY];
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
      if (payment.paymentState !== PaymentState.WAITING_FOR_INVOICE_PAYMENT) {
        throw newConflictError(
          `Payment ${statementId} is not in WAITING_FOR_INVOICE_PAYMENT state.`,
        );
      }
      let now = this.getNow();
      await transaction.batchUpdate([
        updatePaymentStateStatement({
          paymentStatementIdEq: statementId,
          setState: PaymentState.FAILED_WITH_INVOICE,
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
    return {};
  }
}
