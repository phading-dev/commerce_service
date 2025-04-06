import Stripe from "stripe";
import { SERVICE_CLIENT } from "../../common/service_client";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import { STRIPE_CLIENT } from "../../common/stripe_client";
import { BillingProfileState, PaymentState } from "../../db/schema";
import { getBillingProfile, listPaymentsByState } from "../../db/sql";
import { Database } from "@google-cloud/spanner";
import { BillingProfileState as BillingProfileStateResponse } from "@phading/commerce_service_interface/web/billing/billing_profile_state";
import { GetBillingProfileInfoHandlerInterface } from "@phading/commerce_service_interface/web/billing/handler";
import {
  GetBillingProfileInfoRequestBody,
  GetBillingProfileInfoResponse,
} from "@phading/commerce_service_interface/web/billing/interface";
import { CARD_BRAND } from "@phading/commerce_service_interface/web/billing/payment_method_masked";
import { newFetchSessionAndCheckCapabilityRequest } from "@phading/user_session_service_interface/node/client";
import { newInternalServerErrorError, newUnauthorizedError } from "@selfage/http_error";
import { parseEnum } from "@selfage/message/parser";
import { NodeServiceClient } from "@selfage/node_service_client";
import { Ref } from "@selfage/ref";

export class GetBillingProfileInfoHandler extends GetBillingProfileInfoHandlerInterface {
  public static create(): GetBillingProfileInfoHandler {
    return new GetBillingProfileInfoHandler(
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
    body: GetBillingProfileInfoRequestBody,
    sessionStr: string,
  ): Promise<GetBillingProfileInfoResponse> {
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
        `Account ${accountId} is not allowed to get billing profile info.`,
      );
    }
    let [profileRows, paymentRows] = await Promise.all([
      getBillingProfile(this.database, {
        billingProfileAccountIdEq: accountId,
      }),
      listPaymentsByState(this.database, {
        paymentAccountIdEq: accountId,
        paymentStateEq: PaymentState.FAILED,
      }),
    ]);
    if (profileRows.length === 0) {
      throw newInternalServerErrorError(
        `Billing account ${accountId} is not found.`,
      );
    }
    let profile = profileRows[0];
    if (!profile.billingProfileStripePaymentCustomerId) {
      throw newInternalServerErrorError(
        `Billing account ${accountId} does not have a Stripe customer.`,
      );
    }
    let stripeCustomer = await this.stripeClient.val.customers.retrieve(
      profile.billingProfileStripePaymentCustomerId,
    );
    let primaryPaymentMethodId = (stripeCustomer as Stripe.Customer)
      .invoice_settings.default_payment_method as string;
    let paymentMethod: Stripe.Response<Stripe.PaymentMethod>;
    if (primaryPaymentMethodId) {
      paymentMethod =
        await this.stripeClient.val.customers.retrievePaymentMethod(
          profile.billingProfileStripePaymentCustomerId,
          primaryPaymentMethodId,
        );
    }
    return {
      primaryPaymentMethod: paymentMethod
        ? {
            paymentMethodId: paymentMethod.id,
            card: {
              brand: parseEnum(
                paymentMethod.card.brand.toUpperCase(),
                CARD_BRAND,
              ),
              lastFourDigits: paymentMethod.card.last4,
              expMonth: paymentMethod.card.exp_month,
              expYear: paymentMethod.card.exp_year,
            },
          }
        : undefined,
      state: this.getState(
        profile.billingProfileStateInfo.state,
        paymentRows.length > 0,
      ),
      paymentAfterMs: profile.billingProfilePaymentAfterMs,
    };
  }

  private getState(
    state: BillingProfileState,
    hasFailedPayment: boolean,
  ): BillingProfileStateResponse {
    switch (state) {
      case BillingProfileState.HEALTHY:
        return hasFailedPayment
          ? BillingProfileStateResponse.WITH_FAILED_PAYMENTS
          : BillingProfileStateResponse.HEALTHY;
      case BillingProfileState.SUSPENDED:
        return BillingProfileStateResponse.SUSPENDED;
    }
  }
}
