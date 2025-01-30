import { SPANNER_DATABASE } from "../../common/spanner_database";
import {
  deleteBillingAccountStatement,
  insertBillingAccountStatement,
} from "../../db/sql";
import { CreateStripeSessionToAddPaymentMethodHandler } from "./create_stripe_session_to_add_payment_method_handler";
import { CREATE_STRIPE_SESSION_TO_ADD_PAYMENT_METHOD_RESPONSE } from "@phading/commerce_service_interface/web/billing/interface";
import { ExchangeSessionAndCheckCapabilityResponse } from "@phading/user_session_service_interface/node/interface";
import { UrlBuilder } from "@phading/web_interface/url_builder";
import { eqMessage } from "@selfage/message/test_matcher";
import { NodeServiceClientMock } from "@selfage/node_service_client/client_mock";
import { assertThat, eq } from "@selfage/test_matcher";
import { TEST_RUNNER } from "@selfage/test_runner";

TEST_RUNNER.run({
  name: "CreateStripeSessionToAddPaymentMethodHandlerTest",
  cases: [
    {
      name: "Success",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertBillingAccountStatement({
              accountId: "account1",
              stripeCustomerId: "stripeCustomer1",
            }),
          ]);
          await transaction.commit();
        });
        let createSessionParamsCaptured: any;
        let stripeClientMock: any = {
          checkout: {
            sessions: {
              create: (createSessionParams: any) => {
                createSessionParamsCaptured = createSessionParams;
                return {
                  url: "https://stripe.com/checkout",
                };
              },
            },
          },
        };
        let clientMock = new NodeServiceClientMock();
        clientMock.response = {
          accountId: "account1",
          capabilities: {
            canBeBilled: true,
          },
        } as ExchangeSessionAndCheckCapabilityResponse;
        let urlBuilder = new UrlBuilder("https://test.com");
        let handler = new CreateStripeSessionToAddPaymentMethodHandler(
          SPANNER_DATABASE,
          stripeClientMock,
          clientMock,
          urlBuilder,
        );

        // Execute
        let response = await handler.handle("", {}, "session1");

        // Verify
        assertThat(
          createSessionParamsCaptured.currency,
          eq("usd"),
          "createSessionParams.currency",
        );
        assertThat(
          createSessionParamsCaptured.customer,
          eq("stripeCustomer1"),
          "createSessionParams.customer",
        );
        assertThat(
          createSessionParamsCaptured.success_url,
          eq(
            "https://test.com/replace_primary_payment_method?e=%7B%22accountId%22%3A%22account1%22%7D&session_id=%7BCHECKOUT_SESSION_ID%7D",
          ),
          "createSessionParams.success_url",
        );
        assertThat(
          createSessionParamsCaptured.cancel_url,
          eq(
            "https://test.com/?e=%7B%22accountId%22%3A%22account1%22%2C%22account%22%3A%7B%22billing%22%3A%7B%7D%7D%7D",
          ),
          "createSessionParams.cancel_url",
        );
        assertThat(
          response,
          eqMessage(
            {
              redirectUrl: "https://stripe.com/checkout",
            },
            CREATE_STRIPE_SESSION_TO_ADD_PAYMENT_METHOD_RESPONSE,
          ),
          "response",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deleteBillingAccountStatement("account1"),
          ]);
          await transaction.commit();
        });
      },
    },
  ],
});
