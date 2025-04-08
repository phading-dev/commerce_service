import Stripe from "stripe";
import { SERVICE_CLIENT } from "../../common/service_client";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import { STRIPE_CLIENT } from "../../common/stripe_client";
import { PaymentProfileState, PaymentState } from "../../db/schema";
import { getPaymentProfile, listPaymentsByState } from "../../db/sql";
import { Database } from "@google-cloud/spanner";
import { GetPaymentProfileInfoHandlerInterface } from "@phading/commerce_service_interface/web/payment/handler";
import {
  GetPaymentProfileInfoRequestBody,
  GetPaymentProfileInfoResponse,
} from "@phading/commerce_service_interface/web/payment/interface";
import { CARD_BRAND } from "@phading/commerce_service_interface/web/payment/payment_method_masked";
import { PaymentProfileState as PaymentProfileStateResponse } from "@phading/commerce_service_interface/web/payment/payment_profile_state";
import { newFetchSessionAndCheckCapabilityRequest } from "@phading/user_session_service_interface/node/client";
import {
  newInternalServerErrorError,
  newUnauthorizedError,
} from "@selfage/http_error";
import { parseEnum } from "@selfage/message/parser";
import { NodeServiceClient } from "@selfage/node_service_client";
import { Ref } from "@selfage/ref";

export class GetPaymentProfileInfoHandler extends GetPaymentProfileInfoHandlerInterface {
  public static create(): GetPaymentProfileInfoHandler {
    return new GetPaymentProfileInfoHandler(
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
    body: GetPaymentProfileInfoRequestBody,
    sessionStr: string,
  ): Promise<GetPaymentProfileInfoResponse> {
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
        `Account ${accountId} is not allowed to get payment profile info.`,
      );
    }
    let [profileRows, paymentRows] = await Promise.all([
      getPaymentProfile(this.database, {
        paymentProfileAccountIdEq: accountId,
      }),
      listPaymentsByState(this.database, {
        paymentAccountIdEq: accountId,
        paymentStateEq: PaymentState.FAILED,
      }),
    ]);
    if (profileRows.length === 0) {
      throw newInternalServerErrorError(
        `Payment account ${accountId} is not found.`,
      );
    }
    let profile = profileRows[0];
    if (!profile.paymentProfileStripePaymentCustomerId) {
      throw newInternalServerErrorError(
        `Payment account ${accountId} does not have a Stripe customer.`,
      );
    }
    let stripeCustomer = await this.stripeClient.val.customers.retrieve(
      profile.paymentProfileStripePaymentCustomerId,
    );
    let primaryPaymentMethodId = (stripeCustomer as Stripe.Customer)
      .invoice_settings.default_payment_method as string;
    let paymentMethod: Stripe.Response<Stripe.PaymentMethod>;
    if (primaryPaymentMethodId) {
      paymentMethod =
        await this.stripeClient.val.customers.retrievePaymentMethod(
          profile.paymentProfileStripePaymentCustomerId,
          primaryPaymentMethodId,
        );
    }
    return {
      primaryPaymentMethod: paymentMethod
        ? {
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
        profile.paymentProfileStateInfo.state,
        paymentRows.length > 0,
      ),
      paymentAfterMs: profile.paymentProfilePaymentAfterMs,
    };
  }

  private getState(
    state: PaymentProfileState,
    hasFailedPayment: boolean,
  ): PaymentProfileStateResponse {
    switch (state) {
      case PaymentProfileState.HEALTHY:
        return hasFailedPayment
          ? PaymentProfileStateResponse.WITH_FAILED_PAYMENTS
          : PaymentProfileStateResponse.HEALTHY;
      case PaymentProfileState.SUSPENDED:
        return PaymentProfileStateResponse.SUSPENDED;
    }
  }
}
