import "../local/env";
import { SPANNER_DATABASE } from "../common/spanner_database";
import {
  GET_PAYOUT_PROFILE_ROW,
  GET_STRIPE_CONNECTED_ACCOUNT_CREATING_TASK_ROW,
  deletePayoutProfileStatement,
  deleteStripeConnectedAccountCreatingTaskStatement,
  getPayoutProfile,
  getStripeConnectedAccountCreatingTask,
} from "../db/sql";
import { CreatePayoutProfileHandler } from "./create_payout_profile_handler";
import { eqMessage } from "@selfage/message/test_matcher";
import { assertThat, isArray } from "@selfage/test_matcher";
import { TEST_RUNNER } from "@selfage/test_runner";

TEST_RUNNER.run({
  name: "CreatePayoutProfileHandlerTest",
  cases: [
    {
      name: "Success",
      execute: async () => {
        // Prepare
        let handler = new CreatePayoutProfileHandler(
          SPANNER_DATABASE,
          () => 1000,
        );

        // Execute
        await handler.handle("", { accountId: "account1" });

        // Verify
        assertThat(
          await getPayoutProfile(SPANNER_DATABASE, {
            payoutProfileAccountIdEq: "account1",
          }),
          isArray([
            eqMessage(
              {
                payoutProfileAccountId: "account1",
                payoutProfileCreatedTimeMs: 1000,
              },
              GET_PAYOUT_PROFILE_ROW,
            ),
          ]),
          "account",
        );
        assertThat(
          await getStripeConnectedAccountCreatingTask(SPANNER_DATABASE, {
            stripeConnectedAccountCreatingTaskAccountIdEq: "account1",
          }),
          isArray([
            eqMessage(
              {
                stripeConnectedAccountCreatingTaskAccountId: "account1",
                stripeConnectedAccountCreatingTaskRetryCount: 0,
                stripeConnectedAccountCreatingTaskExecutionTimeMs: 1000,
                stripeConnectedAccountCreatingTaskCreatedTimeMs: 1000,
              },
              GET_STRIPE_CONNECTED_ACCOUNT_CREATING_TASK_ROW,
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
            deletePayoutProfileStatement({
              payoutProfileAccountIdEq: "account1",
            }),
            deleteStripeConnectedAccountCreatingTaskStatement({
              stripeConnectedAccountCreatingTaskAccountIdEq: "account1",
            }),
          ]);
          await transaction.commit();
        });
      },
    },
  ],
});
