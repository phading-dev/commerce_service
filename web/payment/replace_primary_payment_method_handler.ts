import Stripe from "stripe";
import { SERVICE_CLIENT } from "../../common/service_client";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import { STRIPE_CLIENT } from "../../common/stripe_client";
import { getPaymentProfile } from "../../db/sql";
import { Database } from "@google-cloud/spanner";
import { ReplacePrimaryPaymentMethodHandlerInterface } from "@phading/commerce_service_interface/web/payment/handler";
import {
  ReplacePrimaryPaymentMethodRequestBody,
  ReplacePrimaryPaymentMethodResponse,
} from "@phading/commerce_service_interface/web/payment/interface";
import { newFetchSessionAndCheckCapabilityRequest } from "@phading/user_session_service_interface/node/client";
import {
  newInternalServerErrorError,
  newNotFoundError,
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

  public detachedCallbackFn = () => {};

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
    let profileRows = await getPaymentProfile(this.database, {
      paymentProfileAccountIdEq: accountId,
    });
    if (profileRows.length === 0) {
      throw newNotFoundError(
        `Payment account ${accountId} is not found.`,
      );
    }
    let profile = profileRows[0];
    if (!profile.paymentProfileStripePaymentCustomerId) {
      throw newInternalServerErrorError(
        `Payment account ${accountId} does not have a Stripe customer.`,
      );
    }
    let stripeCustomerId = profile.paymentProfileStripePaymentCustomerId;
    let [session, customer] = await Promise.all([
      this.stripeClient.val.checkout.sessions.retrieve(body.checkoutSessionId, {
        expand: ["setup_intent"],
      }),
      this.stripeClient.val.customers.retrieve(stripeCustomerId),
    ]);
    let newPaymentMethodId = (session.setup_intent as Stripe.SetupIntent)
      .payment_method as string;
    let prevDefaultPaymentMethodId = (customer as Stripe.Customer)
      .invoice_settings?.default_payment_method as string;
    if (prevDefaultPaymentMethodId === newPaymentMethodId) {
      // Already updated.
      return {};
    }

    await this.stripeClient.val.customers.update(stripeCustomerId, {
      invoice_settings: {
        default_payment_method: newPaymentMethodId,
      },
    });
    // Best effort.
    this.detachPaymentMethod(loggingPrefix, prevDefaultPaymentMethodId);
    return {};
  }

  private async detachPaymentMethod(
    loggingPrefix: string,
    paymentMethodId?: string,
  ): Promise<void> {
    if (!paymentMethodId) {
      return;
    }
    try {
      await this.stripeClient.val.paymentMethods.detach(paymentMethodId);
    } catch (error) {
      console.error(
        `${loggingPrefix} Failed to detach payment method ${paymentMethodId}:`,
        error,
      );
    }
    this.detachedCallbackFn();
  }
}
