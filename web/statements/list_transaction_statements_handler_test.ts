import "../../local/env";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import { PaymentState, PayoutState } from "../../db/schema";
import {
  deletePaymentStatement,
  deletePayoutStatement,
  deleteTransactionStatementStatement,
  insertPaymentStatement,
  insertPayoutStatement,
  insertTransactionStatementStatement,
} from "../../db/sql";
import { ListTransactionStatementsHandler } from "./list_transaction_statements_handler";
import { LIST_TRANSACTION_STATEMENTS_RESPONSE } from "@phading/commerce_service_interface/web/statements/interface";
import {
  PaymentState as PaymentStateResponse,
  PayoutState as PayoutStateResponse,
} from "@phading/commerce_service_interface/web/statements/transaction_statement";
import { ProductID } from "@phading/price";
import { AmountType } from "@phading/price/amount_type";
import { FetchSessionAndCheckCapabilityResponse } from "@phading/user_session_service_interface/node/interface";
import { eqMessage } from "@selfage/message/test_matcher";
import { NodeServiceClientMock } from "@selfage/node_service_client/client_mock";
import { assertThat } from "@selfage/test_matcher";
import { TEST_RUNNER } from "@selfage/test_runner";

TEST_RUNNER.run({
  name: "ListTransactionStatementsHandlerTest",
  cases: [
    {
      name: "MixedData",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertTransactionStatementStatement({
              statementId: "statement0",
              accountId: "account1",
              month: "2022-12",
              statement: {
                currency: "USD",
                totalAmount: 1300,
                totalAmountType: AmountType.DEBIT,
                positiveAmountType: AmountType.DEBIT,
                items: [],
              },
            }),
            insertTransactionStatementStatement({
              statementId: "statement1",
              accountId: "account1",
              month: "2022-11",
              statement: {
                currency: "USD",
                totalAmount: 1300,
                totalAmountType: AmountType.DEBIT,
                positiveAmountType: AmountType.DEBIT,
                items: [
                  {
                    productID: ProductID.SHOW,
                    amountType: AmountType.DEBIT,
                    unit: "seconds",
                    amount: 80,
                    quantity: 880,
                  },
                  {
                    productID: ProductID.STORAGE,
                    amountType: AmountType.DEBIT,
                    unit: "MiB",
                    amount: 90,
                    quantity: 990,
                  },
                ],
              },
            }),
            insertPaymentStatement({
              statementId: "statement1",
              accountId: "account1",
              state: PaymentState.PAID,
              stripeInvoiceUrl: "https://stripe.com/invoice1",
            }),
            insertTransactionStatementStatement({
              statementId: "statement2",
              accountId: "account1",
              month: "2022-10",
              statement: {
                currency: "USD",
                totalAmount: 1402,
                totalAmountType: AmountType.DEBIT,
                positiveAmountType: AmountType.DEBIT,
                items: [
                  {
                    productID: ProductID.SHOW,
                    amountType: AmountType.DEBIT,
                    unit: "seconds",
                    amount: 82,
                    quantity: 882,
                  },
                ],
              },
            }),
            insertPaymentStatement({
              statementId: "statement2",
              accountId: "account1",
              state: PaymentState.FAILED,
              stripeInvoiceUrl: "https://stripe.com/invoice2",
            }),
            insertTransactionStatementStatement({
              statementId: "statement3",
              accountId: "account1",
              month: "2022-09",
              statement: {
                currency: "USD",
                totalAmount: 1500,
                totalAmountType: AmountType.DEBIT,
                positiveAmountType: AmountType.DEBIT,
                items: [
                  {
                    productID: ProductID.SHOW,
                    amountType: AmountType.DEBIT,
                    unit: "seconds",
                    amount: 85,
                    quantity: 885,
                  },
                ],
              },
            }),
            insertPaymentStatement({
              statementId: "statement3",
              accountId: "account1",
              state: PaymentState.CHARGING_VIA_STRIPE_INVOICE,
              stripeInvoiceUrl: "https://stripe.com/invoice3",
            }),
            insertTransactionStatementStatement({
              statementId: "statement4",
              accountId: "account1",
              month: "2022-08",
              statement: {
                currency: "USD",
                totalAmount: 1600,
                totalAmountType: AmountType.DEBIT,
                positiveAmountType: AmountType.CREDIT,
                items: [
                  {
                    productID: ProductID.SHOW,
                    amountType: AmountType.DEBIT,
                    unit: "seconds",
                    amount: 88,
                    quantity: 888,
                  },
                  {
                    productID: ProductID.SHOW_CREDIT,
                    amountType: AmountType.CREDIT,
                    unit: "seconds",
                    amount: 77,
                    quantity: 777,
                  },
                ],
              },
            }),
            insertPaymentStatement({
              statementId: "statement4",
              accountId: "account1",
              state: PaymentState.PROCESSING,
            }),
            insertTransactionStatementStatement({
              statementId: "statement5",
              accountId: "account1",
              month: "2022-07",
              statement: {
                currency: "USD",
                totalAmount: 1700,
                totalAmountType: AmountType.CREDIT,
                positiveAmountType: AmountType.CREDIT,
                items: [
                  {
                    productID: ProductID.SHOW_CREDIT,
                    amountType: AmountType.CREDIT,
                    unit: "seconds",
                    amount: 90,
                    quantity: 890,
                  },
                  {
                    productID: ProductID.STORAGE,
                    amountType: AmountType.DEBIT,
                    unit: "MiB",
                    amount: 60,
                    quantity: 660,
                  },
                ],
              },
            }),
            insertPayoutStatement({
              statementId: "statement5",
              accountId: "account1",
              state: PayoutState.PAID,
            }),
            insertTransactionStatementStatement({
              statementId: "statement6",
              accountId: "account1",
              month: "2022-06",
              statement: {
                currency: "USD",
                totalAmount: 1800,
                totalAmountType: AmountType.CREDIT,
                positiveAmountType: AmountType.DEBIT,
                items: [
                  {
                    productID: ProductID.SHOW_CREDIT,
                    amountType: AmountType.CREDIT,
                    unit: "seconds",
                    amount: 92,
                    quantity: 892,
                  },
                ],
              },
            }),
            insertPayoutStatement({
              statementId: "statement6",
              accountId: "account1",
              state: PayoutState.FAILED,
            }),
            insertTransactionStatementStatement({
              statementId: "statement7",
              accountId: "account1",
              month: "2022-05",
              statement: {
                currency: "USD",
                totalAmount: 1900,
                totalAmountType: AmountType.CREDIT,
                positiveAmountType: AmountType.CREDIT,
                items: [
                  {
                    productID: ProductID.SHOW_CREDIT,
                    amountType: AmountType.CREDIT,
                    unit: "seconds",
                    amount: 95,
                    quantity: 895,
                  },
                ],
              },
            }),
            insertPayoutStatement({
              statementId: "statement7",
              accountId: "account1",
              state: PayoutState.PROCESSING,
            }),
            insertTransactionStatementStatement({
              statementId: "statement8",
              accountId: "account1",
              month: "2022-04",
              statement: {
                currency: "USD",
                totalAmount: 2100,
                totalAmountType: AmountType.DEBIT,
                positiveAmountType: AmountType.DEBIT,
                items: [],
              },
            }),
          ]);
          await transaction.commit();
        });
        let serviceClientMock = new NodeServiceClientMock();
        serviceClientMock.response = {
          accountId: "account1",
        } as FetchSessionAndCheckCapabilityResponse;
        let handler = new ListTransactionStatementsHandler(
          SPANNER_DATABASE,
          serviceClientMock,
        );

        // Execute
        let response = await handler.handle(
          "",
          {
            startMonth: "2022-05",
            endMonth: "2022-11",
          },
          "session1",
        );

        // Verify
        assertThat(
          response,
          eqMessage(
            {
              statements: [
                {
                  statementId: "statement1",
                  month: "2022-11",
                  currency: "USD",
                  totalAmount: 1300,
                  totalAmountType: AmountType.DEBIT,
                  positiveAmountType: AmountType.DEBIT,
                  items: [
                    {
                      productID: ProductID.SHOW,
                      amountType: AmountType.DEBIT,
                      unit: "seconds",
                      amount: 80,
                      quantity: 880,
                    },
                    {
                      productID: ProductID.STORAGE,
                      amountType: AmountType.DEBIT,
                      unit: "MiB",
                      amount: 90,
                      quantity: 990,
                    },
                  ],
                  payment: {
                    state: PaymentStateResponse.PAID,
                    stripeInvoiceUrl: "https://stripe.com/invoice1",
                  },
                },
                {
                  statementId: "statement2",
                  month: "2022-10",
                  currency: "USD",
                  totalAmount: 1402,
                  totalAmountType: AmountType.DEBIT,
                  positiveAmountType: AmountType.DEBIT,
                  items: [
                    {
                      productID: ProductID.SHOW,
                      amountType: AmountType.DEBIT,
                      unit: "seconds",
                      amount: 82,
                      quantity: 882,
                    },
                  ],
                  payment: {
                    state: PaymentStateResponse.FAILED,
                    stripeInvoiceUrl: "https://stripe.com/invoice2",
                  },
                },
                {
                  statementId: "statement3",
                  month: "2022-09",
                  currency: "USD",
                  totalAmount: 1500,
                  totalAmountType: AmountType.DEBIT,
                  positiveAmountType: AmountType.DEBIT,
                  items: [
                    {
                      productID: ProductID.SHOW,
                      amountType: AmountType.DEBIT,
                      unit: "seconds",
                      amount: 85,
                      quantity: 885,
                    },
                  ],
                  payment: {
                    state: PaymentStateResponse.PROCESSING,
                    stripeInvoiceUrl: "https://stripe.com/invoice3",
                  },
                },
                {
                  statementId: "statement4",
                  month: "2022-08",
                  currency: "USD",
                  totalAmount: 1600,
                  totalAmountType: AmountType.DEBIT,
                  positiveAmountType: AmountType.CREDIT,
                  items: [
                    {
                      productID: ProductID.SHOW,
                      amountType: AmountType.DEBIT,
                      unit: "seconds",
                      amount: 88,
                      quantity: 888,
                    },
                    {
                      productID: ProductID.SHOW_CREDIT,
                      amountType: AmountType.CREDIT,
                      unit: "seconds",
                      amount: 77,
                      quantity: 777,
                    },
                  ],
                  payment: {
                    state: PaymentStateResponse.PROCESSING,
                  },
                },
                {
                  statementId: "statement5",
                  month: "2022-07",
                  currency: "USD",
                  totalAmount: 1700,
                  totalAmountType: AmountType.CREDIT,
                  positiveAmountType: AmountType.CREDIT,
                  items: [
                    {
                      productID: ProductID.SHOW_CREDIT,
                      amountType: AmountType.CREDIT,
                      unit: "seconds",
                      amount: 90,
                      quantity: 890,
                    },
                    {
                      productID: ProductID.STORAGE,
                      amountType: AmountType.DEBIT,
                      unit: "MiB",
                      amount: 60,
                      quantity: 660,
                    },
                  ],
                  payout: {
                    state: PayoutStateResponse.PAID,
                  },
                },
                {
                  statementId: "statement6",
                  month: "2022-06",
                  currency: "USD",
                  totalAmount: 1800,
                  totalAmountType: AmountType.CREDIT,
                  positiveAmountType: AmountType.DEBIT,
                  items: [
                    {
                      productID: ProductID.SHOW_CREDIT,
                      amountType: AmountType.CREDIT,
                      unit: "seconds",
                      amount: 92,
                      quantity: 892,
                    },
                  ],
                  payout: {
                    state: PayoutStateResponse.FAILED,
                  },
                },
                {
                  statementId: "statement7",
                  month: "2022-05",
                  currency: "USD",
                  totalAmount: 1900,
                  totalAmountType: AmountType.CREDIT,
                  positiveAmountType: AmountType.CREDIT,
                  items: [
                    {
                      productID: ProductID.SHOW_CREDIT,
                      amountType: AmountType.CREDIT,
                      unit: "seconds",
                      amount: 95,
                      quantity: 895,
                    },
                  ],
                  payout: {
                    state: PayoutStateResponse.PROCESSING,
                  },
                },
              ],
            },
            LIST_TRANSACTION_STATEMENTS_RESPONSE,
          ),
          "response",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deleteTransactionStatementStatement({
              transactionStatementStatementIdEq: "statement0",
            }),
            deleteTransactionStatementStatement({
              transactionStatementStatementIdEq: "statement1",
            }),
            deleteTransactionStatementStatement({
              transactionStatementStatementIdEq: "statement2",
            }),
            deleteTransactionStatementStatement({
              transactionStatementStatementIdEq: "statement3",
            }),
            deleteTransactionStatementStatement({
              transactionStatementStatementIdEq: "statement4",
            }),
            deleteTransactionStatementStatement({
              transactionStatementStatementIdEq: "statement5",
            }),
            deleteTransactionStatementStatement({
              transactionStatementStatementIdEq: "statement6",
            }),
            deleteTransactionStatementStatement({
              transactionStatementStatementIdEq: "statement7",
            }),
            deleteTransactionStatementStatement({
              transactionStatementStatementIdEq: "statement8",
            }),
            deletePaymentStatement({ paymentStatementIdEq: "statement1" }),
            deletePaymentStatement({ paymentStatementIdEq: "statement2" }),
            deletePaymentStatement({ paymentStatementIdEq: "statement3" }),
            deletePaymentStatement({ paymentStatementIdEq: "statement4" }),
            deletePayoutStatement({ payoutStatementIdEq: "statement5" }),
            deletePayoutStatement({ payoutStatementIdEq: "statement6" }),
            deletePayoutStatement({ payoutStatementIdEq: "statement7" }),
          ]);
          await transaction.commit();
        });
      },
    },
  ],
});
