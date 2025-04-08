import "../local/env";
import { SPANNER_DATABASE } from "../common/spanner_database";
import { PayoutState } from "../db/schema";
import {
  GET_PAYOUT_ROW,
  GET_PAYOUT_TASK_METADATA_ROW,
  deletePayoutProfileStatement,
  deletePayoutStatement,
  deletePayoutTaskStatement,
  deleteTransactionStatementStatement,
  getPayout,
  getPayoutTaskMetadata,
  insertPayoutProfileStatement,
  insertPayoutStatement,
  insertPayoutTaskStatement,
  insertTransactionStatementStatement,
  listPendingPayoutTasks,
} from "../db/sql";
import { ProcessPayoutTaskHandler } from "./process_payout_task_handler";
import { AmountType } from "@phading/price/amount_type";
import { newBadRequestError } from "@selfage/http_error";
import { eqHttpError } from "@selfage/http_error/test_matcher";
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

async function insertPayout(): Promise<void> {
  await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
    await transaction.batchUpdate([
      insertPayoutProfileStatement({
        accountId: "account1",
        stripeConnectedAccountId: "stripConnectedAccount1",
      }),
      insertTransactionStatementStatement({
        statementId: "statement1",
        accountId: "account1",
        statement: {
          currency: "USD",
          totalAmount: 1200,
          totalAmountType: AmountType.CREDIT,
        },
      }),
      insertPayoutStatement({
        statementId: "statement1",
        accountId: "account1",
        state: PayoutState.PROCESSING,
      }),
      insertPayoutTaskStatement({
        statementId: "statement1",
        retryCount: 0,
        executionTimeMs: 100,
      }),
    ]);
    await transaction.commit();
  });
}

async function cleanupAll(): Promise<void> {
  await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
    await transaction.batchUpdate([
      deletePayoutProfileStatement({
        payoutProfileAccountIdEq: "account1",
      }),
      deleteTransactionStatementStatement({
        transactionStatementStatementIdEq: "statement1",
      }),
      deletePayoutStatement({ payoutStatementIdEq: "statement1" }),
      deletePayoutTaskStatement({ payoutTaskStatementIdEq: "statement1" }),
    ]);
    await transaction.commit();
  });
}

