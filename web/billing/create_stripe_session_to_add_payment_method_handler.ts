import Stripe from "stripe";
import { CURRENCY } from "../../common/params";
import { SERVICE_CLIENT } from "../../common/service_client";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import { STRIPE_CLIENT } from "../../common/stripe_client";
import { getBillingAccount } from "../../db/sql";
import { Database } from "@google-cloud/spanner";
import { CreateStripeSessionToAddPaymentMethodHandlerInterface } from "@phading/commerce_service_interface/web/billing/handler";
import {
  CreateStripeSessionToAddPaymentMethodRequestBody,
  CreateStripeSessionToAddPaymentMethodResponse,
} from "@phading/commerce_service_interface/web/billing/interface";
import { exchangeSessionAndCheckCapability } from "@phading/user_session_service_interface/node/client";
import {
  URL_BUILDER,
  UrlBuilder,
  buildMainAppUrl,
  buildReplacePrimaryPaymentMethodUrl,
} from "@phading/web_interface/url_builder";
import { newNotFoundError, newUnauthorizedError } from "@selfage/http_error";
import { NodeServiceClient } from "@selfage/node_service_client";

export class CreateStripeSessionToAddPaymentMethodHandler extends CreateStripeSessionToAddPaymentMethodHandlerInterface {
  public static create(): CreateStripeSessionToAddPaymentMethodHandler {
    return new CreateStripeSessionToAddPaymentMethodHandler(
      SPANNER_DATABASE,
      STRIPE_CLIENT,
      SERVICE_CLIENT,
      URL_BUILDER,
    );
  }

  public constructor(
    private database: Database,
    private stripeClient: Stripe,
    private serviceClient: NodeServiceClient,
    private urlBuilder: UrlBuilder,
  ) {
    super();
  }

  public async handle(
    loggingPrefix: string,
    body: CreateStripeSessionToAddPaymentMethodRequestBody,
    sessionStr: string,
  ): Promise<CreateStripeSessionToAddPaymentMethodResponse> {
    let { accountId, capabilities } = await exchangeSessionAndCheckCapability(
      this.serviceClient,
      {
        signedSession: sessionStr,
        capabilitiesMask: {
          checkCanBeBilled: true,
        },
      },
    );
    if (!capabilities.canBeBilled) {
      throw newUnauthorizedError(
        `Account ${accountId} cannot create stripe session to add payment method.`,
      );
    }
    let rows = await getBillingAccount(this.database, accountId);
    if (rows.length === 0) {
      throw newNotFoundError(`Billing account ${accountId} is not found.`);
    }
    let account = rows[0].billingAccountData;
    let session = await this.stripeClient.checkout.sessions.create({
      billing_address_collection: "required",
      mode: "setup",
      currency: CURRENCY.toLocaleLowerCase(),
      customer: account.stripeCustomerId,
      payment_method_types: ["card"],
      success_url: buildReplacePrimaryPaymentMethodUrl(
        this.urlBuilder,
        {
          accountId,
        },
        "{CHECKOUT_SESSION_ID}",
      ),
      cancel_url: buildMainAppUrl(this.urlBuilder, {
        accountId,
        account: {
          billing: {},
        },
      }),
    });
    return {
      redirectUrl: session.url,
    };
  }
}
