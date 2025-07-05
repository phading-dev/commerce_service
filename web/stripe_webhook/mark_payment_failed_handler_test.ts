import "../../local/env";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import { PaymentState } from "../../db/schema";
import {
  GET_PAYMENT_METHOD_NEEDS_UPDATE_NOTIFYING_TASK_ROW,
  GET_PAYMENT_PROFILE_SUSPENDING_DUE_TO_PAST_DUE_TASK_ROW,
  GET_PAYMENT_ROW,
  deletePaymentMethodNeedsUpdateNotifyingTaskStatement,
  deletePaymentProfileSuspendingDueToPastDueTaskStatement,
  deletePaymentStatement,
  getPayment,
  getPaymentMethodNeedsUpdateNotifyingTask,
  getPaymentProfileSuspendingDueToPastDueTask,
  insertPaymentMethodNeedsUpdateNotifyingTaskStatement,
  insertPaymentProfileSuspendingDueToPastDueTaskStatement,
  insertPaymentStatement,
} from "../../db/sql";
import { MarkPaymentFailedHandler } from "./mark_payment_failed_handler";
import { eqMessage } from "@selfage/message/test_matcher";
import { Ref } from "@selfage/ref";
import { assertThat, eq, isArray } from "@selfage/test_matcher";
import { TEST_RUNNER } from "@selfage/test_runner";
import { Readable } from "stream";

