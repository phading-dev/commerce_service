import "../local/env";
import { SPANNER_DATABASE } from "../common/spanner_database";
import { PaymentState } from "../db/schema";
import {
  GET_PAYMENT_METHOD_NEEDS_UPDATE_NOTIFYING_TASK_ROW,
  GET_PAYMENT_PROFILE_SUSPENDING_DUE_TO_PAST_DUE_TASK_ROW,
  GET_PAYMENT_ROW,
  GET_PAYMENT_STRIPE_INVOICE_CREATING_TASK_METADATA_ROW,
  deletePaymentMethodNeedsUpdateNotifyingTaskStatement,
  deletePaymentProfileStatement,
  deletePaymentProfileSuspendingDueToPastDueTaskStatement,
  deletePaymentStatement,
  deletePaymentStripeInvoiceCreatingTaskStatement,
  deleteTransactionStatementStatement,
  getPayment,
  getPaymentMethodNeedsUpdateNotifyingTask,
  getPaymentProfileSuspendingDueToPastDueTask,
  getPaymentStripeInvoiceCreatingTaskMetadata,
  insertPaymentMethodNeedsUpdateNotifyingTaskStatement,
  insertPaymentProfileStatement,
  insertPaymentProfileSuspendingDueToPastDueTaskStatement,
  insertPaymentStatement,
  insertPaymentStripeInvoiceCreatingTaskStatement,
  insertTransactionStatementStatement,
  listPendingPaymentStripeInvoiceCreatingTasks,
} from "../db/sql";
import { ProcessPaymentStripeInvoiceCreatingTaskHandler } from "./process_payment_stripe_invoice_creating_task_handler";
import { AmountType } from "@phading/price/amount_type";
import { newBadRequestError } from "@selfage/http_error";
import { eqHttpError } from "@selfage/http_error/test_matcher";
import { eqMessage } from "@selfage/message/test_matcher";
import { Ref } from "@selfage/ref";
import { assertReject, assertThat, eq, isArray } from "@selfage/test_matcher";
import { TEST_RUNNER } from "@selfage/test_runner";

