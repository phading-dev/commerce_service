import "../local/env";
import { SPANNER_DATABASE } from "../common/spanner_database";
import {
  GET_BILLING_PROFILE_SUSPENSION_NOTIFYING_TASK_METADATA_ROW,
  deleteBillingProfileSuspensionNotifyingTaskStatement,
  getBillingProfileSuspensionNotifyingTaskMetadata,
  insertBillingProfileSuspensionNotifyingTaskStatement,
  listPendingBillingProfileSuspensionNotifyingTasks,
} from "../db/sql";
import { ProcessBillingProfileSuspensionNotifyingTaskHandler } from "./process_billing_profile_suspension_notifying_task_handler";
import { GetAccountContactResponse } from "@phading/user_service_interface/node/interface";
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
  name: "ProcessBillingProfileSuspensionNotifyingTaskHandlerTest",
  cases: [
    {
      name: "ProcessTask",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertBillingProfileSuspensionNotifyingTaskStatement({
              accountId: "account1",
              version: 1,
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
        let sendEmailParamsCaptured: any;
        let sendgridClientMock: any = {
          send: async (sendEmailParams: any) => {
            sendEmailParamsCaptured = sendEmailParams;
          },
        };
        let handler = new ProcessBillingProfileSuspensionNotifyingTaskHandler(
          SPANNER_DATABASE,
          clientMock,
          sendgridClientMock,
          () => 1000,
        );

        // Execute
        await handler.processTask("prefix", {
          accountId: "account1",
          version: 1,
        });

        // Verify
        assertThat(
          sendEmailParamsCaptured.to,
          eq("contact@email.com"),
          "sendEmailParams.to",
        );
        assertThat(
          sendEmailParamsCaptured.dynamicTemplateData.name,
          eq("First Second"),
          "sendEmailParams.dynamicTemplateData.name",
        );
        assertThat(
          await listPendingBillingProfileSuspensionNotifyingTasks(
            SPANNER_DATABASE,
            { billingProfileSuspensionNotifyingTaskExecutionTimeMsLe: 1000000 },
          ),
          isArray([]),
          "tasks",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deleteBillingProfileSuspensionNotifyingTaskStatement({
              billingProfileSuspensionNotifyingTaskAccountIdEq: "account1",
              billingProfileSuspensionNotifyingTaskVersionEq: 1,
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
            insertBillingProfileSuspensionNotifyingTaskStatement({
              accountId: "account1",
              version: 1,
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
        let handler = new ProcessBillingProfileSuspensionNotifyingTaskHandler(
          SPANNER_DATABASE,
          clientMock,
          sendgridClientMock,
          () => 1000,
        );

        // Execute
        let error = await assertReject(
          handler.processTask("prefix", {
            accountId: "account1",
            version: 1,
          }),
        );

        // Verify
        assertThat(error, eqError(new Error("Fake error")), "error");
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deleteBillingProfileSuspensionNotifyingTaskStatement({
              billingProfileSuspensionNotifyingTaskAccountIdEq: "account1",
              billingProfileSuspensionNotifyingTaskVersionEq: 1,
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
            insertBillingProfileSuspensionNotifyingTaskStatement({
              accountId: "account1",
              version: 1,
              retryCount: 0,
              executionTimeMs: 100,
              createdTimeMs: 100,
            }),
          ]);
          await transaction.commit();
        });
        let handler = new ProcessBillingProfileSuspensionNotifyingTaskHandler(
          SPANNER_DATABASE,
          undefined,
          undefined,
          () => 1000,
        );

        // Execute
        await handler.claimTask("prefix", {
          accountId: "account1",
          version: 1,
        });

        // Verify
        assertThat(
          await getBillingProfileSuspensionNotifyingTaskMetadata(
            SPANNER_DATABASE,
            {
              billingProfileSuspensionNotifyingTaskAccountIdEq: "account1",
              billingProfileSuspensionNotifyingTaskVersionEq: 1,
            },
          ),
          isArray([
            eqMessage(
              {
                billingProfileSuspensionNotifyingTaskRetryCount: 1,
                billingProfileSuspensionNotifyingTaskExecutionTimeMs: 301000,
              },
              GET_BILLING_PROFILE_SUSPENSION_NOTIFYING_TASK_METADATA_ROW,
            ),
          ]),
          "task",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deleteBillingProfileSuspensionNotifyingTaskStatement({
              billingProfileSuspensionNotifyingTaskAccountIdEq: "account1",
              billingProfileSuspensionNotifyingTaskVersionEq: 1,
            }),
          ]);
          await transaction.commit();
        });
      },
    },
  ],
});
