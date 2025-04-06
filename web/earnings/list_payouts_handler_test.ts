import "../../local/env";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import { PayoutState } from "../../db/schema";
import {
  deletePayoutStatement,
  deleteTransactionStatementStatement,
  insertPayoutStatement,
  insertTransactionStatementStatement,
} from "../../db/sql";
import { ListPayoutsHandler } from "./list_payouts_handler";
import { LIST_PAYOUTS_RESPONSE } from "@phading/commerce_service_interface/web/earnings/interface";
import { PayoutState as PayoutStateResponse } from "@phading/commerce_service_interface/web/earnings/payout";
import { FetchSessionAndCheckCapabilityResponse } from "@phading/user_session_service_interface/node/interface";
import { eqMessage } from "@selfage/message/test_matcher";
import { NodeServiceClientMock } from "@selfage/node_service_client/client_mock";
import { assertThat } from "@selfage/test_matcher";
import { TEST_RUNNER } from "@selfage/test_runner";

TEST_RUNNER.run({
  name: "ListPayoutsHandlerTest",
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
            insertPayoutStatement({
              statementId: "statement1",
              accountId: "account1",
              state: PayoutState.PAID,
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
            insertPayoutStatement({
              statementId: "statement2",
              accountId: "account1",
              state: PayoutState.FAILED,
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
            insertPayoutStatement({
              statementId: "statement3",
              accountId: "account1",
              state: PayoutState.PROCESSING,
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
            insertPayoutStatement({
              statementId: "statement5",
              accountId: "account1",
              state: PayoutState.PAID,
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
            insertPayoutStatement({
              statementId: "statement6",
              accountId: "account1",
              state: PayoutState.PAID,
              updatedTimeMs: 6000,
            }),
          ]);
          await transaction.commit();
        });

        let serviceClientMock = new NodeServiceClientMock();
        serviceClientMock.response = {
          accountId: "account1",
          capabilities: { canEarn: true },
        } as FetchSessionAndCheckCapabilityResponse;

        let handler = new ListPayoutsHandler(
          SPANNER_DATABASE,
          serviceClientMock,
        );

        // Execute
        let response = await handler.handle(
          "",
          {
            startMonth: "2022-11",
            endMonth: "2023-02",
          },
          "session1",
        );

        // Verify
        assertThat(
          response,
          eqMessage(
            {
              payouts: [
                {
                  payoutId: "statement5",
                  month: "2023-02",
                  amount: 1700,
                  currency: "USD",
                  state: PayoutStateResponse.PAID,
                  updatedTimeMs: 5000,
                },
                {
                  payoutId: "statement3",
                  month: "2022-12",
                  amount: 1500,
                  currency: "USD",
                  state: PayoutStateResponse.PROCESSING,
                  updatedTimeMs: 3000,
                },
                {
                  payoutId: "statement2",
                  month: "2022-11",
                  amount: 1400,
                  currency: "USD",
                  state: PayoutStateResponse.FAILED,
                  updatedTimeMs: 2000,
                },
              ],
            },
            LIST_PAYOUTS_RESPONSE,
          ),
          "response",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deletePayoutStatement({ payoutStatementIdEq: "statement1" }),
            deletePayoutStatement({ payoutStatementIdEq: "statement2" }),
            deletePayoutStatement({ payoutStatementIdEq: "statement3" }),
            deletePayoutStatement({ payoutStatementIdEq: "statement4" }),
            deletePayoutStatement({ payoutStatementIdEq: "statement5" }),
            deletePayoutStatement({ payoutStatementIdEq: "statement6" }),
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
