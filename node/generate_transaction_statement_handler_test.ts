import "../local/env";
import { SPANNER_DATABASE } from "../common/spanner_database";
import { PaymentState, PayoutState } from "../db/schema";
import {
  GET_PAYMENT_ROW,
  GET_PAYMENT_STRIPE_INVOICE_CREATING_TASK_ROW,
  GET_PAYOUT_ROW,
  GET_PAYOUT_STRIPE_TRANSFER_CREATING_TASK_ROW,
  GET_TRANSACTION_STATEMENT_ROW,
  deletePaymentStatement,
  deletePaymentStripeInvoiceCreatingTaskStatement,
  deletePayoutStatement,
  deletePayoutStripeTransferCreatingTaskStatement,
  deleteTransactionStatementStatement,
  getPayment,
  getPaymentStripeInvoiceCreatingTask,
  getPayout,
  getPayoutStripeTransferCreatingTask,
  getTransactionStatement,
  insertTransactionStatementStatement,
  listPendingPaymentStripeInvoiceCreatingTasks,
  listPendingPayoutStripeTransferCreatingTasks,
} from "../db/sql";
import { GenerateTransactionStatementHandler } from "./generate_transaction_statement_handler";
import { ProductID } from "@phading/price";
import { AmountType } from "@phading/price/amount_type";
import { eqMessage } from "@selfage/message/test_matcher";
import { assertThat, isArray } from "@selfage/test_matcher";
import { TEST_RUNNER } from "@selfage/test_runner";

