import "../../local/env";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import {
  deletePaymentProfileStatement,
  insertPaymentProfileStatement,
} from "../../db/sql";
import { ReplacePrimaryPaymentMethodHandler } from "./replace_primary_payment_method_handler";
import { FetchSessionAndCheckCapabilityResponse } from "@phading/user_session_service_interface/node/interface";
import { NodeServiceClientMock } from "@selfage/node_service_client/client_mock";
import { Ref } from "@selfage/ref";
import { assertThat, eq, isArray } from "@selfage/test_matcher";
import { TEST_RUNNER } from "@selfage/test_runner";

TEST_RUNNER.run({
  name: "ReplacePrimaryPaymentMethodHandlerTest",
  cases: [
    {
      name: "SetPrimaryPaymentMethodOnly",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertPaymentProfileStatement({
              accountId: "account1",
              stripePaymentCustomerId: "stripeCustomer1",
            }),
          ]);
          await transaction.commit();
        });
        let checkoutSessionIdCaptured: string;
        let stripeCustomerIdCaptured: string;
        let customerUpdateParamCaptured: any;
        let stripeClientMock: any = {
          checkout: {
            sessions: {
              retrieve: (checkoutSessionId: string) => {
                checkoutSessionIdCaptured = checkoutSessionId;
                return {
                  setup_intent: {
                    payment_method: "paymentMethod1",
                  },
                };
              },
            },
          },
          customers: {
            update: (stripeCustomerId: string, customerUpdateParam: any) => {
              stripeCustomerIdCaptured = stripeCustomerId;
              customerUpdateParamCaptured = customerUpdateParam;
              return {};
            },
            listPaymentMethods: () => {
              return {
                data: [],
              } as any;
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
        let handler = new ReplacePrimaryPaymentMethodHandler(
          SPANNER_DATABASE,
          new Ref(stripeClientMock),
          clientMock,
        );

        // Execute
        await handler.handle(
          "",
          {
            checkoutSessionId: "checkoutSession1",
          },
          "session1",
        );

        // Verify
        assertThat(
          checkoutSessionIdCaptured,
          eq("checkoutSession1"),
          "checkoutSessionId",
        );
        assertThat(
          stripeCustomerIdCaptured,
          eq("stripeCustomer1"),
          "stripeCustomerId",
        );
        assertThat(
          customerUpdateParamCaptured.invoice_settings.default_payment_method,
          eq("paymentMethod1"),
          "paymentMethodId",
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
      name: "SetPrimaryAndDetachOtherPaymentMethods",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertPaymentProfileStatement({
              accountId: "account1",
              stripePaymentCustomerId: "stripeCustomer1",
            }),
          ]);
          await transaction.commit();
        });
        let stripeCustomerIdCaptured: string;
        let detachPaymentMethodIds: string[] = [];
        let stripeClientMock: any = {
          checkout: {
            sessions: {
              retrieve: () => {
                return {
                  setup_intent: {
                    payment_method: "paymentMethod1",
                  },
                };
              },
            },
          },
          customers: {
            update: () => {
              return {};
            },
            listPaymentMethods: (stripeCustomerId: string) => {
              stripeCustomerIdCaptured = stripeCustomerId;
              return {
                data: [
                  {
                    id: "paymentMethod1",
                  },
                  {
                    id: "paymentMethod2",
                  },
                  {
                    id: "paymentMethod3",
                  },
                ],
              } as any;
            },
          },
          paymentMethods: {
            detach: (paymentMethodId: string) => {
              detachPaymentMethodIds.push(paymentMethodId);
              return {};
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
        let handler = new ReplacePrimaryPaymentMethodHandler(
          SPANNER_DATABASE,
          new Ref(stripeClientMock),
          clientMock,
        );

        // Execute
        await handler.handle(
          "",
          {
            checkoutSessionId: "checkoutSession1",
          },
          "session1",
        );

        // Verify
        assertThat(
          stripeCustomerIdCaptured,
          eq("stripeCustomer1"),
          "stripeCustomerId",
        );
        assertThat(
          detachPaymentMethodIds,
          isArray([eq("paymentMethod2"), eq("paymentMethod3")]),
          "detachPaymentMethodIds",
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
