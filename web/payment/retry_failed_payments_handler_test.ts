import "../../local/env";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import { PaymentState } from "../../db/schema";
import {
  GET_PAYMENT_ROW,
  GET_PAYMENT_STRIPE_INVOICE_CREATING_TASK_ROW,
  GET_PAYMENT_STRIPE_INVOICE_PAYING_TASK_ROW,
  deletePaymentStatement,
  deletePaymentStripeInvoiceCreatingTaskStatement,
  deletePaymentStripeInvoicePayingTaskStatement,
  getPayment,
  getPaymentStripeInvoiceCreatingTask,
  getPaymentStripeInvoicePayingTask,
  insertPaymentStatement,
  listPendingPaymentStripeInvoiceCreatingTasks,
  listPendingPaymentStripeInvoicePayingTasks,
} from "../../db/sql";
import { RetryFailedPaymentsHandler } from "./retry_failed_payments_handler";
import { FetchSessionAndCheckCapabilityResponse } from "@phading/user_session_service_interface/node/interface";
import { eqMessage } from "@selfage/message/test_matcher";
import { NodeServiceClientMock } from "@selfage/node_service_client/client_mock";
import { assertThat, isArray, isUnorderedArray } from "@selfage/test_matcher";
import { TEST_RUNNER } from "@selfage/test_runner";

