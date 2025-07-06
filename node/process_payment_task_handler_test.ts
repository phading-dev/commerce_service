import "../local/env";
import { SPANNER_DATABASE } from "../common/spanner_database";
import { PaymentState } from "../db/schema";
import {
  GET_PAYMENT_ROW,
  GET_PAYMENT_TASK_METADATA_ROW,
  deletePaymentMethodNeedsUpdateNotifyingTaskStatement,
  deletePaymentProfileStatement,
  deletePaymentProfileSuspendingDueToPastDueTaskStatement,
  deletePaymentStatement,
  deletePaymentTaskStatement,
  deleteTransactionStatementStatement,
  getPayment,
  getPaymentTaskMetadata,
  insertPaymentProfileStatement,
  insertPaymentStatement,
  insertPaymentTaskStatement,
  insertTransactionStatementStatement,
  listPendingPaymentTasks,
} from "../db/sql";
import { ProcessPaymentTaskHandler } from "./process_payment_task_handler";
import { AmountType } from "@phading/price/amount_type";
import { newBadRequestError } from "@selfage/http_error";
import { eqHttpError } from "@selfage/http_error/test_matcher";
import { eqMessage } from "@selfage/message/test_matcher";
import { Ref } from "@selfage/ref";
import {
  assertReject,
  assertThat,
  eq,
  eqError,
  isArray,
} from "@selfage/test_matcher";
import { TEST_RUNNER } from "@selfage/test_runner";

let ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

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
        state: PaymentState.PROCESSING,
      }),
      insertPaymentTaskStatement({
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
      deletePaymentTaskStatement({
        paymentTaskStatementIdEq: "statement1",
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
  name: "ProcessPaymentTaskHandlerTest",
  cases: [
    {
      name: "Success",
      execute: async () => {
        // Prepare
        await insertPayment();
        let createInvoiceParamsCaptured: any;
        let createInvoiceOptionCaptured: any;
        let addLinesInvoiceIdCaptured: string;
        let addLinesParamsCaptured: any;
        let addLinesOptionCaptured: any;
        let finalizeInvoiceIdCaptured: string;
        let finalizeInvoiceParamsCaptured: any;
        let finalizeInvoiceOptionCaptured: any;
        let stripeClientMock: any = {
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
        let handler = new ProcessPaymentTaskHandler(
          SPANNER_DATABASE,
          new Ref(stripeClientMock),
          () => 1000,
        );

        // Execute
        await handler.processTask("", { statementId: "statement1" });

        // Verify
        assertThat(
          createInvoiceParamsCaptured.customer,
          eq("stripeCustomer1"),
          "createInvoiceParams.customer",
        );
        assertThat(
          createInvoiceParamsCaptured.description,
          eq("2021-01"),
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
          eq("cstatement1"),
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
          eq("astatement1"),
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
          eq("fstatement1"),
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
                paymentState: PaymentState.CHARGING_VIA_STRIPE_INVOICE,
                paymentStripeInvoiceId: "invoice1",
                paymentUpdatedTimeMs: 1000,
              },
              GET_PAYMENT_ROW,
            ),
          ]),
          "payment",
        );
        assertThat(
          await listPendingPaymentTasks(SPANNER_DATABASE, {
            paymentTaskExecutionTimeMsLe: ONE_YEAR_MS,
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
      name: "CreateInvoiceFailed",
      execute: async () => {
        // Prepare
        await insertPayment();
        let stripeClientMock: any = {
          invoices: {
            create: async () => {
              throw new Error("Fake error");
            },
          },
        };
        let handler = new ProcessPaymentTaskHandler(
          SPANNER_DATABASE,
          new Ref(stripeClientMock),
          () => 1000,
        );

        // Execute
        let error = await assertReject(
          handler.processTask("", { statementId: "statement1" }),
        );

        // Verify
        assertThat(error, eqError(new Error("Fake error")), "error");
        assertThat(
          await getPayment(SPANNER_DATABASE, {
            paymentStatementIdEq: "statement1",
          }),
          isArray([
            eqMessage(
              {
                paymentStatementId: "statement1",
                paymentAccountId: "account1",
                paymentState: PaymentState.PROCESSING,
              },
              GET_PAYMENT_ROW,
            ),
          ]),
          "payment",
        );
      },
      tearDown: async () => {
        await cleanupAll();
      },
    },
    {
      name: "PaymentNotInProcessingState",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertPaymentStatement({
              statementId: "statement1",
              state: PaymentState.FAILED,
            }),
          ]);
          await transaction.commit();
        });
        let stripeClientMock: any = {};
        let handler = new ProcessPaymentTaskHandler(
          SPANNER_DATABASE,
          new Ref(stripeClientMock),
          () => 1000,
        );

        // Execute
        let error = await assertReject(
          handler.processTask("", { statementId: "statement1" }),
        );

        // Verify
        assertThat(
          error,
          eqHttpError(
            newBadRequestError("Payment statement1 is not in PROCESSING state"),
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
            insertPaymentTaskStatement({
              statementId: "statement1",
              retryCount: 0,
              executionTimeMs: 100,
            }),
          ]);
          await transaction.commit();
        });
        let handler = new ProcessPaymentTaskHandler(
          SPANNER_DATABASE,
          undefined,
          () => 1000,
        );

        // Execute
        await handler.claimTask("", { statementId: "statement1" });

        // Verify
        assertThat(
          await getPaymentTaskMetadata(SPANNER_DATABASE, {
            paymentTaskStatementIdEq: "statement1",
          }),
          isArray([
            eqMessage(
              {
                paymentTaskRetryCount: 1,
                paymentTaskExecutionTimeMs: 301000,
              },
              GET_PAYMENT_TASK_METADATA_ROW,
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
