import { SPANNER_DATABASE } from "../common/spanner_database";
import { StripeConnectedAccountState } from "../db/schema";
import {
  GET_EARNINGS_ACCOUNT_ROW,
  GET_STRIPE_CONNECTED_ACCOUNT_CREATING_TASK_METADATA_ROW,
  deleteEarningsAccountStatement,
  deleteSetupStripeConnectedAccountNotifyingTaskStatement,
  deleteStripeConnectedAccountCreatingTaskStatement,
  getEarningsAccount,
  getStripeConnectedAccountCreatingTaskMetadata,
  insertEarningsAccountStatement,
  insertStripeConnectedAccountCreatingTaskStatement,
  listPendingSetupStripeConnectedAccountNotifyingTasks,
  listPendingStripeConnectedAccountCreatingTasks,
} from "../db/sql";
import { ProcessStripeConnectedAccountCreatingTaskHandler } from "./process_stripe_connected_account_creating_task_handler";
import { GetAccountContactResponse } from "@phading/user_service_interface/node/interface";
import { newInternalServerErrorError } from "@selfage/http_error";
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
            insertEarningsAccountStatement({
              accountId: "account1",
            }),
            insertStripeConnectedAccountCreatingTaskStatement(
              "account1",
              0,
              100,
              100,
            ),
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
          eq("account1"),
          "options.idempotencyKey",
        );
        assertThat(
          await getEarningsAccount(SPANNER_DATABASE, "account1"),
          isArray([
            eqMessage(
              {
                earningsAccountData: {
                  accountId: "account1",
                  stripeConnectedAccountId: "stripeAccount1",
                  stripeConnectedAccountState:
                    StripeConnectedAccountState.ONBOARDING,
                },
              },
              GET_EARNINGS_ACCOUNT_ROW,
            ),
          ]),
          "earningsAccount",
        );
        assertThat(
          await listPendingStripeConnectedAccountCreatingTasks(
            SPANNER_DATABASE,
            1000000,
          ),
          isArray([]),
          "stripeConnectedAccountCreatingTasks",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deleteEarningsAccountStatement("account1"),
            deleteSetupStripeConnectedAccountNotifyingTaskStatement("account1"),
            deleteStripeConnectedAccountCreatingTaskStatement("account1"),
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
            insertEarningsAccountStatement({
              accountId: "account1",
              stripeConnectedAccountId: "stripeAccount1",
              stripeConnectedAccountState:
                StripeConnectedAccountState.ONBOARDING,
            }),
            insertStripeConnectedAccountCreatingTaskStatement(
              "account1",
              0,
              100,
              100,
            ),
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
        await handler.processTask("", {
          accountId: "account1",
        });

        // Verify
        assertThat(
          await listPendingSetupStripeConnectedAccountNotifyingTasks(
            SPANNER_DATABASE,
            1000000,
          ),
          isArray([]),
          "SetupStripeConnectedAccountNotifyingTasks",
        );
        assertThat(
          await listPendingStripeConnectedAccountCreatingTasks(
            SPANNER_DATABASE,
            1000000,
          ),
          isArray([]),
          "StripeConnectedAccountCreatingTasks",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deleteEarningsAccountStatement("account1"),
            deleteStripeConnectedAccountCreatingTaskStatement("account1"),
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
            insertEarningsAccountStatement({
              accountId: "account1",
              stripeConnectedAccountId: "stripeAccount1",
              stripeConnectedAccountState:
                StripeConnectedAccountState.ONBOARDING,
            }),
            insertStripeConnectedAccountCreatingTaskStatement(
              "account1",
              0,
              100,
              100,
            ),
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
              "Earnings account account1 already has a stripe connected account id stripeAccount1 which is different from the new one stripeAccount2.",
            ),
          ),
          "error",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deleteEarningsAccountStatement("account1"),
            deleteStripeConnectedAccountCreatingTaskStatement("account1"),
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
            insertEarningsAccountStatement({
              accountId: "account1",
            }),
            insertStripeConnectedAccountCreatingTaskStatement(
              "account1",
              0,
              100,
              100,
            ),
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
            deleteEarningsAccountStatement("account1"),
            deleteStripeConnectedAccountCreatingTaskStatement("account1"),
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
            insertStripeConnectedAccountCreatingTaskStatement(
              "account1",
              0,
              100,
              100,
            ),
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
            "account1",
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
            deleteStripeConnectedAccountCreatingTaskStatement("account1"),
          ]);
          await transaction.commit();
        });
      },
    },
  ],
});