async function cleanupAll() {
  await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
    await transaction.batchUpdate([
      deletePaymentStatement({ paymentStatementIdEq: "statement1" }),
      deletePaymentMethodNeedsUpdateNotifyingTaskStatement({
        paymentMethodNeedsUpdateNotifyingTaskStatementIdEq: "statement1",
      }),
      deletePaymentProfileSuspendingDueToPastDueTaskStatement({
        paymentProfileSuspendingDueToPastDueTaskStatementIdEq: "statement1",
      }),
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
            insertPaymentStatement({
              accountId: "account1",
              statementId: "statement1",
              state: PaymentState.CHARGING_VIA_STRIPE_INVOICE,
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
                  statementId: "statement1",
                },
              };
            },
          },
        };
        let handler = new MarkPaymentFailedHandler(
          SPANNER_DATABASE,
          new Ref(stripeClientMock),
          () => 1000,
          "secret1",
        );

        // Execute
        await handler.handle("", Readable.from("event_input"), "sig1");

        // Verify
        assertThat(payloadCaptured, eq("event_input"), "payload");
        assertThat(sigCaptured, eq("sig1"), "sig");
        assertThat(secretCaptured, eq("secret1"), "secret");
        assertThat(invoiceIdCaptured, eq("invoice1"), "invoiceId");
        assertThat(
          await getPayment(SPANNER_DATABASE, {
            paymentStatementIdEq: "statement1",
          }),
          isArray([
            eqMessage(
              {
                paymentAccountId: "account1",
                paymentStatementId: "statement1",
                paymentState: PaymentState.FAILED,
                paymentUpdatedTimeMs: 1000,
              },
              GET_PAYMENT_ROW,
            ),
          ]),
          "payment",
        );
        assertThat(
          await getPaymentMethodNeedsUpdateNotifyingTask(SPANNER_DATABASE, {
            paymentMethodNeedsUpdateNotifyingTaskStatementIdEq: "statement1",
          }),
          isArray([
            eqMessage(
              {
                paymentMethodNeedsUpdateNotifyingTaskStatementId: "statement1",
                paymentMethodNeedsUpdateNotifyingTaskRetryCount: 0,
                paymentMethodNeedsUpdateNotifyingTaskCreatedTimeMs: 1000,
                paymentMethodNeedsUpdateNotifyingTaskExecutionTimeMs: 1000,
              },
              GET_PAYMENT_METHOD_NEEDS_UPDATE_NOTIFYING_TASK_ROW,
            ),
          ]),
          "notifyingTasks",
        );
        assertThat(
          await getPaymentProfileSuspendingDueToPastDueTask(SPANNER_DATABASE, {
            paymentProfileSuspendingDueToPastDueTaskStatementIdEq: "statement1",
          }),
          isArray([
            eqMessage(
              {
                paymentProfileSuspendingDueToPastDueTaskStatementId:
                  "statement1",
                paymentProfileSuspendingDueToPastDueTaskRetryCount: 0,
                paymentProfileSuspendingDueToPastDueTaskExecutionTimeMs: 864001000,
                paymentProfileSuspendingDueToPastDueTaskCreatedTimeMs: 1000,
              },
              GET_PAYMENT_PROFILE_SUSPENDING_DUE_TO_PAST_DUE_TASK_ROW,
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
      name: "MarkFailureWithExistingTasks",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertPaymentStatement({
              accountId: "account1",
              statementId: "statement1",
              state: PaymentState.CHARGING_VIA_STRIPE_INVOICE,
            }),
            insertPaymentMethodNeedsUpdateNotifyingTaskStatement({
              statementId: "statement1",
              retryCount: 0,
              executionTimeMs: 100,
              createdTimeMs: 100,
            }),
            insertPaymentProfileSuspendingDueToPastDueTaskStatement({
              statementId: "statement1",
              retryCount: 0,
              executionTimeMs: 100,
              createdTimeMs: 100,
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
                  statementId: "statement1",
                },
              };
            },
          },
        };
        let handler = new MarkPaymentFailedHandler(
          SPANNER_DATABASE,
          new Ref(stripeClientMock),
          () => 1000,
          "secret1",
        );

        // Execute
        await handler.handle("", Readable.from("event_input"), "sig1");

        // Verify
        assertThat(
          await getPayment(SPANNER_DATABASE, {
            paymentStatementIdEq: "statement1",
          }),
          isArray([
            eqMessage(
              {
                paymentAccountId: "account1",
                paymentStatementId: "statement1",
                paymentState: PaymentState.FAILED,
                paymentUpdatedTimeMs: 1000,
              },
              GET_PAYMENT_ROW,
            ),
          ]),
          "payment",
        );
        assertThat(
          await getPaymentMethodNeedsUpdateNotifyingTask(SPANNER_DATABASE, {
            paymentMethodNeedsUpdateNotifyingTaskStatementIdEq: "statement1",
          }),
          isArray([
            eqMessage(
              {
                paymentMethodNeedsUpdateNotifyingTaskStatementId: "statement1",
                paymentMethodNeedsUpdateNotifyingTaskRetryCount: 0,
                paymentMethodNeedsUpdateNotifyingTaskExecutionTimeMs: 1000,
                paymentMethodNeedsUpdateNotifyingTaskCreatedTimeMs: 1000,
              },
              GET_PAYMENT_METHOD_NEEDS_UPDATE_NOTIFYING_TASK_ROW,
            ),
          ]),
          "notifyingTasks",
        );
        assertThat(
          await getPaymentProfileSuspendingDueToPastDueTask(SPANNER_DATABASE, {
            paymentProfileSuspendingDueToPastDueTaskStatementIdEq: "statement1",
          }),
          isArray([
            eqMessage(
              {
                paymentProfileSuspendingDueToPastDueTaskStatementId:
                  "statement1",
                paymentProfileSuspendingDueToPastDueTaskRetryCount: 0,
                paymentProfileSuspendingDueToPastDueTaskExecutionTimeMs: 100,
                paymentProfileSuspendingDueToPastDueTaskCreatedTimeMs: 100,
              },
              GET_PAYMENT_PROFILE_SUSPENDING_DUE_TO_PAST_DUE_TASK_ROW,
            ),
          ]),
          "accountSuspendingTasks",
        );
      },
      tearDown: async () => {
        await cleanupAll();
      },
    },
  ],
});
