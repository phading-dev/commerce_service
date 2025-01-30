import { SPANNER_DATABASE } from "../common/spanner_database";
import { StripeConnectedAccountState } from "../db/schema";
import {
  GET_EARNINGS_ACCOUNT_ROW,
  LIST_STRIPE_CONNECTED_ACCOUNT_CREATING_TASKS_ROW,
  deleteEarningsAccountStatement,
  deleteStripeConnectedAccountCreatingTaskStatement,
  getEarningsAccount,
  insertEarningsAccountStatement,
  insertStripeConnectedAccountCreatingTaskStatement,
  listStripeConnectedAccountCreatingTasks,
} from "../db/sql";
import { ProcessStripeConnectedAccountCreatingTaskHandler } from "./process_stripe_connected_account_creating_task_handler";
import { GetAccountContactResponse } from "@phading/user_service_interface/node/interface";
import { eqMessage } from "@selfage/message/test_matcher";
import { NodeServiceClientMock } from "@selfage/node_service_client/client_mock";
import { assertThat, eq, isArray } from "@selfage/test_matcher";
import { TEST_RUNNER } from "@selfage/test_runner";

TEST_RUNNER.run({
  name: "ProcessStripeConnectedAccountCreatingTaskHandlerTest",
  cases: [
    {
      name: "Success",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertEarningsAccountStatement({
              accountId: "account1",
            }),
            insertStripeConnectedAccountCreatingTaskStatement(
              "account1",
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
          stripeClientMock,
          () => 1000,
        );

        // Execute
        handler.handle("", {
          accountId: "account1",
        });
        await new Promise<void>(
          (resolve) => (handler.doneCallbackFn = resolve),
        );

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
          await listStripeConnectedAccountCreatingTasks(
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
            deleteStripeConnectedAccountCreatingTaskStatement("account1"),
          ]);
          await transaction.commit();
        });
      },
    },
    {
      name: "AccountCreationFailedAndRetried",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertEarningsAccountStatement({
              accountId: "account1",
            }),
            insertStripeConnectedAccountCreatingTaskStatement(
              "account1",
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
          stripeClientMock,
          () => 1000,
        );

        // Execute
        handler.handle("", {
          accountId: "account1",
        });
        await new Promise<void>(
          (resolve) => (handler.doneCallbackFn = resolve),
        );

        // Verify
        assertThat(
          await listStripeConnectedAccountCreatingTasks(
            SPANNER_DATABASE,
            1000000,
          ),
          isArray([
            eqMessage(
              {
                stripeConnectedAccountCreatingTaskAccountId: "account1",
                stripeConnectedAccountCreatingTaskExecutionTimeMs: 301000,
              },
              LIST_STRIPE_CONNECTED_ACCOUNT_CREATING_TASKS_ROW,
            ),
          ]),
          "stripeConnectedAccountCreatingTasks",
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
    // TODO: Add a test case for when created account id mismatches.
  ],
});
