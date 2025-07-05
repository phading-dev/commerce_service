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
import { assertThat, eq } from "@selfage/test_matcher";
import { TEST_RUNNER } from "@selfage/test_runner";

async function insertPaymentProfile() {
  await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
    await transaction.batchUpdate([
      insertPaymentProfileStatement({
        accountId: "account1",
        stripePaymentCustomerId: "stripeCustomer1",
      }),
    ]);
    await transaction.commit();
  });
}

async function deletePaymentProfile() {
  await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
    await transaction.batchUpdate([
      deletePaymentProfileStatement({
        paymentProfileAccountIdEq: "account1",
      }),
    ]);
    await transaction.commit();
  });
}

TEST_RUNNER.run({
  name: "ReplacePrimaryPaymentMethodHandlerTest",
  cases: [
    {
      name: "Success",
      execute: async () => {
        // Prepare
        await insertPaymentProfile();
        let checkoutSessionIdCaptured: string;
        let retrieveStripeCustomerIdCaptured: string;
        let updateCustomerIdCaptured: string;
        let updateCustomerParamCaptured: any;
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
            retrieve: (stripeCustomerId: string) => {
              retrieveStripeCustomerIdCaptured = stripeCustomerId;
              return {};
            },
            update: (stripeCustomerId: string, updateCustomerParam: any) => {
              updateCustomerIdCaptured = stripeCustomerId;
              updateCustomerParamCaptured = updateCustomerParam;
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
          checkoutSessionIdCaptured,
          eq("checkoutSession1"),
          "checkoutSessionId",
        );
        assertThat(
          retrieveStripeCustomerIdCaptured,
          eq("stripeCustomer1"),
          "retrieveCustomerId",
        );
        assertThat(
          updateCustomerIdCaptured,
          eq("stripeCustomer1"),
          "updateCustomerId",
        );
        assertThat(
          updateCustomerParamCaptured.invoice_settings.default_payment_method,
          eq("paymentMethod1"),
          "paymentMethodId",
        );
      },
      tearDown: async () => {
        await deletePaymentProfile();
      },
    },
    {
      name: "DetachPreviousPaymentMethod",
      execute: async () => {
        // Prepare
        await insertPaymentProfile();
        let detachPaymentMethodIdCaptured: string;
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
            retrieve: () => {
              return {
                invoice_settings: {
                  default_payment_method: "paymentMethod0",
                },
              };
            },
            update: () => {
              return {};
            },
          },
          paymentMethods: {
            detach: async (paymentMethodId: string) => {
              await new Promise((resolve) => setTimeout(resolve));
              detachPaymentMethodIdCaptured = paymentMethodId;
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
        await new Promise<void>((resolve) => {
          handler.detachedCallbackFn = () => {
            resolve();
          };
        });

        // Verify
        assertThat(
          detachPaymentMethodIdCaptured,
          eq("paymentMethod0"),
          "detachPaymentMethodId",
        );
      },
      tearDown: async () => {
        await deletePaymentProfile();
      },
    },
    {
      name: "SkipUpdatingIfAlreadyUpdated",
      execute: async () => {
        // Prepare
        await insertPaymentProfile();
        let updated = false;
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
            retrieve: () => {
              return {
                invoice_settings: {
                  default_payment_method: "paymentMethod1",
                },
              };
            },
            update: () => {
              updated = true;
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
        assertThat(updated, eq(false), "updated");
      },
      tearDown: async () => {
        await deletePaymentProfile();
      },
    },
  ],
});
