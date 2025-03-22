import "../local/env";
import { SPANNER_DATABASE } from "../common/spanner_database";
import { BillingProfileState, PaymentState } from "../db/schema";
import {
  GET_BILLING_PROFILE_ROW,
  GET_BILLING_PROFILE_STATE_SYNCING_TASK_ROW,
  GET_BILLING_PROFILE_SUSPENSION_NOTIFYING_TASK_ROW,
  deleteBillingProfileStateSyncingTaskStatement,
  deleteBillingProfileStatement,
  deleteBillingProfileSuspendingDueToPastDueTaskStatement,
  deleteBillingProfileSuspensionNotifyingTaskStatement,
  deletePaymentStatement,
  deleteTransactionStatementStatement,
  getBillingProfile,
  getBillingProfileStateSyncingTask,
  getBillingProfileSuspensionNotifyingTask,
  insertBillingProfileStateSyncingTaskStatement,
  insertBillingProfileStatement,
  insertBillingProfileSuspendingDueToPastDueTaskStatement,
  insertPaymentStatement,
  insertTransactionStatementStatement,
  listPendingBillingProfileStateSyncingTasks,
  listPendingBillingProfileSuspendingDueToPastDueTasks,
  listPendingBillingProfileSuspensionNotifyingTasks,
} from "../db/sql";
import { ProcessBillingProfileSuspendingDueToPastDueTaskHandler } from "./process_billing_profile_suspending_due_to_past_due_task_handler";
import { eqMessage } from "@selfage/message/test_matcher";
import { assertThat, isArray } from "@selfage/test_matcher";
import { TEST_RUNNER } from "@selfage/test_runner";

async function cleanupAll() {
  await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
    await transaction.batchUpdate([
      deleteBillingProfileStatement({ billingProfileAccountIdEq: "account1" }),
      deleteTransactionStatementStatement({
        transactionStatementStatementIdEq: "statement1",
      }),
      deletePaymentStatement({ paymentStatementIdEq: "statement1" }),
      deleteBillingProfileStateSyncingTaskStatement({
        billingProfileStateSyncingTaskAccountIdEq: "account1",
        billingProfileStateSyncingTaskVersionEq: 1,
      }),
      deleteBillingProfileStateSyncingTaskStatement({
        billingProfileStateSyncingTaskAccountIdEq: "account1",
        billingProfileStateSyncingTaskVersionEq: 2,
      }),
      deleteBillingProfileSuspendingDueToPastDueTaskStatement({
        billingProfileSuspendingDueToPastDueTaskStatementIdEq: "statement1",
      }),
      deleteBillingProfileSuspensionNotifyingTaskStatement({
        billingProfileSuspensionNotifyingTaskAccountIdEq: "account1",
        billingProfileSuspensionNotifyingTaskVersionEq: 1,
      }),
      deleteBillingProfileSuspensionNotifyingTaskStatement({
        billingProfileSuspensionNotifyingTaskAccountIdEq: "account1",
        billingProfileSuspensionNotifyingTaskVersionEq: 2,
      }),
    ]);
    await transaction.commit();
  });
}

