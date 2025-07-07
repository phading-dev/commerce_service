import "../local/env";
import { SPANNER_DATABASE } from "../common/spanner_database";
import {
  GET_PAYOUT_PROFILE_ROW,
  GET_STRIPE_CONNECTED_ACCOUNT_FOR_PAYOUT_CREATING_TASK_ROW,
  deletePayoutProfileStatement,
  deleteStripeConnectedAccountForPayoutCreatingTaskStatement,
  getPayoutProfile,
  getStripeConnectedAccountForPayoutCreatingTask,
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
          () => "task1",
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
          await getStripeConnectedAccountForPayoutCreatingTask(
            SPANNER_DATABASE,
            {
              stripeConnectedAccountForPayoutCreatingTaskTaskIdEq: "task1",
            },
          ),
          isArray([
            eqMessage(
              {
                stripeConnectedAccountForPayoutCreatingTaskTaskId: "task1",
                stripeConnectedAccountForPayoutCreatingTaskAccountId:
                  "account1",
                stripeConnectedAccountForPayoutCreatingTaskRetryCount: 0,
                stripeConnectedAccountForPayoutCreatingTaskExecutionTimeMs: 1000,
                stripeConnectedAccountForPayoutCreatingTaskCreatedTimeMs: 1000,
              },
              GET_STRIPE_CONNECTED_ACCOUNT_FOR_PAYOUT_CREATING_TASK_ROW,
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
            deleteStripeConnectedAccountForPayoutCreatingTaskStatement({
              stripeConnectedAccountForPayoutCreatingTaskTaskIdEq: "task1",
            }),
          ]);
          await transaction.commit();
        });
      },
    },
  ],
});
