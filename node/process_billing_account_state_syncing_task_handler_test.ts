import { SPANNER_DATABASE } from "../common/spanner_database";
import { BillingAccountState } from "../db/schema";
import {
  GET_BILLING_ACCOUNT_STATE_SYNCING_TASK_METADATA_ROW,
  deleteBillingAccountStateSyncingTaskStatement,
  deleteBillingAccountStatement,
  getBillingAccountStateSyncingTaskMetadata,
  insertBillingAccountStateSyncingTaskStatement,
  insertBillingAccountStatement,
  listPendingBillingAccountStateSyncingTasks,
} from "../db/sql";
import { ProcessBillingAccountStateSyncingTaskHandler } from "./process_billing_account_state_syncing_task_handler";
import { BillingAccountState as UserServiceBillingAccountState } from "@phading/user_service_interface/node/billing_account_state";
import {
  SYNC_BILLING_ACCOUNT_STATE,
  SYNC_BILLING_ACCOUNT_STATE_REQUEST_BODY,
} from "@phading/user_service_interface/node/interface";
import { newBadRequestError } from "@selfage/http_error";
import { eqHttpError } from "@selfage/http_error/test_matcher";
import { eqMessage } from "@selfage/message/test_matcher";
import { NodeServiceClientMock } from "@selfage/node_service_client/client_mock";
import {
  assertReject,
  assertThat,
  eq,
  eqError,
  isArray,
} from "@selfage/test_matcher";
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
          accountId: "account1",
          stateInfo: {
            state: this.state,
            version: 1,
          },
        }),
        insertBillingAccountStateSyncingTaskStatement(
          "account1",
          1,
          0,
          100,
          100,
        ),
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
    await handler.processTask("", {
      accountId: "account1",
      version: 1,
    });

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
          accountId: "account1",
          billingAccountStateVersion: 1,
          billingAccountState: this.syncState,
        },
        SYNC_BILLING_ACCOUNT_STATE_REQUEST_BODY,
      ),
      "RC body",
    );
    assertThat(
      await listPendingBillingAccountStateSyncingTasks(
        SPANNER_DATABASE,
        1000000,
      ),
      isArray([]),
      "listBillingAccountStateSyncingTasks",
    );
  }
  public async tearDown() {
    await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
      await transaction.batchUpdate([
        deleteBillingAccountStatement("account1"),
        deleteBillingAccountStateSyncingTaskStatement("account1", 1),
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
      name: "SyncFailed",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertBillingAccountStatement({
              accountId: "account1",
              stateInfo: {
                state: BillingAccountState.HEALTHY,
                version: 1,
              },
            }),
            insertBillingAccountStateSyncingTaskStatement(
              "account1",
              1,
              0,
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
        let error = await assertReject(
          handler.processTask("", {
            accountId: "account1",
            version: 1,
          }),
        );

        // Verify
        assertThat(error, eqError(new Error("Fake error")), "error");
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deleteBillingAccountStatement("account1"),
            deleteBillingAccountStateSyncingTaskStatement("account1", 1),
          ]);
          await transaction.commit();
        });
      },
    },
    {
      name: "VersionMismatch",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertBillingAccountStatement({
              accountId: "account1",
              stateInfo: {
                state: BillingAccountState.HEALTHY,
                version: 2,
              },
            }),
            insertBillingAccountStateSyncingTaskStatement(
              "account1",
              1,
              0,
              100,
              100,
            ),
          ]);
          await transaction.commit();
        });
        let handler = new ProcessBillingAccountStateSyncingTaskHandler(
          SPANNER_DATABASE,
          new NodeServiceClientMock(),
          () => 1000,
        );

        // Execute
        let error = await assertReject(
          handler.processTask("", {
            accountId: "account1",
            version: 1,
          }),
        );

        // Verify
        assertThat(
          error,
          eqHttpError(
            newBadRequestError(
              "Billing account account1 version is 2 which doesn't match task version 1.",
            ),
          ),
          "error",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deleteBillingAccountStatement("account1"),
            deleteBillingAccountStateSyncingTaskStatement("account1", 1),
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
            insertBillingAccountStateSyncingTaskStatement(
              "account1",
              1,
              0,
              100,
              100,
            ),
          ]);
          await transaction.commit();
        });
        let handler = new ProcessBillingAccountStateSyncingTaskHandler(
          SPANNER_DATABASE,
          undefined,
          () => 1000,
        );

        // Execute
        await handler.claimTask("", {
          accountId: "account1",
          version: 1,
        });

        // Verify
        assertThat(
          await getBillingAccountStateSyncingTaskMetadata(
            SPANNER_DATABASE,
            "account1",
            1,
          ),
          isArray([
            eqMessage(
              {
                billingAccountStateSyncingTaskRetryCount: 1,
                billingAccountStateSyncingTaskExecutionTimeMs: 301000,
              },
              GET_BILLING_ACCOUNT_STATE_SYNCING_TASK_METADATA_ROW,
            ),
          ]),
          "task",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deleteBillingAccountStateSyncingTaskStatement("account1", 1),
          ]);
          await transaction.commit();
        });
      },
    },
  ],
});
