import { SPANNER_DATABASE } from "../common/spanner_database";
import { BillingAccountState } from "../db/schema";
import {
  GET_BILLING_ACCOUNT_ROW,
  GET_STRIPE_CUSTOMER_CREATING_TASK_ROW,
  deleteBillingAccountStatement,
  deleteStripeCustomerCreatingTaskStatement,
  getBillingAccount,
  getStripeCustomerCreatingTask,
} from "../db/sql";
import { CreateBillingAccountHandler } from "./create_billing_account_handler";
import { eqMessage } from "@selfage/message/test_matcher";
import { assertThat, isArray } from "@selfage/test_matcher";
import { TEST_RUNNER } from "@selfage/test_runner";

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
          await getStripeCustomerCreatingTask(SPANNER_DATABASE, "account1"),
          isArray([
            eqMessage(
              {
                stripeCustomerCreatingTaskAccountId: "account1",
                stripeCustomerCreatingTaskRetryCount: 0,
                stripeCustomerCreatingTaskExecutionTimeMs: 1000,
                stripeCustomerCreatingTaskCreatedTimeMs: 1000,
              },
              GET_STRIPE_CUSTOMER_CREATING_TASK_ROW,
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
