import "../../local/env";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import { PaymentState } from "../../db/schema";
import {
  GET_BILLING_PROFILE_SUSPENDING_DUE_TO_PAST_DUE_TASK_ROW,
  GET_PAYMENT_METHOD_NEEDS_UPDATE_NOTIFYING_TASK_METADATA_ROW,
  GET_PAYMENT_METHOD_NEEDS_UPDATE_NOTIFYING_TASK_ROW,
  GET_PAYMENT_ROW,
  deleteBillingProfileSuspendingDueToPastDueTaskStatement,
  deletePaymentMethodNeedsUpdateNotifyingTaskStatement,
  deletePaymentStatement,
  getBillingProfileSuspendingDueToPastDueTask,
  getPayment,
  getPaymentMethodNeedsUpdateNotifyingTask,
  getPaymentMethodNeedsUpdateNotifyingTaskMetadata,
  insertPaymentMethodNeedsUpdateNotifyingTaskStatement,
  insertPaymentStatement,
  listPendingBillingProfileSuspendingDueToPastDueTasks,
} from "../../db/sql";
import { MarkPaymentFailedHandler } from "./mark_payment_failed_handler";
import { eqMessage } from "@selfage/message/test_matcher";
import { Ref } from "@selfage/ref";
import { assertThat, eq, isArray } from "@selfage/test_matcher";
import { TEST_RUNNER } from "@selfage/test_runner";
import { Readable } from "stream";

let FUTURE_TIME_MS = 364 * 24 * 60 * 60 * 1000;

async function cleanupAll() {
  await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
    await transaction.batchUpdate([
      deletePaymentStatement({ paymentStatementIdEq: "statement1" }),
      deletePaymentMethodNeedsUpdateNotifyingTaskStatement({
        paymentMethodNeedsUpdateNotifyingTaskStatementIdEq: "statement1",
      }),
      deleteBillingProfileSuspendingDueToPastDueTaskStatement({
        billingProfileSuspendingDueToPastDueTaskStatementIdEq: "statement1",
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
          "billing",
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
          await getBillingProfileSuspendingDueToPastDueTask(SPANNER_DATABASE, {
            billingProfileSuspendingDueToPastDueTaskStatementIdEq: "statement1",
          }),
          isArray([
            eqMessage(
              {
                billingProfileSuspendingDueToPastDueTaskStatementId:
                  "statement1",
                billingProfileSuspendingDueToPastDueTaskRetryCount: 0,
                billingProfileSuspendingDueToPastDueTaskExecutionTimeMs: 864001000,
                billingProfileSuspendingDueToPastDueTaskCreatedTimeMs: 1000,
              },
              GET_BILLING_PROFILE_SUSPENDING_DUE_TO_PAST_DUE_TASK_ROW,
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
            insertPaymentStatement({
              accountId: "account1",
              statementId: "statement1",
              state: PaymentState.FAILED,
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
          "secret1",
          () => 1000,
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
              },
              GET_PAYMENT_ROW,
            ),
          ]),
          "billing",
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
          await listPendingBillingProfileSuspendingDueToPastDueTasks(
            SPANNER_DATABASE,
            {
              billingProfileSuspendingDueToPastDueTaskExecutionTimeMsLe:
                FUTURE_TIME_MS,
            },
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
            insertPaymentStatement({
              accountId: "account1",
              statementId: "statement1",
              state: PaymentState.FAILED,
            }),
            insertPaymentMethodNeedsUpdateNotifyingTaskStatement({
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
          "secret1",
          () => 1000,
        );

        // Execute
        await handler.handle("", Readable.from("event_input"), "sig1");

        // Verify
        assertThat(
          await getPaymentMethodNeedsUpdateNotifyingTaskMetadata(
            SPANNER_DATABASE,
            {
              paymentMethodNeedsUpdateNotifyingTaskStatementIdEq: "statement1",
            },
          ),
          isArray([
            eqMessage(
              {
                paymentMethodNeedsUpdateNotifyingTaskRetryCount: 0,
                paymentMethodNeedsUpdateNotifyingTaskExecutionTimeMs: 100,
              },
              GET_PAYMENT_METHOD_NEEDS_UPDATE_NOTIFYING_TASK_METADATA_ROW,
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
