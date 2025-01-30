import { SPANNER_DATABASE } from "../common/spanner_database";
import {
  deleteUpdatePaymentMethodNotifyingTaskStatement,
  insertUpdatePaymentMethodNotifyingTaskStatement,
} from "../db/sql";
import { ListUpdatePaymentMethodNotifyingTasksHandler } from "./list_update_payment_method_notifying_tasks_handler";
import { LIST_UPDATE_PAYMENT_METHOD_NOTIFYING_TASKS_RESPONSE } from "@phading/commerce_service_interface/node/interface";
import { eqMessage } from "@selfage/message/test_matcher";
import { assertThat } from "@selfage/test_matcher";
import { TEST_RUNNER } from "@selfage/test_runner";

TEST_RUNNER.run({
  name: "ListUpdatePaymentMethodNotifyingTasksHandlerTest",
  cases: [
    {
      name: "Success",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertUpdatePaymentMethodNotifyingTaskStatement("billing1", 100, 0),
            insertUpdatePaymentMethodNotifyingTaskStatement("billing2", 0, 0),
            insertUpdatePaymentMethodNotifyingTaskStatement(
              "billing3",
              1000,
              0,
            ),
          ]);
          await transaction.commit();
        });
        let handler = new ListUpdatePaymentMethodNotifyingTasksHandler(
          SPANNER_DATABASE,
          () => 100,
        );

        // Execute
        let response = await handler.handle("", {});

        // Verify
        assertThat(
          response,
          eqMessage(
            {
              tasks: [
                {
                  billingId: "billing2",
                },
                {
                  billingId: "billing1",
                },
              ],
            },
            LIST_UPDATE_PAYMENT_METHOD_NOTIFYING_TASKS_RESPONSE,
          ),
          "response",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deleteUpdatePaymentMethodNotifyingTaskStatement("billing1"),
            deleteUpdatePaymentMethodNotifyingTaskStatement("billing2"),
            deleteUpdatePaymentMethodNotifyingTaskStatement("billing3"),
          ]);
          await transaction.commit();
        });
      },
    },
  ],
});
