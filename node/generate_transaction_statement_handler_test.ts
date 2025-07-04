import "../local/env";
import { SPANNER_DATABASE } from "../common/spanner_database";
import { PaymentState, PayoutState } from "../db/schema";
import {
  GET_PAYMENT_ROW,
  GET_PAYMENT_TASK_ROW,
  GET_PAYOUT_ROW,
  GET_PAYOUT_TASK_ROW,
  GET_TRANSACTION_STATEMENT_ROW,
  deletePaymentProfileStatement,
  deletePaymentStatement,
  deletePaymentTaskStatement,
  deletePayoutStatement,
  deletePayoutTaskStatement,
  deleteTransactionStatementStatement,
  getPayment,
  getPaymentTask,
  getPayout,
  getPayoutTask,
  getTransactionStatement,
  insertPaymentProfileStatement,
  insertTransactionStatementStatement,
  listPendingPaymentTasks,
  listPendingPayoutTasks,
} from "../db/sql";
import { GenerateTransactionStatementHandler } from "./generate_transaction_statement_handler";
import { ProductID } from "@phading/price";
import { AmountType } from "@phading/price/amount_type";
import { eqMessage } from "@selfage/message/test_matcher";
import { assertThat, isArray } from "@selfage/test_matcher";
import { TEST_RUNNER } from "@selfage/test_runner";

async function insertPaymentProfile(firstPaymentTimeMs: number) {
  await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
    await transaction.batchUpdate([
      insertPaymentProfileStatement({
        accountId: "account1",
        firstPaymentTimeMs,
      }),
    ]);
    await transaction.commit();
  });
}

async function cleanupAll() {
  await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
    await transaction.batchUpdate([
      deletePaymentProfileStatement({
        paymentProfileAccountIdEq: "account1",
      }),
      deleteTransactionStatementStatement({
        transactionStatementStatementIdEq: "statement1",
      }),
      deletePaymentStatement({
        paymentStatementIdEq: "statement1",
      }),
      deletePaymentTaskStatement({
        paymentTaskStatementIdEq: "statement1",
      }),
      deletePayoutStatement({
        payoutStatementIdEq: "statement1",
      }),
      deletePayoutTaskStatement({
        payoutTaskStatementIdEq: "statement1",
      }),
    ]);
    await transaction.commit();
  });
}

