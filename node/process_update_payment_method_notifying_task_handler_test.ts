import { SPANNER_DATABASE } from "../common/spanner_database";
import { PaymentState } from "../db/schema";
import {
  LIST_UPDATE_PAYMENT_METHOD_NOTIFYING_TASKS_ROW,
  deleteBillingStatement,
  deleteUpdatePaymentMethodNotifyingTaskStatement,
  insertBillingStatement,
  insertUpdatePaymentMethodNotifyingTaskStatement,
  listUpdatePaymentMethodNotifyingTasks,
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
import { assertThat, eq, isArray } from "@selfage/test_matcher";
import { TEST_RUNNER } from "@selfage/test_runner";

TEST_RUNNER.run({
  name: "ProcessUpdatePaymentMethodNotifyingTaskHandlerTest",
  cases: [
    {
      name: "Success",
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
        handler.handle("", {
          billingId: "billing1",
        });
        await new Promise<void>(
          (resolve) => (handler.doneCallbackFn = resolve),
        );

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
            "https://test.com/?e=%7B%22accountId%22%3A%22account1%22%2C%22account%22%3A%7B%22billing%22%3A%7B%7D%7D%7D",
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
          await listUpdatePaymentMethodNotifyingTasks(
            SPANNER_DATABASE,
            1000000,
          ),
          isArray([]),
          "listUpdatePaymentMethodNotifyingTasks",
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
      name: "FailedToSendEmailAndRetry",
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
        handler.handle("", {
          billingId: "billing1",
        });
        await new Promise<void>(
          (resolve) => (handler.doneCallbackFn = resolve),
        );

        // Verify
        assertThat(
          await listUpdatePaymentMethodNotifyingTasks(
            SPANNER_DATABASE,
            1000000,
          ),
          isArray([
            eqMessage(
              {
                updatePaymentMethodNotifyingTaskBillingId: "billing1",
                updatePaymentMethodNotifyingTaskExecutionTimeMs: 301000,
              },
              LIST_UPDATE_PAYMENT_METHOD_NOTIFYING_TASKS_ROW,
            ),
          ]),
          "listUpdatePaymentMethodNotifyingTasks",
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
  ],
});
