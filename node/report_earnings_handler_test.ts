import { SPANNER_DATABASE } from "../common/spanner_database";
import { PayoutState } from "../db/schema";
import {
  GET_EARNINGS_ROW,
  GET_PAYOUT_TASK_ROW,
  deleteEarningsStatement,
  deletePayoutTaskStatement,
  getEarnings,
  getPayoutTask,
  insertEarningsStatement,
  listPendingPayoutTasks,
} from "../db/sql";
import { ReportEarningsHandler } from "./report_earnings_handler";
import { ProductType } from "@phading/price";
import { eqMessage } from "@selfage/message/test_matcher";
import { assertThat, isArray } from "@selfage/test_matcher";
import { TEST_RUNNER } from "@selfage/test_runner";

TEST_RUNNER.run({
  name: "ReportEarningsHandlerTest",
  cases: [
    {
      name: "Success",
      execute: async () => {
        // Prepare
        let handler = new ReportEarningsHandler(
          SPANNER_DATABASE,
          () => "earnings1",
          () => 1000,
        );

        // Execute
        await handler.handle("", {
          accountId: "account1",
          month: "2021-01",
          watchTimeSec: 3700,
        });

        // Verify
        assertThat(
          await getEarnings(SPANNER_DATABASE, "earnings1"),
          isArray([
            eqMessage(
              {
                earningsData: {
                  accountId: "account1",
                  earningsId: "earnings1",
                  month: "2021-01",
                  currency: "USD",
                  totalAmount: 8,
                  state: PayoutState.PROCESSING,
                  createdTimeMs: 1000,
                  items: [
                    {
                      productType: ProductType.SHOW_PAYOUT,
                      quantity: 3700,
                      amount: 8,
                    },
                  ],
                },
              },
              GET_EARNINGS_ROW,
            ),
          ]),
          "earnings",
        );
        assertThat(
          await getPayoutTask(SPANNER_DATABASE, "earnings1"),
          isArray([
            eqMessage(
              {
                payoutTaskEarningsId: "earnings1",
                payoutTaskRetryCount: 0,
                payoutTaskExecutionTimeMs: 1000,
                payoutTaskCreatedTimeMs: 1000,
              },
              GET_PAYOUT_TASK_ROW,
            ),
          ]),
          "payoutTasks",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deleteEarningsStatement("earnings1"),
            deletePayoutTaskStatement("earnings1"),
          ]);
          await transaction.commit();
        });
      },
    },
    {
      name: "EarningsAlreadyExist",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertEarningsStatement({
              earningsId: "earnings1",
              accountId: "account1",
              month: "2021-01",
              state: PayoutState.PROCESSING,
            }),
          ]);
          await transaction.commit();
        });
        let handler = new ReportEarningsHandler(
          SPANNER_DATABASE,
          () => "earnings1",
          () => 1000,
        );

        // Execute
        await handler.handle("", {
          accountId: "account1",
          month: "2021-01",
          watchTimeSec: 3700,
        });

        // Verify
        assertThat(
          await getEarnings(SPANNER_DATABASE, "earnings1"),
          isArray([
            eqMessage(
              {
                earningsData: {
                  accountId: "account1",
                  earningsId: "earnings1",
                  month: "2021-01",
                  state: PayoutState.PROCESSING,
                },
              },
              GET_EARNINGS_ROW,
            ),
          ]),
          "earnings",
        );
        assertThat(
          await listPendingPayoutTasks(SPANNER_DATABASE, 1000000),
          isArray([]),
          "payoutTasks",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([deleteEarningsStatement("earnings1")]);
          await transaction.commit();
        });
      },
    },
  ],
});
