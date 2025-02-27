import { SPANNER_DATABASE } from "../common/spanner_database";
import {
  GET_BILLING_ACCOUNT_SUSPENSION_NOTIFYING_TASK_METADATA_ROW,
  deleteBillingAccountSuspensionNotifyingTaskStatement,
  getBillingAccountSuspensionNotifyingTaskMetadata,
  insertBillingAccountSuspensionNotifyingTaskStatement,
  listPendingBillingAccountSuspensionNotifyingTasks,
} from "../db/sql";
import { ProcessBillingAccountSuspensionNotifyingTaskHandler } from "./process_billing_account_suspension_notifying_task_handler";
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
  name: "ProcessBillingAccountSuspensionNotifyingTaskHandlerTest",
  cases: [
    {
      name: "ProcessTask",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertBillingAccountSuspensionNotifyingTaskStatement(
              "account1",
              1,
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
        let sendEmailParamsCaptured: any;
        let sendgridClientMock: any = {
          send: async (sendEmailParams: any) => {
            sendEmailParamsCaptured = sendEmailParams;
          },
        };
        let handler = new ProcessBillingAccountSuspensionNotifyingTaskHandler(
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
          await listPendingBillingAccountSuspensionNotifyingTasks(
            SPANNER_DATABASE,
            1000000,
          ),
          isArray([]),
          "tasks",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deleteBillingAccountSuspensionNotifyingTaskStatement("account1", 1),
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
            insertBillingAccountSuspensionNotifyingTaskStatement(
              "account1",
              1,
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
        let sendgridClientMock: any = {
          send: async () => {
            throw new Error("Fake error");
          },
        };
        let handler = new ProcessBillingAccountSuspensionNotifyingTaskHandler(
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
            deleteBillingAccountSuspensionNotifyingTaskStatement("account1", 1),
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
            insertBillingAccountSuspensionNotifyingTaskStatement(
              "account1",
              1,
              0,
              100,
              100,
            ),
          ]);
          await transaction.commit();
        });
        let handler = new ProcessBillingAccountSuspensionNotifyingTaskHandler(
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
          await getBillingAccountSuspensionNotifyingTaskMetadata(
            SPANNER_DATABASE,
            "account1",
            1,
          ),
          isArray([
            eqMessage(
              {
                billingAccountSuspensionNotifyingTaskRetryCount: 1,
                billingAccountSuspensionNotifyingTaskExecutionTimeMs: 301000,
              },
              GET_BILLING_ACCOUNT_SUSPENSION_NOTIFYING_TASK_METADATA_ROW,
            ),
          ]),
          "task",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deleteBillingAccountSuspensionNotifyingTaskStatement("account1", 1),
          ]);
          await transaction.commit();
        });
      },
    },
  ],
});
