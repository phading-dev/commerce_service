import "../local/env";
import { SPANNER_DATABASE } from "../common/spanner_database";
import { InitCreditGrantingState } from "../db/schema";
import {
  GET_INIT_CREDIT_GRANTING_TASK_METADATA_ROW,
  GET_PAYMENT_PROFILE_ROW,
  deleteInitCreditGrantingTaskStatement,
  deletePaymentProfileStatement,
  getInitCreditGrantingTaskMetadata,
  getPaymentProfile,
  insertInitCreditGrantingTaskStatement,
  insertPaymentProfileStatement,
  listPendingInitCreditGrantingTasks,
} from "../db/sql";
import { ProcessInitCreditGrantingTaskHandler } from "./process_init_credit_granting_task_handler";
import { eqMessage } from "@selfage/message/test_matcher";
import { Ref } from "@selfage/ref";
import { assertThat, eq, isArray } from "@selfage/test_matcher";
import { TEST_RUNNER } from "@selfage/test_runner";

TEST_RUNNER.run({
  name: "ProcessInitCreditGrantingTaskHandlerTest",
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
            insertInitCreditGrantingTaskStatement({
              taskId: "task1",
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
        let handler = new ProcessInitCreditGrantingTaskHandler(
          SPANNER_DATABASE,
          new Ref(stripeClientMock),
          () => 1000,
        );

        // Execute
        await handler.processTask("", {
          taskId: "task1",
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
          eq("ictask1"),
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
          await listPendingInitCreditGrantingTasks(SPANNER_DATABASE, {
            initCreditGrantingTaskExecutionTimeMsLe: 1000000,
          }),
          isArray([]),
          "InitCreditGrantingTask",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deletePaymentProfileStatement({
              paymentProfileAccountIdEq: "account1",
            }),
            deleteInitCreditGrantingTaskStatement({
              initCreditGrantingTaskTaskIdEq: "task1",
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
            insertInitCreditGrantingTaskStatement({
              taskId: "task1",
              accountId: "account1",
              retryCount: 0,
              executionTimeMs: 100,
              createdTimeMs: 100,
            }),
          ]);
          await transaction.commit();
        });
        let handler = new ProcessInitCreditGrantingTaskHandler(
          SPANNER_DATABASE,
          undefined,
          () => 1000,
        );

        // Execute
        await handler.claimTask("", {
          taskId: "task1",
          accountId: "account1",
        });

        // Verify
        assertThat(
          await getInitCreditGrantingTaskMetadata(SPANNER_DATABASE, {
            initCreditGrantingTaskTaskIdEq: "task1",
          }),
          isArray([
            eqMessage(
              {
                initCreditGrantingTaskRetryCount: 1,
                initCreditGrantingTaskExecutionTimeMs: 301000,
              },
              GET_INIT_CREDIT_GRANTING_TASK_METADATA_ROW,
            ),
          ]),
          "InitCreditGrantingTask",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deleteInitCreditGrantingTaskStatement({
              initCreditGrantingTaskTaskIdEq: "task1",
            }),
          ]);
          await transaction.commit();
        });
      },
    },
  ],
});
