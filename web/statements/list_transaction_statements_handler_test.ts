import "../../local/env";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import {
  deleteTransactionStatementStatement,
  insertTransactionStatementStatement,
} from "../../db/sql";
import { ListTransactionStatementsHandler } from "./list_transaction_statements_handler";
import { LIST_TRANSACTION_STATEMENTS_RESPONSE } from "@phading/commerce_service_interface/web/statements/interface";
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
            insertTransactionStatementStatement({
              statementId: "statement2",
              accountId: "account1",
              month: "2022-09",
              statement: {
                currency: "USD",
                totalAmount: 1500,
                totalAmountType: AmountType.DEBIT,
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
            insertTransactionStatementStatement({
              statementId: "statement3",
              accountId: "account1",
              month: "2022-08",
              statement: {
                currency: "USD",
                totalAmount: 1600,
                totalAmountType: AmountType.DEBIT,
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
            insertTransactionStatementStatement({
              statementId: "statement4",
              accountId: "account1",
              month: "2022-07",
              statement: {
                currency: "USD",
                totalAmount: 1700,
                totalAmountType: AmountType.CREDIT,
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
            insertTransactionStatementStatement({
              statementId: "statement5",
              accountId: "account1",
              month: "2022-06",
              statement: {
                currency: "USD",
                totalAmount: 1800,
                totalAmountType: AmountType.CREDIT,
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
            insertTransactionStatementStatement({
              statementId: "statement6",
              accountId: "account1",
              month: "2022-04",
              statement: {
                currency: "USD",
                totalAmount: 2100,
                totalAmountType: AmountType.DEBIT,
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
                {
                  statementId: "statement2",
                  month: "2022-09",
                  currency: "USD",
                  totalAmount: 1500,
                  totalAmountType: AmountType.DEBIT,
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
                {
                  statementId: "statement3",
                  month: "2022-08",
                  currency: "USD",
                  totalAmount: 1600,
                  totalAmountType: AmountType.DEBIT,
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
                {
                  statementId: "statement4",
                  month: "2022-07",
                  currency: "USD",
                  totalAmount: 1700,
                  totalAmountType: AmountType.CREDIT,
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
                {
                  statementId: "statement5",
                  month: "2022-06",
                  currency: "USD",
                  totalAmount: 1800,
                  totalAmountType: AmountType.CREDIT,
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
          ]);
          await transaction.commit();
        });
      },
    },
  ],
});