TEST_RUNNER.run({
  name: "RetryFailedPaymentsHandlerTest",
  cases: [
    {
      name: "RetryFailedPayments",
      async execute() {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertPaymentStatement({
              statementId: "statement1",
              accountId: "account1",
              state: PaymentState.FAILED_WITHOUT_INVOICE,
            }),
            insertPaymentStatement({
              statementId: "statement2",
              accountId: "account1",
              state: PaymentState.CREATING_STRIPE_INVOICE,
            }),
            insertPaymentStatement({
              statementId: "statement3",
              accountId: "account1",
              state: PaymentState.WAITING_FOR_INVOICE_PAYMENT,
            }),
            insertPaymentStatement({
              statementId: "statement4",
              accountId: "account1",
              state: PaymentState.PAID,
            }),
            insertPaymentStatement({
              statementId: "statement5",
              accountId: "account1",
              state: PaymentState.FAILED_WITH_INVOICE,
            }),
            insertPaymentStatement({
              statementId: "statement6",
              accountId: "account1",
              state: PaymentState.PAYING_INVOICE,
            }),
          ]);
          await transaction.commit();
        });
        let clientMock = new NodeServiceClientMock();
        clientMock.response = {
          accountId: "account1",
          capabilities: {
            canBeBilled: true,
          },
        } as FetchSessionAndCheckCapabilityResponse;
        let id = 0;
        let handler = new RetryFailedPaymentsHandler(
          SPANNER_DATABASE,
          clientMock,
          () => `uuid${id++}`,
          () => 1000,
        );

        // Execute
        await handler.handle("", {}, "session1");

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
                paymentState: PaymentState.CREATING_STRIPE_INVOICE,
                paymentUpdatedTimeMs: 1000,
              },
              GET_PAYMENT_ROW,
            ),
          ]),
          "payment for statement1",
        );
        assertThat(
          await getPayment(SPANNER_DATABASE, {
            paymentStatementIdEq: "statement2",
          }),
          isArray([
            eqMessage(
              {
                paymentAccountId: "account1",
                paymentStatementId: "statement2",
                paymentState: PaymentState.CREATING_STRIPE_INVOICE,
              },
              GET_PAYMENT_ROW,
            ),
          ]),
          "payment for statement2",
        );
        assertThat(
          await getPayment(SPANNER_DATABASE, {
            paymentStatementIdEq: "statement3",
          }),
          isArray([
            eqMessage(
              {
                paymentAccountId: "account1",
                paymentStatementId: "statement3",
                paymentState: PaymentState.WAITING_FOR_INVOICE_PAYMENT,
              },
              GET_PAYMENT_ROW,
            ),
          ]),
          "payment for statement3",
        );
        assertThat(
          await getPayment(SPANNER_DATABASE, {
            paymentStatementIdEq: "statement4",
          }),
          isArray([
            eqMessage(
              {
                paymentAccountId: "account1",
                paymentStatementId: "statement4",
                paymentState: PaymentState.PAID,
              },
              GET_PAYMENT_ROW,
            ),
          ]),
          "payment for statement4",
        );
        assertThat(
          await getPayment(SPANNER_DATABASE, {
            paymentStatementIdEq: "statement5",
          }),
          isArray([
            eqMessage(
              {
                paymentAccountId: "account1",
                paymentStatementId: "statement5",
                paymentState: PaymentState.PAYING_INVOICE,
                paymentUpdatedTimeMs: 1000,
              },
              GET_PAYMENT_ROW,
            ),
          ]),
          "payment for statement5",
        );
        assertThat(
          await getPayment(SPANNER_DATABASE, {
            paymentStatementIdEq: "statement6",
          }),
          isArray([
            eqMessage(
              {
                paymentAccountId: "account1",
                paymentStatementId: "statement6",
                paymentState: PaymentState.PAYING_INVOICE,
              },
              GET_PAYMENT_ROW,
            ),
          ]),
          "payment for statement6",
        );
        assertThat(
          await getPaymentStripeInvoiceCreatingTask(SPANNER_DATABASE, {
            paymentStripeInvoiceCreatingTaskTaskIdEq: "uuid0",
          }),
          isUnorderedArray([
            eqMessage(
              {
                paymentStripeInvoiceCreatingTaskTaskId: "uuid0",
                paymentStripeInvoiceCreatingTaskStatementId: "statement1",
                paymentStripeInvoiceCreatingTaskRetryCount: 0,
                paymentStripeInvoiceCreatingTaskExecutionTimeMs: 1000,
                paymentStripeInvoiceCreatingTaskCreatedTimeMs: 1000,
              },
              GET_PAYMENT_STRIPE_INVOICE_CREATING_TASK_ROW,
            ),
          ]),
          "paymentStripeInvoiceCreatingTask for statement1",
        );
        assertThat(
          await getPaymentStripeInvoicePayingTask(SPANNER_DATABASE, {
            paymentStripeInvoicePayingTaskTaskIdEq: "uuid1",
          }),
          isUnorderedArray([
            eqMessage(
              {
                paymentStripeInvoicePayingTaskTaskId: "uuid1",
                paymentStripeInvoicePayingTaskStatementId: "statement5",
                paymentStripeInvoicePayingTaskRetryCount: 0,
                paymentStripeInvoicePayingTaskExecutionTimeMs: 1000,
                paymentStripeInvoicePayingTaskCreatedTimeMs: 1000,
              },
              GET_PAYMENT_STRIPE_INVOICE_PAYING_TASK_ROW,
            ),
          ]),
          "paymentStripeInvoicePayingTask for statement5",
        );
      },
      async tearDown() {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deletePaymentStatement({ paymentStatementIdEq: "statement1" }),
            deletePaymentStatement({ paymentStatementIdEq: "statement2" }),
            deletePaymentStatement({ paymentStatementIdEq: "statement3" }),
            deletePaymentStatement({ paymentStatementIdEq: "statement4" }),
            deletePaymentStatement({ paymentStatementIdEq: "statement5" }),
            deletePaymentStatement({ paymentStatementIdEq: "statement6" }),
            deletePaymentStripeInvoiceCreatingTaskStatement({
              paymentStripeInvoiceCreatingTaskTaskIdEq: "uuid0",
            }),
            deletePaymentStripeInvoiceCreatingTaskStatement({
              paymentStripeInvoiceCreatingTaskTaskIdEq: "uuid1",
            }),
            deletePaymentStripeInvoicePayingTaskStatement({
              paymentStripeInvoicePayingTaskTaskIdEq: "uuid0",
            }),
            deletePaymentStripeInvoicePayingTaskStatement({
              paymentStripeInvoicePayingTaskTaskIdEq: "uuid1",
            }),
          ]);
          await transaction.commit();
        });
      },
    },
    {
      name: "NoPaymentsToRetry",
      async execute() {
        // Prepare
        let clientMock = new NodeServiceClientMock();
        clientMock.response = {
          accountId: "account1",
          capabilities: {
            canBeBilled: true,
          },
        } as FetchSessionAndCheckCapabilityResponse;
        let handler = new RetryFailedPaymentsHandler(
          SPANNER_DATABASE,
          clientMock,
          () => "uuid0",
          () => 1000,
        );

        // Execute
        await handler.handle("", {}, "session1");

        // Verify
        assertThat(
          await listPendingPaymentStripeInvoiceCreatingTasks(SPANNER_DATABASE, {
            paymentStripeInvoiceCreatingTaskExecutionTimeMsLe: 1000000,
          }),
          isArray([]),
          "pending PaymentStripeInvoiceCreatingTasks",
        );
        assertThat(
          await listPendingPaymentStripeInvoicePayingTasks(SPANNER_DATABASE, {
            paymentStripeInvoicePayingTaskExecutionTimeMsLe: 1000000,
          }),
          isArray([]),
          "pending PaymentStripeInvoicePayingTasks",
        );
      },
      async tearDown() {},
    },
  ],
});
