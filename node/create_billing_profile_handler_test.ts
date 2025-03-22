import "../local/env";
import { SPANNER_DATABASE } from "../common/spanner_database";
import { BillingProfileState } from "../db/schema";
import {
  GET_BILLING_PROFILE_ROW,
  GET_STRIPE_PAYMENT_CUSTOMER_CREATING_TASK_ROW,
  deleteBillingProfileStatement,
  deleteStripePaymentCustomerCreatingTaskStatement,
  getBillingProfile,
  getStripePaymentCustomerCreatingTask,
} from "../db/sql";
import { CreateBillingProfileHandler } from "./create_billing_profile_handler";
import { eqMessage } from "@selfage/message/test_matcher";
import { assertThat, isArray } from "@selfage/test_matcher";
import { TEST_RUNNER } from "@selfage/test_runner";

TEST_RUNNER.run({
  name: "CreateBillingProfileHandlerTest",
  cases: [
    {
      name: "Success",
      execute: async () => {
        // Prepare
        let handler = new CreateBillingProfileHandler(
          SPANNER_DATABASE,
          () => 1000,
        );

        // Execute
        await handler.handle("", { accountId: "account1" });

        // Verify
        assertThat(
          await getBillingProfile(SPANNER_DATABASE, {
            billingProfileAccountIdEq: "account1",
          }),
          isArray([
            eqMessage(
              {
                billingProfileAccountId: "account1",
                billingProfileStateInfo: {
                  version: 0,
                  state: BillingProfileState.HEALTHY,
                  updatedTimeMs: 1000,
                },
                billingProfilePaymentAfterMs: 2592001000,
              },
              GET_BILLING_PROFILE_ROW,
            ),
          ]),
          "account",
        );
        assertThat(
          await getStripePaymentCustomerCreatingTask(SPANNER_DATABASE, {
            stripePaymentCustomerCreatingTaskAccountIdEq: "account1",
          }),
          isArray([
            eqMessage(
              {
                stripePaymentCustomerCreatingTaskAccountId: "account1",
                stripePaymentCustomerCreatingTaskRetryCount: 0,
                stripePaymentCustomerCreatingTaskExecutionTimeMs: 1000,
                stripePaymentCustomerCreatingTaskCreatedTimeMs: 1000,
              },
              GET_STRIPE_PAYMENT_CUSTOMER_CREATING_TASK_ROW,
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
            deleteBillingProfileStatement({
              billingProfileAccountIdEq: "account1",
            }),
            deleteStripePaymentCustomerCreatingTaskStatement({
              stripePaymentCustomerCreatingTaskAccountIdEq: "account1",
            }),
          ]);
          await transaction.commit();
        });
      },
    },
  ],
});
