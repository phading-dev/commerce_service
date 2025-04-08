import "../../local/env";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import { StripeConnectedAccountState } from "../../db/schema";
import {
  deletePayoutProfileStatement,
  insertPayoutProfileStatement,
} from "../../db/sql";
import { GetPayoutProfileInfoHandler } from "./get_payout_profile_info_handler";
import {
  GET_PAYOUT_PROFILE_INFO_RESPONSE,
  LinkType,
} from "@phading/commerce_service_interface/web/payout/interface";
import { FetchSessionAndCheckCapabilityResponse } from "@phading/user_session_service_interface/node/interface";
import { UrlBuilder } from "@phading/web_interface/url_builder";
import { eqMessage } from "@selfage/message/test_matcher";
import { NodeServiceClientMock } from "@selfage/node_service_client/client_mock";
import { Ref } from "@selfage/ref";
import { assertThat, eq } from "@selfage/test_matcher";
import { TEST_RUNNER } from "@selfage/test_runner";

TEST_RUNNER.run({
  name: "GetPayoutProfileInfoHandlerTest",
  cases: [
    {
      name: "OnboardingLink",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertPayoutProfileStatement({
              accountId: "account1",
              stripeConnectedAccountState:
                StripeConnectedAccountState.ONBOARDING,
              stripeConnectedAccountId: "connectedAccount1",
            }),
          ]);
          await transaction.commit();
        });
        let paramsCaptured: any;
        let stripeClientMock: any = {
          accountLinks: {
            create: async (params: any) => {
              paramsCaptured = params;
              return {
                url: "https://stripe.com/onboarding",
              };
            },
          },
        };
        let clientMock = new NodeServiceClientMock();
        clientMock.response = {
          accountId: "account1",
          capabilities: {
            canEarn: true,
          },
        } as FetchSessionAndCheckCapabilityResponse;
        let urlBuilder = new UrlBuilder("https://test.com");
        let handler = new GetPayoutProfileInfoHandler(
          SPANNER_DATABASE,
          new Ref(stripeClientMock),
          clientMock,
          urlBuilder,
        );

        // Execute
        let response = await handler.handle("", {}, "session1");

        // Verify
        assertThat(
          response,
          eqMessage(
            {
              connectedAccountLinkType: LinkType.ONBOARDING,
              connectedAccountUrl: "https://stripe.com/onboarding",
            },
            GET_PAYOUT_PROFILE_INFO_RESPONSE,
          ),
          "response",
        );
        assertThat(
          paramsCaptured.account,
          eq("connectedAccount1"),
          "paramsCaptured.account",
        );
        assertThat(
          paramsCaptured.return_url,
          eq(
            "https://test.com/?e=%7B%223%22%3A%7B%221%22%3A%22account1%22%7D%7D",
          ),
          "paramsCaptured.return_url",
        );
        assertThat(
          paramsCaptured.refresh_url,
          eq(
            "https://test.com/?e=%7B%221%22%3A%7B%221%22%3A%22account1%22%2C%222%22%3A%7B%223%22%3A%7B%7D%7D%7D%7D",
          ),
          "paramsCaptured.refresh_url",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deletePayoutProfileStatement({
              payoutProfileAccountIdEq: "account1",
            }),
          ]);
          await transaction.commit();
        });
      },
    },
    {
      name: "LoginLink",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertPayoutProfileStatement({
              accountId: "account1",
              stripeConnectedAccountState:
                StripeConnectedAccountState.ONBOARDED,
              stripeConnectedAccountId: "connectedAccount1",
            }),
          ]);
          await transaction.commit();
        });
        let stripeConnectedAccountIdCaptured: any;
        let stripeClientMock: any = {
          accounts: {
            createLoginLink: async (stripeConnectedAccountId: any) => {
              stripeConnectedAccountIdCaptured = stripeConnectedAccountId;
              return {
                url: "https://stripe.com/login",
              };
            },
          },
        };
        let clientMock = new NodeServiceClientMock();
        clientMock.response = {
          accountId: "account1",
          capabilities: {
            canEarn: true,
          },
        } as FetchSessionAndCheckCapabilityResponse;
        let urlBuilder = new UrlBuilder("https://test.com");
        let handler = new GetPayoutProfileInfoHandler(
          SPANNER_DATABASE,
          new Ref(stripeClientMock),
          clientMock,
          urlBuilder,
        );

        // Execute
        let response = await handler.handle("", {}, "session1");

        // Verify
        assertThat(
          response,
          eqMessage(
            {
              connectedAccountLinkType: LinkType.LOGIN,
              connectedAccountUrl: "https://stripe.com/login",
            },
            GET_PAYOUT_PROFILE_INFO_RESPONSE,
          ),
          "response",
        );
        assertThat(
          stripeConnectedAccountIdCaptured,
          eq("connectedAccount1"),
          "stripeConnectedAccountIdCaptured",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deletePayoutProfileStatement({
              payoutProfileAccountIdEq: "account1",
            }),
          ]);
          await transaction.commit();
        });
      },
    },
  ],
});
