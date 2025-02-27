import Stripe from "stripe";
import { SERVICE_CLIENT } from "../../common/service_client";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import { STRIPE_CLIENT } from "../../common/stripe_client";
import { getBillingAccount } from "../../db/sql";
import { Database } from "@google-cloud/spanner";
import { GetPrimaryPaymentMethodHandlerInterface } from "@phading/commerce_service_interface/web/billing/handler";
import {
  GetPrimaryPaymentMethodRequestBody,
  GetPrimaryPaymentMethodResponse,
} from "@phading/commerce_service_interface/web/billing/interface";
import { CARD_BRAND } from "@phading/commerce_service_interface/web/billing/payment_method_masked";
import { newExchangeSessionAndCheckCapabilityRequest } from "@phading/user_session_service_interface/node/client";
import { newInternalServerErrorError } from "@selfage/http_error";
import { parseEnum } from "@selfage/message/parser";
import { NodeServiceClient } from "@selfage/node_service_client";
import { Ref } from "@selfage/ref";

export class GetPrimaryPaymentMethodHandler extends GetPrimaryPaymentMethodHandlerInterface {
  public static create(): GetPrimaryPaymentMethodHandler {
    return new GetPrimaryPaymentMethodHandler(
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
    body: GetPrimaryPaymentMethodRequestBody,
    sessionStr: string,
  ): Promise<GetPrimaryPaymentMethodResponse> {
    let { accountId, capabilities } = await this.serviceClient.send(
      newExchangeSessionAndCheckCapabilityRequest({
        signedSession: sessionStr,
        capabilitiesMask: {
          checkCanBeBilled: true,
        },
      }),
    );
    if (!capabilities.canBeBilled) {
      throw newInternalServerErrorError(
        `Account ${accountId} cannot get primary payment method.`,
      );
    }
    let rows = await getBillingAccount(this.database, accountId);
    if (rows.length === 0) {
      throw newInternalServerErrorError(
        `Billing account ${accountId} is not found.`,
      );
    }
    let account = rows[0].billingAccountData;

    let stripeCustomer = await this.stripeClient.val.customers.retrieve(
      account.stripeCustomerId,
    );
    let primaryPaymentMethodId = (stripeCustomer as Stripe.Customer)
      .invoice_settings.default_payment_method as string;
    // If not found, an error is thrown.
    let paymentMethod =
      await this.stripeClient.val.customers.retrievePaymentMethod(
        account.stripeCustomerId,
        primaryPaymentMethodId,
      );
    return {
      paymentMethod: {
        paymentMethodId: paymentMethod.id,
        card: {
          brand: parseEnum(paymentMethod.card.brand.toUpperCase(), CARD_BRAND),
          lastFourDigits: paymentMethod.card.last4,
          expMonth: paymentMethod.card.exp_month,
          expYear: paymentMethod.card.exp_year,
        },
      },
    };
  }
}