TEST_RUNNER.run({
  name: "ProcessBillingProfileSuspendingDueToPastDueTaskHandlerTest",
  cases: [
    {
      name: "Success",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertBillingProfileStatement({
              accountId: "account1",
              stateInfo: {
                state: BillingProfileState.HEALTHY,
                version: 1,
                updatedTimeMs: 100,
              },
            }),
            insertBillingProfileStateSyncingTaskStatement({
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
              state: PaymentState.FAILED,
            }),
            insertBillingProfileSuspendingDueToPastDueTaskStatement({
              statementId: "statement1",
              retryCount: 0,
              executionTimeMs: 100,
              createdTimeMs: 100,
            }),
          ]);
          await transaction.commit();
        });
        let handler =
          new ProcessBillingProfileSuspendingDueToPastDueTaskHandler(
            SPANNER_DATABASE,
            () => 1000,
          );

        // Execute
        await handler.handle("", {
          statementId: "statement1",
        });

        // Verify
        assertThat(
          await getBillingProfile(SPANNER_DATABASE, {
            billingProfileAccountIdEq: "account1",
          }),
          isArray([
            eqMessage(
              {
                billingProfileAccountId: "account1",
                billingProfileStateInfo: {
                  state: BillingProfileState.SUSPENDED,
                  version: 2,
                  updatedTimeMs: 1000,
                },
              },
              GET_BILLING_PROFILE_ROW,
            ),
          ]),
          "billingProfile",
        );
        assertThat(
          await getBillingProfileSuspensionNotifyingTask(SPANNER_DATABASE, {
            billingProfileSuspensionNotifyingTaskAccountIdEq: "account1",
            billingProfileSuspensionNotifyingTaskVersionEq: 2,
          }),
          isArray([
            eqMessage(
              {
                billingProfileSuspensionNotifyingTaskAccountId: "account1",
                billingProfileSuspensionNotifyingTaskVersion: 2,
                billingProfileSuspensionNotifyingTaskRetryCount: 0,
                billingProfileSuspensionNotifyingTaskExecutionTimeMs: 1000,
                billingProfileSuspensionNotifyingTaskCreatedTimeMs: 1000,
              },
              GET_BILLING_PROFILE_SUSPENSION_NOTIFYING_TASK_ROW,
            ),
          ]),
          "BillingProfileSuspensionNotifyingTasks",
        );
        assertThat(
          await getBillingProfileStateSyncingTask(SPANNER_DATABASE, {
            billingProfileStateSyncingTaskAccountIdEq: "account1",
            billingProfileStateSyncingTaskVersionEq: 2,
          }),
          isArray([
            eqMessage(
              {
                billingProfileStateSyncingTaskAccountId: "account1",
                billingProfileStateSyncingTaskVersion: 2,
                billingProfileStateSyncingTaskRetryCount: 0,
                billingProfileStateSyncingTaskExecutionTimeMs: 1000,
                billingProfileStateSyncingTaskCreatedTimeMs: 1000,
              },
              GET_BILLING_PROFILE_STATE_SYNCING_TASK_ROW,
            ),
          ]),
          "BillingProfileStateSyncingTasks",
        );
        assertThat(
          await listPendingBillingProfileSuspendingDueToPastDueTasks(
            SPANNER_DATABASE,
            {
              billingProfileSuspendingDueToPastDueTaskExecutionTimeMsLe: 1000000,
            },
          ),
          isArray([]),
          "BillingProfileSuspendingDueToPastDueTasks",
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
            insertBillingProfileStatement({
              accountId: "account1",
              stateInfo: {
                state: BillingProfileState.SUSPENDED,
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
              state: PaymentState.FAILED,
            }),
            insertBillingProfileSuspendingDueToPastDueTaskStatement({
              statementId: "statement1",
              retryCount: 0,
              executionTimeMs: 100,
              createdTimeMs: 100,
            }),
          ]);
          await transaction.commit();
        });
        let handler =
          new ProcessBillingProfileSuspendingDueToPastDueTaskHandler(
            SPANNER_DATABASE,
            () => 1000,
          );

        // Execute
        await handler.handle("", {
          statementId: "statement1",
        });

        // Verify
        assertThat(
          await getBillingProfile(SPANNER_DATABASE, {
            billingProfileAccountIdEq: "account1",
          }),
          isArray([
            eqMessage(
              {
                billingProfileAccountId: "account1",
                billingProfileStateInfo: {
                  state: BillingProfileState.SUSPENDED,
                  version: 1,
                  updatedTimeMs: 100,
                },
              },
              GET_BILLING_PROFILE_ROW,
            ),
          ]),
          "billingProfile",
        );
        assertThat(
          await listPendingBillingProfileSuspensionNotifyingTasks(
            SPANNER_DATABASE,
            { billingProfileSuspensionNotifyingTaskExecutionTimeMsLe: 1000000 },
          ),
          isArray([]),
          "BillingProfileSuspensionNotifyingTasks",
        );
        assertThat(
          await listPendingBillingProfileStateSyncingTasks(SPANNER_DATABASE, {
            billingProfileStateSyncingTaskExecutionTimeMsLe: 1000000,
          }),
          isArray([]),
          "BillingProfileStateSyncingTasks",
        );
        assertThat(
          await listPendingBillingProfileSuspendingDueToPastDueTasks(
            SPANNER_DATABASE,
            {
              billingProfileSuspendingDueToPastDueTaskExecutionTimeMsLe: 1000000,
            },
          ),
          isArray([]),
          "BillingProfileSuspendingDueToPastDueTasks",
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
            insertBillingProfileStatement({
              accountId: "account1",
              stateInfo: {
                state: BillingProfileState.HEALTHY,
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
            insertBillingProfileSuspendingDueToPastDueTaskStatement({
              statementId: "statement1",
              retryCount: 0,
              executionTimeMs: 100,
              createdTimeMs: 100,
            }),
          ]);
          await transaction.commit();
        });
        let handler =
          new ProcessBillingProfileSuspendingDueToPastDueTaskHandler(
            SPANNER_DATABASE,
            () => 1000,
          );

        // Execute
        await handler.handle("", {
          statementId: "statement1",
        });

        // Verify
        assertThat(
          await getBillingProfile(SPANNER_DATABASE, {
            billingProfileAccountIdEq: "account1",
          }),
          isArray([
            eqMessage(
              {
                billingProfileAccountId: "account1",
                billingProfileStateInfo: {
                  state: BillingProfileState.HEALTHY,
                  version: 1,
                  updatedTimeMs: 100,
                },
              },
              GET_BILLING_PROFILE_ROW,
            ),
          ]),
          "billingProfile",
        );
        assertThat(
          await listPendingBillingProfileSuspensionNotifyingTasks(
            SPANNER_DATABASE,
            { billingProfileSuspensionNotifyingTaskExecutionTimeMsLe: 1000000 },
          ),
          isArray([]),
          "BillingProfileSuspensionNotifyingTasks",
        );
        assertThat(
          await listPendingBillingProfileStateSyncingTasks(SPANNER_DATABASE, {
            billingProfileStateSyncingTaskExecutionTimeMsLe: 1000000,
          }),
          isArray([]),
          "BillingProfileStateSyncingTasks",
        );
        assertThat(
          await listPendingBillingProfileSuspendingDueToPastDueTasks(
            SPANNER_DATABASE,
            {
              billingProfileSuspendingDueToPastDueTaskExecutionTimeMsLe: 1000000,
            },
          ),
          isArray([]),
          "BillingProfileSuspendingDueToPastDueTasks",
        );
      },
      tearDown: async () => {
        await cleanupAll();
      },
    },
  ],
});
