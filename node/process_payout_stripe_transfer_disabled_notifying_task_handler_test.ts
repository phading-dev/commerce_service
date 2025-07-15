import "../local/env";
import { SPANNER_DATABASE } from "../common/spanner_database";
import {
  GET_PAYOUT_STRIPE_TRANSFER_DISABLED_NOTIFYING_TASK_METADATA_ROW,
  deletePayoutStripeTransferDisabledNotifyingTaskStatement,
  deleteTransactionStatementStatement,
  getPayoutStripeTransferDisabledNotifyingTaskMetadata,
  insertPayoutStripeTransferDisabledNotifyingTaskStatement,
  insertTransactionStatementStatement,
  listPendingPayoutStripeTransferDisabledNotifyingTasks,
} from "../db/sql";
import { ProcessPayoutStripeTransferDisabledNotifyingTaskHandler } from "./process_payout_stripe_transfer_disabled_notifying_task_handler";
import {
  GET_ACCOUNT_CONTACT,
  GET_ACCOUNT_CONTACT_REQUEST_BODY,
  GetAccountContactResponse,
} from "@phading/user_service_interface/node/interface";
import { eqMessage } from "@selfage/message/test_matcher";
import { NodeServiceClientMock } from "@selfage/node_service_client/client_mock";
import { assertThat, eq, isArray } from "@selfage/test_matcher";
import { TEST_RUNNER } from "@selfage/test_runner";

TEST_RUNNER.run({
  name: "ProcessPayoutStripeTransferDisabledNotifyingTaskHandlerTest",
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
              statement: {
                totalAmount: 1000,
                currency: "USD",
              },
            }),
            insertPayoutStripeTransferDisabledNotifyingTaskStatement({
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
        let handler =
          new ProcessPayoutStripeTransferDisabledNotifyingTaskHandler(
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
          emailParamsCaptured.dynamicTemplateData.name,
          eq("First Second"),
          "emailParamsCaptured.dynamicTemplateData.name",
        );
        assertThat(
          emailParamsCaptured.dynamicTemplateData.month,
          eq("2024-01"),
          "emailParamsCaptured.dynamicTemplateData.month",
        );
        assertThat(
          emailParamsCaptured.dynamicTemplateData.money,
          eq("$10.00"),
          "emailParamsCaptured.dynamicTemplateData.money",
        );
        assertThat(
          emailParamsCaptured.dynamicTemplateData.setupPayoutUrl,
          eq(
            "https://test.com/?e=%7B%221%22%3A%7B%221%22%3A%7B%221%22%3A%22account1%22%7D%2C%222%22%3A%7B%223%22%3A%7B%7D%7D%7D%7D",
          ),
          "emailParamsCaptured.dynamicTemplateData.setupPayoutUrl",
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
          await listPendingPayoutStripeTransferDisabledNotifyingTasks(
            SPANNER_DATABASE,
            {
              payoutStripeTransferDisabledNotifyingTaskExecutionTimeMsLe: 1000000,
            },
          ),
          isArray([]),
          "PayoutStripeTransferDisabledNotifyingTasks",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deleteTransactionStatementStatement({
              transactionStatementStatementIdEq: "statement1",
            }),
            deletePayoutStripeTransferDisabledNotifyingTaskStatement({
              payoutStripeTransferDisabledNotifyingTaskStatementIdEq:
                "statement1",
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
            insertPayoutStripeTransferDisabledNotifyingTaskStatement({
              statementId: "statement1",
              retryCount: 0,
              executionTimeMs: 100,
              createdTimeMs: 100,
            }),
          ]);
          await transaction.commit();
        });
        let handler =
          new ProcessPayoutStripeTransferDisabledNotifyingTaskHandler(
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
          await getPayoutStripeTransferDisabledNotifyingTaskMetadata(
            SPANNER_DATABASE,
            {
              payoutStripeTransferDisabledNotifyingTaskStatementIdEq:
                "statement1",
            },
          ),
          isArray([
            eqMessage(
              {
                payoutStripeTransferDisabledNotifyingTaskRetryCount: 1,
                payoutStripeTransferDisabledNotifyingTaskExecutionTimeMs: 301000,
              },
              GET_PAYOUT_STRIPE_TRANSFER_DISABLED_NOTIFYING_TASK_METADATA_ROW,
            ),
          ]),
          "PayoutStripeTransferDisabledNotifyingTaskMetadata",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deletePayoutStripeTransferDisabledNotifyingTaskStatement({
              payoutStripeTransferDisabledNotifyingTaskStatementIdEq:
                "statement1",
            }),
          ]);
          await transaction.commit();
        });
      },
    },
  ],
});
