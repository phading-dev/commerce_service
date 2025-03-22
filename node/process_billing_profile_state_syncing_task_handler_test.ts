import "../local/env";
import { SPANNER_DATABASE } from "../common/spanner_database";
import { BillingProfileState } from "../db/schema";
import {
  GET_BILLING_PROFILE_STATE_SYNCING_TASK_METADATA_ROW,
  deleteBillingProfileStateSyncingTaskStatement,
  deleteBillingProfileStatement,
  getBillingProfileStateSyncingTaskMetadata,
  insertBillingProfileStateSyncingTaskStatement,
  insertBillingProfileStatement,
  listPendingBillingProfileStateSyncingTasks,
} from "../db/sql";
import { ProcessBillingProfileStateSyncingTaskHandler } from "./process_billing_profile_state_syncing_task_handler";
import { BillingProfileState as UserServiceBillingProfileState } from "@phading/user_service_interface/node/billing_profile_state";
import {
  SYNC_BILLING_PROFILE_STATE,
  SYNC_BILLING_PROFILE_STATE_REQUEST_BODY,
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
    private state: BillingProfileState,
    private syncState: UserServiceBillingProfileState,
  ) {}
  public async execute() {
    // Prepare
    await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
      await transaction.batchUpdate([
        insertBillingProfileStatement({
          accountId: "account1",
          stateInfo: {
            state: this.state,
            version: 1,
          },
        }),
        insertBillingProfileStateSyncingTaskStatement({
          accountId: "account1",
          version: 1,
          retryCount: 0,
          executionTimeMs: 100,
        }),
      ]);
      await transaction.commit();
    });
    let clientMock = new NodeServiceClientMock();
    let handler = new ProcessBillingProfileStateSyncingTaskHandler(
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
      eq(SYNC_BILLING_PROFILE_STATE),
      "RC",
    );
    assertThat(
      clientMock.request.body,
      eqMessage(
        {
          accountId: "account1",
          billingProfileStateVersion: 1,
          billingProfileState: this.syncState,
        },
        SYNC_BILLING_PROFILE_STATE_REQUEST_BODY,
      ),
      "RC body",
    );
    assertThat(
      await listPendingBillingProfileStateSyncingTasks(SPANNER_DATABASE, {
        billingProfileStateSyncingTaskExecutionTimeMsLe: 1000000,
      }),
      isArray([]),
      "listBillingProfileStateSyncingTasks",
    );
  }
  public async tearDown() {
    await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
      await transaction.batchUpdate([
        deleteBillingProfileStatement({
          billingProfileAccountIdEq: "account1",
        }),
        deleteBillingProfileStateSyncingTaskStatement({
          billingProfileStateSyncingTaskAccountIdEq: "account1",
          billingProfileStateSyncingTaskVersionEq: 1,
        }),
      ]);
      await transaction.commit();
    });
  }
}

TEST_RUNNER.run({
  name: "ProcessBillingProfileStateSyncingTaskHandlerTest",
  cases: [
    new SyncStateCase(
      "SyncHealthyState",
      BillingProfileState.HEALTHY,
      UserServiceBillingProfileState.HEALTHY,
    ),
    new SyncStateCase(
      "SyncSuspendedState",
      BillingProfileState.SUSPENDED,
      UserServiceBillingProfileState.SUSPENDED,
    ),
    {
      name: "SyncFailed",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertBillingProfileStatement({
              accountId: "account1",
              stateInfo: {
                state: BillingProfileState.HEALTHY,
                version: 1,
              },
            }),
            insertBillingProfileStateSyncingTaskStatement({
              accountId: "account1",
              version: 1,
              retryCount: 0,
              executionTimeMs: 100,
            }),
          ]);
          await transaction.commit();
        });
        let clientMock = new NodeServiceClientMock();
        clientMock.error = new Error("Fake error");
        let handler = new ProcessBillingProfileStateSyncingTaskHandler(
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
            deleteBillingProfileStatement({
              billingProfileAccountIdEq: "account1",
            }),
            deleteBillingProfileStateSyncingTaskStatement({
              billingProfileStateSyncingTaskAccountIdEq: "account1",
              billingProfileStateSyncingTaskVersionEq: 1,
            }),
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
            insertBillingProfileStatement({
              accountId: "account1",
              stateInfo: {
                state: BillingProfileState.HEALTHY,
                version: 2,
              },
            }),
            insertBillingProfileStateSyncingTaskStatement({
              accountId: "account1",
              version: 1,
              retryCount: 0,
              executionTimeMs: 100,
            }),
          ]);
          await transaction.commit();
        });
        let handler = new ProcessBillingProfileStateSyncingTaskHandler(
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
              "Billing profile account1 version is 2 which doesn't match task version 1.",
            ),
          ),
          "error",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deleteBillingProfileStatement({
              billingProfileAccountIdEq: "account1",
            }),
            deleteBillingProfileStateSyncingTaskStatement({
              billingProfileStateSyncingTaskAccountIdEq: "account1",
              billingProfileStateSyncingTaskVersionEq: 1,
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
            insertBillingProfileStateSyncingTaskStatement({
              accountId: "account1",
              version: 1,
              retryCount: 0,
              executionTimeMs: 100,
            }),
          ]);
          await transaction.commit();
        });
        let handler = new ProcessBillingProfileStateSyncingTaskHandler(
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
          await getBillingProfileStateSyncingTaskMetadata(SPANNER_DATABASE, {
            billingProfileStateSyncingTaskAccountIdEq: "account1",
            billingProfileStateSyncingTaskVersionEq: 1,
          }),
          isArray([
            eqMessage(
              {
                billingProfileStateSyncingTaskRetryCount: 1,
                billingProfileStateSyncingTaskExecutionTimeMs: 301000,
              },
              GET_BILLING_PROFILE_STATE_SYNCING_TASK_METADATA_ROW,
            ),
          ]),
          "task",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deleteBillingProfileStateSyncingTaskStatement({
              billingProfileStateSyncingTaskAccountIdEq: "account1",
              billingProfileStateSyncingTaskVersionEq: 1,
            }),
          ]);
          await transaction.commit();
        });
      },
    },
  ],
});
