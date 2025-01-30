import { SPANNER_DATABASE } from "../common/spanner_database";
import {
  LIST_SETUP_STRIPE_CONNECTED_ACCOUNT_NOTIFYING_TASKS_ROW,
  deleteSetupStripeConnectedAccountNotifyingTaskStatement,
  insertSetupStripeConnectedAccountNotifyingTaskStatement,
  listSetupStripeConnectedAccountNotifyingTasks,
} from "../db/sql";
import { ProcessSetupStripeConnectedAccountNotifyingTaskHandler } from "./process_setup_stripe_connected_account_task_handler";
import { GetAccountContactResponse } from "@phading/user_service_interface/node/interface";
import { UrlBuilder } from "@phading/web_interface/url_builder";
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
            insertSetupStripeConnectedAccountNotifyingTaskStatement(
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
        let sendParamsCapture: any;
        let sendgridClientMock: any = {
          send: async (sendParams: any) => {
            sendParamsCapture = sendParams;
          },
        };
        let urlBuilder = new UrlBuilder("http://test.com");
        let handler =
          new ProcessSetupStripeConnectedAccountNotifyingTaskHandler(
            SPANNER_DATABASE,
            clientMock,
            sendgridClientMock,
            urlBuilder,
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
          sendParamsCapture.to,
          eq("contact@email.com"),
          "sendParams.to",
        );
        assertThat(
          sendParamsCapture.dynamicTemplateData.name,
          eq("First Second"),
          "sendParams.dynamicTemplateData.name",
        );
        assertThat(
          sendParamsCapture.dynamicTemplateData.completeSetupUrl,
          eq(
            "http://test.com/?e=%7B%22accountId%22%3A%22account1%22%2C%22account%22%3A%7B%22earnings%22%3A%7B%7D%7D%7D",
          ),
          "sendParams.dynamicTemplateData.completeSetupUrl",
        );
        assertThat(
          await listSetupStripeConnectedAccountNotifyingTasks(
            SPANNER_DATABASE,
            1000000,
          ),
          isArray([]),
          "listSetupStripeConnectedAccountNotifyingTasks",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deleteSetupStripeConnectedAccountNotifyingTaskStatement("account1"),
          ]);
          await transaction.commit();
        });
      },
    },
    {
      name: "FailedToSendEmailAndRetried",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertSetupStripeConnectedAccountNotifyingTaskStatement(
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
        let sendgridClientMock: any = {
          send: async () => {
            throw new Error("Fake error");
          },
        };
        let urlBuilder = new UrlBuilder("http://test.com");
        let handler =
          new ProcessSetupStripeConnectedAccountNotifyingTaskHandler(
            SPANNER_DATABASE,
            clientMock,
            sendgridClientMock,
            urlBuilder,
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
          await listSetupStripeConnectedAccountNotifyingTasks(
            SPANNER_DATABASE,
            1000000,
          ),
          isArray([
            eqMessage(
              {
                setupStripeConnectedAccountNotifyingTaskAccountId: "account1",
                setupStripeConnectedAccountNotifyingTaskExecutionTimeMs: 301000,
              },
              LIST_SETUP_STRIPE_CONNECTED_ACCOUNT_NOTIFYING_TASKS_ROW,
            ),
          ]),
          "listSetupStripeConnectedAccountNotifyingTasks",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deleteSetupStripeConnectedAccountNotifyingTaskStatement("account1"),
          ]);
          await transaction.commit();
        });
      },
    },
  ],
});
