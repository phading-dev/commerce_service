import { SPANNER_DATABASE } from "../common/spanner_database";
import {
  GET_EARNINGS_ACCOUNT_ROW,
  LIST_STRIPE_CONNECTED_ACCOUNT_CREATING_TASKS_ROW,
  deleteEarningsAccountStatement,
  deleteStripeConnectedAccountCreatingTaskStatement,
  getEarningsAccount,
  listStripeConnectedAccountCreatingTasks,
} from "../db/sql";
import { CreateEarningsAccountHandler } from "./create_earnings_account_handler";
import { eqMessage } from "@selfage/message/test_matcher";
import { assertThat, isArray } from "@selfage/test_matcher";
import { TEST_RUNNER } from "@selfage/test_runner";

let FUTURE_TIME_MS = 365 * 24 * 60 * 60 * 1000;

TEST_RUNNER.run({
  name: "CreateEarningsAccountHandlerTest",
  cases: [
    {
      name: "Success",
      execute: async () => {
        // Prepare
        let handler = new CreateEarningsAccountHandler(
          SPANNER_DATABASE,
          () => 1000,
        );

        // Execute
        await handler.handle("", { accountId: "account1" });

        // Verify
        assertThat(
          await getEarningsAccount(SPANNER_DATABASE, "account1"),
          isArray([
            eqMessage(
              {
                earningsAccountData: {
                  accountId: "account1",
                },
              },
              GET_EARNINGS_ACCOUNT_ROW,
            ),
          ]),
          "account",
        );
        assertThat(
          await listStripeConnectedAccountCreatingTasks(
            SPANNER_DATABASE,
            FUTURE_TIME_MS,
          ),
          isArray([
            eqMessage(
              {
                stripeConnectedAccountCreatingTaskAccountId: "account1",
                stripeConnectedAccountCreatingTaskExecutionTimeMs: 1000,
              },
              LIST_STRIPE_CONNECTED_ACCOUNT_CREATING_TASKS_ROW,
            ),
          ]),
          "task",
        );

        // Execute again
        await handler.handle("", { accountId: "account1" });

        // Verify no error
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deleteEarningsAccountStatement("account1"),
            deleteStripeConnectedAccountCreatingTaskStatement("account1"),
          ]);
          await transaction.commit();
        });
      },
    },
  ],
});
