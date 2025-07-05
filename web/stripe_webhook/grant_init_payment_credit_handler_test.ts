import "../../local/env";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import { InitCreditGrantingState } from "../../db/schema";
import {
  GET_INIT_PAYMENT_CREDIT_GRANTING_TASK_ROW,
  GET_PAYMENT_PROFILE_ROW,
  deleteInitPaymentCreditGrantingTaskStatement,
  deletePaymentCardGrantedInitCreditStatement,
  deletePaymentProfileStatement,
  getInitPaymentCreditGrantingTask,
  getPaymentCardGrantedInitCredit,
  getPaymentProfile,
  insertPaymentCardGrantedInitCreditStatement,
  insertPaymentProfileStatement,
  listPendingInitPaymentCreditGrantingTasks,
} from "../../db/sql";
import { GrantInitPaymentCreditHandler } from "./grant_init_payment_credit_handler";
import { eqMessage } from "@selfage/message/test_matcher";
import { Ref } from "@selfage/ref";
import { assertThat, eq, isArray } from "@selfage/test_matcher";
import { TEST_RUNNER } from "@selfage/test_runner";
import { Readable } from "stream";

async function cleanupAll() {
  await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
    await transaction.batchUpdate([
      deletePaymentProfileStatement({
        paymentProfileAccountIdEq: "account1",
      }),
      deletePaymentCardGrantedInitCreditStatement({
        paymentCardGrantedInitCreditFingerprintEq: "fingerprint1",
      }),
      deleteInitPaymentCreditGrantingTaskStatement({
        initPaymentCreditGrantingTaskAccountIdEq: "account1",
      }),
    ]);
    await transaction.commit();
  });
}

