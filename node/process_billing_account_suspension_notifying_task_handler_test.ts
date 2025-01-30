// Email sent.
// Email failed to send and retried.
import { SPANNER_DATABASE } from "../common/spanner_database";
import {
  LIST_BILLING_ACCOUNT_SUSPENSION_NOTIFYING_TASKS_ROW,
  deleteBillingAccountSuspensionNotifyingTaskStatement,
  insertBillingAccountSuspensionNotifyingTaskStatement,
  listBillingAccountSuspensionNotifyingTasks,
} from "../db/sql";
import { ProcessBillingAccountSuspensionNotifyingTaskHandler } from "./process_billing_account_suspension_notifying_task_handler";
import { GetAccountContactResponse } from "@phading/user_service_interface/node/interface";
import { eqMessage } from "@selfage/message/test_matcher";
import { NodeServiceClientMock } from "@selfage/node_service_client/client_mock";
import { assertThat, eq, isArray } from "@selfage/test_matcher";
import { TEST_RUNNER } from "@selfage/test_runner";

TEST_RUNNER.run({
  name: "ProcessBillingAccountSuspensionNotifyingTaskHandlerTest",
  cases: [
    {
      name: "Success",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertBillingAccountSuspensionNotifyingTaskStatement(
              "account1",
              1,
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
        handler.handle("prefix", {
          accountId: "account1",
          version: 1,
        });
        await new Promise<void>(
          (resolve) => (handler.doneCallbackFn = resolve),
        );

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
          await listBillingAccountSuspensionNotifyingTasks(
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
      name: "FailedToSendEmailAndRetried",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertBillingAccountSuspensionNotifyingTaskStatement(
              "account1",
              1,
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
        handler.handle("prefix", {
          accountId: "account1",
          version: 1,
        });
        await new Promise<void>(
          (resolve) => (handler.doneCallbackFn = resolve),
        );

        // Verify
        assertThat(
          await listBillingAccountSuspensionNotifyingTasks(
            SPANNER_DATABASE,
            1000000,
          ),
          isArray([
            eqMessage(
              {
                billingAccountSuspensionNotifyingTaskAccountId: "account1",
                billingAccountSuspensionNotifyingTaskVersion: 1,
                billingAccountSuspensionNotifyingTaskExecutionTimeMs: 301000,
              },
              LIST_BILLING_ACCOUNT_SUSPENSION_NOTIFYING_TASKS_ROW,
            ),
          ]),
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
  ],
});
