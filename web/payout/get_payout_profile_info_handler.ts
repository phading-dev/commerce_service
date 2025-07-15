import Stripe from "stripe";
import { SERVICE_CLIENT } from "../../common/service_client";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import { STRIPE_CLIENT } from "../../common/stripe_client";
import { StripeConnectedAccountState } from "../../db/schema";
import { getPayoutProfile } from "../../db/sql";
import { ENV_VARS } from "../../env_vars";
import { Database } from "@google-cloud/spanner";
import { GetPayoutProfileInfoHandlerInterface } from "@phading/commerce_service_interface/web/payout/handler";
import {
  GetPayoutProfileInfoRequestBody,
  GetPayoutProfileInfoResponse,
  LinkType,
} from "@phading/commerce_service_interface/web/payout/interface";
import { newFetchSessionAndCheckCapabilityRequest } from "@phading/user_session_service_interface/node/client";
import { buildUrl } from "@phading/web_interface/url_builder";
import {
  newInternalServerErrorError,
  newUnauthorizedError,
} from "@selfage/http_error";
import { NodeServiceClient } from "@selfage/node_service_client";
import { Ref } from "@selfage/ref";

export class GetPayoutProfileInfoHandler extends GetPayoutProfileInfoHandlerInterface {
  public static create(): GetPayoutProfileInfoHandler {
    return new GetPayoutProfileInfoHandler(
      SPANNER_DATABASE,
      STRIPE_CLIENT,
      SERVICE_CLIENT,
      ENV_VARS.externalOrigin,
    );
  }

  public constructor(
    private database: Database,
    private stripeClient: Ref<Stripe>,
    private serviceClient: NodeServiceClient,
    private externalOrigin: string,
  ) {
    super();
  }

  public async handle(
    loggingPrefix: string,
    body: GetPayoutProfileInfoRequestBody,
    sessionStr: string,
  ): Promise<GetPayoutProfileInfoResponse> {
    let { accountId, capabilities } = await this.serviceClient.send(
      newFetchSessionAndCheckCapabilityRequest({
        signedSession: sessionStr,
        capabilitiesMask: {
          checkCanEarn: true,
        },
      }),
    );
    if (!capabilities.canEarn) {
      throw newUnauthorizedError(
        `Account ${accountId} is not allowed to get payout profile info.`,
      );
    }
    let rows = await getPayoutProfile(this.database, {
      payoutProfileAccountIdEq: accountId,
    });
    if (rows.length === 0) {
      return {
        notAvailable: true,
      };
    }
    let profile = rows[0];
    if (!profile.payoutProfileStripeConnectedAccountId) {
      return {
        notAvailable: true,
      };
    }

    if (
      profile.payoutProfileStripeConnectedAccountState ===
      StripeConnectedAccountState.ONBOARDING
    ) {
      let onboardingLink = await this.stripeClient.val.accountLinks.create({
        account: profile.payoutProfileStripeConnectedAccountId,
        return_url: buildUrl(this.externalOrigin, {
          main: {
            chooseAccount: {
              accountId,
            },
            account: {
              payout: {},
            },
          },
        }),
        refresh_url: buildUrl(this.externalOrigin, {
          main: {
            chooseAccount: {
              accountId,
            },
            account: {
              payout: {},
            },
          },
        }),
        type: "account_onboarding",
      });
      return {
        connectedAccountLinkType: LinkType.ONBOARDING,
        connectedAccountUrl: onboardingLink.url,
      };
    } else if (
      profile.payoutProfileStripeConnectedAccountState ===
      StripeConnectedAccountState.ONBOARDED
    ) {
      let loginLink = await this.stripeClient.val.accounts.createLoginLink(
        profile.payoutProfileStripeConnectedAccountId,
      );
      return {
        connectedAccountLinkType: LinkType.LOGIN,
        connectedAccountUrl: loginLink.url,
      };
    } else {
      throw newInternalServerErrorError(
        `StripeConnectedAccountState ${StripeConnectedAccountState[profile.payoutProfileStripeConnectedAccountState]} is not handled.`,
      );
    }
  }
}
