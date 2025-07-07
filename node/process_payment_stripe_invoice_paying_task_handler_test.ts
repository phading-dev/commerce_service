import "../local/env";
import { SPANNER_DATABASE } from "../common/spanner_database";
import { PaymentState } from "../db/schema";
import {
  GET_PAYMENT_ROW,
  GET_PAYMENT_STRIPE_INVOICE_PAYING_TASK_METADATA_ROW,
  deletePaymentStatement,
  deletePaymentStripeInvoicePayingTaskStatement,
  getPayment,
  getPaymentStripeInvoicePayingTaskMetadata,
  insertPaymentStatement,
  insertPaymentStripeInvoicePayingTaskStatement,
  listPendingPaymentStripeInvoicePayingTasks,
} from "../db/sql";
import { ProcessPaymentStripeInvoicePayingTaskHandler } from "./process_payment_stripe_invoice_paying_task_handler";
import { newBadRequestError } from "@selfage/http_error";
import { eqHttpError } from "@selfage/http_error/test_matcher";
import { eqMessage } from "@selfage/message/test_matcher";
import { Ref } from "@selfage/ref";
import { assertReject, assertThat, eq, isArray } from "@selfage/test_matcher";
import { TEST_RUNNER } from "@selfage/test_runner";

async function insertPayment(): Promise<void> {
  await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
    await transaction.batchUpdate([
      insertPaymentStatement({
        statementId: "statement1",
        accountId: "account1",
        state: PaymentState.PAYING_INVOICE,
        stripeInvoiceId: "invoice1",
      }),
      insertPaymentStripeInvoicePayingTaskStatement({
        taskId: "task1",
        statementId: "statement1",
        retryCount: 0,
        executionTimeMs: 100,
      }),
    ]);
    await transaction.commit();
  });
}

async function cleanupAll(): Promise<void> {
  await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
    await transaction.batchUpdate([
      deletePaymentStatement({ paymentStatementIdEq: "statement1" }),
      deletePaymentStripeInvoicePayingTaskStatement({
        paymentStripeInvoicePayingTaskTaskIdEq: "task1",
      }),
    ]);
    await transaction.commit();
  });
}

TEST_RUNNER.run({
  name: "ProcessPaymentStripeInvoicePayingTaskHandlerTest",
  cases: [
    {
      name: "Success",
      execute: async () => {
        // Prepare
        await insertPayment();
        let payInvoiceIdCaptured: string;
        let payInvoiceOptionCaptured: any;
        let stripeClientMock: any = {
          invoices: {
            pay: async (
              payInvoiceId: string,
              payInvoiceParams: any,
              payInvoiceOption: any,
            ) => {
              payInvoiceIdCaptured = payInvoiceId;
              payInvoiceOptionCaptured = payInvoiceOption;
              return {};
            },
          },
        };
        let handler = new ProcessPaymentStripeInvoicePayingTaskHandler(
          SPANNER_DATABASE,
          new Ref(stripeClientMock),
          () => 1000,
        );

        // Execute
        await handler.processTask("", {
          taskId: "task1",
          statementId: "statement1",
        });

        // Verify
        assertThat(payInvoiceIdCaptured, eq("invoice1"), "payInvoiceId");
        assertThat(
          payInvoiceOptionCaptured.idempotencyKey,
          eq("pitask1"),
          "payInvoiceOption.idempotencyKey",
        );
        assertThat(
          await getPayment(SPANNER_DATABASE, {
            paymentStatementIdEq: "statement1",
          }),
          isArray([
            eqMessage(
              {
                paymentStatementId: "statement1",
                paymentAccountId: "account1",
                paymentState: PaymentState.WAITING_FOR_INVOICE_PAYMENT,
                paymentStripeInvoiceId: "invoice1",
                paymentUpdatedTimeMs: 1000,
              },
              GET_PAYMENT_ROW,
            ),
          ]),
          "payment",
        );
        assertThat(
          await listPendingPaymentStripeInvoicePayingTasks(SPANNER_DATABASE, {
            paymentStripeInvoicePayingTaskExecutionTimeMsLe: 1000000,
          }),
          isArray([]),
          "tasks",
        );
      },
      tearDown: async () => {
        await cleanupAll();
      },
    },
    {
      name: "PaymentNotInPayingState",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertPaymentStatement({
              statementId: "statement1",
              state: PaymentState.FAILED_WITHOUT_INVOICE,
            }),
          ]);
          await transaction.commit();
        });
        let stripeClientMock: any = {};
        let handler = new ProcessPaymentStripeInvoicePayingTaskHandler(
          SPANNER_DATABASE,
          new Ref(stripeClientMock),
          () => 1000,
        );

        // Execute
        let error = await assertReject(
          handler.processTask("", {
            taskId: "task1",
            statementId: "statement1",
          }),
        );

        // Verify
        assertThat(
          error,
          eqHttpError(
            newBadRequestError(
              "Payment statement1 is not in PAYING_INVOICE state",
            ),
          ),
          "error",
        );
      },
      tearDown: async () => {
        await cleanupAll();
      },
    },
    {
      name: "ClaimTask",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertPaymentStripeInvoicePayingTaskStatement({
              taskId: "task1",
              statementId: "statement1",
              retryCount: 0,
              executionTimeMs: 100,
            }),
          ]);
          await transaction.commit();
        });
        let handler = new ProcessPaymentStripeInvoicePayingTaskHandler(
          SPANNER_DATABASE,
          undefined,
          () => 1000,
        );

        // Execute
        await handler.claimTask("", {
          taskId: "task1",
          statementId: "statement1",
        });

        // Verify
        assertThat(
          await getPaymentStripeInvoicePayingTaskMetadata(SPANNER_DATABASE, {
            paymentStripeInvoicePayingTaskTaskIdEq: "task1",
          }),
          isArray([
            eqMessage(
              {
                paymentStripeInvoicePayingTaskRetryCount: 1,
                paymentStripeInvoicePayingTaskExecutionTimeMs: 301000,
              },
              GET_PAYMENT_STRIPE_INVOICE_PAYING_TASK_METADATA_ROW,
            ),
          ]),
          "tasks",
        );
      },
      tearDown: async () => {
        await cleanupAll();
      },
    },
  ],
});