TEST_RUNNER.run({
  name: "GenerateTransactionStatementHandlerTest",
  cases: [
    {
      name: "DebitToConsumer",
      execute: async () => {
        // Prepare
        await insertPaymentProfile(100);
        let handler = new GenerateTransactionStatementHandler(
          SPANNER_DATABASE,
          () => `statement1`,
          () => 1000,
        );

        // Execute
        await handler.handle("", {
          accountId: "account1",
          month: "2021-01",
          lineItems: [
            {
              productID: ProductID.SHOW,
              quantity: 100 * 3600,
            },
          ],
        });

        // Verify
        assertThat(
          await getTransactionStatement(SPANNER_DATABASE, {
            transactionStatementStatementIdEq: "statement1",
          }),
          isArray([
            eqMessage(
              {
                transactionStatementAccountId: "account1",
                transactionStatementStatementId: "statement1",
                transactionStatementMonth: "2021-01",
                transactionStatementStatement: {
                  currency: "USD",
                  totalAmountType: AmountType.DEBIT,
                  totalAmount: 10,
                  items: [
                    {
                      productID: ProductID.SHOW,
                      unit: "second",
                      quantity: 100 * 3600,
                      amount: 10,
                      amountType: AmountType.DEBIT,
                    },
                  ],
                },
                transactionStatementCreatedTimeMs: 1000,
              },
              GET_TRANSACTION_STATEMENT_ROW,
            ),
          ]),
          "statement",
        );
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
                paymentCreatedTimeMs: 1000,
                paymentUpdatedTimeMs: 1000,
              },
              GET_PAYMENT_ROW,
            ),
          ]),
          "payment",
        );
        assertThat(
          await getPaymentTask(SPANNER_DATABASE, {
            paymentTaskStatementIdEq: "statement1",
          }),
          isArray([
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
          "paymentTask",
        );
      },
      tearDown: async () => {
        await cleanupAll();
      },
    },
    {
      name: "CreditToPublisher",
      execute: async () => {
        // Prepare
        await insertPaymentProfile(2000);
        let handler = new GenerateTransactionStatementHandler(
          SPANNER_DATABASE,
          () => "statement1",
          () => 1000,
        );

        // Execute
        await handler.handle("", {
          accountId: "account1",
          month: "2021-01",
          lineItems: [
            {
              productID: ProductID.SHOW_CREDIT,
              quantity: 20 * 100 * 3600,
            },
            {
              productID: ProductID.STORAGE,
              quantity: 3 * 10 * 1024 * 30 * 24,
            },
            {
              productID: ProductID.UPLOAD,
              quantity: 2 * 1024,
            },
          ],
        });

        // Verify
        assertThat(
          await getTransactionStatement(SPANNER_DATABASE, {
            transactionStatementStatementIdEq: "statement1",
          }),
          isArray([
            eqMessage(
              {
                transactionStatementAccountId: "account1",
                transactionStatementStatementId: "statement1",
                transactionStatementMonth: "2021-01",
                transactionStatementStatement: {
                  currency: "USD",
                  totalAmountType: AmountType.CREDIT,
                  totalAmount: 71,
                  items: [
                    {
                      productID: ProductID.SHOW_CREDIT,
                      unit: "second",
                      quantity: 20 * 100 * 3600,
                      amount: 140,
                      amountType: AmountType.CREDIT,
                    },
                    {
                      productID: ProductID.STORAGE,
                      unit: "MiB x hour",
                      quantity: 3 * 10 * 1024 * 30 * 24,
                      amount: 45,
                      amountType: AmountType.DEBIT,
                    },
                    {
                      productID: ProductID.UPLOAD,
                      unit: "MiB",
                      quantity: 2 * 1024,
                      amount: 24,
                      amountType: AmountType.DEBIT,
                    },
                  ],
                },
                transactionStatementCreatedTimeMs: 1000,
              },
              GET_TRANSACTION_STATEMENT_ROW,
            ),
          ]),
          "statement",
        );
        assertThat(
          await getPayout(SPANNER_DATABASE, {
            payoutStatementIdEq: "statement1",
          }),
          isArray([
            eqMessage(
              {
                payoutAccountId: "account1",
                payoutStatementId: "statement1",
                payoutState: PayoutState.PROCESSING,
                payoutCreatedTimeMs: 1000,
                payoutUpdatedTimeMs: 1000,
              },
              GET_PAYOUT_ROW,
            ),
          ]),
          "payout",
        );
        assertThat(
          await getPayoutTask(SPANNER_DATABASE, {
            payoutTaskStatementIdEq: "statement1",
          }),
          isArray([
            eqMessage(
              {
                payoutTaskStatementId: "statement1",
                payoutTaskRetryCount: 0,
                payoutTaskExecutionTimeMs: 1000,
                payoutTaskCreatedTimeMs: 1000,
              },
              GET_PAYOUT_TASK_ROW,
            ),
          ]),
          "payoutTask",
        );
      },
      tearDown: async () => {
        await cleanupAll();
      },
    },
    {
      name: "DebitToPublisher",
      execute: async () => {
        // Prepare
        await insertPaymentProfile(2000);
        let handler = new GenerateTransactionStatementHandler(
          SPANNER_DATABASE,
          () => "statement1",
          () => 1000,
        );

        // Execute
        await handler.handle("", {
          accountId: "account1",
          month: "2021-01",
          lineItems: [
            {
              productID: ProductID.SHOW_CREDIT,
              quantity: 2 * 100 * 3600,
            },
            {
              productID: ProductID.STORAGE,
              quantity: 3 * 10 * 1024 * 30 * 24,
            },
            {
              productID: ProductID.UPLOAD,
              quantity: 2 * 1024,
            },
          ],
        });

        // Verify
        assertThat(
          await getTransactionStatement(SPANNER_DATABASE, {
            transactionStatementStatementIdEq: "statement1",
          }),
          isArray([
            eqMessage(
              {
                transactionStatementAccountId: "account1",
                transactionStatementStatementId: "statement1",
                transactionStatementMonth: "2021-01",
                transactionStatementStatement: {
                  currency: "USD",
                  totalAmountType: AmountType.DEBIT,
                  totalAmount: 55,
                  items: [
                    {
                      productID: ProductID.SHOW_CREDIT,
                      unit: "second",
                      quantity: 2 * 100 * 3600,
                      amount: 14,
                      amountType: AmountType.CREDIT,
                    },
                    {
                      productID: ProductID.STORAGE,
                      unit: "MiB x hour",
                      quantity: 3 * 10 * 1024 * 30 * 24,
                      amount: 45,
                      amountType: AmountType.DEBIT,
                    },
                    {
                      productID: ProductID.UPLOAD,
                      unit: "MiB",
                      quantity: 2 * 1024,
                      amount: 24,
                      amountType: AmountType.DEBIT,
                    },
                  ],
                },
                transactionStatementCreatedTimeMs: 1000,
              },
              GET_TRANSACTION_STATEMENT_ROW,
            ),
          ]),
          "statement",
        );
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
                paymentCreatedTimeMs: 1000,
                paymentUpdatedTimeMs: 1000,
              },
              GET_PAYMENT_ROW,
            ),
          ]),
          "payment",
        );
        assertThat(
          await getPaymentTask(SPANNER_DATABASE, {
            paymentTaskStatementIdEq: "statement1",
          }),
          isArray([
            eqMessage(
              {
                paymentTaskStatementId: "statement1",
                paymentTaskRetryCount: 0,
                paymentTaskExecutionTimeMs: 2000,
                paymentTaskCreatedTimeMs: 1000,
              },
              GET_PAYMENT_TASK_ROW,
            ),
          ]),
          "paymentTask",
        );
      },
      tearDown: async () => {
        await cleanupAll();
      },
    },
    {
      name: "ZeroDebit",
      execute: async () => {
        // Prepare
        await insertPaymentProfile(100);
        let handler = new GenerateTransactionStatementHandler(
          SPANNER_DATABASE,
          () => "statement1",
          () => 1000,
        );

        // Execute
        await handler.handle("", {
          accountId: "account1",
          month: "2021-01",
          lineItems: [
            {
              productID: ProductID.SHOW_CREDIT,
              quantity: 3 * 100 * 3600,
            },
            {
              productID: ProductID.UPLOAD,
              quantity: 1.75 * 1024,
            },
          ],
        });

        // Verify
        assertThat(
          await getTransactionStatement(SPANNER_DATABASE, {
            transactionStatementStatementIdEq: "statement1",
          }),
          isArray([
            eqMessage(
              {
                transactionStatementAccountId: "account1",
                transactionStatementStatementId: "statement1",
                transactionStatementMonth: "2021-01",
                transactionStatementStatement: {
                  currency: "USD",
                  totalAmountType: AmountType.DEBIT,
                  totalAmount: 0,
                  items: [
                    {
                      productID: ProductID.SHOW_CREDIT,
                      unit: "second",
                      quantity: 3 * 100 * 3600,
                      amount: 21,
                      amountType: AmountType.CREDIT,
                    },
                    {
                      productID: ProductID.UPLOAD,
                      unit: "MiB",
                      quantity: 1.75 * 1024,
                      amount: 21,
                      amountType: AmountType.DEBIT,
                    },
                  ],
                },
                transactionStatementCreatedTimeMs: 1000,
              },
              GET_TRANSACTION_STATEMENT_ROW,
            ),
          ]),
          "statement",
        );
        assertThat(
          await getPayment(SPANNER_DATABASE, {
            paymentStatementIdEq: "statement1",
          }),
          isArray([]),
          "payment",
        );
        assertThat(
          await listPendingPaymentTasks(SPANNER_DATABASE, {
            paymentTaskExecutionTimeMsLe: 1000000,
          }),
          isArray([]),
          "paymentTask",
        );
        assertThat(
          await getPayout(SPANNER_DATABASE, {
            payoutStatementIdEq: "statement1",
          }),
          isArray([]),
          "payout",
        );
        assertThat(
          await listPendingPayoutTasks(SPANNER_DATABASE, {
            payoutTaskExecutionTimeMsLe: 1000000,
          }),
          isArray([]),
          "payoutTask",
        );
      },
      tearDown: async () => {
        await cleanupAll();
      },
    },
    {
      name: "StatementAlreadyExists",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertPaymentProfileStatement({
              accountId: "account1",
              firstPaymentTimeMs: 100,
            }),
            insertTransactionStatementStatement({
              accountId: "account1",
              statementId: "statement1",
              month: "2021-01",
            }),
          ]);
          await transaction.commit();
        });
        let handler = new GenerateTransactionStatementHandler(
          SPANNER_DATABASE,
          () => "statement2",
          () => 1000,
        );

        // Execute
        await handler.handle("", {
          accountId: "account1",
          month: "2021-01",
          lineItems: [
            {
              productID: ProductID.SHOW,
              quantity: 1200,
            },
          ],
        });

        // Verify
        assertThat(
          await getTransactionStatement(SPANNER_DATABASE, {
            transactionStatementStatementIdEq: "statement1",
          }),
          isArray([
            eqMessage(
              {
                transactionStatementAccountId: "account1",
                transactionStatementStatementId: "statement1",
                transactionStatementMonth: "2021-01",
              },
              GET_TRANSACTION_STATEMENT_ROW,
            ),
          ]),
          "statement",
        );
        assertThat(
          await listPendingPaymentTasks(SPANNER_DATABASE, {
            paymentTaskExecutionTimeMsLe: 1000000,
          }),
          isArray([]),
          "paymentTasks",
        );
        assertThat(
          await listPendingPayoutTasks(SPANNER_DATABASE, {
            payoutTaskExecutionTimeMsLe: 1000000,
          }),
          isArray([]),
          "payoutTasks",
        );
      },
      tearDown: async () => {
        await cleanupAll();
      },
    },
  ],
});
