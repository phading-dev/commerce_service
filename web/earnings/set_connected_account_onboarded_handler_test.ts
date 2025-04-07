import "../../local/env";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import { PayoutState, StripeConnectedAccountState } from "../../db/schema";
import {
  GET_EARNINGS_PROFILE_ROW,
  GET_PAYOUT_ROW,
  GET_PAYOUT_TASK_ROW,
  deleteEarningsProfileStatement,
  deletePayoutStatement,
  deletePayoutTaskStatement,
  getEarningsProfile,
  getPayout,
  getPayoutTask,
  insertEarningsProfileStatement,
  insertPayoutStatement,
} from "../../db/sql";
import { SetConnectedAccountOnboardedHandler } from "./set_connected_account_onboarded_handler";
import { FetchSessionAndCheckCapabilityResponse } from "@phading/user_session_service_interface/node/interface";
import { newUnauthorizedError } from "@selfage/http_error";
import { eqHttpError } from "@selfage/http_error/test_matcher";
import { eqMessage } from "@selfage/message/test_matcher";
import { NodeServiceClientMock } from "@selfage/node_service_client/client_mock";
import { assertReject, assertThat, isArray } from "@selfage/test_matcher";
import { TEST_RUNNER } from "@selfage/test_runner";

async function cleanupAll() {
  await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
    await transaction.batchUpdate([
      deleteEarningsProfileStatement({
        earningsProfileAccountIdEq: "account1",
      }),
      deletePayoutStatement({ payoutStatementIdEq: "statement1" }),
      deletePayoutStatement({ payoutStatementIdEq: "statement2" }),
      deletePayoutStatement({ payoutStatementIdEq: "statement3" }),
      deletePayoutStatement({ payoutStatementIdEq: "statement4" }),
      deletePayoutTaskStatement({ payoutTaskStatementIdEq: "statement1" }),
      deletePayoutTaskStatement({ payoutTaskStatementIdEq: "statement2" }),
      deletePayoutTaskStatement({ payoutTaskStatementIdEq: "statement3" }),
      deletePayoutTaskStatement({ payoutTaskStatementIdEq: "statement4" }),
    ]);
    await transaction.commit();
  });
}

TEST_RUNNER.run({
  name: "SetConnectedAccountOnboardedHandlerTest",
  cases: [
    {
      name: "MarkAsOnboarded",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertEarningsProfileStatement({
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
        } as FetchSessionAndCheckCapabilityResponse;
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
          await getEarningsProfile(SPANNER_DATABASE, {
            earningsProfileAccountIdEq: "account1",
          }),
          isArray([
            eqMessage(
              {
                earningsProfileAccountId: "account1",
                earningsProfileStripeConnectedAccountState:
                  StripeConnectedAccountState.ONBOARDED,
              },
              GET_EARNINGS_PROFILE_ROW,
            ),
          ]),
          "EarningsProfile",
        );
      },
      tearDown: async () => {
        await cleanupAll();
      },
    },
    {
      name: "MarkAsOnboardedAndRetryPayouts",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertEarningsProfileStatement({
              accountId: "account1",
              stripeConnectedAccountState:
                StripeConnectedAccountState.ONBOARDING,
            }),
            insertPayoutStatement({
              accountId: "account1",
              statementId: "statement1",
              state: PayoutState.DISABLED,
            }),
            insertPayoutStatement({
              accountId: "account1",
              statementId: "statement2",
              state: PayoutState.PAID,
            }),
            insertPayoutStatement({
              accountId: "account1",
              statementId: "statement3",
              state: PayoutState.PROCESSING,
            }),
            insertPayoutStatement({
              accountId: "account1",
              statementId: "statement4",
              state: PayoutState.DISABLED,
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
        } as FetchSessionAndCheckCapabilityResponse;
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
          await getEarningsProfile(SPANNER_DATABASE, {
            earningsProfileAccountIdEq: "account1",
          }),
          isArray([
            eqMessage(
              {
                earningsProfileAccountId: "account1",
                earningsProfileStripeConnectedAccountState:
                  StripeConnectedAccountState.ONBOARDED,
              },
              GET_EARNINGS_PROFILE_ROW,
            ),
          ]),
          "EarningsProfile",
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
                payoutUpdatedTimeMs: 1000,
              },
              GET_PAYOUT_ROW,
            ),
          ]),
          "Payout for statement1",
        );
        assertThat(
          await getPayout(SPANNER_DATABASE, {
            payoutStatementIdEq: "statement2",
          }),
          isArray([
            eqMessage(
              {
                payoutAccountId: "account1",
                payoutStatementId: "statement2",
                payoutState: PayoutState.PAID,
              },
              GET_PAYOUT_ROW,
            ),
          ]),
          "Payout for statement2",
        );
        assertThat(
          await getPayout(SPANNER_DATABASE, {
            payoutStatementIdEq: "statement3",
          }),
          isArray([
            eqMessage(
              {
                payoutAccountId: "account1",
                payoutStatementId: "statement3",
                payoutState: PayoutState.PROCESSING,
              },
              GET_PAYOUT_ROW,
            ),
          ]),
          "Payout for statement3",
        );
        assertThat(
          await getPayout(SPANNER_DATABASE, {
            payoutStatementIdEq: "statement4",
          }),
          isArray([
            eqMessage(
              {
                payoutAccountId: "account1",
                payoutStatementId: "statement4",
                payoutState: PayoutState.PROCESSING,
                payoutUpdatedTimeMs: 1000,
              },
              GET_PAYOUT_ROW,
            ),
          ]),
          "Payout for statement4",
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
          "PayoutTask for statement1",
        );
        assertThat(
          await getPayoutTask(SPANNER_DATABASE, {
            payoutTaskStatementIdEq: "statement4",
          }),
          isArray([
            eqMessage(
              {
                payoutTaskStatementId: "statement4",
                payoutTaskRetryCount: 0,
                payoutTaskExecutionTimeMs: 1000,
                payoutTaskCreatedTimeMs: 1000,
              },
              GET_PAYOUT_TASK_ROW,
            ),
          ]),
          "PayoutTask for statement4",
        );
      },
      tearDown: async () => {
        await cleanupAll();
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
        } as FetchSessionAndCheckCapabilityResponse;
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
              "Earnings profile account1 cannot be updated by the logged-in account account2.",
            ),
          ),
          "Error",
        );
      },
    },
  ],
});
