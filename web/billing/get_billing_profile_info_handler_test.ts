import "../../local/env";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import { BillingProfileState, PaymentState } from "../../db/schema";
import {
  deleteBillingProfileStatement,
  deletePaymentStatement,
  insertBillingProfileStatement,
  insertPaymentStatement,
} from "../../db/sql";
import { GetBillingProfileInfoHandler } from "./get_billing_profile_info_handler";
import { BillingProfileState as BillingProfileStateResponse } from "@phading/commerce_service_interface/web/billing/billing_profile_state";
import { GET_BILLING_PROFILE_INFO_RESPONSE } from "@phading/commerce_service_interface/web/billing/interface";
import { CardBrand } from "@phading/commerce_service_interface/web/billing/payment_method_masked";
import { FetchSessionAndCheckCapabilityResponse } from "@phading/user_session_service_interface/node/interface";
import { eqMessage } from "@selfage/message/test_matcher";
import { NodeServiceClientMock } from "@selfage/node_service_client/client_mock";
import { Ref } from "@selfage/ref";
import { assertThat, eq } from "@selfage/test_matcher";
import { TEST_RUNNER } from "@selfage/test_runner";

TEST_RUNNER.run({
  name: "GetBillingProfileInfosHandlerTest",
  cases: [
    {
      name: "WithPrimaryPaymentMethodAndHealthyAndNoFailedPayment",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertBillingProfileStatement({
              accountId: "account1",
              stateInfo: {
                state: BillingProfileState.HEALTHY,
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
        let handler = new GetBillingProfileInfoHandler(
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
                paymentMethodId: "paymentMethod1",
                card: {
                  brand: CardBrand.VISA,
                  lastFourDigits: "1234",
                  expMonth: 12,
                  expYear: 2023,
                },
              },
              state: BillingProfileStateResponse.HEALTHY,
              paymentAfterMs: 1000,
            },
            GET_BILLING_PROFILE_INFO_RESPONSE,
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
    {
      name: "NoPaymentMethodAndHealthyButWithFailedPayments",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertBillingProfileStatement({
              accountId: "account1",
              stateInfo: {
                state: BillingProfileState.HEALTHY,
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
        let handler = new GetBillingProfileInfoHandler(
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
              state: BillingProfileStateResponse.WITH_FAILED_PAYMENTS,
              paymentAfterMs: 1000,
            },
            GET_BILLING_PROFILE_INFO_RESPONSE,
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
            insertBillingProfileStatement({
              accountId: "account1",
              stateInfo: {
                state: BillingProfileState.SUSPENDED,
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
        let handler = new GetBillingProfileInfoHandler(
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
              state: BillingProfileStateResponse.SUSPENDED,
              paymentAfterMs: 1000,
            },
            GET_BILLING_PROFILE_INFO_RESPONSE,
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