async function cleanupAll() {
  await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
    await transaction.batchUpdate([
      deleteTransactionStatementStatement({
        transactionStatementStatementIdEq: "uuid0",
      }),
      deleteTransactionStatementStatement({
        transactionStatementStatementIdEq: "uuid1",
      }),
      deletePaymentStatement({
        paymentStatementIdEq: "uuid0",
      }),
      deletePaymentStripeInvoiceCreatingTaskStatement({
        paymentStripeInvoiceCreatingTaskTaskIdEq: "uuid1",
      }),
      deletePayoutStatement({
        payoutStatementIdEq: "uuid0",
      }),
      deletePayoutStripeTransferCreatingTaskStatement({
        payoutStripeTransferCreatingTaskTaskIdEq: "uuid1",
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
        let id = 0;
        let handler = new GenerateTransactionStatementHandler(
          SPANNER_DATABASE,
          () => `uuid${id++}`,
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
            transactionStatementStatementIdEq: "uuid0",
          }),
          isArray([
            eqMessage(
              {
                transactionStatementAccountId: "account1",
                transactionStatementStatementId: "uuid0",
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
            paymentStatementIdEq: "uuid0",
          }),
          isArray([
            eqMessage(
              {
                paymentAccountId: "account1",
                paymentStatementId: "uuid0",
                paymentState: PaymentState.CREATING_STRIPE_INVOICE,
                paymentCreatedTimeMs: 1000,
                paymentUpdatedTimeMs: 1000,
              },
              GET_PAYMENT_ROW,
            ),
          ]),
          "payment",
        );
        assertThat(
          await getPaymentStripeInvoiceCreatingTask(SPANNER_DATABASE, {
            paymentStripeInvoiceCreatingTaskTaskIdEq: "uuid1",
          }),
          isArray([
            eqMessage(
              {
                paymentStripeInvoiceCreatingTaskTaskId: "uuid1",
                paymentStripeInvoiceCreatingTaskStatementId: "uuid0",
                paymentStripeInvoiceCreatingTaskRetryCount: 0,
                paymentStripeInvoiceCreatingTaskExecutionTimeMs: 1000,
                paymentStripeInvoiceCreatingTaskCreatedTimeMs: 1000,
              },
              GET_PAYMENT_STRIPE_INVOICE_CREATING_TASK_ROW,
            ),
          ]),
          "paymentStripeInvoiceCreatingTask",
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
        let id = 0;
        let handler = new GenerateTransactionStatementHandler(
          SPANNER_DATABASE,
          () => `uuid${id++}`,
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
            transactionStatementStatementIdEq: "uuid0",
          }),
          isArray([
            eqMessage(
              {
                transactionStatementAccountId: "account1",
                transactionStatementStatementId: "uuid0",
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
            payoutStatementIdEq: "uuid0",
          }),
          isArray([
            eqMessage(
              {
                payoutAccountId: "account1",
                payoutStatementId: "uuid0",
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
          await getPayoutStripeTransferCreatingTask(SPANNER_DATABASE, {
            payoutStripeTransferCreatingTaskTaskIdEq: "uuid1",
          }),
          isArray([
            eqMessage(
              {
                payoutStripeTransferCreatingTaskTaskId: "uuid1",
                payoutStripeTransferCreatingTaskStatementId: "uuid0",
                payoutStripeTransferCreatingTaskRetryCount: 0,
                payoutStripeTransferCreatingTaskExecutionTimeMs: 1000,
                payoutStripeTransferCreatingTaskCreatedTimeMs: 1000,
              },
              GET_PAYOUT_STRIPE_TRANSFER_CREATING_TASK_ROW,
            ),
          ]),
          "payoutStripeTransferCreatingTask",
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
        let id = 0;
        let handler = new GenerateTransactionStatementHandler(
          SPANNER_DATABASE,
          () => `uuid${id++}`,
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
            transactionStatementStatementIdEq: "uuid0",
          }),
          isArray([
            eqMessage(
              {
                transactionStatementAccountId: "account1",
                transactionStatementStatementId: "uuid0",
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
            paymentStatementIdEq: "uuid0",
          }),
          isArray([
            eqMessage(
              {
                paymentAccountId: "account1",
                paymentStatementId: "uuid0",
                paymentState: PaymentState.CREATING_STRIPE_INVOICE,
                paymentCreatedTimeMs: 1000,
                paymentUpdatedTimeMs: 1000,
              },
              GET_PAYMENT_ROW,
            ),
          ]),
          "payment",
        );
        assertThat(
          await getPaymentStripeInvoiceCreatingTask(SPANNER_DATABASE, {
            paymentStripeInvoiceCreatingTaskTaskIdEq: "uuid1",
          }),
          isArray([
            eqMessage(
              {
                paymentStripeInvoiceCreatingTaskTaskId: "uuid1",
                paymentStripeInvoiceCreatingTaskStatementId: "uuid0",
                paymentStripeInvoiceCreatingTaskRetryCount: 0,
                paymentStripeInvoiceCreatingTaskExecutionTimeMs: 1000,
                paymentStripeInvoiceCreatingTaskCreatedTimeMs: 1000,
              },
              GET_PAYMENT_STRIPE_INVOICE_CREATING_TASK_ROW,
            ),
          ]),
          "paymentStripeInvoiceCreatingTask",
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
        let id = 0;
        let handler = new GenerateTransactionStatementHandler(
          SPANNER_DATABASE,
          () => `uuid${id++}`,
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
            transactionStatementStatementIdEq: "uuid0",
          }),
          isArray([
            eqMessage(
              {
                transactionStatementAccountId: "account1",
                transactionStatementStatementId: "uuid0",
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
            paymentStatementIdEq: "uuid0",
          }),
          isArray([]),
          "payment",
        );
        assertThat(
          await listPendingPaymentStripeInvoiceCreatingTasks(SPANNER_DATABASE, {
            paymentStripeInvoiceCreatingTaskExecutionTimeMsLe: 1000000,
          }),
          isArray([]),
          "paymentTask",
        );
        assertThat(
          await getPayout(SPANNER_DATABASE, {
            payoutStatementIdEq: "uuid0",
          }),
          isArray([]),
          "payout",
        );
        assertThat(
          await listPendingPayoutStripeTransferCreatingTasks(SPANNER_DATABASE, {
            payoutStripeTransferCreatingTaskExecutionTimeMsLe: 1000000,
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
            insertTransactionStatementStatement({
              accountId: "account1",
              statementId: "uuid0",
              month: "2021-01",
            }),
          ]);
          await transaction.commit();
        });
        let handler = new GenerateTransactionStatementHandler(
          SPANNER_DATABASE,
          () => "uuid1",
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
            transactionStatementStatementIdEq: "uuid0",
          }),
          isArray([
            eqMessage(
              {
                transactionStatementAccountId: "account1",
                transactionStatementStatementId: "uuid0",
                transactionStatementMonth: "2021-01",
              },
              GET_TRANSACTION_STATEMENT_ROW,
            ),
          ]),
          "statement",
        );
        assertThat(
          await listPendingPaymentStripeInvoiceCreatingTasks(SPANNER_DATABASE, {
            paymentStripeInvoiceCreatingTaskExecutionTimeMsLe: 1000000,
          }),
          isArray([]),
          "paymentTasks",
        );
        assertThat(
          await listPendingPayoutStripeTransferCreatingTasks(SPANNER_DATABASE, {
            payoutStripeTransferCreatingTaskExecutionTimeMsLe: 1000000,
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
