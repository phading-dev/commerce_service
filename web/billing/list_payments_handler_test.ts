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
import { LIST_PAYMENTS_RESPONSE } from "@phading/commerce_service_interface/web/billing/interface";
import { PaymentState as PaymentStateResponse } from "@phading/commerce_service_interface/web/billing/payment";
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
              stripeInvoiceUrl: "https://stripe.com/invoice1",
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
              state: PaymentState.FAILED,
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
              state: PaymentState.CHARGING_VIA_STRIPE_INVOICE,
              stripeInvoiceUrl: "https://stripe.com/invoice3",
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
              state: PaymentState.PROCESSING,
              stripeInvoiceUrl: "https://stripe.com/invoice5",
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
              state: PaymentState.PAID,
              stripeInvoiceUrl: "https://stripe.com/invoice6",
              updatedTimeMs: 6000,
            }),
            insertPaymentStatement({
              statementId: "statement7",
              accountId: "account1",
              state: PaymentState.PAID,
              stripeInvoiceUrl: "https://stripe.com/invoice7",
              updatedTimeMs: 7000,
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
            endMonth: "2023-03",
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
                  paymentId: "statement6",
                  month: "2023-03",
                  amount: 1800,
                  currency: "USD",
                  stripeInvoiceUrl: "https://stripe.com/invoice6",
                  state: PaymentStateResponse.PAID,
                  updatedTimeMs: 6000,
                },
                {
                  paymentId: "statement5",
                  month: "2023-02",
                  amount: 1700,
                  currency: "USD",
                  stripeInvoiceUrl: "https://stripe.com/invoice5",
                  state: PaymentStateResponse.PROCESSING,
                  updatedTimeMs: 5000,
                },
                {
                  paymentId: "statement3",
                  month: "2022-12",
                  amount: 1500,
                  currency: "USD",
                  stripeInvoiceUrl: "https://stripe.com/invoice3",
                  state: PaymentStateResponse.PROCESSING,
                  updatedTimeMs: 3000,
                },
                {
                  paymentId: "statement2",
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
          ]);
          await transaction.commit();
        });
      },
    },
  ],
});
