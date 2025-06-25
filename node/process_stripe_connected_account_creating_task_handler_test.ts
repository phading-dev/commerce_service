import "../local/env";
import { SPANNER_DATABASE } from "../common/spanner_database";
import { StripeConnectedAccountState } from "../db/schema";
import {
  GET_PAYOUT_PROFILE_ROW,
  GET_STRIPE_CONNECTED_ACCOUNT_CREATING_TASK_METADATA_ROW,
  deletePayoutProfileStatement,
  deleteStripeConnectedAccountCreatingTaskStatement,
  deleteStripeConnectedAccountNeedsSetupNotifyingTaskStatement,
  getPayoutProfile,
  getStripeConnectedAccountCreatingTaskMetadata,
  insertPayoutProfileStatement,
  insertStripeConnectedAccountCreatingTaskStatement,
  listPendingStripeConnectedAccountCreatingTasks,
} from "../db/sql";
import { ProcessStripeConnectedAccountCreatingTaskHandler } from "./process_stripe_connected_account_creating_task_handler";
import { GetAccountContactResponse } from "@phading/user_service_interface/node/interface";
import {
  newBadRequestError,
  newInternalServerErrorError,
} from "@selfage/http_error";
import { eqHttpError } from "@selfage/http_error/test_matcher";
import { eqMessage } from "@selfage/message/test_matcher";
import { NodeServiceClientMock } from "@selfage/node_service_client/client_mock";
import { Ref } from "@selfage/ref";
import {
  assertReject,
  assertThat,
  eq,
  eqError,
  isArray,
} from "@selfage/test_matcher";
import { TEST_RUNNER } from "@selfage/test_runner";

