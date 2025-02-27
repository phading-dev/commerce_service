import getStream from "get-stream";
import Stripe from "stripe";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import { STRIPE_CLIENT } from "../../common/stripe_client";
import { PaymentState } from "../../db/schema";
import {
  deleteBillingAccountSuspendingDueToPastDueTaskStatement,
  getBilling,
  updateBillingStatement,
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
    );
  }

  public constructor(
    private database: Database,
    private stripeClient: Ref<Stripe>,
    private stripeSecretKey: string,
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
      let billingRows = await getBilling(
        transaction,
        invoice.metadata.billingId,
      );
      if (billingRows.length === 0) {
        throw newInternalServerErrorError(
          `Billing ${invoice.metadata.billingId} is not found.`,
        );
      }
      let billing = billingRows[0].billingData;
      billing.state = PaymentState.PAID;
      await transaction.batchUpdate([
        updateBillingStatement(billing),
        deleteBillingAccountSuspendingDueToPastDueTaskStatement(
          billing.billingId,
        ),
      ]);
      await transaction.commit();
    });
    return { received: true };
  }
}
