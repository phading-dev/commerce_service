import { SPANNER_DATABASE } from "../../common/spanner_database";
import { PaymentState } from "../../db/schema";
import {
  GET_BILLING_ROW,
  LIST_BILLING_ACCOUNT_SUSPENDING_DUE_TO_PAST_DUE_TASKS_ROW,
  LIST_UPDATE_PAYMENT_METHOD_NOTIFYING_TASKS_ROW,
  deleteBillingAccountSuspendingDueToPastDueTaskStatement,
  deleteBillingStatement,
  deleteUpdatePaymentMethodNotifyingTaskStatement,
  getBilling,
  insertBillingStatement,
  insertUpdatePaymentMethodNotifyingTaskStatement,
  listBillingAccountSuspendingDueToPastDueTasks,
  listUpdatePaymentMethodNotifyingTasks,
} from "../../db/sql";
import { MarkPaymentFailedHandler } from "./mark_payment_failed_handler";
import { eqMessage } from "@selfage/message/test_matcher";
import { assertThat, eq, isArray } from "@selfage/test_matcher";
import { TEST_RUNNER } from "@selfage/test_runner";
import { Readable } from "stream";

let FUTURE_TIME_MS = 364 * 24 * 60 * 60 * 1000;

async function cleanupAll() {
  await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
    await transaction.batchUpdate([
      deleteBillingStatement("billing1"),
      deleteUpdatePaymentMethodNotifyingTaskStatement("billing1"),
      deleteBillingAccountSuspendingDueToPastDueTaskStatement("billing1"),
    ]);
    await transaction.commit();
  });
}

