import "../local/env";
import { SPANNER_DATABASE } from "../common/spanner_database";
import { PaymentState } from "../db/schema";
import {
  GET_UPDATE_PAYMENT_METHOD_NOTIFYING_TASK_METADATA_ROW,
  deleteBillingStatement,
  deleteUpdatePaymentMethodNotifyingTaskStatement,
  getUpdatePaymentMethodNotifyingTaskMetadata,
  insertBillingStatement,
  insertUpdatePaymentMethodNotifyingTaskStatement,
  listPendingUpdatePaymentMethodNotifyingTasks,
} from "../db/sql";
import { ProcessUpdatePaymentMethodNotifyingTaskHandler } from "./process_update_payment_method_notifying_task_handler";
import {
  GET_ACCOUNT_CONTACT,
  GET_ACCOUNT_CONTACT_REQUEST_BODY,
  GetAccountContactResponse,
} from "@phading/user_service_interface/node/interface";
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
  name: "ProcessUpdatePaymentMethodNotifyingTaskHandlerTest",
  cases: [
    {
      name: "ProcessTask",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertBillingStatement({
              billingId: "billing1",
              accountId: "account1",
              state: PaymentState.CHARGING,
              month: "2024-01",
            }),
            insertUpdatePaymentMethodNotifyingTaskStatement(
              "billing1",
              0,
              100,
              100,
            ),
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
        let urlBuilder = new UrlBuilder("https://test.com");
        let handler = new ProcessUpdatePaymentMethodNotifyingTaskHandler(
          SPANNER_DATABASE,
          clientMock,
          sendgridClientMock,
          urlBuilder,
          () => 1000,
        );

        // Execute
        await handler.processTask("", {
          billingId: "billing1",
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
            "https://test.com/?e=%7B%221%22%3A%7B%221%22%3A%22account1%22%2C%222%22%3A%7B%222%22%3A%7B%7D%7D%7D%7D",
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
          await listPendingUpdatePaymentMethodNotifyingTasks(
            SPANNER_DATABASE,
            1000000,
          ),
          isArray([]),
          "UpdatePaymentMethodNotifyingTasks",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deleteBillingStatement("billing1"),
            deleteUpdatePaymentMethodNotifyingTaskStatement("billing1"),
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
            insertBillingStatement({
              billingId: "billing1",
              accountId: "account1",
              state: PaymentState.CHARGING,
              month: "2024-01",
            }),
            insertUpdatePaymentMethodNotifyingTaskStatement(
              "billing1",
              0,
              100,
              100,
            ),
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
        let urlBuilder = new UrlBuilder("https://test.com");
        let handler = new ProcessUpdatePaymentMethodNotifyingTaskHandler(
          SPANNER_DATABASE,
          clientMock,
          sendgridClientMock,
          urlBuilder,
          () => 1000,
        );

        // Execute
        let error = await assertReject(
          handler.processTask("", {
            billingId: "billing1",
          }),
        );

        // Verify
        assertThat(error, eqError(new Error("Fake error")), "error");
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deleteBillingStatement("billing1"),
            deleteUpdatePaymentMethodNotifyingTaskStatement("billing1"),
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
            insertUpdatePaymentMethodNotifyingTaskStatement(
              "billing1",
              0,
              100,
              100,
            ),
          ]);
          await transaction.commit();
        });
        let handler = new ProcessUpdatePaymentMethodNotifyingTaskHandler(
          SPANNER_DATABASE,
          new NodeServiceClientMock(),
          undefined,
          undefined,
          () => 1000,
        );

        // Execute
        await handler.claimTask("", {
          billingId: "billing1",
        });

        // Verify
        assertThat(
          await getUpdatePaymentMethodNotifyingTaskMetadata(
            SPANNER_DATABASE,
            "billing1",
          ),
          isArray([
            eqMessage(
              {
                updatePaymentMethodNotifyingTaskRetryCount: 1,
                updatePaymentMethodNotifyingTaskExecutionTimeMs: 301000,
              },
              GET_UPDATE_PAYMENT_METHOD_NOTIFYING_TASK_METADATA_ROW,
            ),
          ]),
          "UpdatePaymentMethodNotifyingTasks",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deleteUpdatePaymentMethodNotifyingTaskStatement("billing1"),
          ]);
          await transaction.commit();
        });
      },
    },
  ],
});
