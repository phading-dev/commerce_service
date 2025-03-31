import Stripe from "stripe";
import { SERVICE_CLIENT } from "../../common/service_client";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import { STRIPE_CLIENT } from "../../common/stripe_client";
import { URL_BUILDER } from "../../common/url_builder";
import { getBillingProfile } from "../../db/sql";
import { ENV_VARS } from "../../env_vars";
import { Database } from "@google-cloud/spanner";
import { CreateStripeSessionToAddPaymentMethodHandlerInterface } from "@phading/commerce_service_interface/web/billing/handler";
import {
  CreateStripeSessionToAddPaymentMethodRequestBody,
  CreateStripeSessionToAddPaymentMethodResponse,
} from "@phading/commerce_service_interface/web/billing/interface";
import { newFetchSessionAndCheckCapabilityRequest } from "@phading/user_session_service_interface/node/client";
import { UrlBuilder } from "@phading/web_interface/url_builder";
import { newNotFoundError, newUnauthorizedError } from "@selfage/http_error";
import { NodeServiceClient } from "@selfage/node_service_client";
import { Ref } from "@selfage/ref";

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
    private stripeClient: Ref<Stripe>,
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
        `Account ${accountId} cannot create stripe session to add payment method.`,
      );
    }
    let rows = await getBillingProfile(this.database, {
      billingProfileAccountIdEq: accountId,
    });
    if (rows.length === 0) {
      throw newNotFoundError(`Billing account ${accountId} is not found.`);
    }
    let row = rows[0];
    let session = await this.stripeClient.val.checkout.sessions.create({
      billing_address_collection: "required",
      mode: "setup",
      currency: ENV_VARS.defaultCurrency.toLocaleLowerCase(),
      customer: row.billingProfileStripePaymentCustomerId,
      payment_method_types: ["card"],
      success_url: this.urlBuilder.build(
        {
          replacePrimaryPaymnetMethod: {
            accountId,
          },
        },
        [["session_id", "{CHECKOUT_SESSION_ID}"]],
      ),
      cancel_url: this.urlBuilder.build({
        main: {
          accountId,
          account: {
            billing: {},
          },
        },
      }),
    });
    return {
      redirectUrl: session.url,
    };
  }
}
