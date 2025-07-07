import "../local/env";
import { SPANNER_DATABASE } from "../common/spanner_database";
import { StripeConnectedAccountState } from "../db/schema";
import {
  GET_PAYOUT_PROFILE_ROW,
  GET_STRIPE_CONNECTED_ACCOUNT_FOR_PAYOUT_CREATING_TASK_METADATA_ROW,
  GET_STRIPE_CONNECTED_ACCOUNT_NEEDS_SETUP_NOTIFYING_TASK_ROW,
  deletePayoutProfileStatement,
  deleteStripeConnectedAccountForPayoutCreatingTaskStatement,
  deleteStripeConnectedAccountNeedsSetupNotifyingTaskStatement,
  getPayoutProfile,
  getStripeConnectedAccountForPayoutCreatingTaskMetadata,
  getStripeConnectedAccountNeedsSetupNotifyingTask,
  insertPayoutProfileStatement,
  insertStripeConnectedAccountForPayoutCreatingTaskStatement,
  listPendingStripeConnectedAccountForPayoutCreatingTasks,
  listPendingStripeConnectedAccountNeedsSetupNotifyingTasks,
} from "../db/sql";
import { ProcessStripeConnectedAccountForPayoutCreatingTaskHandler } from "./process_stripe_connected_account_for_payout_creating_task_handler";
import { GetAccountContactResponse } from "@phading/user_service_interface/node/interface";
import { newInternalServerErrorError } from "@selfage/http_error";
import { eqHttpError } from "@selfage/http_error/test_matcher";
import { eqMessage } from "@selfage/message/test_matcher";
import { NodeServiceClientMock } from "@selfage/node_service_client/client_mock";
import { Ref } from "@selfage/ref";
import { assertReject, assertThat, eq, isArray } from "@selfage/test_matcher";
import { TEST_RUNNER } from "@selfage/test_runner";

async function cleanupAll() {
  await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
    await transaction.batchUpdate([
      deletePayoutProfileStatement({
        payoutProfileAccountIdEq: "account1",
      }),
      deleteStripeConnectedAccountNeedsSetupNotifyingTaskStatement({
        stripeConnectedAccountNeedsSetupNotifyingTaskAccountIdEq: "account1",
      }),
      deleteStripeConnectedAccountForPayoutCreatingTaskStatement({
        stripeConnectedAccountForPayoutCreatingTaskTaskIdEq: "task1",
      }),
    ]);
    await transaction.commit();
  });
}

TEST_RUNNER.run({
  name: "ProcessStripeConnectedAccountForPayoutCreatingTaskHandlerTest",
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
            insertStripeConnectedAccountForPayoutCreatingTaskStatement({
              taskId: "task1",
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
        let handler =
          new ProcessStripeConnectedAccountForPayoutCreatingTaskHandler(
            SPANNER_DATABASE,
            clientMock,
            new Ref(stripeClientMock),
            () => 1000,
          );

        // Execute
        await handler.processTask("", {
          taskId: "task1",
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
          eq("catask1"),
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
          await getStripeConnectedAccountNeedsSetupNotifyingTask(
            SPANNER_DATABASE,
            {
              stripeConnectedAccountNeedsSetupNotifyingTaskAccountIdEq:
                "account1",
            },
          ),
          isArray([
            eqMessage(
              {
                stripeConnectedAccountNeedsSetupNotifyingTaskAccountId:
                  "account1",
                stripeConnectedAccountNeedsSetupNotifyingTaskRetryCount: 0,
                stripeConnectedAccountNeedsSetupNotifyingTaskExecutionTimeMs: 1000,
                stripeConnectedAccountNeedsSetupNotifyingTaskCreatedTimeMs: 1000,
              },
              GET_STRIPE_CONNECTED_ACCOUNT_NEEDS_SETUP_NOTIFYING_TASK_ROW,
            ),
          ]),
          "stripeConnectedAccountNeedsSetupNotifyingTasks",
        );
        assertThat(
          await listPendingStripeConnectedAccountForPayoutCreatingTasks(
            SPANNER_DATABASE,
            {
              stripeConnectedAccountForPayoutCreatingTaskExecutionTimeMsLe: 1000000,
            },
          ),
          isArray([]),
          "stripeConnectedAccountForPayoutCreatingTasks",
        );
      },
      tearDown: async () => {
        await cleanupAll();
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
                StripeConnectedAccountState.ONBOARDED,
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
        let handler =
          new ProcessStripeConnectedAccountForPayoutCreatingTaskHandler(
            SPANNER_DATABASE,
            clientMock,
            new Ref(stripeClientMock),
            () => 1000,
          );

        // Execute
        await handler.processTask("", {
          taskId: "task1",
          accountId: "account1",
        });

        // Verify
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
                  StripeConnectedAccountState.ONBOARDED,
              },
              GET_PAYOUT_PROFILE_ROW,
            ),
          ]),
          "profile",
        );
        assertThat(
          await listPendingStripeConnectedAccountNeedsSetupNotifyingTasks(
            SPANNER_DATABASE,
            {
              stripeConnectedAccountNeedsSetupNotifyingTaskExecutionTimeMsLe: 1000000,
            },
          ),
          isArray([]),
          "stripeConnectedAccountNeedsSetupNotifyingTasks",
        );
        assertThat(
          await listPendingStripeConnectedAccountForPayoutCreatingTasks(
            SPANNER_DATABASE,
            {
              stripeConnectedAccountForPayoutCreatingTaskExecutionTimeMsLe: 1000000,
            },
          ),
          isArray([]),
          "stripeConnectedAccountForPayoutCreatingTasks",
        );
      },
      tearDown: async () => {
        await cleanupAll();
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
        let handler =
          new ProcessStripeConnectedAccountForPayoutCreatingTaskHandler(
            SPANNER_DATABASE,
            clientMock,
            new Ref(stripeClientMock),
            () => 1000,
          );

        // Execute
        let error = await assertReject(
          handler.processTask("", {
            taskId: "task1",
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
        await cleanupAll();
      },
    },
    {
      name: "ClaimTask",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertStripeConnectedAccountForPayoutCreatingTaskStatement({
              taskId: "task1",
              accountId: "account1",
              retryCount: 0,
              executionTimeMs: 100,
              createdTimeMs: 100,
            }),
          ]);
          await transaction.commit();
        });
        let handler =
          new ProcessStripeConnectedAccountForPayoutCreatingTaskHandler(
            SPANNER_DATABASE,
            undefined,
            undefined,
            () => 1000,
          );

        // Execute
        await handler.claimTask("", {
          taskId: "task1",
          accountId: "account1",
        });

        // Verify
        assertThat(
          await getStripeConnectedAccountForPayoutCreatingTaskMetadata(
            SPANNER_DATABASE,
            {
              stripeConnectedAccountForPayoutCreatingTaskTaskIdEq: "task1",
            },
          ),
          isArray([
            eqMessage(
              {
                stripeConnectedAccountForPayoutCreatingTaskRetryCount: 1,
                stripeConnectedAccountForPayoutCreatingTaskExecutionTimeMs: 301000,
              },
              GET_STRIPE_CONNECTED_ACCOUNT_FOR_PAYOUT_CREATING_TASK_METADATA_ROW,
            ),
          ]),
          "stripeConnectedAccountForPayoutCreatingTasks",
        );
      },
      tearDown: async () => {
        await cleanupAll();
      },
    },
  ],
});
