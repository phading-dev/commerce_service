import "../../local/env";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import { PaymentProfileState, PaymentState } from "../../db/schema";
import {
  deletePaymentProfileStatement,
  deletePaymentStatement,
  insertPaymentProfileStatement,
  insertPaymentStatement,
} from "../../db/sql";
import { GetPaymentProfileInfoHandler } from "./get_payment_profile_info_handler";
import { GET_PAYMENT_PROFILE_INFO_RESPONSE } from "@phading/commerce_service_interface/web/payment/interface";
import { CardBrand } from "@phading/commerce_service_interface/web/payment/payment_method_masked";
import { PaymentProfileState as PaymentProfileStateResponse } from "@phading/commerce_service_interface/web/payment/payment_profile_state";
import { FetchSessionAndCheckCapabilityResponse } from "@phading/user_session_service_interface/node/interface";
import { eqMessage } from "@selfage/message/test_matcher";
import { NodeServiceClientMock } from "@selfage/node_service_client/client_mock";
import { Ref } from "@selfage/ref";
import { assertThat, eq } from "@selfage/test_matcher";
import { TEST_RUNNER } from "@selfage/test_runner";

TEST_RUNNER.run({
  name: "GetPaymentProfileInfosHandlerTest",
  cases: [
    {
      name: "WithPrimaryPaymentMethodAndHealthyAndNoFailedPayment",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertPaymentProfileStatement({
              accountId: "account1",
              stateInfo: {
                state: PaymentProfileState.HEALTHY,
              },
              paymentAfterMs: 1000,
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
        let handler = new GetPaymentProfileInfoHandler(
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
              primaryPaymentMethod: {
                card: {
                  brand: CardBrand.VISA,
                  lastFourDigits: "1234",
                  expMonth: 12,
                  expYear: 2023,
                },
              },
              state: PaymentProfileStateResponse.HEALTHY,
              paymentAfterMs: 1000,
            },
            GET_PAYMENT_PROFILE_INFO_RESPONSE,
          ),
          "response",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deletePaymentProfileStatement({
              paymentProfileAccountIdEq: "account1",
            }),
          ]);
          await transaction.commit();
        });
      },
    },
    {
      name: "NoPaymentMethodAndHealthyButWithFailedPayments",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertPaymentProfileStatement({
              accountId: "account1",
              stateInfo: {
                state: PaymentProfileState.HEALTHY,
              },
              paymentAfterMs: 1000,
              stripePaymentCustomerId: "stripeCustomer1",
            }),
            insertPaymentStatement({
              accountId: "account1",
              statementId: "statement1",
              state: PaymentState.FAILED,
            }),
          ]);
          await transaction.commit();
        });
        let stripeClientMock: any = {
          customers: {
            retrieve: () => {
              return {
                invoice_settings: {},
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
        let handler = new GetPaymentProfileInfoHandler(
          SPANNER_DATABASE,
          new Ref(stripeClientMock),
          clientMock,
        );

        // Execute
        let response = await handler.handle("", {}, "session1");

        // Verify
        assertThat(
          response,
          eqMessage(
            {
              state: PaymentProfileStateResponse.WITH_FAILED_PAYMENTS,
              paymentAfterMs: 1000,
            },
            GET_PAYMENT_PROFILE_INFO_RESPONSE,
          ),
          "response",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deletePaymentProfileStatement({
              paymentProfileAccountIdEq: "account1",
            }),
            deletePaymentStatement({
              paymentStatementIdEq: "statement1",
            }),
          ]);
          await transaction.commit();
        });
      },
    },
    {
      name: "NoPaymentMethodAndSuspsended",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertPaymentProfileStatement({
              accountId: "account1",
              stateInfo: {
                state: PaymentProfileState.SUSPENDED,
              },
              paymentAfterMs: 1000,
              stripePaymentCustomerId: "stripeCustomer1",
            }),
          ]);
          await transaction.commit();
        });
        let stripeClientMock: any = {
          customers: {
            retrieve: () => {
              return {
                invoice_settings: {},
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
        let handler = new GetPaymentProfileInfoHandler(
          SPANNER_DATABASE,
          new Ref(stripeClientMock),
          clientMock,
        );

        // Execute
        let response = await handler.handle("", {}, "session1");

        // Verify
        assertThat(
          response,
          eqMessage(
            {
              state: PaymentProfileStateResponse.SUSPENDED,
              paymentAfterMs: 1000,
            },
            GET_PAYMENT_PROFILE_INFO_RESPONSE,
          ),
          "response",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deletePaymentProfileStatement({
              paymentProfileAccountIdEq: "account1",
            }),
          ]);
          await transaction.commit();
        });
      },
    },
  ],
});
