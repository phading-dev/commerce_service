import "../local/env";
import { SPANNER_DATABASE } from "../common/spanner_database";
import { InitCreditGrantingState, PaymentProfileState } from "../db/schema";
import {
  GET_PAYMENT_PROFILE_ROW,
  GET_STRIPE_CUSTOMER_CREATING_TASK_ROW,
  deletePaymentProfileStatement,
  deleteStripeCustomerCreatingTaskStatement,
  getPaymentProfile,
  getStripeCustomerCreatingTask,
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
          () => "task1",
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
                paymentProfileInitCreditGrantingState:
                  InitCreditGrantingState.NOT_GRANTED,
                paymentProfileCreatedTimeMs: 1000,
              },
              GET_PAYMENT_PROFILE_ROW,
            ),
          ]),
          "account",
        );
        assertThat(
          await getStripeCustomerCreatingTask(SPANNER_DATABASE, {
            stripeCustomerCreatingTaskTaskIdEq: "task1",
          }),
          isArray([
            eqMessage(
              {
                stripeCustomerCreatingTaskTaskId: "task1",
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
            deletePaymentProfileStatement({
              paymentProfileAccountIdEq: "account1",
            }),
            deleteStripeCustomerCreatingTaskStatement({
              stripeCustomerCreatingTaskTaskIdEq: "task1",
            }),
          ]);
          await transaction.commit();
        });
      },
    },
  ],
});
