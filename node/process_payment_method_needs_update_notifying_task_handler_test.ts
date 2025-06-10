import "../local/env";
import { SPANNER_DATABASE } from "../common/spanner_database";
import {
  GET_PAYMENT_METHOD_NEEDS_UPDATE_NOTIFYING_TASK_METADATA_ROW,
  deletePaymentMethodNeedsUpdateNotifyingTaskStatement,
  deleteTransactionStatementStatement,
  getPaymentMethodNeedsUpdateNotifyingTaskMetadata,
  insertPaymentMethodNeedsUpdateNotifyingTaskStatement,
  insertTransactionStatementStatement,
  listPendingPaymentMethodNeedsUpdateNotifyingTasks,
} from "../db/sql";
import { ProcessPaymentMethodNeedsUpdateNotifyingTaskHandler } from "./process_payment_method_needs_update_notifying_task_handler";
import {
  GET_ACCOUNT_CONTACT,
  GET_ACCOUNT_CONTACT_REQUEST_BODY,
  GetAccountContactResponse,
} from "@phading/user_service_interface/node/interface";
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
  name: "ProcessPaymentMethodNeedsUpdateNotifyingTaskHandlerTest",
  cases: [
    {
      name: "ProcessTask",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertTransactionStatementStatement({
              statementId: "statement1",
              accountId: "account1",
              month: "2024-01",
            }),
            insertPaymentMethodNeedsUpdateNotifyingTaskStatement({
              statementId: "statement1",
              retryCount: 0,
              executionTimeMs: 100,
              createdTimeMs: 100,
            }),
          ]);
          await transaction.commit();
        });
        let clientMock = new NodeServiceClientMock();
        clientMock.response = {
          contactEmail: "account1-contact@email.com",
          naturalName: "First Second",
        } as GetAccountContactResponse;
        let emailParamsCaptured: any;
        let sendgridClientMock: any = {
          send: async (emailParams: any): Promise<void> => {
            emailParamsCaptured = emailParams;
          },
        };
        let handler = new ProcessPaymentMethodNeedsUpdateNotifyingTaskHandler(
          SPANNER_DATABASE,
          clientMock,
          sendgridClientMock,
          "https://test.com",
          () => 1000,
        );

        // Execute
        await handler.processTask("", {
          statementId: "statement1",
        });

        // Verify
        assertThat(
          emailParamsCaptured.to,
          eq("account1-contact@email.com"),
          "emailParamsCaptured.to",
        );
        assertThat(
          emailParamsCaptured.dynamicTemplateData.month,
          eq("2024-01"),
          "emailParamsCaptured.dynamicTemplateData.month",
        );
        assertThat(
          emailParamsCaptured.dynamicTemplateData.name,
          eq("First Second"),
          "emailParamsCaptured.dynamicTemplateData.name",
        );
        assertThat(
          emailParamsCaptured.dynamicTemplateData.updatePaymentMethodUrl,
          eq(
            "https://test.com/?e=%7B%221%22%3A%7B%221%22%3A%7B%221%22%3A%22account1%22%7D%2C%222%22%3A%7B%222%22%3A%7B%7D%7D%7D%7D",
          ),
          "emailParamsCaptured.dynamicTemplateData.updatePaymentMethodUrl",
        );
        assertThat(
          clientMock.request.descriptor,
          eq(GET_ACCOUNT_CONTACT),
          "RC",
        );
        assertThat(
          clientMock.request.body,
          eqMessage(
            { accountId: "account1" },
            GET_ACCOUNT_CONTACT_REQUEST_BODY,
          ),
          "RC body",
        );
        assertThat(
          await listPendingPaymentMethodNeedsUpdateNotifyingTasks(
            SPANNER_DATABASE,
            { paymentMethodNeedsUpdateNotifyingTaskExecutionTimeMsLe: 1000000 },
          ),
          isArray([]),
          "PaymentMethodNeedsUpdateNotifyingTasks",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deleteTransactionStatementStatement({
              transactionStatementStatementIdEq: "statement1",
            }),
            deletePaymentMethodNeedsUpdateNotifyingTaskStatement({
              paymentMethodNeedsUpdateNotifyingTaskStatementIdEq: "statement1",
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
            insertTransactionStatementStatement({
              statementId: "statement1",
              accountId: "account1",
              month: "2024-01",
            }),
            insertPaymentMethodNeedsUpdateNotifyingTaskStatement({
              statementId: "statement1",
              retryCount: 0,
              executionTimeMs: 100,
              createdTimeMs: 100,
            }),
          ]);
          await transaction.commit();
        });
        let clientMock = new NodeServiceClientMock();
        clientMock.response = {
          contactEmail: "account1-contact@email.com",
          naturalName: "First Second",
        } as GetAccountContactResponse;
        let sendgridClientMock: any = {
          send: async (emailParams: any) => {
            throw new Error("Fake error");
          },
        };
        let handler = new ProcessPaymentMethodNeedsUpdateNotifyingTaskHandler(
          SPANNER_DATABASE,
          clientMock,
          sendgridClientMock,
          "https://test.com",
          () => 1000,
        );

        // Execute
        let error = await assertReject(
          handler.processTask("", {
            statementId: "statement1",
          }),
        );

        // Verify
        assertThat(error, eqError(new Error("Fake error")), "error");
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deleteTransactionStatementStatement({
              transactionStatementStatementIdEq: "statement1",
            }),
            deletePaymentMethodNeedsUpdateNotifyingTaskStatement({
              paymentMethodNeedsUpdateNotifyingTaskStatementIdEq: "statement1",
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
            insertPaymentMethodNeedsUpdateNotifyingTaskStatement({
              statementId: "statement1",
              retryCount: 0,
              executionTimeMs: 100,
              createdTimeMs: 100,
            }),
          ]);
          await transaction.commit();
        });
        let handler = new ProcessPaymentMethodNeedsUpdateNotifyingTaskHandler(
          SPANNER_DATABASE,
          new NodeServiceClientMock(),
          undefined,
          undefined,
          () => 1000,
        );

        // Execute
        await handler.claimTask("", {
          statementId: "statement1",
        });

        // Verify
        assertThat(
          await getPaymentMethodNeedsUpdateNotifyingTaskMetadata(
            SPANNER_DATABASE,
            {
              paymentMethodNeedsUpdateNotifyingTaskStatementIdEq: "statement1",
            },
          ),
          isArray([
            eqMessage(
              {
                paymentMethodNeedsUpdateNotifyingTaskRetryCount: 1,
                paymentMethodNeedsUpdateNotifyingTaskExecutionTimeMs: 301000,
              },
              GET_PAYMENT_METHOD_NEEDS_UPDATE_NOTIFYING_TASK_METADATA_ROW,
            ),
          ]),
          "PaymentMethodNeedsUpdateNotifyingTasks",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deletePaymentMethodNeedsUpdateNotifyingTaskStatement({
              paymentMethodNeedsUpdateNotifyingTaskStatementIdEq: "statement1",
            }),
          ]);
          await transaction.commit();
        });
      },
    },
  ],
});
