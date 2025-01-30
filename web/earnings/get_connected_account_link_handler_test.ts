// Get ONBOARDING link.
// Get LOGIN link.
import { SPANNER_DATABASE } from "../../common/spanner_database";
import { StripeConnectedAccountState } from "../../db/schema";
import {
  deleteEarningsAccountStatement,
  insertEarningsAccountStatement,
} from "../../db/sql";
import { GetConnectedAccountLinkHandler } from "./get_connected_account_link_handler";
import {
  GET_CONNECTED_ACCOUNT_LINK_RESPONSE,
  LinkType,
} from "@phading/commerce_service_interface/web/earnings/interface";
import { ExchangeSessionAndCheckCapabilityResponse } from "@phading/user_session_service_interface/node/interface";
import { UrlBuilder } from "@phading/web_interface/url_builder";
import { eqMessage } from "@selfage/message/test_matcher";
import { NodeServiceClientMock } from "@selfage/node_service_client/client_mock";
import { assertThat, eq } from "@selfage/test_matcher";
import { TEST_RUNNER } from "@selfage/test_runner";

TEST_RUNNER.run({
  name: "GetConnectedAccountLinkHandlerTest",
  cases: [
    {
      name: "OnboardingLink",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertEarningsAccountStatement({
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
        } as ExchangeSessionAndCheckCapabilityResponse;
        let urlBuilder = new UrlBuilder("https://test.com");
        let handler = new GetConnectedAccountLinkHandler(
          SPANNER_DATABASE,
          stripeClientMock,
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
              type: LinkType.ONBOARDING,
              url: "https://stripe.com/onboarding",
            },
            GET_CONNECTED_ACCOUNT_LINK_RESPONSE,
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
            "https://test.com/set_connected_account_onboarded?e=%7B%22accountId%22%3A%22account1%22%7D",
          ),
          "paramsCaptured.return_url",
        );
        assertThat(
          paramsCaptured.refresh_url,
          eq("https://test.com/?e=%7B%22accountId%22%3A%22account1%22%2C%22account%22%3A%7B%22earnings%22%3A%7B%7D%7D%7D"),
          "paramsCaptured.refresh_url",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deleteEarningsAccountStatement("account1"),
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
            insertEarningsAccountStatement({
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
        } as ExchangeSessionAndCheckCapabilityResponse;
        let urlBuilder = new UrlBuilder("https://test.com");
        let handler = new GetConnectedAccountLinkHandler(
          SPANNER_DATABASE,
          stripeClientMock,
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
              type: LinkType.LOGIN,
              url: "https://stripe.com/login",
            },
            GET_CONNECTED_ACCOUNT_LINK_RESPONSE,
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
            deleteEarningsAccountStatement("account1"),
          ]);
          await transaction.commit();
        });
      },
    },
  ],
});