TEST_RUNNER.run({
  name: "ProcessStripeConnectedAccountCreatingTaskHandlerTest",
  cases: [
    {
      name: "ProcessTask",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertPayoutProfileStatement({
              accountId: "account1",
            }),
            insertStripeConnectedAccountCreatingTaskStatement({
              accountId: "account1",
              retryCount: 0,
              executionTimeMs: 100,
              createdTimeMs: 100,
            }),
          ]);
          await transaction.commit();
        });
        let clientMock = new NodeServiceClientMock();
        clientMock.response = {
          contactEmail: "contact@email.com",
          naturalName: "First Second",
        } as GetAccountContactResponse;
        let createAccountParamsCapture: any;
        let optionsCapture: any;
        let stripeClientMock: any = {
          accounts: {
            create: async (createAccountParams: any, options: any) => {
              createAccountParamsCapture = createAccountParams;
              optionsCapture = options;
              return {
                id: "stripeAccount1",
              };
            },
          },
        };
        let handler = new ProcessStripeConnectedAccountCreatingTaskHandler(
          SPANNER_DATABASE,
          clientMock,
          new Ref(stripeClientMock),
          () => 1000,
        );

        // Execute
        await handler.processTask("", {
          accountId: "account1",
        });

        // Verify
        assertThat(
          createAccountParamsCapture.email,
          eq("contact@email.com"),
          "createAccountParams.email",
        );
        assertThat(
          optionsCapture.idempotencyKey,
          eq("aaccount1"),
          "options.idempotencyKey",
        );
        assertThat(
          await getPayoutProfile(SPANNER_DATABASE, {
            payoutProfileAccountIdEq: "account1",
          }),
          isArray([
            eqMessage(
              {
                payoutProfileAccountId: "account1",
                payoutProfileStripeConnectedAccountId: "stripeAccount1",
                payoutProfileStripeConnectedAccountState:
                  StripeConnectedAccountState.ONBOARDING,
              },
              GET_PAYOUT_PROFILE_ROW,
            ),
          ]),
          "profile",
        );
        assertThat(
          await listPendingStripeConnectedAccountCreatingTasks(
            SPANNER_DATABASE,
            { stripeConnectedAccountCreatingTaskExecutionTimeMsLe: 1000000 },
          ),
          isArray([]),
          "stripeConnectedAccountCreatingTasks",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deletePayoutProfileStatement({
              payoutProfileAccountIdEq: "account1",
            }),
            deleteStripeConnectedAccountNeedsSetupNotifyingTaskStatement({
              stripeConnectedAccountNeedsSetupNotifyingTaskAccountIdEq:
                "account1",
            }),
            deleteStripeConnectedAccountCreatingTaskStatement({
              stripeConnectedAccountCreatingTaskAccountIdEq: "account1",
            }),
          ]);
          await transaction.commit();
        });
      },
    },
    {
      name: "AccountAlreadyCreated",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertPayoutProfileStatement({
              accountId: "account1",
              stripeConnectedAccountId: "stripeAccount1",
              stripeConnectedAccountState:
                StripeConnectedAccountState.ONBOARDING,
            }),
          ]);
          await transaction.commit();
        });
        let clientMock = new NodeServiceClientMock();
        clientMock.response = {
          contactEmail: "contact@email.com",
          naturalName: "First Second",
        } as GetAccountContactResponse;
        let stripeClientMock: any = {
          accounts: {
            create: async (createAccountParams: any, options: any) => {
              return {
                id: "stripeAccount1",
              };
            },
          },
        };
        let handler = new ProcessStripeConnectedAccountCreatingTaskHandler(
          SPANNER_DATABASE,
          clientMock,
          new Ref(stripeClientMock),
          () => 1000,
        );

        // Execute
        let error = await assertReject(
          handler.processTask("", {
            accountId: "account1",
          }),
        );

        // Verify
        assertThat(
          error,
          eqHttpError(
            newBadRequestError(
              "Payout profile account1 already has a stripe connected account id stripeAccount1.",
            ),
          ),
          "error",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deletePayoutProfileStatement({
              payoutProfileAccountIdEq: "account1",
            }),
          ]);
          await transaction.commit();
        });
      },
    },
    {
      name: "AccountCreatedWithDifferentId",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertPayoutProfileStatement({
              accountId: "account1",
              stripeConnectedAccountId: "stripeAccount1",
              stripeConnectedAccountState:
                StripeConnectedAccountState.ONBOARDING,
            }),
          ]);
          await transaction.commit();
        });
        let clientMock = new NodeServiceClientMock();
        clientMock.response = {
          contactEmail: "contact@email.com",
          naturalName: "First Second",
        } as GetAccountContactResponse;
        let stripeClientMock: any = {
          accounts: {
            create: async (createAccountParams: any, options: any) => {
              return {
                id: "stripeAccount2",
              };
            },
          },
        };
        let handler = new ProcessStripeConnectedAccountCreatingTaskHandler(
          SPANNER_DATABASE,
          clientMock,
          new Ref(stripeClientMock),
          () => 1000,
        );

        // Execute
        let error = await assertReject(
          handler.processTask("", {
            accountId: "account1",
          }),
        );

        // Verify
        assertThat(
          error,
          eqHttpError(
            newInternalServerErrorError(
              "Payout profile account1 already has a stripe connected account id stripeAccount1 which is different from the new one stripeAccount2.",
            ),
          ),
          "error",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deletePayoutProfileStatement({
              payoutProfileAccountIdEq: "account1",
            }),
          ]);
          await transaction.commit();
        });
      },
    },
    {
      name: "AccountCreationFailed",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertPayoutProfileStatement({
              accountId: "account1",
            }),
            insertStripeConnectedAccountCreatingTaskStatement({
              accountId: "account1",
              retryCount: 0,
              executionTimeMs: 100,
              createdTimeMs: 100,
            }),
          ]);
          await transaction.commit();
        });
        let clientMock = new NodeServiceClientMock();
        clientMock.response = {
          contactEmail: "contact@email.com",
          naturalName: "First Second",
        } as GetAccountContactResponse;
        let stripeClientMock: any = {
          accounts: {
            create: async (createAccountParams: any) => {
              throw new Error("Fake error.");
            },
          },
        };
        let handler = new ProcessStripeConnectedAccountCreatingTaskHandler(
          SPANNER_DATABASE,
          clientMock,
          new Ref(stripeClientMock),
          () => 1000,
        );

        // Execute
        let error = await assertReject(
          handler.processTask("", {
            accountId: "account1",
          }),
        );

        // Verify
        assertThat(error, eqError(new Error("Fake error")), "error");
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deletePayoutProfileStatement({
              payoutProfileAccountIdEq: "account1",
            }),
            deleteStripeConnectedAccountCreatingTaskStatement({
              stripeConnectedAccountCreatingTaskAccountIdEq: "account1",
            }),
          ]);
          await transaction.commit();
        });
      },
    },
    {
      name: "ClaimTask",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertStripeConnectedAccountCreatingTaskStatement({
              accountId: "account1",
              retryCount: 0,
              executionTimeMs: 100,
              createdTimeMs: 100,
            }),
          ]);
          await transaction.commit();
        });
        let handler = new ProcessStripeConnectedAccountCreatingTaskHandler(
          SPANNER_DATABASE,
          undefined,
          undefined,
          () => 1000,
        );

        // Execute
        await handler.claimTask("", {
          accountId: "account1",
        });

        // Verify
        assertThat(
          await getStripeConnectedAccountCreatingTaskMetadata(
            SPANNER_DATABASE,
            { stripeConnectedAccountCreatingTaskAccountIdEq: "account1" },
          ),
          isArray([
            eqMessage(
              {
                stripeConnectedAccountCreatingTaskRetryCount: 1,
                stripeConnectedAccountCreatingTaskExecutionTimeMs: 301000,
              },
              GET_STRIPE_CONNECTED_ACCOUNT_CREATING_TASK_METADATA_ROW,
            ),
          ]),
          "stripeConnectedAccountCreatingTasks",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deleteStripeConnectedAccountCreatingTaskStatement({
              stripeConnectedAccountCreatingTaskAccountIdEq: "account1",
            }),
          ]);
          await transaction.commit();
        });
      },
    },
  ],
});
