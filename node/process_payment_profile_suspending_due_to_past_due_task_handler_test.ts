import "../local/env";
import { SPANNER_DATABASE } from "../common/spanner_database";
import { PaymentProfileState, PaymentState } from "../db/schema";
import {
  GET_PAYMENT_PROFILE_ROW,
  GET_PAYMENT_PROFILE_STATE_SYNCING_TASK_ROW,
  GET_PAYMENT_PROFILE_SUSPENSION_NOTIFYING_TASK_ROW,
  deletePaymentProfileStateSyncingTaskStatement,
  deletePaymentProfileStatement,
  deletePaymentProfileSuspendingDueToPastDueTaskStatement,
  deletePaymentProfileSuspensionNotifyingTaskStatement,
  deletePaymentStatement,
  deleteTransactionStatementStatement,
  getPaymentProfile,
  getPaymentProfileStateSyncingTask,
  getPaymentProfileSuspensionNotifyingTask,
  insertPaymentProfileStateSyncingTaskStatement,
  insertPaymentProfileStatement,
  insertPaymentProfileSuspendingDueToPastDueTaskStatement,
  insertPaymentStatement,
  insertTransactionStatementStatement,
  listPendingPaymentProfileStateSyncingTasks,
  listPendingPaymentProfileSuspendingDueToPastDueTasks,
  listPendingPaymentProfileSuspensionNotifyingTasks,
} from "../db/sql";
import { ProcessPaymentProfileSuspendingDueToPastDueTaskHandler } from "./process_payment_profile_suspending_due_to_past_due_task_handler";
import { eqMessage } from "@selfage/message/test_matcher";
import { assertThat, isArray } from "@selfage/test_matcher";
import { TEST_RUNNER } from "@selfage/test_runner";

async function cleanupAll() {
  await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
    await transaction.batchUpdate([
      deletePaymentProfileStatement({ paymentProfileAccountIdEq: "account1" }),
      deleteTransactionStatementStatement({
        transactionStatementStatementIdEq: "statement1",
      }),
      deletePaymentStatement({ paymentStatementIdEq: "statement1" }),
      deletePaymentProfileStateSyncingTaskStatement({
        paymentProfileStateSyncingTaskAccountIdEq: "account1",
        paymentProfileStateSyncingTaskVersionEq: 1,
      }),
      deletePaymentProfileStateSyncingTaskStatement({
        paymentProfileStateSyncingTaskAccountIdEq: "account1",
        paymentProfileStateSyncingTaskVersionEq: 2,
      }),
      deletePaymentProfileSuspendingDueToPastDueTaskStatement({
        paymentProfileSuspendingDueToPastDueTaskStatementIdEq: "statement1",
      }),
      deletePaymentProfileSuspensionNotifyingTaskStatement({
        paymentProfileSuspensionNotifyingTaskAccountIdEq: "account1",
        paymentProfileSuspensionNotifyingTaskVersionEq: 1,
      }),
      deletePaymentProfileSuspensionNotifyingTaskStatement({
        paymentProfileSuspensionNotifyingTaskAccountIdEq: "account1",
        paymentProfileSuspensionNotifyingTaskVersionEq: 2,
      }),
    ]);
    await transaction.commit();
  });
}

