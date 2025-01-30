import { SPANNER_DATABASE } from "../common/spanner_database";
import { BillingAccountState } from "../db/schema";
import {
  GET_BILLING_ACCOUNT_ROW,
  LIST_STRIPE_CUSTOMER_CREATING_TASKS_ROW,
  deleteBillingAccountStatement,
  deleteStripeCustomerCreatingTaskStatement,
  getBillingAccount,
  listStripeCustomerCreatingTasks,
} from "../db/sql";
import { CreateBillingAccountHandler } from "./create_billing_account_handler";
import { eqMessage } from "@selfage/message/test_matcher";
import { assertThat, isArray } from "@selfage/test_matcher";
import { TEST_RUNNER } from "@selfage/test_runner";

let FUTURE_TIME_MS = 365 * 24 * 60 * 60 * 1000;

TEST_RUNNER.run({
  name: "CreateBillingAccountHandlerTest",
  cases: [
    {
      name: "Success",
      execute: async () => {
        // Prepare
        let handler = new CreateBillingAccountHandler(
          SPANNER_DATABASE,
          () => 1000,
        );

        // Execute
        await handler.handle("", { accountId: "account1" });

        // Verify
        assertThat(
          await getBillingAccount(SPANNER_DATABASE, "account1"),
          isArray([
            eqMessage(
              {
                billingAccountData: {
                  accountId: "account1",
                  stateInfo: {
                    version: 0,
                    state: BillingAccountState.HEALTHY,
                    updatedTimeMs: 1000,
                  },
                  paymentAfterMs: 2592001000,
                },
              },
              GET_BILLING_ACCOUNT_ROW,
            ),
          ]),
          "account",
        );
        assertThat(
          await listStripeCustomerCreatingTasks(
            SPANNER_DATABASE,
            FUTURE_TIME_MS,
          ),
          isArray([
            eqMessage(
              {
                stripeCustomerCreatingTaskAccountId: "account1",
                stripeCustomerCreatingTaskExecutionTimeMs: 1000,
              },
              LIST_STRIPE_CUSTOMER_CREATING_TASKS_ROW,
            ),
          ]),
          "tasks",
        );

        // Execute
        await handler.handle("", { accountId: "account1" });

        // Verify no error
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deleteBillingAccountStatement("account1"),
            deleteStripeCustomerCreatingTaskStatement("account1"),
          ]);
          await transaction.commit();
        });
      },
    },
  ],
});
