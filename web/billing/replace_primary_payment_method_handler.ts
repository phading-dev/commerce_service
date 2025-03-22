import Stripe from "stripe";
import { SERVICE_CLIENT } from "../../common/service_client";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import { STRIPE_CLIENT } from "../../common/stripe_client";
import { PaymentState } from "../../db/schema";
import {
  getBillingProfile,
  insertPaymentTaskStatement,
  listPaymentsByState,
  updatePaymentStateStatement,
} from "../../db/sql";
import { Database } from "@google-cloud/spanner";
import { Statement } from "@google-cloud/spanner/build/src/transaction";
import { ReplacePrimaryPaymentMethodHandlerInterface } from "@phading/commerce_service_interface/web/billing/handler";
import {
  ReplacePrimaryPaymentMethodRequestBody,
  ReplacePrimaryPaymentMethodResponse,
} from "@phading/commerce_service_interface/web/billing/interface";
import { newFetchSessionAndCheckCapabilityRequest } from "@phading/user_session_service_interface/node/client";
import { newInternalServerErrorError } from "@selfage/http_error";
import { NodeServiceClient } from "@selfage/node_service_client";
import { Ref } from "@selfage/ref";

export class ReplacePrimaryPaymentMethodHandler extends ReplacePrimaryPaymentMethodHandlerInterface {
  public static create(): ReplacePrimaryPaymentMethodHandler {
    return new ReplacePrimaryPaymentMethodHandler(
      SPANNER_DATABASE,
      STRIPE_CLIENT,
      SERVICE_CLIENT,
      () => Date.now(),
    );
  }

  public constructor(
    private database: Database,
    private stripeClient: Ref<Stripe>,
    private serviceClient: NodeServiceClient,
    private getNow: () => number,
  ) {
    super();
  }

  public async handle(
    loggingPrefix: string,
    body: ReplacePrimaryPaymentMethodRequestBody,
    sessionStr: string,
  ): Promise<ReplacePrimaryPaymentMethodResponse> {
    let { accountId, capabilities } = await this.serviceClient.send(
      newFetchSessionAndCheckCapabilityRequest({
        signedSession: sessionStr,
        capabilitiesMask: {
          checkCanBeBilled: true,
        },
      }),
    );
    if (!capabilities.canBeBilled) {
      throw newInternalServerErrorError(
        `Account ${accountId} cannot replace primary payment method.`,
      );
    }
    let profileRows = await getBillingProfile(this.database, {
      billingProfileAccountIdEq: accountId,
    });
    if (profileRows.length === 0) {
      throw newInternalServerErrorError(
        `Billing account ${accountId} is not found.`,
      );
    }
    let stripeCustomerId = profileRows[0].billingProfileStripePaymentCustomerId;
    let session = await this.stripeClient.val.checkout.sessions.retrieve(
      body.checkoutSessionId,
      {
        expand: ["setup_intent"],
      },
    );
    let paymentMethodId = (session.setup_intent as Stripe.SetupIntent)
      .payment_method as string;

    await this.setPrimaryPaymentMethod(stripeCustomerId, paymentMethodId);
    await this.retryFailedPayments(accountId);
    await this.detachOtherPaymentMethods(stripeCustomerId, paymentMethodId);
    return {};
  }

  private async setPrimaryPaymentMethod(
    stripeCustomerId: string,
    paymentMethodId: string,
  ): Promise<void> {
    await this.stripeClient.val.customers.update(stripeCustomerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });
  }

  private async retryFailedPayments(accountId: string): Promise<void> {
    await this.database.runTransactionAsync(async (transaction) => {
      let paymentRows = await listPaymentsByState(transaction, {
        paymentAccountIdEq: accountId,
        paymentStateEq: PaymentState.FAILED,
      });
      let now = this.getNow();
      let statements = new Array<Statement>();
      for (let payment of paymentRows) {
        statements.push(
          updatePaymentStateStatement({
            paymentStatementIdEq: payment.paymentStatementId,
            setState: PaymentState.PROCESSING,
            setUpdatedTimeMs: now,
          }),
          insertPaymentTaskStatement({
            statementId: payment.paymentStatementId,
            retryCount: 0,
            executionTimeMs: now,
            createdTimeMs: now,
          }),
        );
      }
      if (statements.length > 0) {
        await transaction.batchUpdate(statements);
        await transaction.commit();
      }
    });
  }

  private async detachOtherPaymentMethods(
    stripeCustomerId: string,
    paymentMethodId: string,
  ): Promise<void> {
    let paymentMethods =
      await this.stripeClient.val.customers.listPaymentMethods(
        stripeCustomerId,
      );
    await Promise.all(
      paymentMethods.data
        .filter((paymentMethod) => paymentMethod.id !== paymentMethodId)
        .map((paymentMethod) =>
          this.stripeClient.val.paymentMethods.detach(paymentMethod.id),
        ),
    );
  }
}
