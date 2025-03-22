import "../local/env";
import { SPANNER_DATABASE } from "../common/spanner_database";
import {
  GET_STRIPE_CONNECTED_ACCOUNT_NEEDS_SETUP_NOTIFYING_TASK_METADATA_ROW,
  deleteStripeConnectedAccountNeedsSetupNotifyingTaskStatement,
  getStripeConnectedAccountNeedsSetupNotifyingTaskMetadata,
  insertStripeConnectedAccountNeedsSetupNotifyingTaskStatement,
  listPendingStripeConnectedAccountNeedsSetupNotifyingTasks,
} from "../db/sql";
import { ProcessStripeConnectedAccountNeedsSetupNotifyingTaskHandler } from "./process_stripe_connected_account_needs_setup_notifying_task_handler";
import { GetAccountContactResponse } from "@phading/user_service_interface/node/interface";
import { UrlBuilder } from "@phading/web_interface/url_builder";
import { eqMessage } from "@selfage/message/test_matcher";
import { NodeServiceClientMock } from "@selfage/node_service_client/client_mock";
import {
  assertReject,
  assertThat,
  eq,
  eqError,
  isArray,
} from "@selfage/test_matcher";
import { TEST_RUNNER } from "@selfage/test_runner";

TEST_RUNNER.run({
  name: "ProcessStripeConnectedAccountNeedsSetupNotifyingTaskHandlerTest",
  cases: [
    {
      name: "ProcessTask",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertStripeConnectedAccountNeedsSetupNotifyingTaskStatement({
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
        let sendParamsCapture: any;
        let sendgridClientMock: any = {
          send: async (sendParams: any) => {
            sendParamsCapture = sendParams;
          },
        };
        let urlBuilder = new UrlBuilder("http://test.com");
        let handler =
          new ProcessStripeConnectedAccountNeedsSetupNotifyingTaskHandler(
            SPANNER_DATABASE,
            clientMock,
            sendgridClientMock,
            urlBuilder,
            () => 1000,
          );

        // Execute
        await handler.processTask("", {
          accountId: "account1",
        });

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
            "http://test.com/?e=%7B%221%22%3A%7B%221%22%3A%22account1%22%2C%222%22%3A%7B%223%22%3A%7B%7D%7D%7D%7D",
          ),
          "sendParams.dynamicTemplateData.completeSetupUrl",
        );
        assertThat(
          await listPendingStripeConnectedAccountNeedsSetupNotifyingTasks(
            SPANNER_DATABASE,
            {
              stripeConnectedAccountNeedsSetupNotifyingTaskExecutionTimeMsLe: 1000000,
            },
          ),
          isArray([]),
          "StripeConnectedAccountNeedsSetupNotifyingTasks",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deleteStripeConnectedAccountNeedsSetupNotifyingTaskStatement({
              stripeConnectedAccountNeedsSetupNotifyingTaskAccountIdEq:
                "account1",
            }),
          ]);
          await transaction.commit();
        });
      },
    },
    {
      name: "FailedToSendEmail",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertStripeConnectedAccountNeedsSetupNotifyingTaskStatement({
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
        let sendgridClientMock: any = {
          send: async () => {
            throw new Error("Fake error");
          },
        };
        let urlBuilder = new UrlBuilder("http://test.com");
        let handler =
          new ProcessStripeConnectedAccountNeedsSetupNotifyingTaskHandler(
            SPANNER_DATABASE,
            clientMock,
            sendgridClientMock,
            urlBuilder,
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
            deleteStripeConnectedAccountNeedsSetupNotifyingTaskStatement({
              stripeConnectedAccountNeedsSetupNotifyingTaskAccountIdEq:
                "account1",
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
            insertStripeConnectedAccountNeedsSetupNotifyingTaskStatement({
              accountId: "account1",
              retryCount: 0,
              executionTimeMs: 100,
              createdTimeMs: 100,
            }),
          ]);
          await transaction.commit();
        });
        let handler =
          new ProcessStripeConnectedAccountNeedsSetupNotifyingTaskHandler(
            SPANNER_DATABASE,
            undefined,
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
          await getStripeConnectedAccountNeedsSetupNotifyingTaskMetadata(
            SPANNER_DATABASE,
            {
              stripeConnectedAccountNeedsSetupNotifyingTaskAccountIdEq:
                "account1",
            },
          ),
          isArray([
            eqMessage(
              {
                stripeConnectedAccountNeedsSetupNotifyingTaskRetryCount: 1,
                stripeConnectedAccountNeedsSetupNotifyingTaskExecutionTimeMs: 301000,
              },
              GET_STRIPE_CONNECTED_ACCOUNT_NEEDS_SETUP_NOTIFYING_TASK_METADATA_ROW,
            ),
          ]),
          "StripeConnectedAccountNeedsSetupNotifyingTasks",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deleteStripeConnectedAccountNeedsSetupNotifyingTaskStatement({
              stripeConnectedAccountNeedsSetupNotifyingTaskAccountIdEq:
                "account1",
            }),
          ]);
          await transaction.commit();
        });
      },
    },
  ],
});
