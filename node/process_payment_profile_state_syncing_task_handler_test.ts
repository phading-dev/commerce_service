import "../local/env";
import { SPANNER_DATABASE } from "../common/spanner_database";
import { PaymentProfileState } from "../db/schema";
import {
  GET_PAYMENT_PROFILE_STATE_SYNCING_TASK_METADATA_ROW,
  deletePaymentProfileStateSyncingTaskStatement,
  deletePaymentProfileStatement,
  getPaymentProfileStateSyncingTaskMetadata,
  insertPaymentProfileStateSyncingTaskStatement,
  insertPaymentProfileStatement,
  listPendingPaymentProfileStateSyncingTasks,
} from "../db/sql";
import { ProcessPaymentProfileStateSyncingTaskHandler } from "./process_payment_profile_state_syncing_task_handler";
import {
  SYNC_PAYMENT_PROFILE_STATE,
  SYNC_PAYMENT_PROFILE_STATE_REQUEST_BODY,
} from "@phading/user_service_interface/node/interface";
import { PaymentProfileState as UserServicePaymentProfileState } from "@phading/user_service_interface/node/payment_profile_state";
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
    private state: PaymentProfileState,
    private syncState: UserServicePaymentProfileState,
  ) {}
  public async execute() {
    // Prepare
    await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
      await transaction.batchUpdate([
        insertPaymentProfileStatement({
          accountId: "account1",
          stateInfo: {
            state: this.state,
            version: 1,
          },
        }),
        insertPaymentProfileStateSyncingTaskStatement({
          accountId: "account1",
          version: 1,
          retryCount: 0,
          executionTimeMs: 100,
        }),
      ]);
      await transaction.commit();
    });
    let clientMock = new NodeServiceClientMock();
    let handler = new ProcessPaymentProfileStateSyncingTaskHandler(
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
      eq(SYNC_PAYMENT_PROFILE_STATE),
      "RC",
    );
    assertThat(
      clientMock.request.body,
      eqMessage(
        {
          accountId: "account1",
          paymentProfileStateVersion: 1,
          paymentProfileState: this.syncState,
        },
        SYNC_PAYMENT_PROFILE_STATE_REQUEST_BODY,
      ),
      "RC body",
    );
    assertThat(
      await listPendingPaymentProfileStateSyncingTasks(SPANNER_DATABASE, {
        paymentProfileStateSyncingTaskExecutionTimeMsLe: 1000000,
      }),
      isArray([]),
      "listPaymentProfileStateSyncingTasks",
    );
  }
  public async tearDown() {
    await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
      await transaction.batchUpdate([
        deletePaymentProfileStatement({
          paymentProfileAccountIdEq: "account1",
        }),
        deletePaymentProfileStateSyncingTaskStatement({
          paymentProfileStateSyncingTaskAccountIdEq: "account1",
          paymentProfileStateSyncingTaskVersionEq: 1,
        }),
      ]);
      await transaction.commit();
    });
  }
}

TEST_RUNNER.run({
  name: "ProcessPaymentProfileStateSyncingTaskHandlerTest",
  cases: [
    new SyncStateCase(
      "SyncHealthyState",
      PaymentProfileState.HEALTHY,
      UserServicePaymentProfileState.HEALTHY,
    ),
    new SyncStateCase(
      "SyncSuspendedState",
      PaymentProfileState.SUSPENDED,
      UserServicePaymentProfileState.SUSPENDED,
    ),
    {
      name: "SyncFailed",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertPaymentProfileStatement({
              accountId: "account1",
              stateInfo: {
                state: PaymentProfileState.HEALTHY,
                version: 1,
              },
            }),
            insertPaymentProfileStateSyncingTaskStatement({
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
        let handler = new ProcessPaymentProfileStateSyncingTaskHandler(
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
            deletePaymentProfileStatement({
              paymentProfileAccountIdEq: "account1",
            }),
            deletePaymentProfileStateSyncingTaskStatement({
              paymentProfileStateSyncingTaskAccountIdEq: "account1",
              paymentProfileStateSyncingTaskVersionEq: 1,
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
            insertPaymentProfileStatement({
              accountId: "account1",
              stateInfo: {
                state: PaymentProfileState.HEALTHY,
                version: 2,
              },
            }),
            insertPaymentProfileStateSyncingTaskStatement({
              accountId: "account1",
              version: 1,
              retryCount: 0,
              executionTimeMs: 100,
            }),
          ]);
          await transaction.commit();
        });
        let handler = new ProcessPaymentProfileStateSyncingTaskHandler(
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
              "Payment profile account1 version is 2 which doesn't match task version 1.",
            ),
          ),
          "error",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deletePaymentProfileStatement({
              paymentProfileAccountIdEq: "account1",
            }),
            deletePaymentProfileStateSyncingTaskStatement({
              paymentProfileStateSyncingTaskAccountIdEq: "account1",
              paymentProfileStateSyncingTaskVersionEq: 1,
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
            insertPaymentProfileStateSyncingTaskStatement({
              accountId: "account1",
              version: 1,
              retryCount: 0,
              executionTimeMs: 100,
            }),
          ]);
          await transaction.commit();
        });
        let handler = new ProcessPaymentProfileStateSyncingTaskHandler(
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
          await getPaymentProfileStateSyncingTaskMetadata(SPANNER_DATABASE, {
            paymentProfileStateSyncingTaskAccountIdEq: "account1",
            paymentProfileStateSyncingTaskVersionEq: 1,
          }),
          isArray([
            eqMessage(
              {
                paymentProfileStateSyncingTaskRetryCount: 1,
                paymentProfileStateSyncingTaskExecutionTimeMs: 301000,
              },
              GET_PAYMENT_PROFILE_STATE_SYNCING_TASK_METADATA_ROW,
            ),
          ]),
          "task",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deletePaymentProfileStateSyncingTaskStatement({
              paymentProfileStateSyncingTaskAccountIdEq: "account1",
              paymentProfileStateSyncingTaskVersionEq: 1,
            }),
          ]);
          await transaction.commit();
        });
      },
    },
  ],
});
