import "../../local/env";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import { PaymentState } from "../../db/schema";
import {
  GET_PAYMENT_ROW,
  GET_PAYMENT_TASK_ROW,
  deletePaymentStatement,
  deletePaymentTaskStatement,
  getPayment,
  getPaymentTask,
  insertPaymentStatement,
  listPendingPaymentTasks,
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
              state: PaymentState.FAILED,
            }),
            insertPaymentStatement({
              statementId: "statement2",
              accountId: "account1",
              state: PaymentState.PROCESSING,
            }),
            insertPaymentStatement({
              statementId: "statement3",
              accountId: "account1",
              state: PaymentState.CHARGING_VIA_STRIPE_INVOICE,
            }),
            insertPaymentStatement({
              statementId: "statement4",
              accountId: "account1",
              state: PaymentState.PAID,
            }),
            insertPaymentStatement({
              statementId: "statement5",
              accountId: "account1",
              state: PaymentState.FAILED,
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
        let handler = new RetryFailedPaymentsHandler(
          SPANNER_DATABASE,
          clientMock,
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
                paymentState: PaymentState.PROCESSING,
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
                paymentState: PaymentState.PROCESSING,
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
                paymentState: PaymentState.CHARGING_VIA_STRIPE_INVOICE,
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
                paymentState: PaymentState.PROCESSING,
                paymentUpdatedTimeMs: 1000,
              },
              GET_PAYMENT_ROW,
            ),
          ]),
          "payment for statement5",
        );
        assertThat(
          await getPaymentTask(SPANNER_DATABASE, {
            paymentTaskStatementIdEq: "statement1",
          }),
          isUnorderedArray([
            eqMessage(
              {
                paymentTaskStatementId: "statement1",
                paymentTaskRetryCount: 0,
                paymentTaskExecutionTimeMs: 1000,
                paymentTaskCreatedTimeMs: 1000,
              },
              GET_PAYMENT_TASK_ROW,
            ),
          ]),
          "paymentTask for statement1",
        );
        assertThat(
          await getPaymentTask(SPANNER_DATABASE, {
            paymentTaskStatementIdEq: "statement5",
          }),
          isUnorderedArray([
            eqMessage(
              {
                paymentTaskStatementId: "statement5",
                paymentTaskRetryCount: 0,
                paymentTaskExecutionTimeMs: 1000,
                paymentTaskCreatedTimeMs: 1000,
              },
              GET_PAYMENT_TASK_ROW,
            ),
          ]),
          "paymentTask for statement5",
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
            deletePaymentTaskStatement({
              paymentTaskStatementIdEq: "statement1",
            }),
            deletePaymentTaskStatement({
              paymentTaskStatementIdEq: "statement2",
            }),
            deletePaymentTaskStatement({
              paymentTaskStatementIdEq: "statement3",
            }),
            deletePaymentTaskStatement({
              paymentTaskStatementIdEq: "statement4",
            }),
            deletePaymentTaskStatement({
              paymentTaskStatementIdEq: "statement5",
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
          () => 1000,
        );

        // Execute
        await handler.handle("", {}, "session1");

        // Verify
        assertThat(
          await listPendingPaymentTasks(SPANNER_DATABASE, {
            paymentTaskExecutionTimeMsLe: 1000000,
          }),
          isArray([]),
          "pending payment tasks",
        );
      },
      async tearDown() {},
    },
  ],
});