TEST_RUNNER.run({
  name: "GrantInitPaymentCreditHandlerTest",
  cases: [
    {
      name: "Success",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertPaymentProfileStatement({
              accountId: "account1",
              initCreditGrantingState: InitCreditGrantingState.NOT_GRANTED,
            }),
          ]);
          await transaction.commit();
        });
        let payloadCaptured: string;
        let sigCaptured: string;
        let secretCaptured: string;
        let paymentMethodIdCaptured: string;
        let stripeClientMock: any = {
          webhooks: {
            constructEvent: (payload: string, sig: string, secret: string) => {
              payloadCaptured = payload;
              sigCaptured = sig;
              secretCaptured = secret;
              return {
                type: "customer.updated",
                data: {
                  object: {
                    invoice_settings: {
                      default_payment_method: "paymentMethod1",
                    },
                    metadata: {
                      accountId: "account1",
                    },
                  },
                  previous_attributes: {
                    invoice_settings: {},
                  },
                },
              };
            },
          },
          paymentMethods: {
            retrieve: async (paymentMethodId: string) => {
              paymentMethodIdCaptured = paymentMethodId;
              return {
                card: {
                  fingerprint: "fingerprint1",
                },
              };
            },
          },
        };
        let handler = new GrantInitPaymentCreditHandler(
          SPANNER_DATABASE,
          new Ref(stripeClientMock),
          () => 1000,
          "secret1",
        );

        // Execute
        await handler.handle("", Readable.from("event_input"), "sig1");

        // Verify
        assertThat(payloadCaptured, eq("event_input"), "payload");
        assertThat(sigCaptured, eq("sig1"), "sig");
        assertThat(secretCaptured, eq("secret1"), "secret");
        assertThat(
          paymentMethodIdCaptured,
          eq("paymentMethod1"),
          "paymentMethodId",
        );
        assertThat(
          await getPaymentProfile(SPANNER_DATABASE, {
            paymentProfileAccountIdEq: "account1",
          }),
          isArray([
            eqMessage(
              {
                paymentProfileAccountId: "account1",
                paymentProfileInitCreditGrantingState:
                  InitCreditGrantingState.GRANTING,
              },
              GET_PAYMENT_PROFILE_ROW,
            ),
          ]),
          "paymentProfile",
        );
        assertThat(
          (
            await getPaymentCardGrantedInitCredit(SPANNER_DATABASE, {
              paymentCardGrantedInitCreditFingerprintEq: "fingerprint1",
            })
          ).length,
          eq(1),
          "paymentCardGrantedInitCredit",
        );
        assertThat(
          await getInitPaymentCreditGrantingTask(SPANNER_DATABASE, {
            initPaymentCreditGrantingTaskAccountIdEq: "account1",
          }),
          isArray([
            eqMessage(
              {
                initPaymentCreditGrantingTaskAccountId: "account1",
                initPaymentCreditGrantingTaskRetryCount: 0,
                initPaymentCreditGrantingTaskExecutionTimeMs: 1000,
                initPaymentCreditGrantingTaskCreatedTimeMs: 1000,
              },
              GET_INIT_PAYMENT_CREDIT_GRANTING_TASK_ROW,
            ),
          ]),
          "initPaymentCreditGrantingTask",
        );
      },
      tearDown: async () => {
        await cleanupAll();
      },
    },
    {
      name: "CardSeenBefore",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertPaymentProfileStatement({
              accountId: "account1",
              initCreditGrantingState: InitCreditGrantingState.NOT_GRANTED,
            }),
            insertPaymentCardGrantedInitCreditStatement({
              fingerprint: "fingerprint1",
            }),
          ]);
          await transaction.commit();
        });
        let stripeClientMock: any = {
          webhooks: {
            constructEvent: (payload: string, sig: string, secret: string) => {
              return {
                type: "customer.updated",
                data: {
                  object: {
                    invoice_settings: {
                      default_payment_method: "paymentMethod1",
                    },
                    metadata: {
                      accountId: "account1",
                    },
                  },
                  previous_attributes: {
                    invoice_settings: {
                      default_payment_method: "paymentMethod0",
                    },
                  },
                },
              };
            },
          },
          paymentMethods: {
            retrieve: async (paymentMethodId: string) => {
              return {
                card: {
                  fingerprint: "fingerprint1",
                },
              };
            },
          },
        };
        let handler = new GrantInitPaymentCreditHandler(
          SPANNER_DATABASE,
          new Ref(stripeClientMock),
          () => 1000,
          "secret1",
        );

        // Execute
        await handler.handle("", Readable.from("event_input"), "sig1");

        // Verify
        assertThat(
          await getPaymentProfile(SPANNER_DATABASE, {
            paymentProfileAccountIdEq: "account1",
          }),
          isArray([
            eqMessage(
              {
                paymentProfileAccountId: "account1",
                paymentProfileInitCreditGrantingState:
                  InitCreditGrantingState.NOT_GRANTED,
              },
              GET_PAYMENT_PROFILE_ROW,
            ),
          ]),
          "paymentProfile",
        );
        assertThat(
          await listPendingInitPaymentCreditGrantingTasks(SPANNER_DATABASE, {
            initPaymentCreditGrantingTaskExecutionTimeMsLe: 1000000,
          }),
          isArray([]),
          "initPaymentCreditGrantingTask",
        );
      },
      tearDown: async () => {
        await cleanupAll();
      },
    },
    {
      name: "CreditBeingGranted",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertPaymentProfileStatement({
              accountId: "account1",
              initCreditGrantingState: InitCreditGrantingState.GRANTING,
            }),
          ]);
          await transaction.commit();
        });
        let stripeClientMock: any = {
          webhooks: {
            constructEvent: (payload: string, sig: string, secret: string) => {
              return {
                type: "customer.updated",
                data: {
                  object: {
                    invoice_settings: {
                      default_payment_method: "paymentMethod1",
                    },
                    metadata: {
                      accountId: "account1",
                    },
                  },
                  previous_attributes: {},
                },
              };
            },
          },
          paymentMethods: {
            retrieve: async (paymentMethodId: string) => {
              return {
                card: {
                  fingerprint: "fingerprint1",
                },
              };
            },
          },
        };
        let handler = new GrantInitPaymentCreditHandler(
          SPANNER_DATABASE,
          new Ref(stripeClientMock),
          () => 1000,
          "secret1",
        );

        // Execute
        await handler.handle("", Readable.from("event_input"), "sig1");

        // Verify
        assertThat(
          await getPaymentProfile(SPANNER_DATABASE, {
            paymentProfileAccountIdEq: "account1",
          }),
          isArray([
            eqMessage(
              {
                paymentProfileAccountId: "account1",
                paymentProfileInitCreditGrantingState:
                  InitCreditGrantingState.GRANTING,
              },
              GET_PAYMENT_PROFILE_ROW,
            ),
          ]),
          "paymentProfile",
        );
        assertThat(
          (
            await getPaymentCardGrantedInitCredit(SPANNER_DATABASE, {
              paymentCardGrantedInitCreditFingerprintEq: "fingerprint1",
            })
          ).length,
          eq(0),
          "paymentCardGrantedInitCredit",
        );
        assertThat(
          await listPendingInitPaymentCreditGrantingTasks(SPANNER_DATABASE, {
            initPaymentCreditGrantingTaskExecutionTimeMsLe: 1000000,
          }),
          isArray([]),
          "paymentCreditGrantingTask",
        );
      },
      tearDown: async () => {
        await cleanupAll();
      },
    },
    {
      name: "NoDefaultPaymentMethodUpdate",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertPaymentProfileStatement({
              accountId: "account1",
              initCreditGrantingState: InitCreditGrantingState.NOT_GRANTED,
            }),
          ]);
          await transaction.commit();
        });
        let stripeClientMock: any = {
          webhooks: {
            constructEvent: (payload: string, sig: string, secret: string) => {
              return {
                type: "customer.updated",
                data: {
                  object: {
                    metadata: {
                      accountId: "account1",
                    },
                  },
                  previous_attributes: {},
                },
              };
            },
          },
        };
        let handler = new GrantInitPaymentCreditHandler(
          SPANNER_DATABASE,
          new Ref(stripeClientMock),
          () => 1000,
          "secret1",
        );

        // Execute
        await handler.handle("", Readable.from("event_input"), "sig1");

        // Verify
        assertThat(
          await getPaymentProfile(SPANNER_DATABASE, {
            paymentProfileAccountIdEq: "account1",
          }),
          isArray([
            eqMessage(
              {
                paymentProfileAccountId: "account1",
                paymentProfileInitCreditGrantingState:
                  InitCreditGrantingState.NOT_GRANTED,
              },
              GET_PAYMENT_PROFILE_ROW,
            ),
          ]),
          "paymentProfile",
        );
        assertThat(
          await listPendingInitPaymentCreditGrantingTasks(SPANNER_DATABASE, {
            initPaymentCreditGrantingTaskExecutionTimeMsLe: 1000000,
          }),
          isArray([]),
          "initPaymentCreditGrantingTask",
        );
      },
      tearDown: async () => {
        await cleanupAll();
      },
    },
  ],
});
