import "../../local/env";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import { PayoutState, StripeConnectedAccountState } from "../../db/schema";
import {
  GET_PAYOUT_PROFILE_ROW,
  GET_PAYOUT_ROW,
  GET_PAYOUT_STRIPE_TRANSFER_CREATING_TASK_ROW,
  deletePayoutProfileStatement,
  deletePayoutStatement,
  deletePayoutStripeTransferCreatingTaskStatement,
  getPayout,
  getPayoutProfile,
  getPayoutStripeTransferCreatingTask,
  insertPayoutProfileStatement,
  insertPayoutStatement,
} from "../../db/sql";
import { MarkPayoutEnabledHandler } from "./mark_payout_enabled_handler";
import { FetchSessionAndCheckCapabilityResponse } from "@phading/user_session_service_interface/node/interface";
import { eqMessage } from "@selfage/message/test_matcher";
import { NodeServiceClientMock } from "@selfage/node_service_client/client_mock";
import { Ref } from "@selfage/ref";
import { assertThat, eq, isArray } from "@selfage/test_matcher";
import { TEST_RUNNER } from "@selfage/test_runner";
import { Readable } from "stream";

async function cleanupAll() {
  await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
    await transaction.batchUpdate([
      deletePayoutProfileStatement({
        payoutProfileAccountIdEq: "account1",
      }),
      deletePayoutStatement({ payoutStatementIdEq: "statement1" }),
      deletePayoutStatement({ payoutStatementIdEq: "statement2" }),
      deletePayoutStatement({ payoutStatementIdEq: "statement3" }),
      deletePayoutStatement({ payoutStatementIdEq: "statement4" }),
      deletePayoutStripeTransferCreatingTaskStatement({
        payoutStripeTransferCreatingTaskTaskIdEq: "uuid0",
      }),
      deletePayoutStripeTransferCreatingTaskStatement({
        payoutStripeTransferCreatingTaskTaskIdEq: "uuid1",
      }),
      deletePayoutStripeTransferCreatingTaskStatement({
        payoutStripeTransferCreatingTaskTaskIdEq: "uuid2",
      }),
      deletePayoutStripeTransferCreatingTaskStatement({
        payoutStripeTransferCreatingTaskTaskIdEq: "uuid3",
      }),
    ]);
    await transaction.commit();
  });
}