TEST_RUNNER.run({
  name: "ProcessPayoutTaskHandlerTest",
  cases: [
    {
      name: "ProcessTask",
      execute: async () => {
        // Prepare
        await insertPayout();
        let stripeConnectedAccountIdCaptured: string;
        let createTransferParamsCaptured: any;
        let optionCaptured: any;
        let stripeClientMock: any = {
          accounts: {
            retrieve: async (stripeConnectedAccountId: string) => {
              stripeConnectedAccountIdCaptured = stripeConnectedAccountId;
              return { payouts_enabled: true };
            },
          },
          transfers: {
            create: async (createTransferParams: any, option: any) => {
              createTransferParamsCaptured = createTransferParams;
              optionCaptured = option;
              return { id: "transfer1" };
            },
          },
        };
        let handler = new ProcessPayoutTaskHandler(
          SPANNER_DATABASE,
          new Ref(stripeClientMock),
          () => 1000,
        );

        // Execute
        await handler.processTask("", {
          statementId: "statement1",
        });

        // Verify
        assertThat(
          stripeConnectedAccountIdCaptured,
          eq("stripConnectedAccount1"),
          "stripeConnectedAccountId",
        );
        assertThat(
          createTransferParamsCaptured.amount,
          eq(1200),
          "createTransferParams.amount",
        );
        assertThat(
          createTransferParamsCaptured.currency,
          eq("usd"),
          "createTransferParams.currency",
        );
        assertThat(
          createTransferParamsCaptured.destination,
          eq("stripConnectedAccount1"),
          "createTransferParams.destination",
        );
        assertThat(
          optionCaptured.idempotencyKey,
          eq("statement1"),
          "option.idempotencyKey",
        );
        assertThat(
          await getPayout(SPANNER_DATABASE, {
            payoutStatementIdEq: "statement1",
          }),
          isArray([
            eqMessage(
              {
                payoutStatementId: "statement1",
                payoutAccountId: "account1",
                payoutState: PayoutState.PAID,
                payoutStripeTransferId: "transfer1",
                payoutUpdatedTimeMs: 1000,
              },
              GET_PAYOUT_ROW,
            ),
          ]),
          "payout",
        );
        assertThat(
          await listPendingPayoutTasks(SPANNER_DATABASE, {
            payoutTaskExecutionTimeMsLe: 1000000,
          }),
          isArray([]),
          "payoutTasks",
        );
      },
      tearDown: async () => {
        await cleanupAll();
      },
    },
    {
      name: "PayoutFailed",
      execute: async () => {
        // Prepare
        await insertPayout();
        let stripeClientMock: any = {
          accounts: {
            retrieve: async () => {
              return { payouts_enabled: true };
            },
          },
          transfers: {
            create: async () => {
              throw new Error("Fake error");
            },
          },
        };
        let handler = new ProcessPayoutTaskHandler(
          SPANNER_DATABASE,
          new Ref(stripeClientMock),
          () => 1000,
        );

        // Execute
        let error = await assertReject(
          handler.processTask("", {
            statementId: "statement1",
          }),
        );

        // Verify
        assertThat(error, eqError(new Error("Fake error")), "error");
        assertThat(
          await getPayout(SPANNER_DATABASE, {
            payoutStatementIdEq: "statement1",
          }),
          isArray([
            eqMessage(
              {
                payoutStatementId: "statement1",
                payoutAccountId: "account1",
                payoutState: PayoutState.PROCESSING,
              },
              GET_PAYOUT_ROW,
            ),
          ]),
          "payout",
        );
      },
      tearDown: async () => {
        await cleanupAll();
      },
    },
    {
      name: "PayoutNotEnabledAndReportFailure",
      execute: async () => {
        // Prepare
        await insertPayout();
        let stripeClientMock: any = {
          accounts: {
            retrieve: async () => {
              return { payouts_enabled: false };
            },
          },
        };
        let handler = new ProcessPayoutTaskHandler(
          SPANNER_DATABASE,
          new Ref(stripeClientMock),
          () => 1000,
        );

        // Execute
        await handler.processTask("", {
          statementId: "statement1",
        });

        // Verify
        assertThat(
          await getPayout(SPANNER_DATABASE, {
            payoutStatementIdEq: "statement1",
          }),
          isArray([
            eqMessage(
              {
                payoutStatementId: "statement1",
                payoutAccountId: "account1",
                payoutState: PayoutState.DISABLED,
                payoutUpdatedTimeMs: 1000,
              },
              GET_PAYOUT_ROW,
            ),
          ]),
          "payout",
        );
        assertThat(
          await listPendingPayoutTasks(SPANNER_DATABASE, {
            payoutTaskExecutionTimeMsLe: 1000000,
          }),
          isArray([]),
          "payoutTasks",
        );
      },
      tearDown: async () => {
        await cleanupAll();
      },
    },
    {
      name: "PayoutNotInProcessingState",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertPayoutStatement({
              statementId: "statement1",
              state: PayoutState.PAID,
            }),
          ]);
          await transaction.commit();
        });
        let stripeClientMock: any = {};
        let handler = new ProcessPayoutTaskHandler(
          SPANNER_DATABASE,
          new Ref(stripeClientMock),
          () => 1000,
        );

        // Execute
        let error = await assertReject(
          handler.processTask("", {
            statementId: "statement1",
          }),
        );

        // Verify
        assertThat(
          error,
          eqHttpError(
            newBadRequestError("Payout statement1 is not in PROCESSING state."),
          ),
          "error",
        );
      },
      tearDown: async () => {
        await cleanupAll();
      },
    },
    {
      name: "ClaimTask",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertPayoutTaskStatement({
              statementId: "statement1",
              retryCount: 0,
              executionTimeMs: 100,
            }),
          ]);
          await transaction.commit();
        });
        let handler = new ProcessPayoutTaskHandler(
          SPANNER_DATABASE,
          undefined,
          () => 1000,
        );

        // Execute
        await handler.claimTask("", {
          statementId: "statement1",
        });

        // Verify
        assertThat(
          await getPayoutTaskMetadata(SPANNER_DATABASE, {
            payoutTaskStatementIdEq: "statement1",
          }),
          isArray([
            eqMessage(
              {
                payoutTaskRetryCount: 1,
                payoutTaskExecutionTimeMs: 301000,
              },
              GET_PAYOUT_TASK_METADATA_ROW,
            ),
          ]),
          "payoutTask",
        );
      },
      tearDown: async () => {
        await cleanupAll();
      },
    },
  ],
});