async function insertPayment(): Promise<void> {
  await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
    await transaction.batchUpdate([
      insertPaymentProfileStatement({
        accountId: "account1",
        stripePaymentCustomerId: "stripeCustomer1",
      }),
      insertTransactionStatementStatement({
        statementId: "statement1",
        accountId: "account1",
        month: "2021-01",
        statement: {
          currency: "USD",
          totalAmount: 1200,
          totalAmountType: AmountType.DEBIT,
        },
      }),
      insertPaymentStatement({
        statementId: "statement1",
        accountId: "account1",
        state: PaymentState.CREATING_STRIPE_INVOICE,
      }),
      insertPaymentStripeInvoiceCreatingTaskStatement({
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
      deletePaymentProfileStatement({ paymentProfileAccountIdEq: "account1" }),
      deleteTransactionStatementStatement({
        transactionStatementStatementIdEq: "statement1",
      }),
      deletePaymentStatement({ paymentStatementIdEq: "statement1" }),
      deletePaymentStripeInvoiceCreatingTaskStatement({
        paymentStripeInvoiceCreatingTaskTaskIdEq: "task1",
      }),
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
  name: "ProcessPaymentStripeInvoiceCreatingTaskHandlerTest",
  cases: [
    {
      name: "Success",
      execute: async () => {
        // Prepare
        await insertPayment();
        let stripeCustomerIdCaptured: string;
        let createInvoiceParamsCaptured: any;
        let createInvoiceOptionCaptured: any;
        let addLinesInvoiceIdCaptured: string;
        let addLinesParamsCaptured: any;
        let addLinesOptionCaptured: any;
        let finalizeInvoiceIdCaptured: string;
        let finalizeInvoiceParamsCaptured: any;
        let finalizeInvoiceOptionCaptured: any;
        let stripeClientMock: any = {
          customers: {
            retrieve: async (stripeCustomerId: string) => {
              stripeCustomerIdCaptured = stripeCustomerId;
              return {
                invoice_settings: {
                  default_payment_method: "paymentMethod1",
                },
              };
            },
          },
          invoices: {
            create: async (
              createInvoiceParams: any,
              createInvoiceOption: any,
            ) => {
              createInvoiceParamsCaptured = createInvoiceParams;
              createInvoiceOptionCaptured = createInvoiceOption;
              return {
                id: "invoice1",
              };
            },
            addLines: async (
              addLinesInvoiceId: string,
              addLinesParams: any,
              addLinesOption: any,
            ) => {
              addLinesInvoiceIdCaptured = addLinesInvoiceId;
              addLinesParamsCaptured = addLinesParams;
              addLinesOptionCaptured = addLinesOption;
            },
            finalizeInvoice: async (
              finalizeInvoiceId: string,
              finalizeInvoiceParams: any,
              finalizeInvoiceOption: any,
            ) => {
              finalizeInvoiceIdCaptured = finalizeInvoiceId;
              finalizeInvoiceParamsCaptured = finalizeInvoiceParams;
              finalizeInvoiceOptionCaptured = finalizeInvoiceOption;
              return {};
            },
          },
        };
        let handler = new ProcessPaymentStripeInvoiceCreatingTaskHandler(
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
        assertThat(
          stripeCustomerIdCaptured,
          eq("stripeCustomer1"),
          "stripeCustomerId",
        );
        assertThat(
          createInvoiceParamsCaptured.customer,
          eq("stripeCustomer1"),
          "createInvoiceParams.customer",
        );
        assertThat(
          createInvoiceParamsCaptured.description,
          eq("For the month of 2021-01"),
          "createInvoiceParams.description",
        );
        assertThat(
          createInvoiceParamsCaptured.metadata.statementId,
          eq("statement1"),
          "createInvoiceParams.metadata.statementId",
        );
        assertThat(
          createInvoiceParamsCaptured.currency,
          eq("usd"),
          "createInvoiceParams.currency",
        );
        assertThat(
          createInvoiceOptionCaptured.idempotencyKey,
          eq("citask1"),
          "createInvoiceOption.idempotencyKey",
        );
        assertThat(
          addLinesInvoiceIdCaptured,
          eq("invoice1"),
          "addLinesInvoiceId",
        );
        assertThat(
          addLinesParamsCaptured.lines[0].description,
          eq("Total"),
          "addLinesParams.lines[0].description",
        );
        assertThat(
          addLinesParamsCaptured.lines[0].amount,
          eq(1200),
          "addLinesParams.lines[0].amount",
        );
        assertThat(
          addLinesOptionCaptured.idempotencyKey,
          eq("altask1"),
          "addLinesOption.idempotencyKey",
        );
        assertThat(
          finalizeInvoiceIdCaptured,
          eq("invoice1"),
          "finalizeInvoiceId",
        );
        assertThat(
          finalizeInvoiceParamsCaptured.auto_advance,
          eq(true),
          "finalizeInvoiceParams.auto_advance",
        );
        assertThat(
          finalizeInvoiceOptionCaptured.idempotencyKey,
          eq("fitask1"),
          "finalizeInvoiceOption.idempotencyKey",
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
          await listPendingPaymentStripeInvoiceCreatingTasks(SPANNER_DATABASE, {
            paymentStripeInvoiceCreatingTaskExecutionTimeMsLe: 1000000,
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
      name: "MissingDefaultPaymentMethodAndReportFailure",
      execute: async () => {
        // Prepare
        await insertPayment();
        let stripeClientMock: any = {
          customers: {
            retrieve: async () => {
              return {
                invoice_settings: {
                  default_payment_method: null,
                },
              } as any;
            },
          },
        };
        let handler = new ProcessPaymentStripeInvoiceCreatingTaskHandler(
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
        assertThat(
          await getPayment(SPANNER_DATABASE, {
            paymentStatementIdEq: "statement1",
          }),
          isArray([
            eqMessage(
              {
                paymentStatementId: "statement1",
                paymentAccountId: "account1",
                paymentState: PaymentState.FAILED_WITHOUT_INVOICE,
                paymentUpdatedTimeMs: 1000,
              },
              GET_PAYMENT_ROW,
            ),
          ]),
          "payment",
        );
        assertThat(
          await listPendingPaymentStripeInvoiceCreatingTasks(SPANNER_DATABASE, {
            paymentStripeInvoiceCreatingTaskExecutionTimeMsLe: 1000000,
          }),
          isArray([]),
          "tasks",
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
          "updatePaymentMethodNotifyingTasks",
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
          "paymentProfileSuspendingDueToPastDueTasks",
        );
      },
      tearDown: async () => {
        await cleanupAll();
      },
    },
    {
      name: "MissingDefaultPaymentMethodAndReportFailureWithExistingTask",
      execute: async () => {
        // Prepare
        await insertPayment();
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
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
          customers: {
            retrieve: async () => {
              return {
                invoice_settings: {
                  default_payment_method: null,
                },
              } as any;
            },
          },
        };
        let handler = new ProcessPaymentStripeInvoiceCreatingTaskHandler(
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
        assertThat(
          await getPayment(SPANNER_DATABASE, {
            paymentStatementIdEq: "statement1",
          }),
          isArray([
            eqMessage(
              {
                paymentStatementId: "statement1",
                paymentAccountId: "account1",
                paymentState: PaymentState.FAILED_WITHOUT_INVOICE,
                paymentUpdatedTimeMs: 1000,
              },
              GET_PAYMENT_ROW,
            ),
          ]),
          "payment",
        );
        assertThat(
          await listPendingPaymentStripeInvoiceCreatingTasks(SPANNER_DATABASE, {
            paymentStripeInvoiceCreatingTaskExecutionTimeMsLe: 1000000,
          }),
          isArray([]),
          "tasks",
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
          "updatePaymentMethodNotifyingTasks",
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
          "paymentProfileSuspendingDueToPastDueTasks",
        );
      },
      tearDown: async () => {
        await cleanupAll();
      },
    },
    {
      name: "PaymentNotInCreatingState",
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
        let handler = new ProcessPaymentStripeInvoiceCreatingTaskHandler(
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
              "Payment statement1 is not in CREATING_STRIPE_INVOICE state",
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
            insertPaymentStripeInvoiceCreatingTaskStatement({
              taskId: "task1",
              statementId: "statement1",
              retryCount: 0,
              executionTimeMs: 100,
            }),
          ]);
          await transaction.commit();
        });
        let handler = new ProcessPaymentStripeInvoiceCreatingTaskHandler(
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
          await getPaymentStripeInvoiceCreatingTaskMetadata(SPANNER_DATABASE, {
            paymentStripeInvoiceCreatingTaskTaskIdEq: "task1",
          }),
          isArray([
            eqMessage(
              {
                paymentStripeInvoiceCreatingTaskRetryCount: 1,
                paymentStripeInvoiceCreatingTaskExecutionTimeMs: 301000,
              },
              GET_PAYMENT_STRIPE_INVOICE_CREATING_TASK_METADATA_ROW,
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
