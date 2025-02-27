import { SPANNER_DATABASE } from "../common/spanner_database";
import { BillingAccountState, PaymentState } from "../db/schema";
import {
  GET_BILLING_ACCOUNT_ROW,
  GET_BILLING_ACCOUNT_STATE_SYNCING_TASK_ROW,
  GET_BILLING_ACCOUNT_SUSPENSION_NOTIFYING_TASK_ROW,
  deleteBillingAccountStateSyncingTaskStatement,
  deleteBillingAccountStatement,
  deleteBillingAccountSuspendingDueToPastDueTaskStatement,
  deleteBillingAccountSuspensionNotifyingTaskStatement,
  deleteBillingStatement,
  getBillingAccount,
  getBillingAccountStateSyncingTask,
  getBillingAccountSuspensionNotifyingTask,
  insertBillingAccountStateSyncingTaskStatement,
  insertBillingAccountStatement,
  insertBillingAccountSuspendingDueToPastDueTaskStatement,
  insertBillingStatement,
  listPendingBillingAccountStateSyncingTasks,
  listPendingBillingAccountSuspendingDueToPastDueTasks,
  listPendingBillingAccountSuspensionNotifyingTasks,
} from "../db/sql";
import { ProcessBillingAccountSuspendingDueToPastDueTaskHandler } from "./process_billing_account_suspending_due_to_past_due_task_handler";
import { eqMessage } from "@selfage/message/test_matcher";
import { assertThat, isArray } from "@selfage/test_matcher";
import { TEST_RUNNER } from "@selfage/test_runner";

async function cleanupAll() {
  await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
    await transaction.batchUpdate([
      deleteBillingAccountStatement("account1"),
      deleteBillingStatement("billing1"),
      deleteBillingAccountStateSyncingTaskStatement("account1", 1),
      deleteBillingAccountStateSyncingTaskStatement("account1", 2),
      deleteBillingAccountSuspendingDueToPastDueTaskStatement("billing1"),
      deleteBillingAccountSuspensionNotifyingTaskStatement("account1", 1),
      deleteBillingAccountSuspensionNotifyingTaskStatement("account1", 2),
    ]);
    await transaction.commit();
  });
}

TEST_RUNNER.run({
  name: "ProcessBillingAccountSuspendingDueToPastDueTaskHandlerTest",
  cases: [
    {
      name: "Success",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertBillingAccountStatement({
              accountId: "account1",
              stateInfo: {
                state: BillingAccountState.HEALTHY,
                version: 1,
                updatedTimeMs: 100,
              },
            }),
            insertBillingAccountStateSyncingTaskStatement(
              "account1",
              1,
              0,
              100,
              100,
            ),
            insertBillingStatement({
              billingId: "billing1",
              accountId: "account1",
              state: PaymentState.FAILED,
              month: "2020-01",
            }),
            insertBillingAccountSuspendingDueToPastDueTaskStatement(
              "billing1",
              0,
              100,
              100,
            ),
          ]);
          await transaction.commit();
        });
        let handler =
          new ProcessBillingAccountSuspendingDueToPastDueTaskHandler(
            SPANNER_DATABASE,
            () => 1000,
          );

        // Execute
        await handler.handle("", {
          billingId: "billing1",
        });

        // Verify
        assertThat(
          await getBillingAccount(SPANNER_DATABASE, "account1"),
          isArray([
            eqMessage(
              {
                billingAccountData: {
                  accountId: "account1",
                  stateInfo: {
                    state: BillingAccountState.SUSPENDED,
                    version: 2,
                    updatedTimeMs: 1000,
                  },
                },
              },
              GET_BILLING_ACCOUNT_ROW,
            ),
          ]),
          "billingAccount",
        );
        assertThat(
          await getBillingAccountSuspensionNotifyingTask(
            SPANNER_DATABASE,
            "account1",
            2,
          ),
          isArray([
            eqMessage(
              {
                billingAccountSuspensionNotifyingTaskAccountId: "account1",
                billingAccountSuspensionNotifyingTaskVersion: 2,
                billingAccountSuspensionNotifyingTaskRetryCount: 0,
                billingAccountSuspensionNotifyingTaskExecutionTimeMs: 1000,
                billingAccountSuspensionNotifyingTaskCreatedTimeMs: 1000,
              },
              GET_BILLING_ACCOUNT_SUSPENSION_NOTIFYING_TASK_ROW,
            ),
          ]),
          "BillingAccountSuspensionNotifyingTasks",
        );
        assertThat(
          await getBillingAccountStateSyncingTask(
            SPANNER_DATABASE,
            "account1",
            2,
          ),
          isArray([
            eqMessage(
              {
                billingAccountStateSyncingTaskAccountId: "account1",
                billingAccountStateSyncingTaskVersion: 2,
                billingAccountStateSyncingTaskRetryCount: 0,
                billingAccountStateSyncingTaskExecutionTimeMs: 1000,
                billingAccountStateSyncingTaskCreatedTimeMs: 1000,
              },
              GET_BILLING_ACCOUNT_STATE_SYNCING_TASK_ROW,
            ),
          ]),
          "BillingAccountStateSyncingTasks",
        );
        assertThat(
          await listPendingBillingAccountSuspendingDueToPastDueTasks(
            SPANNER_DATABASE,
            1000000,
          ),
          isArray([]),
          "BillingAccountSuspendingDueToPastDueTasks",
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
            insertBillingAccountStatement({
              accountId: "account1",
              stateInfo: {
                state: BillingAccountState.SUSPENDED,
                version: 2,
                updatedTimeMs: 100,
              },
            }),
            insertBillingStatement({
              billingId: "billing1",
              accountId: "account1",
              state: PaymentState.FAILED,
              month: "2020-01",
            }),
            insertBillingAccountSuspendingDueToPastDueTaskStatement(
              "billing1",
              0,
              100,
              100,
            ),
          ]);
          await transaction.commit();
        });
        let handler =
          new ProcessBillingAccountSuspendingDueToPastDueTaskHandler(
            SPANNER_DATABASE,
            () => 1000,
          );

        // Execute
        await handler.handle("", {
          billingId: "billing1",
        });

        // Verify
        assertThat(
          await getBillingAccount(SPANNER_DATABASE, "account1"),
          isArray([
            eqMessage(
              {
                billingAccountData: {
                  accountId: "account1",
                  stateInfo: {
                    state: BillingAccountState.SUSPENDED,
                    version: 2,
                    updatedTimeMs: 100,
                  },
                },
              },
              GET_BILLING_ACCOUNT_ROW,
            ),
          ]),
          "billingAccount",
        );
        assertThat(
          await listPendingBillingAccountSuspensionNotifyingTasks(
            SPANNER_DATABASE,
            1000000,
          ),
          isArray([]),
          "BillingAccountSuspensionNotifyingTasks",
        );
        assertThat(
          await listPendingBillingAccountStateSyncingTasks(
            SPANNER_DATABASE,
            1000000,
          ),
          isArray([]),
          "BillingAccountStateSyncingTasks",
        );
        assertThat(
          await listPendingBillingAccountSuspendingDueToPastDueTasks(
            SPANNER_DATABASE,
            1000000,
          ),
          isArray([]),
          "BillingAccountSuspendingDueToPastDueTasks",
        );
      },
      tearDown: async () => {
        await cleanupAll();
      },
    },
  ],
});
