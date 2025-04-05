import Stripe from "stripe";
import { SERVICE_CLIENT } from "../../common/service_client";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import { STRIPE_CLIENT } from "../../common/stripe_client";
import { getBillingProfile } from "../../db/sql";
import { Database } from "@google-cloud/spanner";
import { ReplacePrimaryPaymentMethodHandlerInterface } from "@phading/commerce_service_interface/web/billing/handler";
import {
  ReplacePrimaryPaymentMethodRequestBody,
  ReplacePrimaryPaymentMethodResponse,
} from "@phading/commerce_service_interface/web/billing/interface";
import { newFetchSessionAndCheckCapabilityRequest } from "@phading/user_session_service_interface/node/client";
import {
  newInternalServerErrorError,
  newUnauthorizedError,
} from "@selfage/http_error";
import { NodeServiceClient } from "@selfage/node_service_client";
import { Ref } from "@selfage/ref";

export class ReplacePrimaryPaymentMethodHandler extends ReplacePrimaryPaymentMethodHandlerInterface {
  public static create(): ReplacePrimaryPaymentMethodHandler {
    return new ReplacePrimaryPaymentMethodHandler(
      SPANNER_DATABASE,
      STRIPE_CLIENT,
      SERVICE_CLIENT,
    );
  }

  public constructor(
    private database: Database,
    private stripeClient: Ref<Stripe>,
    private serviceClient: NodeServiceClient,
  ) {
    super();
  }

  public async handle(
    loggingPrefix: string,
    body: ReplacePrimaryPaymentMethodRequestBody,
    sessionStr: string,
  ): Promise<ReplacePrimaryPaymentMethodResponse> {
    if (!body.checkoutSessionId) {
      throw newInternalServerErrorError(`"checkoutSessionId" is required.`);
    }
    let { accountId, capabilities } = await this.serviceClient.send(
      newFetchSessionAndCheckCapabilityRequest({
        signedSession: sessionStr,
        capabilitiesMask: {
          checkCanBeBilled: true,
        },
      }),
    );
    if (!capabilities.canBeBilled) {
      throw newUnauthorizedError(
        `Account ${accountId} is not allowed to replace primary payment method.`,
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
