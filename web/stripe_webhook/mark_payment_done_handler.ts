import getStream from "get-stream";
import Stripe from "stripe";
import { PAYMENT_METADATA_STATEMENT_ID_KEY } from "../../common/constants";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import { STRIPE_CLIENT } from "../../common/stripe_client";
import { PaymentState } from "../../db/schema";
import {
  deletePaymentMethodNeedsUpdateNotifyingTaskStatement,
  deletePaymentProfileSuspendingDueToPastDueTaskStatement,
  deletePaymentStripeInvoiceCreatingTaskByStatementStatement,
  deletePaymentStripeInvoicePayingTaskByStatementStatement,
  updatePaymentStateStatement,
} from "../../db/sql";
import { Database } from "@google-cloud/spanner";
import { MarkPaymentDoneHandlerInterface } from "@phading/commerce_service_interface/web/stripe_webhook/handler";
import { Empty } from "@phading/web_interface/empty";
import { newBadRequestError } from "@selfage/http_error";
import { Ref } from "@selfage/ref";
import { Readable } from "stream";

export class MarkPaymentDoneHandler extends MarkPaymentDoneHandlerInterface {
  public static create(
    stripeMarkPaymentDoneSecretKey: string,
  ): MarkPaymentDoneHandler {
    return new MarkPaymentDoneHandler(
      SPANNER_DATABASE,
      STRIPE_CLIENT,
      () => Date.now(),
      stripeMarkPaymentDoneSecretKey,
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
    if (event.type !== "invoice.paid") {
      throw newBadRequestError(
        `Expecting invoice.paid event, but got ${event.type}.`,
      );
    }
    let invoice = event.data.object;
    await this.database.runTransactionAsync(async (transaction) => {
      let statementId = invoice.metadata[PAYMENT_METADATA_STATEMENT_ID_KEY];
      await transaction.batchUpdate([
        updatePaymentStateStatement({
          paymentStatementIdEq: statementId,
          setState: PaymentState.PAID,
          setUpdatedTimeMs: this.getNow(),
        }),
        deletePaymentStripeInvoiceCreatingTaskByStatementStatement({
          paymentStripeInvoiceCreatingTaskStatementIdEq: statementId,
        }),
        deletePaymentStripeInvoicePayingTaskByStatementStatement({
          paymentStripeInvoicePayingTaskStatementIdEq: statementId,
        }),
        deletePaymentProfileSuspendingDueToPastDueTaskStatement({
          paymentProfileSuspendingDueToPastDueTaskStatementIdEq: statementId,
        }),
        deletePaymentMethodNeedsUpdateNotifyingTaskStatement({
          paymentMethodNeedsUpdateNotifyingTaskStatementIdEq: statementId,
        }),
      ]);
      await transaction.commit();
    });
    return {};
  }
}