TEST_RUNNER.run({
  name: "MarkPayoutEnabledHandlerTest",
  cases: [
    {
      name: "MarkAsOnboarded",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertPayoutProfileStatement({
              accountId: "account1",
              stripeConnectedAccountState:
                StripeConnectedAccountState.ONBOARDING,
            }),
          ]);
          await transaction.commit();
        });
        let payloadCaptured: string;
        let sigCaptured: string;
        let secretCaptured: string;
        let stripeClientMock: any = {
          webhooks: {
            constructEvent: (payload: string, sig: string, secret: string) => {
              payloadCaptured = payload;
              sigCaptured = sig;
              secretCaptured = secret;
              return {
                type: "account.updated",
                data: {
                  object: {
                    payouts_enabled: true,
                    metadata: {
                      accountId: "account1",
                    },
                  },
                  previous_attributes: {
                    payouts_enabled: null,
                  },
                },
              } as any;
            },
          },
        };
        let clientMock = new NodeServiceClientMock();
        clientMock.response = {
          accountId: "account1",
          capabilities: {
            canEarn: true,
          },
        } as FetchSessionAndCheckCapabilityResponse;
        let id = 0;
        let handler = new MarkPayoutEnabledHandler(
          SPANNER_DATABASE,
          new Ref(stripeClientMock),
          () => `uuid${id++}`,
          () => 1000,
          "secret1",
        );

        // Execute
        await handler.handle("test", Readable.from("event_input"), "sig1");

        // Verify
        assertThat(payloadCaptured, eq("event_input"), "payload");
        assertThat(sigCaptured, eq("sig1"), "sig");
        assertThat(secretCaptured, eq("secret1"), "secret");
        assertThat(
          await getPayoutProfile(SPANNER_DATABASE, {
            payoutProfileAccountIdEq: "account1",
          }),
          isArray([
            eqMessage(
              {
                payoutProfileAccountId: "account1",
                payoutProfileStripeConnectedAccountState:
                  StripeConnectedAccountState.ONBOARDED,
              },
              GET_PAYOUT_PROFILE_ROW,
            ),
          ]),
          "PayoutProfile",
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
            insertPayoutProfileStatement({
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
        let stripeClientMock: any = {
          webhooks: {
            constructEvent: (payload: string, sig: string, secret: string) => {
              return {
                type: "account.updated",
                data: {
                  object: {
                    payouts_enabled: true,
                    metadata: {
                      accountId: "account1",
                    },
                  },
                  previous_attributes: {
                    payouts_enabled: null,
                  },
                },
              } as any;
            },
          },
        };
        let id = 0;
        let handler = new MarkPayoutEnabledHandler(
          SPANNER_DATABASE,
          new Ref(stripeClientMock),
          () => `uuid${id++}`,
          () => 1000,
          "secret1",
        );

        // Execute
        await handler.handle("test", Readable.from("event_input"), "sig1");

        // Verify
        assertThat(
          await getPayoutProfile(SPANNER_DATABASE, {
            payoutProfileAccountIdEq: "account1",
          }),
          isArray([
            eqMessage(
              {
                payoutProfileAccountId: "account1",
                payoutProfileStripeConnectedAccountState:
                  StripeConnectedAccountState.ONBOARDED,
              },
              GET_PAYOUT_PROFILE_ROW,
            ),
          ]),
          "PayoutProfile",
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
          await getPayoutStripeTransferCreatingTask(SPANNER_DATABASE, {
            payoutStripeTransferCreatingTaskTaskIdEq: "uuid0",
          }),
          isArray([
            eqMessage(
              {
                payoutStripeTransferCreatingTaskTaskId: "uuid0",
                payoutStripeTransferCreatingTaskStatementId: "statement1",
                payoutStripeTransferCreatingTaskRetryCount: 0,
                payoutStripeTransferCreatingTaskExecutionTimeMs: 1000,
                payoutStripeTransferCreatingTaskCreatedTimeMs: 1000,
              },
              GET_PAYOUT_STRIPE_TRANSFER_CREATING_TASK_ROW,
            ),
          ]),
          "PayoutStripeTransferCreatingTask for statement1",
        );
        assertThat(
          await getPayoutStripeTransferCreatingTask(SPANNER_DATABASE, {
            payoutStripeTransferCreatingTaskTaskIdEq: "uuid1",
          }),
          isArray([
            eqMessage(
              {
                payoutStripeTransferCreatingTaskTaskId: "uuid1",
                payoutStripeTransferCreatingTaskStatementId: "statement4",
                payoutStripeTransferCreatingTaskRetryCount: 0,
                payoutStripeTransferCreatingTaskExecutionTimeMs: 1000,
                payoutStripeTransferCreatingTaskCreatedTimeMs: 1000,
              },
              GET_PAYOUT_STRIPE_TRANSFER_CREATING_TASK_ROW,
            ),
          ]),
          "PayoutStripeTransferCreatingTask for statement4",
        );
      },
      tearDown: async () => {
        await cleanupAll();
      },
    },
    {
      name: "PayoutNotEnabled",
      execute: async () => {
        // Prepare
        let stripeClientMock: any = {
          webhooks: {
            constructEvent: (payload: string, sig: string, secret: string) => {
              return {
                type: "account.updated",
                data: {
                  object: {
                    payouts_enabled: false,
                    metadata: {
                      accountId: "account1",
                    },
                  },
                  previous_attributes: {
                    payouts_enabled: null,
                  },
                },
              } as any;
            },
          },
        };
        let handler = new MarkPayoutEnabledHandler(
          SPANNER_DATABASE,
          new Ref(stripeClientMock),
          () => "uuid0",
          () => 1000,
          "secret1",
        );

        // Execute
        await handler.handle("test", Readable.from("event_input"), "sig1");

        // Verify no errors.
      },
    },
    {
      name: "PayoutEnabledNotChanged",
      execute: async () => {
        // Prepare
        let stripeClientMock: any = {
          webhooks: {
            constructEvent: (payload: string, sig: string, secret: string) => {
              return {
                type: "account.updated",
                data: {
                  object: {
                    metadata: {
                      accountId: "account1",
                    },
                  },
                  previous_attributes: {},
                },
              } as any;
            },
          },
        };
        let handler = new MarkPayoutEnabledHandler(
          SPANNER_DATABASE,
          new Ref(stripeClientMock),
          () => "uuid0",
          () => 1000,
          "secret1",
        );

        // Execute
        await handler.handle("test", Readable.from("event_input"), "sig1");

        // Verify no errors.
      },
    },
  ],
});