TEST_RUNNER.run({
  name: "MarkPaymentFailedHandlerTest",
  cases: [
    {
      name: "MarkFailureAndAddTasks",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertBillingStatement({
              accountId: "account1",
              billingId: "billing1",
              state: PaymentState.CHARGING,
              month: "2024-10",
            }),
          ]);
          await transaction.commit();
        });
        let payloadCaptured: string;
        let sigCaptured: string;
        let secretCaptured: string;
        let invoiceIdCaptured: string;
        let stripeClientMock: any = {
          webhooks: {
            constructEvent: (payload: string, sig: string, secret: string) => {
              payloadCaptured = payload;
              sigCaptured = sig;
              secretCaptured = secret;
              return {
                type: "payment_intent.payment_failed",
                data: {
                  object: {
                    invoice: "invoice1",
                  },
                },
              };
            },
          },
          invoices: {
            retrieve: async (invoiceId: string) => {
              invoiceIdCaptured = invoiceId;
              return {
                metadata: {
                  billingId: "billing1",
                },
              };
            },
          },
        };
        let handler = new MarkPaymentFailedHandler(
          SPANNER_DATABASE,
          stripeClientMock,
          "secret1",
          () => 1000,
        );

        // Execute
        await handler.handle("", Readable.from("event_input"), "sig1");

        // Verify
        assertThat(payloadCaptured, eq("event_input"), "payload");
        assertThat(sigCaptured, eq("sig1"), "sig");
        assertThat(secretCaptured, eq("secret1"), "secret");
        assertThat(invoiceIdCaptured, eq("invoice1"), "invoiceId");
        assertThat(
          await getBilling(SPANNER_DATABASE, "billing1"),
          isArray([
            eqMessage(
              {
                billingData: {
                  accountId: "account1",
                  billingId: "billing1",
                  state: PaymentState.FAILED,
                  month: "2024-10",
                },
              },
              GET_BILLING_ROW,
            ),
          ]),
          "billing",
        );
        assertThat(
          await listUpdatePaymentMethodNotifyingTasks(
            SPANNER_DATABASE,
            FUTURE_TIME_MS,
          ),
          isArray([
            eqMessage(
              {
                updatePaymentMethodNotifyingTaskBillingId: "billing1",
                updatePaymentMethodNotifyingTaskExecutionTimeMs: 1000,
              },
              LIST_UPDATE_PAYMENT_METHOD_NOTIFYING_TASKS_ROW,
            ),
          ]),
          "notifyingTasks",
        );
        assertThat(
          await listBillingAccountSuspendingDueToPastDueTasks(
            SPANNER_DATABASE,
            FUTURE_TIME_MS,
          ),
          isArray([
            eqMessage(
              {
                billingAccountSuspendingDueToPastDueTaskBillingId: "billing1",
                billingAccountSuspendingDueToPastDueTaskExecutionTimeMs: 864001000,
              },
              LIST_BILLING_ACCOUNT_SUSPENDING_DUE_TO_PAST_DUE_TASKS_ROW,
            ),
          ]),
          "accountSuspendingTasks",
        );
      },
      tearDown: async () => {
        await cleanupAll();
      },
    },
    {
      name: "MarkFailureWheAlreadyFailedAndNotify",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertBillingStatement({
              accountId: "account1",
              billingId: "billing1",
              state: PaymentState.FAILED,
              month: "2024-10",
            }),
          ]);
          await transaction.commit();
        });
        let stripeClientMock: any = {
          webhooks: {
            constructEvent: () => {
              return {
                type: "payment_intent.payment_failed",
                data: {
                  object: {
                    invoice: "invoice1",
                  },
                },
              };
            },
          },
          invoices: {
            retrieve: async (invoiceId: string) => {
              return {
                metadata: {
                  billingId: "billing1",
                },
              };
            },
          },
        };
        let handler = new MarkPaymentFailedHandler(
          SPANNER_DATABASE,
          stripeClientMock,
          "secret1",
          () => 1000,
        );

        // Execute
        await handler.handle("", Readable.from("event_input"), "sig1");

        // Verify
        assertThat(
          await getBilling(SPANNER_DATABASE, "billing1"),
          isArray([
            eqMessage(
              {
                billingData: {
                  accountId: "account1",
                  billingId: "billing1",
                  state: PaymentState.FAILED,
                  month: "2024-10",
                },
              },
              GET_BILLING_ROW,
            ),
          ]),
          "billing",
        );
        assertThat(
          await listUpdatePaymentMethodNotifyingTasks(
            SPANNER_DATABASE,
            FUTURE_TIME_MS,
          ),
          isArray([
            eqMessage(
              {
                updatePaymentMethodNotifyingTaskBillingId: "billing1",
                updatePaymentMethodNotifyingTaskExecutionTimeMs: 1000,
              },
              LIST_UPDATE_PAYMENT_METHOD_NOTIFYING_TASKS_ROW,
            ),
          ]),
          "notifyingTasks",
        );
        assertThat(
          await listBillingAccountSuspendingDueToPastDueTasks(
            SPANNER_DATABASE,
            FUTURE_TIME_MS,
          ),
          isArray([]),
          "accountSuspendingTasks",
        );
      },
      tearDown: async () => {
        await cleanupAll();
      },
    },
    {
      name: "MarkFailureWhenAlreadyFailedAndNotifyingTaskExists",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertBillingStatement({
              accountId: "account1",
              billingId: "billing1",
              state: PaymentState.FAILED,
              month: "2024-10",
            }),
            insertUpdatePaymentMethodNotifyingTaskStatement("billing1", 0, 0),
          ]);
          await transaction.commit();
        });
        let stripeClientMock: any = {
          webhooks: {
            constructEvent: () => {
              return {
                type: "payment_intent.payment_failed",
                data: {
                  object: {
                    invoice: "invoice1",
                  },
                },
              };
            },
          },
          invoices: {
            retrieve: async (invoiceId: string) => {
              return {
                metadata: {
                  billingId: "billing1",
                },
              };
            },
          },
        };
        let handler = new MarkPaymentFailedHandler(
          SPANNER_DATABASE,
          stripeClientMock,
          "secret1",
          () => 1000,
        );

        // Execute
        await handler.handle("", Readable.from("event_input"), "sig1");

        // Verify
        assertThat(
          await listUpdatePaymentMethodNotifyingTasks(
            SPANNER_DATABASE,
            FUTURE_TIME_MS,
          ),
          isArray([
            eqMessage(
              {
                updatePaymentMethodNotifyingTaskBillingId: "billing1",
                updatePaymentMethodNotifyingTaskExecutionTimeMs: 0,
              },
              LIST_UPDATE_PAYMENT_METHOD_NOTIFYING_TASKS_ROW,
            ),
          ]),
          "notifyingTasks",
        );
      },
      tearDown: async () => {
        await cleanupAll();
      },
    },
  ],
});
