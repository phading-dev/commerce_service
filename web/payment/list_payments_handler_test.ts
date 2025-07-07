import "../../local/env";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import { PaymentState } from "../../db/schema";
import {
  deletePaymentStatement,
  deleteTransactionStatementStatement,
  insertPaymentStatement,
  insertTransactionStatementStatement,
} from "../../db/sql";
import { ListPaymentsHandler } from "./list_payments_handler";
import { LIST_PAYMENTS_RESPONSE } from "@phading/commerce_service_interface/web/payment/interface";
import { PaymentState as PaymentStateResponse } from "@phading/commerce_service_interface/web/payment/payment";
import { FetchSessionAndCheckCapabilityResponse } from "@phading/user_session_service_interface/node/interface";
import { eqMessage } from "@selfage/message/test_matcher";
import { NodeServiceClientMock } from "@selfage/node_service_client/client_mock";
import { assertThat } from "@selfage/test_matcher";
import { TEST_RUNNER } from "@selfage/test_runner";

TEST_RUNNER.run({
  name: "ListPaymentsHandlerTest",
  cases: [
    {
      name: "MixedData",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertTransactionStatementStatement({
              statementId: "statement1",
              accountId: "account1",
              month: "2022-10",
              statement: {
                currency: "USD",
                totalAmount: 1300,
              },
            }),
            insertPaymentStatement({
              statementId: "statement1",
              accountId: "account1",
              state: PaymentState.PAID,
              updatedTimeMs: 1000,
            }),
            insertTransactionStatementStatement({
              statementId: "statement2",
              accountId: "account1",
              month: "2022-11",
              statement: {
                currency: "USD",
                totalAmount: 1400,
              },
            }),
            insertPaymentStatement({
              statementId: "statement2",
              accountId: "account1",
              state: PaymentState.FAILED_WITHOUT_INVOICE,
              updatedTimeMs: 2000,
            }),
            insertTransactionStatementStatement({
              statementId: "statement3",
              accountId: "account1",
              month: "2022-12",
              statement: {
                currency: "USD",
                totalAmount: 1500,
              },
            }),
            insertPaymentStatement({
              statementId: "statement3",
              accountId: "account1",
              state: PaymentState.FAILED_WITH_INVOICE,
              updatedTimeMs: 3000,
            }),
            insertTransactionStatementStatement({
              statementId: "statement4",
              accountId: "account1",
              month: "2023-01",
              statement: {
                currency: "USD",
                totalAmount: 1600,
              },
            }),
            insertTransactionStatementStatement({
              statementId: "statement5",
              accountId: "account1",
              month: "2023-02",
              statement: {
                currency: "USD",
                totalAmount: 1700,
              },
            }),
            insertPaymentStatement({
              statementId: "statement5",
              accountId: "account1",
              state: PaymentState.CREATING_STRIPE_INVOICE,
              updatedTimeMs: 5000,
            }),
            insertTransactionStatementStatement({
              statementId: "statement6",
              accountId: "account1",
              month: "2023-03",
              statement: {
                currency: "USD",
                totalAmount: 1800,
              },
            }),
            insertPaymentStatement({
              statementId: "statement6",
              accountId: "account1",
              state: PaymentState.PAYING_INVOICE,
              updatedTimeMs: 6000,
            }),
            insertTransactionStatementStatement({
              statementId: "statement7",
              accountId: "account1",
              month: "2023-04",
              statement: {
                currency: "USD",
                totalAmount: 1900,
              },
            }),
            insertPaymentStatement({
              statementId: "statement7",
              accountId: "account1",
              state: PaymentState.WAITING_FOR_INVOICE_PAYMENT,
              updatedTimeMs: 7000,
            }),
            insertTransactionStatementStatement({
              statementId: "statement8",
              accountId: "account1",
              month: "2023-05",
              statement: {
                currency: "USD",
                totalAmount: 2000,
              },
            }),
            insertPaymentStatement({
              statementId: "statement8",
              accountId: "account1",
              state: PaymentState.PAID,
              updatedTimeMs: 8000,
            }),
            insertTransactionStatementStatement({
              statementId: "statement9",
              accountId: "account1",
              month: "2023-06",
              statement: {
                currency: "USD",
                totalAmount: 2100,
              },
            }),
            insertPaymentStatement({
              statementId: "statement9",
              accountId: "account1",
              state: PaymentState.PAID,
              updatedTimeMs: 9000,
            }),
          ]);
          await transaction.commit();
        });

        let serviceClientMock = new NodeServiceClientMock();
        serviceClientMock.response = {
          accountId: "account1",
          capabilities: { canBeBilled: true },
        } as FetchSessionAndCheckCapabilityResponse;

        let handler = new ListPaymentsHandler(
          SPANNER_DATABASE,
          serviceClientMock,
        );

        // Execute
        let response = await handler.handle(
          "",
          {
            startMonth: "2022-11",
            endMonth: "2023-05",
          },
          "session1",
        );

        // Verify
        assertThat(
          response,
          eqMessage(
            {
              payments: [
                {
                  month: "2023-05",
                  amount: 2000,
                  currency: "USD",
                  state: PaymentStateResponse.PAID,
                  updatedTimeMs: 8000,
                },
                {
                  month: "2023-04",
                  amount: 1900,
                  currency: "USD",
                  state: PaymentStateResponse.PROCESSING,
                  updatedTimeMs: 7000,
                },
                {
                  month: "2023-03",
                  amount: 1800,
                  currency: "USD",
                  state: PaymentStateResponse.PROCESSING,
                  updatedTimeMs: 6000,
                },
                {
                  month: "2023-02",
                  amount: 1700,
                  currency: "USD",
                  state: PaymentStateResponse.PROCESSING,
                  updatedTimeMs: 5000,
                },
                {
                  month: "2022-12",
                  amount: 1500,
                  currency: "USD",
                  state: PaymentStateResponse.FAILED,
                  updatedTimeMs: 3000,
                },
                {
                  month: "2022-11",
                  amount: 1400,
                  currency: "USD",
                  state: PaymentStateResponse.FAILED,
                  updatedTimeMs: 2000,
                },
              ],
            },
            LIST_PAYMENTS_RESPONSE,
          ),
          "response",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deletePaymentStatement({ paymentStatementIdEq: "statement1" }),
            deletePaymentStatement({ paymentStatementIdEq: "statement2" }),
            deletePaymentStatement({ paymentStatementIdEq: "statement3" }),
            deletePaymentStatement({ paymentStatementIdEq: "statement4" }),
            deletePaymentStatement({ paymentStatementIdEq: "statement5" }),
            deletePaymentStatement({ paymentStatementIdEq: "statement6" }),
            deletePaymentStatement({ paymentStatementIdEq: "statement7" }),
            deletePaymentStatement({ paymentStatementIdEq: "statement8" }),
            deletePaymentStatement({ paymentStatementIdEq: "statement9" }),
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
            deleteTransactionStatementStatement({
              transactionStatementStatementIdEq: "statement9",
            }),
          ]);
          await transaction.commit();
        });
      },
    },
  ],
});
