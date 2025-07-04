import Stripe from "stripe";
import { SERVICE_CLIENT } from "../../common/service_client";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import { STRIPE_CLIENT } from "../../common/stripe_client";
import {
  InitCreditGrantingState,
  PaymentProfileState,
  PaymentState,
} from "../../db/schema";
import { getPaymentProfile, listPaymentsByState } from "../../db/sql";
import { ENV_VARS } from "../../env_vars";
import { Database } from "@google-cloud/spanner";
import { GetPaymentProfileInfoHandlerInterface } from "@phading/commerce_service_interface/web/payment/handler";
import {
  GetPaymentProfileInfoRequestBody,
  GetPaymentProfileInfoResponse,
} from "@phading/commerce_service_interface/web/payment/interface";
import { CARD_BRAND } from "@phading/commerce_service_interface/web/payment/payment_method_masked";
import {
  InitCreditGrantingState as InitCreditGrantingStateResponse,
  PaymentProfileState as PaymentProfileStateResponse,
} from "@phading/commerce_service_interface/web/payment/payment_profile";
import { newFetchSessionAndCheckCapabilityRequest } from "@phading/user_session_service_interface/node/client";
import { newUnauthorizedError } from "@selfage/http_error";
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
    let [
      profileRows,
      failedPaymentRows,
      processingPaymentRows,
      chargingPaymentRows,
    ] = await Promise.all([
      getPaymentProfile(this.database, {
        paymentProfileAccountIdEq: accountId,
      }),
      listPaymentsByState(this.database, {
        paymentAccountIdEq: accountId,
        paymentStateEq: PaymentState.FAILED,
      }),
      listPaymentsByState(this.database, {
        paymentAccountIdEq: accountId,
        paymentStateEq: PaymentState.PROCESSING,
      }),
      listPaymentsByState(this.database, {
        paymentAccountIdEq: accountId,
        paymentStateEq: PaymentState.CHARGING_VIA_STRIPE_INVOICE,
      }),
    ]);
    if (profileRows.length === 0) {
      return {
        notAvailable: true,
      };
    }
    let profile = profileRows[0];
    if (!profile.paymentProfileStripePaymentCustomerId) {
      return {
        notAvailable: true,
      };
    }

    let stripeCustomer = (await this.stripeClient.val.customers.retrieve(
      profile.paymentProfileStripePaymentCustomerId,
      {
        expand: ["invoice_credit_balance"],
      },
    )) as Stripe.Customer;
    let primaryPaymentMethodId = stripeCustomer.invoice_settings
      .default_payment_method as string;
    let paymentMethod: Stripe.Response<Stripe.PaymentMethod>;
    if (primaryPaymentMethodId) {
      paymentMethod =
        await this.stripeClient.val.customers.retrievePaymentMethod(
          profile.paymentProfileStripePaymentCustomerId,
          primaryPaymentMethodId,
        );
    }
    return {
      paymentProfile: {
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
          failedPaymentRows.length > 0,
          processingPaymentRows.length > 0,
          chargingPaymentRows.length > 0,
        ),
        // Stripe stores credit as a negative amount. Return it as a positive amount.
        creditBalanceAmount:
          -1 *
          (stripeCustomer.invoice_credit_balance[
            ENV_VARS.defaultCurrency.toLowerCase()
          ] ?? 0),
        creditBalanceCurrency: ENV_VARS.defaultCurrency,
        initCreditGrantingState: this.getInitCreditGrantingState(
          profile.paymentProfileInitCreditGrantingState,
        ),
      },
    };
  }

  private getState(
    state: PaymentProfileState,
    hasFailedPayment: boolean,
    hasProcessingPayment: boolean,
    hasChargingPayment: boolean,
  ): PaymentProfileStateResponse {
    switch (state) {
      case PaymentProfileState.HEALTHY:
        return hasFailedPayment
          ? PaymentProfileStateResponse.WITH_FAILED_PAYMENTS
          : hasProcessingPayment || hasChargingPayment
            ? PaymentProfileStateResponse.WITH_PROCESSING_PAYMENTS
            : PaymentProfileStateResponse.HEALTHY;
      case PaymentProfileState.SUSPENDED:
        return PaymentProfileStateResponse.SUSPENDED;
    }
  }

  private getInitCreditGrantingState(
    state: InitCreditGrantingState,
  ): InitCreditGrantingStateResponse {
    switch (state) {
      case InitCreditGrantingState.NOT_GRANTED:
        return InitCreditGrantingStateResponse.NOT_GRANTED;
      case InitCreditGrantingState.GRANTING:
        return InitCreditGrantingStateResponse.GRANTING;
      case InitCreditGrantingState.GRANTED:
        return InitCreditGrantingStateResponse.GRANTED;
    }
  }
}
