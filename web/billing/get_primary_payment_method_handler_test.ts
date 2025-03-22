import "../../local/env";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import {
  deleteBillingProfileStatement,
  insertBillingProfileStatement,
} from "../../db/sql";
import { GetPrimaryPaymentMethodHandler } from "./get_primary_payment_method_handler";
import { GET_PRIMARY_PAYMENT_METHOD_RESPONSE } from "@phading/commerce_service_interface/web/billing/interface";
import { CardBrand } from "@phading/commerce_service_interface/web/billing/payment_method_masked";
import { FetchSessionAndCheckCapabilityResponse } from "@phading/user_session_service_interface/node/interface";
import { eqMessage } from "@selfage/message/test_matcher";
import { NodeServiceClientMock } from "@selfage/node_service_client/client_mock";
import { Ref } from "@selfage/ref";
import { assertThat, eq } from "@selfage/test_matcher";
import { TEST_RUNNER } from "@selfage/test_runner";

TEST_RUNNER.run({
  name: "GetPrimaryPaymentMethodsHandlerTest",
  cases: [
    {
      name: "Success",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertBillingProfileStatement({
              accountId: "account1",
              stripePaymentCustomerId: "stripeCustomer1",
            }),
          ]);
          await transaction.commit();
        });
        let stripeCustomerIdCaptured: string;
        let paymentMethodStripeCustomerIdCaptured: string;
        let paymentMethodIdCaptured: string;
        let stripeClientMock: any = {
          customers: {
            retrieve: (stripeCustomerId: string) => {
              stripeCustomerIdCaptured = stripeCustomerId;
              return {
                invoice_settings: {
                  default_payment_method: "paymentMethod1",
                },
              };
            },
            retrievePaymentMethod: (
              paymentMethodStripeCustomerId: string,
              paymentMethodId: string,
            ) => {
              paymentMethodStripeCustomerIdCaptured =
                paymentMethodStripeCustomerId;
              paymentMethodIdCaptured = paymentMethodId;
              return {
                id: "paymentMethod1",
                card: {
                  brand: "visa",
                  last4: "1234",
                  exp_month: 12,
                  exp_year: 2023,
                },
              };
            },
          },
        };
        let clientMock = new NodeServiceClientMock();
        clientMock.response = {
          accountId: "account1",
          capabilities: {
            canBeBilled: true,
          },
        } as FetchSessionAndCheckCapabilityResponse;
        let handler = new GetPrimaryPaymentMethodHandler(
          SPANNER_DATABASE,
          new Ref(stripeClientMock),
          clientMock,
        );

        // Execute
        let response = await handler.handle("", {}, "session1");

        // Verify
        assertThat(
          stripeCustomerIdCaptured,
          eq("stripeCustomer1"),
          "stripeCustomerId",
        );
        assertThat(
          paymentMethodStripeCustomerIdCaptured,
          eq("stripeCustomer1"),
          "paymentMethodStripeCustomerId",
        );
        assertThat(
          paymentMethodIdCaptured,
          eq("paymentMethod1"),
          "paymentMethodId",
        );
        assertThat(
          response,
          eqMessage(
            {
              paymentMethod: {
                paymentMethodId: "paymentMethod1",
                card: {
                  brand: CardBrand.VISA,
                  lastFourDigits: "1234",
                  expMonth: 12,
                  expYear: 2023,
                },
              },
            },
            GET_PRIMARY_PAYMENT_METHOD_RESPONSE,
          ),
          "response",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deleteBillingProfileStatement({
              billingProfileAccountIdEq: "account1",
            }),
          ]);
          await transaction.commit();
        });
      },
    },
  ],
});
