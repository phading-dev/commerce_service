import "../local/env";
import { SPANNER_DATABASE } from "../common/spanner_database";
import { InitCreditGrantingState } from "../db/schema";
import {
  GET_INIT_PAYMENT_CREDIT_GRANTING_TASK_METADATA_ROW,
  GET_PAYMENT_PROFILE_ROW,
  deleteInitPaymentCreditGrantingTaskStatement,
  deletePaymentProfileStatement,
  getInitPaymentCreditGrantingTaskMetadata,
  getPaymentProfile,
  insertInitPaymentCreditGrantingTaskStatement,
  insertPaymentProfileStatement,
  listPendingInitPaymentCreditGrantingTasks,
} from "../db/sql";
import { ProcessInitPaymentCreditGrantingTaskHandler } from "./process_init_payment_credit_granting_task_handler";
import { eqMessage } from "@selfage/message/test_matcher";
import { Ref } from "@selfage/ref";
import {
  assertReject,
  assertThat,
  eq,
  eqError,
  isArray,
} from "@selfage/test_matcher";
import { TEST_RUNNER } from "@selfage/test_runner";

TEST_RUNNER.run({
  name: "ProcessInitPaymentCreditGrantingTaskHandlerTest",
  cases: [
    {
      name: "ProcessTask",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertPaymentProfileStatement({
              accountId: "account1",
              stripePaymentCustomerId: "customer1",
              initCreditGrantingState: InitCreditGrantingState.GRANTING,
            }),
            insertInitPaymentCreditGrantingTaskStatement({
              accountId: "account1",
              retryCount: 0,
              executionTimeMs: 100,
              createdTimeMs: 100,
            }),
          ]);
          await transaction.commit();
        });
        let stripeCustomerIdCaptured: string;
        let createParamsCaptured: any;
        let createOptionsCaptured: any;
        let stripeClientMock: any = {
          customers: {
            createBalanceTransaction: async (
              stripeCustomerId: string,
              createParams: any,
              createOptions: any,
            ) => {
              stripeCustomerIdCaptured = stripeCustomerId;
              createParamsCaptured = createParams;
              createOptionsCaptured = createOptions;
              return {};
            },
          },
        };
        let handler = new ProcessInitPaymentCreditGrantingTaskHandler(
          SPANNER_DATABASE,
          new Ref(stripeClientMock),
          () => 1000,
        );

        // Execute
        await handler.processTask("", {
          accountId: "account1",
        });

        // Verify
        assertThat(
          stripeCustomerIdCaptured,
          eq("customer1"),
          "stripeCustomerId",
        );
        assertThat(
          createParamsCaptured.amount,
          eq(-100),
          "createParams.amount",
        );
        assertThat(
          createParamsCaptured.currency,
          eq("usd"),
          "createParams.currency",
        );
        assertThat(
          createOptionsCaptured.idempotencyKey,
          eq("icaccount1"),
          "createOptions.idempotencyKey",
        );
        assertThat(
          await getPaymentProfile(SPANNER_DATABASE, {
            paymentProfileAccountIdEq: "account1",
          }),
          isArray([
            eqMessage(
              {
                paymentProfileAccountId: "account1",
                paymentProfileStripePaymentCustomerId: "customer1",
                paymentProfileInitCreditGrantingState:
                  InitCreditGrantingState.GRANTED,
              },
              GET_PAYMENT_PROFILE_ROW,
            ),
          ]),
          "PaymentProfile",
        );
        assertThat(
          await listPendingInitPaymentCreditGrantingTasks(SPANNER_DATABASE, {
            initPaymentCreditGrantingTaskExecutionTimeMsLe: 1000000,
          }),
          isArray([]),
          "InitPaymentCreditGrantingTask",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deletePaymentProfileStatement({
              paymentProfileAccountIdEq: "account1",
            }),
            deleteInitPaymentCreditGrantingTaskStatement({
              initPaymentCreditGrantingTaskAccountIdEq: "account1",
            }),
          ]);
          await transaction.commit();
        });
      },
    },
    {
      name: "FailedToGrantCredit",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertPaymentProfileStatement({
              accountId: "account1",
              stripePaymentCustomerId: "customer1",
              initCreditGrantingState: InitCreditGrantingState.GRANTING,
            }),
            insertInitPaymentCreditGrantingTaskStatement({
              accountId: "account1",
              retryCount: 0,
              executionTimeMs: 100,
              createdTimeMs: 100,
            }),
          ]);
          await transaction.commit();
        });
        let stripeClientMock: any = {
          customers: {
            createBalanceTransaction: async () => {
              throw new Error("Fake error");
            },
          },
        };
        let handler = new ProcessInitPaymentCreditGrantingTaskHandler(
          SPANNER_DATABASE,
          new Ref(stripeClientMock),
          () => 1000,
        );

        // Execute
        let error = await assertReject(
          handler.processTask("", {
            accountId: "account1",
          }),
        );

        // Verify
        assertThat(error, eqError(new Error("Fake error")), "Error");
        assertThat(
          await getPaymentProfile(SPANNER_DATABASE, {
            paymentProfileAccountIdEq: "account1",
          }),
          isArray([
            eqMessage(
              {
                paymentProfileAccountId: "account1",
                paymentProfileStripePaymentCustomerId: "customer1",
                paymentProfileInitCreditGrantingState:
                  InitCreditGrantingState.GRANTING,
              },
              GET_PAYMENT_PROFILE_ROW,
            ),
          ]),
          "PaymentProfile",
        );
        assertThat(
          await getInitPaymentCreditGrantingTaskMetadata(SPANNER_DATABASE, {
            initPaymentCreditGrantingTaskAccountIdEq: "account1",
          }),
          isArray([
            eqMessage(
              {
                initPaymentCreditGrantingTaskRetryCount: 0,
                initPaymentCreditGrantingTaskExecutionTimeMs: 100,
              },
              GET_INIT_PAYMENT_CREDIT_GRANTING_TASK_METADATA_ROW,
            ),
          ]),
          "InitPaymentCreditGrantingTask",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deletePaymentProfileStatement({
              paymentProfileAccountIdEq: "account1",
            }),
            deleteInitPaymentCreditGrantingTaskStatement({
              initPaymentCreditGrantingTaskAccountIdEq: "account1",
            }),
          ]);
          await transaction.commit();
        });
      },
    },
    {
      name: "ClaimTask",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertInitPaymentCreditGrantingTaskStatement({
              accountId: "account1",
              retryCount: 0,
              executionTimeMs: 100,
              createdTimeMs: 100,
            }),
          ]);
          await transaction.commit();
        });
        let handler = new ProcessInitPaymentCreditGrantingTaskHandler(
          SPANNER_DATABASE,
          undefined,
          () => 1000,
        );

        // Execute
        await handler.claimTask("", {
          accountId: "account1",
        });

        // Verify
        assertThat(
          await getInitPaymentCreditGrantingTaskMetadata(SPANNER_DATABASE, {
            initPaymentCreditGrantingTaskAccountIdEq: "account1",
          }),
          isArray([
            eqMessage(
              {
                initPaymentCreditGrantingTaskRetryCount: 1,
                initPaymentCreditGrantingTaskExecutionTimeMs: 301000,
              },
              GET_INIT_PAYMENT_CREDIT_GRANTING_TASK_METADATA_ROW,
            ),
          ]),
          "InitPaymentCreditGrantingTask",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deleteInitPaymentCreditGrantingTaskStatement({
              initPaymentCreditGrantingTaskAccountIdEq: "account1",
            }),
          ]);
          await transaction.commit();
        });
      },
    },
  ],
});
