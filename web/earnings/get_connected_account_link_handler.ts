import Stripe from "stripe";
import { SERVICE_CLIENT } from "../../common/service_client";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import { STRIPE_CLIENT } from "../../common/stripe_client";
import { URL_BUILDER } from "../../common/url_builder";
import { StripeConnectedAccountState } from "../../db/schema";
import { getEarningsAccount } from "../../db/sql";
import { Database } from "@google-cloud/spanner";
import { GetConnectedAccountLinkHandlerInterface } from "@phading/commerce_service_interface/web/earnings/handler";
import {
  GetConnectedAccountLinkRequestBody,
  GetConnectedAccountLinkResponse,
  LinkType,
} from "@phading/commerce_service_interface/web/earnings/interface";
import { newExchangeSessionAndCheckCapabilityRequest } from "@phading/user_session_service_interface/node/client";
import { UrlBuilder } from "@phading/web_interface/url_builder";
import {
  newBadRequestError,
  newInternalServerErrorError,
} from "@selfage/http_error";
import { NodeServiceClient } from "@selfage/node_service_client";
import { Ref } from "@selfage/ref";

export class GetConnectedAccountLinkHandler extends GetConnectedAccountLinkHandlerInterface {
  public static create(): GetConnectedAccountLinkHandler {
    return new GetConnectedAccountLinkHandler(
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
    body: GetConnectedAccountLinkRequestBody,
    sessionStr: string,
  ): Promise<GetConnectedAccountLinkResponse> {
    let { accountId, capabilities } = await this.serviceClient.send(
      newExchangeSessionAndCheckCapabilityRequest({
        signedSession: sessionStr,
        capabilitiesMask: {
          checkCanEarn: true,
        },
      }),
    );
    if (!capabilities.canEarn) {
      throw newInternalServerErrorError(
        `Account ${accountId} cannot get connected account link.`,
      );
    }
    let rows = await getEarningsAccount(this.database, accountId);
    if (rows.length === 0) {
      throw newBadRequestError(`Earnings account ${accountId} not found.`);
    }
    let earningsAccount = rows[0].earningsAccountData;
    if (
      earningsAccount.stripeConnectedAccountState ===
      StripeConnectedAccountState.ONBOARDING
    ) {
      let onboardingLink = await this.stripeClient.val.accountLinks.create({
        account: earningsAccount.stripeConnectedAccountId,
        return_url: this.urlBuilder.build({
          setConnectedAccountOnboarded: {
            accountId,
          },
        }),
        refresh_url: this.urlBuilder.build({
          main: {
            accountId,
            account: {
              earnings: {},
            },
          },
        }),
        type: "account_onboarding",
      });
      return {
        type: LinkType.ONBOARDING,
        url: onboardingLink.url,
      };
    } else if (
      earningsAccount.stripeConnectedAccountState ===
      StripeConnectedAccountState.ONBOARDED
    ) {
      let loginLink = await this.stripeClient.val.accounts.createLoginLink(
        earningsAccount.stripeConnectedAccountId,
      );
      return {
        type: LinkType.LOGIN,
        url: loginLink.url,
      };
    } else {
      throw newInternalServerErrorError(
        `StripeConnectedAccountState ${StripeConnectedAccountState[earningsAccount.stripeConnectedAccountState]} is not handled.`,
      );
    }
  }
}
