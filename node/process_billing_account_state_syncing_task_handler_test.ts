import { SPANNER_DATABASE } from "../common/spanner_database";
import { BillingAccountState } from "../db/schema";
import {
  LIST_BILLING_ACCOUNT_STATE_SYNCING_TASKS_ROW,
  deleteBillingAccountStateSyncingTaskStatement,
  deleteBillingAccountStatement,
  insertBillingAccountStateSyncingTaskStatement,
  insertBillingAccountStatement,
  listBillingAccountStateSyncingTasks,
} from "../db/sql";
import { ProcessBillingAccountStateSyncingTaskHandler } from "./process_billing_account_state_syncing_task_handler";
import { BillingAccountState as UserServiceBillingAccountState } from "@phading/user_service_interface/node/billing_account_state";
import {
  SYNC_BILLING_ACCOUNT_STATE,
  SYNC_BILLING_ACCOUNT_STATE_REQUEST_BODY,
} from "@phading/user_service_interface/node/interface";
import { eqMessage } from "@selfage/message/test_matcher";
import { NodeServiceClientMock } from "@selfage/node_service_client/client_mock";
import { assertThat, eq, isArray } from "@selfage/test_matcher";
import { TEST_RUNNER, TestCase } from "@selfage/test_runner";

class SyncStateCase implements TestCase {
  public constructor(
    public name: string,
    private state: BillingAccountState,
    private syncState: UserServiceBillingAccountState,
  ) {}
  public async execute() {
    // Prepare
    await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
      await transaction.batchUpdate([
        insertBillingAccountStatement({
          accountId: "accountId",
          stateInfo: {
            state: this.state,
            version: 1,
          },
        }),
        insertBillingAccountStateSyncingTaskStatement("accountId", 1, 100, 100),
      ]);
      await transaction.commit();
    });
    let clientMock = new NodeServiceClientMock();
    let handler = new ProcessBillingAccountStateSyncingTaskHandler(
      SPANNER_DATABASE,
      clientMock,
      () => 1000,
    );

    // Execute
    handler.handle("", {
      accountId: "accountId",
      version: 1,
    });
    await new Promise<void>((resolve) => (handler.doneCallbackFn = resolve));

    // Verify
    assertThat(
      clientMock.request.descriptor,
      eq(SYNC_BILLING_ACCOUNT_STATE),
      "RC",
    );
    assertThat(
      clientMock.request.body,
      eqMessage(
        {
          accountId: "accountId",
          billingAccountStateVersion: 1,
          billingAccountState: this.syncState,
        },
        SYNC_BILLING_ACCOUNT_STATE_REQUEST_BODY,
      ),
      "RC body",
    );
    assertThat(
      await listBillingAccountStateSyncingTasks(SPANNER_DATABASE, 1000000),
      isArray([]),
      "listBillingAccountStateSyncingTasks",
    );
  }
  public async tearDown() {
    await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
      await transaction.batchUpdate([
        deleteBillingAccountStatement("accountId"),
        deleteBillingAccountStateSyncingTaskStatement("accountId", 1),
      ]);
      await transaction.commit();
    });
  }
}

TEST_RUNNER.run({
  name: "ProcessBillingAccountStateSyncingTaskHandlerTest",
  cases: [
    new SyncStateCase(
      "SyncHealthyState",
      BillingAccountState.HEALTHY,
      UserServiceBillingAccountState.HEALTHY,
    ),
    new SyncStateCase(
      "SyncSuspendedState",
      BillingAccountState.SUSPENDED,
      UserServiceBillingAccountState.SUSPENDED,
    ),
    {
      name: "SyncFailedAndRetried",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertBillingAccountStatement({
              accountId: "accountId",
              stateInfo: {
                state: BillingAccountState.HEALTHY,
                version: 1,
              },
            }),
            insertBillingAccountStateSyncingTaskStatement(
              "accountId",
              1,
              100,
              100,
            ),
          ]);
          await transaction.commit();
        });
        let clientMock = new NodeServiceClientMock();
        clientMock.error = new Error("Fake error");
        let handler = new ProcessBillingAccountStateSyncingTaskHandler(
          SPANNER_DATABASE,
          clientMock,
          () => 1000,
        );

        // Execute
        handler.handle("", {
          accountId: "accountId",
          version: 1,
        });
        await new Promise<void>(
          (resolve) => (handler.doneCallbackFn = resolve),
        );

        // Verify
        assertThat(
          await listBillingAccountStateSyncingTasks(SPANNER_DATABASE, 1000000),
          isArray([
            eqMessage(
              {
                billingAccountStateSyncingTaskAccountId: "accountId",
                billingAccountStateSyncingTaskVersion: 1,
                billingAccountStateSyncingTaskExecutionTimeMs: 301000,
              },
              LIST_BILLING_ACCOUNT_STATE_SYNCING_TASKS_ROW,
            ),
          ]),
          "listBillingAccountStateSyncingTasks",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deleteBillingAccountStatement("accountId"),
            deleteBillingAccountStateSyncingTaskStatement("accountId", 1),
          ]);
          await transaction.commit();
        });
      },
    },
    // Add a test for when version does not match.
  ],
});