TEST_RUNNER.run({
  name: "ProcessPaymentProfileSuspendingDueToPastDueTaskHandlerTest",
  cases: [
    {
      name: "Success",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertPaymentProfileStatement({
              accountId: "account1",
              stateInfo: {
                state: PaymentProfileState.HEALTHY,
                version: 1,
                updatedTimeMs: 100,
              },
            }),
            insertPaymentProfileStateSyncingTaskStatement({
              accountId: "account1",
              version: 1,
              retryCount: 0,
              executionTimeMs: 100,
              createdTimeMs: 100,
            }),
            insertTransactionStatementStatement({
              statementId: "statement1",
              accountId: "account1",
            }),
            insertPaymentStatement({
              statementId: "statement1",
              accountId: "account1",
              state: PaymentState.FAILED_WITHOUT_INVOICE,
            }),
            insertPaymentProfileSuspendingDueToPastDueTaskStatement({
              statementId: "statement1",
              retryCount: 0,
              executionTimeMs: 100,
              createdTimeMs: 100,
            }),
          ]);
          await transaction.commit();
        });
        let handler =
          new ProcessPaymentProfileSuspendingDueToPastDueTaskHandler(
            SPANNER_DATABASE,
            () => 1000,
          );

        // Execute
        await handler.handle("", {
          statementId: "statement1",
        });

        // Verify
        assertThat(
          await getPaymentProfile(SPANNER_DATABASE, {
            paymentProfileAccountIdEq: "account1",
          }),
          isArray([
            eqMessage(
              {
                paymentProfileAccountId: "account1",
                paymentProfileStateInfo: {
                  state: PaymentProfileState.SUSPENDED,
                  version: 2,
                  updatedTimeMs: 1000,
                },
              },
              GET_PAYMENT_PROFILE_ROW,
            ),
          ]),
          "paymentProfile",
        );
        assertThat(
          await getPaymentProfileSuspensionNotifyingTask(SPANNER_DATABASE, {
            paymentProfileSuspensionNotifyingTaskAccountIdEq: "account1",
            paymentProfileSuspensionNotifyingTaskVersionEq: 2,
          }),
          isArray([
            eqMessage(
              {
                paymentProfileSuspensionNotifyingTaskAccountId: "account1",
                paymentProfileSuspensionNotifyingTaskVersion: 2,
                paymentProfileSuspensionNotifyingTaskRetryCount: 0,
                paymentProfileSuspensionNotifyingTaskExecutionTimeMs: 1000,
                paymentProfileSuspensionNotifyingTaskCreatedTimeMs: 1000,
              },
              GET_PAYMENT_PROFILE_SUSPENSION_NOTIFYING_TASK_ROW,
            ),
          ]),
          "PaymentProfileSuspensionNotifyingTasks",
        );
        assertThat(
          await getPaymentProfileStateSyncingTask(SPANNER_DATABASE, {
            paymentProfileStateSyncingTaskAccountIdEq: "account1",
            paymentProfileStateSyncingTaskVersionEq: 2,
          }),
          isArray([
            eqMessage(
              {
                paymentProfileStateSyncingTaskAccountId: "account1",
                paymentProfileStateSyncingTaskVersion: 2,
                paymentProfileStateSyncingTaskRetryCount: 0,
                paymentProfileStateSyncingTaskExecutionTimeMs: 1000,
                paymentProfileStateSyncingTaskCreatedTimeMs: 1000,
              },
              GET_PAYMENT_PROFILE_STATE_SYNCING_TASK_ROW,
            ),
          ]),
          "PaymentProfileStateSyncingTasks",
        );
        assertThat(
          await listPendingPaymentProfileSuspendingDueToPastDueTasks(
            SPANNER_DATABASE,
            {
              paymentProfileSuspendingDueToPastDueTaskExecutionTimeMsLe: 1000000,
            },
          ),
          isArray([]),
          "PaymentProfileSuspendingDueToPastDueTasks",
        );
      },
      tearDown: async () => {
        await cleanupAll();
      },
    },
    {
      name: "AccountAlreadySuspended",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertPaymentProfileStatement({
              accountId: "account1",
              stateInfo: {
                state: PaymentProfileState.SUSPENDED,
                version: 1,
                updatedTimeMs: 100,
              },
            }),
            insertTransactionStatementStatement({
              statementId: "statement1",
              accountId: "account1",
            }),
            insertPaymentStatement({
              statementId: "statement1",
              accountId: "account1",
              state: PaymentState.FAILED_WITH_INVOICE,
            }),
            insertPaymentProfileSuspendingDueToPastDueTaskStatement({
              statementId: "statement1",
              retryCount: 0,
              executionTimeMs: 100,
              createdTimeMs: 100,
            }),
          ]);
          await transaction.commit();
        });
        let handler =
          new ProcessPaymentProfileSuspendingDueToPastDueTaskHandler(
            SPANNER_DATABASE,
            () => 1000,
          );

        // Execute
        await handler.handle("", {
          statementId: "statement1",
        });

        // Verify
        assertThat(
          await getPaymentProfile(SPANNER_DATABASE, {
            paymentProfileAccountIdEq: "account1",
          }),
          isArray([
            eqMessage(
              {
                paymentProfileAccountId: "account1",
                paymentProfileStateInfo: {
                  state: PaymentProfileState.SUSPENDED,
                  version: 1,
                  updatedTimeMs: 100,
                },
              },
              GET_PAYMENT_PROFILE_ROW,
            ),
          ]),
          "paymentProfile",
        );
        assertThat(
          await listPendingPaymentProfileSuspensionNotifyingTasks(
            SPANNER_DATABASE,
            { paymentProfileSuspensionNotifyingTaskExecutionTimeMsLe: 1000000 },
          ),
          isArray([]),
          "PaymentProfileSuspensionNotifyingTasks",
        );
        assertThat(
          await listPendingPaymentProfileStateSyncingTasks(SPANNER_DATABASE, {
            paymentProfileStateSyncingTaskExecutionTimeMsLe: 1000000,
          }),
          isArray([]),
          "PaymentProfileStateSyncingTasks",
        );
        assertThat(
          await listPendingPaymentProfileSuspendingDueToPastDueTasks(
            SPANNER_DATABASE,
            {
              paymentProfileSuspendingDueToPastDueTaskExecutionTimeMsLe: 1000000,
            },
          ),
          isArray([]),
          "PaymentProfileSuspendingDueToPastDueTasks",
        );
      },
      tearDown: async () => {
        await cleanupAll();
      },
    },
    {
      name: "PaymentDone",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertPaymentProfileStatement({
              accountId: "account1",
              stateInfo: {
                state: PaymentProfileState.HEALTHY,
                version: 1,
                updatedTimeMs: 100,
              },
            }),
            insertTransactionStatementStatement({
              statementId: "statement1",
              accountId: "account1",
            }),
            insertPaymentStatement({
              statementId: "statement1",
              accountId: "account1",
              state: PaymentState.PAID,
            }),
            insertPaymentProfileSuspendingDueToPastDueTaskStatement({
              statementId: "statement1",
              retryCount: 0,
              executionTimeMs: 100,
              createdTimeMs: 100,
            }),
          ]);
          await transaction.commit();
        });
        let handler =
          new ProcessPaymentProfileSuspendingDueToPastDueTaskHandler(
            SPANNER_DATABASE,
            () => 1000,
          );

        // Execute
        await handler.handle("", {
          statementId: "statement1",
        });

        // Verify
        assertThat(
          await getPaymentProfile(SPANNER_DATABASE, {
            paymentProfileAccountIdEq: "account1",
          }),
          isArray([
            eqMessage(
              {
                paymentProfileAccountId: "account1",
                paymentProfileStateInfo: {
                  state: PaymentProfileState.HEALTHY,
                  version: 1,
                  updatedTimeMs: 100,
                },
              },
              GET_PAYMENT_PROFILE_ROW,
            ),
          ]),
          "paymentProfile",
        );
        assertThat(
          await listPendingPaymentProfileSuspensionNotifyingTasks(
            SPANNER_DATABASE,
            { paymentProfileSuspensionNotifyingTaskExecutionTimeMsLe: 1000000 },
          ),
          isArray([]),
          "PaymentProfileSuspensionNotifyingTasks",
        );
        assertThat(
          await listPendingPaymentProfileStateSyncingTasks(SPANNER_DATABASE, {
            paymentProfileStateSyncingTaskExecutionTimeMsLe: 1000000,
          }),
          isArray([]),
          "PaymentProfileStateSyncingTasks",
        );
        assertThat(
          await listPendingPaymentProfileSuspendingDueToPastDueTasks(
            SPANNER_DATABASE,
            {
              paymentProfileSuspendingDueToPastDueTaskExecutionTimeMsLe: 1000000,
            },
          ),
          isArray([]),
          "PaymentProfileSuspendingDueToPastDueTasks",
        );
      },
      tearDown: async () => {
        await cleanupAll();
      },
    },
  ],
});
