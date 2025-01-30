import { SPANNER_DATABASE } from "../../common/spanner_database";
import { PayoutState, StripeConnectedAccountState } from "../../db/schema";
import {
  GET_EARNINGS_ACCOUNT_ROW,
  LIST_EARNINGS_ROW,
  deleteEarningsAccountStatement,
  deleteEarningsStatement,
  getEarningsAccount,
  insertEarningsAccountStatement,
  insertEarningsStatement,
  listEarnings,
} from "../../db/sql";
import { SetConnectedAccountOnboardedHandler } from "./set_connected_account_onboarded_handler";
import { ExchangeSessionAndCheckCapabilityResponse } from "@phading/user_session_service_interface/node/interface";
import { newUnauthorizedError } from "@selfage/http_error";
import { eqHttpError } from "@selfage/http_error/test_matcher";
import { eqMessage } from "@selfage/message/test_matcher";
import { NodeServiceClientMock } from "@selfage/node_service_client/client_mock";
import { assertReject, assertThat, isArray } from "@selfage/test_matcher";
import { TEST_RUNNER } from "@selfage/test_runner";

TEST_RUNNER.run({
  name: "SetConnectedAccountOnboardedHandlerTest",
  cases: [
    {
      name: "MarkAsOnboarded",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertEarningsAccountStatement({
              accountId: "account1",
              stripeConnectedAccountState:
                StripeConnectedAccountState.ONBOARDING,
            }),
          ]);
          await transaction.commit();
        });
        let clientMock = new NodeServiceClientMock();
        clientMock.response = {
          accountId: "account1",
          capabilities: {
            canEarn: true,
          },
        } as ExchangeSessionAndCheckCapabilityResponse;
        let handler = new SetConnectedAccountOnboardedHandler(
          SPANNER_DATABASE,
          clientMock,
          () => 1000,
        );

        // Execute
        await handler.handle(
          "test",
          {
            accountId: "account1",
          },
          "session1",
        );

        // Verify
        assertThat(
          await getEarningsAccount(SPANNER_DATABASE, "account1"),
          isArray([
            eqMessage(
              {
                earningsAccountData: {
                  accountId: "account1",
                  stripeConnectedAccountState:
                    StripeConnectedAccountState.ONBOARDED,
                },
              },
              GET_EARNINGS_ACCOUNT_ROW,
            ),
          ]),
          "EarningsAccount",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deleteEarningsAccountStatement("account1"),
          ]);
          await transaction.commit();
        });
      },
    },
    {
      name: "MarkAsOnboardedAndRetryPayouts",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertEarningsAccountStatement({
              accountId: "account1",
              stripeConnectedAccountState:
                StripeConnectedAccountState.ONBOARDING,
            }),
            insertEarningsStatement({
              accountId: "account1",
              earningsId: "earnings1",
              state: PayoutState.FAILED,
              month: "2024-10",
            }),
            insertEarningsStatement({
              accountId: "account1",
              earningsId: "earnings2",
              state: PayoutState.PAID,
              month: "2024-11",
            }),
            insertEarningsStatement({
              accountId: "account1",
              earningsId: "earnings3",
              state: PayoutState.PROCESSING,
              month: "2024-12",
            }),
            insertEarningsStatement({
              accountId: "account1",
              earningsId: "earnings4",
              state: PayoutState.FAILED,
              month: "2024-08",
            }),
          ]);
          await transaction.commit();
        });
        let clientMock = new NodeServiceClientMock();
        clientMock.response = {
          accountId: "account1",
          capabilities: {
            canEarn: true,
          },
        } as ExchangeSessionAndCheckCapabilityResponse;
        let handler = new SetConnectedAccountOnboardedHandler(
          SPANNER_DATABASE,
          clientMock,
          () => 1000,
        );

        // Execute
        await handler.handle(
          "test",
          {
            accountId: "account1",
          },
          "session1",
        );

        // Verify
        assertThat(
          await getEarningsAccount(SPANNER_DATABASE, "account1"),
          isArray([
            eqMessage(
              {
                earningsAccountData: {
                  accountId: "account1",
                  stripeConnectedAccountState:
                    StripeConnectedAccountState.ONBOARDED,
                },
              },
              GET_EARNINGS_ACCOUNT_ROW,
            ),
          ]),
          "EarningsAccount",
        );
        assertThat(
          await listEarnings(
            SPANNER_DATABASE,
            "account1",
            "2024-01",
            "2024-12",
          ),
          isArray([
            eqMessage(
              {
                earningsData: {
                  accountId: "account1",
                  earningsId: "earnings3",
                  state: PayoutState.PROCESSING,
                  month: "2024-12",
                },
              },
              LIST_EARNINGS_ROW,
            ),
            eqMessage(
              {
                earningsData: {
                  accountId: "account1",
                  earningsId: "earnings2",
                  state: PayoutState.PAID,
                  month: "2024-11",
                },
              },
              LIST_EARNINGS_ROW,
            ),
            eqMessage(
              {
                earningsData: {
                  accountId: "account1",
                  earningsId: "earnings1",
                  state: PayoutState.PROCESSING,
                  month: "2024-10",
                },
              },
              LIST_EARNINGS_ROW,
            ),
            eqMessage(
              {
                earningsData: {
                  accountId: "account1",
                  earningsId: "earnings4",
                  state: PayoutState.PROCESSING,
                  month: "2024-08",
                },
              },
              LIST_EARNINGS_ROW,
            ),
          ]),
          "Earnings",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deleteEarningsAccountStatement("account1"),
            deleteEarningsStatement("earnings1"),
            deleteEarningsStatement("earnings2"),
            deleteEarningsStatement("earnings3"),
            deleteEarningsStatement("earnings4"),
          ]);
          await transaction.commit();
        });
      },
    },
    {
      name: "AccountIdMismatch",
      execute: async () => {
        // Prepare
        let clientMock = new NodeServiceClientMock();
        clientMock.response = {
          accountId: "account2",
          capabilities: {
            canEarn: true,
          },
        } as ExchangeSessionAndCheckCapabilityResponse;
        let handler = new SetConnectedAccountOnboardedHandler(
          SPANNER_DATABASE,
          clientMock,
          () => 1000,
        );

        // Execute
        let error = await assertReject(
          handler.handle(
            "test",
            {
              accountId: "account1",
            },
            "session1",
          ),
        );

        // Verify
        assertThat(
          error,
          eqHttpError(
            newUnauthorizedError(
              "Account account1 cannot be updated by logged-in account account2.",
            ),
          ),
          "Error",
        );
      },
    },
  ],
});
