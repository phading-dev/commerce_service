import { SPANNER_DATABASE } from "../common/spanner_database";
import { PayoutState } from "../db/schema";
import {
  GET_EARNINGS_ROW,
  LIST_PAYOUT_TASKS_ROW,
  deleteEarningsAccountStatement,
  deleteEarningsStatement,
  deletePayoutTaskStatement,
  getEarnings,
  insertEarningsAccountStatement,
  insertEarningsStatement,
  insertPayoutTaskStatement,
  listPayoutTasks,
} from "../db/sql";
import { ProcessPayoutTaskHandler } from "./process_payout_task_handler";
import { newBadRequestError } from "@selfage/http_error";
import { eqHttpError } from "@selfage/http_error/test_matcher";
import { eqMessage } from "@selfage/message/test_matcher";
import { assertReject, assertThat, eq, isArray } from "@selfage/test_matcher";
import { TEST_RUNNER } from "@selfage/test_runner";

async function cleanupAll(): Promise<void> {
  await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
    await transaction.batchUpdate([
      deleteEarningsAccountStatement("account1"),
      deleteEarningsStatement("earnings1"),
      deletePayoutTaskStatement("earnings1"),
    ]);
    await transaction.commit();
  });
}

TEST_RUNNER.run({
  name: "ProcessPayoutTaskHandlerTest",
  cases: [
    {
      name: "Success",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertEarningsAccountStatement({
              accountId: "account1",
              stripeConnectedAccountId: "stripConnectedAccount1",
            }),
            insertEarningsStatement({
              accountId: "account1",
              earningsId: "earnings1",
              state: PayoutState.PROCESSING,
              month: "2021-01",
              totalAmount: 1200,
              currency: "USD",
            }),
            insertPayoutTaskStatement("earnings1", 100, 100),
          ]);
          await transaction.commit();
        });
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
          stripeClientMock,
          () => 1000,
        );

        // Execute
        handler.handle("", {
          earningsId: "earnings1",
        });
        await new Promise<void>(
          (resolve) => (handler.doneCallbackFn = resolve),
        );

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
          eq("earnings1"),
          "option.idempotencyKey",
        );
        assertThat(
          await getEarnings(SPANNER_DATABASE, "earnings1"),
          isArray([
            eqMessage(
              {
                earningsData: {
                  accountId: "account1",
                  earningsId: "earnings1",
                  state: PayoutState.PAID,
                  month: "2021-01",
                  totalAmount: 1200,
                  currency: "USD",
                  stripeTransferId: "transfer1",
                },
              },
              GET_EARNINGS_ROW,
            ),
          ]),
          "earnings",
        );
        assertThat(
          await listPayoutTasks(SPANNER_DATABASE, 1000000),
          isArray([]),
          "payoutTasks",
        );
      },
      tearDown: async () => {
        await cleanupAll();
      },
    },
    {
      name: "PayoutFailedAndRetried",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertEarningsAccountStatement({
              accountId: "account1",
              stripeConnectedAccountId: "stripConnectedAccount1",
            }),
            insertEarningsStatement({
              accountId: "account1",
              earningsId: "earnings1",
              state: PayoutState.PROCESSING,
              month: "2021-01",
              totalAmount: 1200,
              currency: "USD",
            }),
            insertPayoutTaskStatement("earnings1", 100, 100),
          ]);
          await transaction.commit();
        });
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
          stripeClientMock,
          () => 1000,
        );

        // Execute
        handler.handle("", {
          earningsId: "earnings1",
        });
        await new Promise<void>(
          (resolve) => (handler.doneCallbackFn = resolve),
        );

        // Verify
        assertThat(
          await getEarnings(SPANNER_DATABASE, "earnings1"),
          isArray([
            eqMessage(
              {
                earningsData: {
                  accountId: "account1",
                  earningsId: "earnings1",
                  state: PayoutState.PROCESSING,
                  month: "2021-01",
                  totalAmount: 1200,
                  currency: "USD",
                },
              },
              GET_EARNINGS_ROW,
            ),
          ]),
          "earnings",
        );
        assertThat(
          await listPayoutTasks(SPANNER_DATABASE, 1000000),
          isArray([
            eqMessage(
              {
                payoutTaskEarningsId: "earnings1",
                payoutTaskExecutionTimeMs: 301000,
              },
              LIST_PAYOUT_TASKS_ROW,
            ),
          ]),
          "payoutTasks",
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
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertEarningsAccountStatement({
              accountId: "account1",
              stripeConnectedAccountId: "stripConnectedAccount1",
            }),
            insertEarningsStatement({
              accountId: "account1",
              earningsId: "earnings1",
              state: PayoutState.PROCESSING,
              month: "2021-01",
              totalAmount: 1200,
              currency: "USD",
            }),
            insertPayoutTaskStatement("earnings1", 100, 100),
          ]);
          await transaction.commit();
        });
        let stripeClientMock: any = {
          accounts: {
            retrieve: async () => {
              return { payouts_enabled: false };
            },
          },
        };
        let handler = new ProcessPayoutTaskHandler(
          SPANNER_DATABASE,
          stripeClientMock,
          () => 1000,
        );

        // Execute
        handler.handle("", {
          earningsId: "earnings1",
        });
        await new Promise<void>(
          (resolve) => (handler.doneCallbackFn = resolve),
        );

        // Verify
        assertThat(
          await getEarnings(SPANNER_DATABASE, "earnings1"),
          isArray([
            eqMessage(
              {
                earningsData: {
                  accountId: "account1",
                  earningsId: "earnings1",
                  state: PayoutState.FAILED,
                  month: "2021-01",
                  totalAmount: 1200,
                  currency: "USD",
                },
              },
              GET_EARNINGS_ROW,
            ),
          ]),
          "earnings",
        );
        assertThat(
          await listPayoutTasks(SPANNER_DATABASE, 1000000),
          isArray([]),
          "payoutTasks",
        );
      },
      tearDown: async () => {
        await cleanupAll();
      },
    },
    {
      name: "EarningsNotInProcessingState",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertEarningsAccountStatement({
              accountId: "account1",
              stripeConnectedAccountId: "stripConnectedAccount1",
            }),
            insertEarningsStatement({
              accountId: "account1",
              earningsId: "earnings1",
              state: PayoutState.PAID,
              month: "2021-01",
              totalAmount: 1200,
              currency: "USD",
            }),
          ]);
          await transaction.commit();
        });
        let stripeClientMock: any = {};
        let handler = new ProcessPayoutTaskHandler(
          SPANNER_DATABASE,
          stripeClientMock,
          () => 1000,
        );

        // Execute
        let error = await assertReject(
          handler.handle("", {
            earningsId: "earnings1",
          }),
        );

        // Verify
        assertThat(
          error,
          eqHttpError(
            newBadRequestError(
              "Earnings earnings1 is not in PROCESSING state.",
            ),
          ),
          "error",
        );
      },
      tearDown: async () => {
        await cleanupAll();
      },
    },
    // Add a test for insufficient balance.
  ],
});
