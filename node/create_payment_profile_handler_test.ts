import "../local/env";
import { SPANNER_DATABASE } from "../common/spanner_database";
import { PaymentProfileState } from "../db/schema";
import {
  GET_PAYMENT_PROFILE_ROW,
  GET_STRIPE_PAYMENT_CUSTOMER_CREATING_TASK_ROW,
  deletePaymentProfileStatement,
  deleteStripePaymentCustomerCreatingTaskStatement,
  getPaymentProfile,
  getStripePaymentCustomerCreatingTask,
} from "../db/sql";
import { CreatePaymentProfileHandler } from "./create_payment_profile_handler";
import { eqMessage } from "@selfage/message/test_matcher";
import { assertThat, isArray } from "@selfage/test_matcher";
import { TEST_RUNNER } from "@selfage/test_runner";

TEST_RUNNER.run({
  name: "CreatePaymentProfileHandlerTest",
  cases: [
    {
      name: "Success",
      execute: async () => {
        // Prepare
        let handler = new CreatePaymentProfileHandler(
          SPANNER_DATABASE,
          () => 1000,
        );

        // Execute
        await handler.handle("", { accountId: "account1" });

        // Verify
        assertThat(
          await getPaymentProfile(SPANNER_DATABASE, {
            paymentProfileAccountIdEq: "account1",
          }),
          isArray([
            eqMessage(
              {
                paymentProfileAccountId: "account1",
                paymentProfileStateInfo: {
                  version: 0,
                  state: PaymentProfileState.HEALTHY,
                  updatedTimeMs: 1000,
                },
                paymentProfilePaymentAfterMs: 2592001000,
              },
              GET_PAYMENT_PROFILE_ROW,
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
            deletePaymentProfileStatement({
              paymentProfileAccountIdEq: "account1",
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
