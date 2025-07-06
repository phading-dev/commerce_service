import "../../local/env";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import { PaymentState } from "../../db/schema";
import {
  GET_PAYMENT_ROW,
  deletePaymentMethodNeedsUpdateNotifyingTaskStatement,
  deletePaymentProfileSuspendingDueToPastDueTaskStatement,
  deletePaymentStatement,
  getPayment,
  insertPaymentMethodNeedsUpdateNotifyingTaskStatement,
  insertPaymentProfileSuspendingDueToPastDueTaskStatement,
  insertPaymentStatement,
  listPendingPaymentMethodNeedsUpdateNotifyingTasks,
  listPendingPaymentProfileSuspendingDueToPastDueTasks,
} from "../../db/sql";
import { MarkPaymentDoneHandler } from "./mark_payment_done_handler";
import { eqMessage } from "@selfage/message/test_matcher";
import { Ref } from "@selfage/ref";
import { assertThat, eq, isArray } from "@selfage/test_matcher";
import { TEST_RUNNER } from "@selfage/test_runner";
import { Readable } from "stream";

TEST_RUNNER.run({
  name: "MarkPaymentDoneHandlerTest",
  cases: [
    {
      name: "Success",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertPaymentStatement({
              accountId: "account1",
              statementId: "statement1",
              state: PaymentState.CHARGING_VIA_STRIPE_INVOICE,
            }),
            insertPaymentProfileSuspendingDueToPastDueTaskStatement({
              statementId: "statement1",
              retryCount: 0,
              executionTimeMs: 1000,
              createdTimeMs: 1000,
            }),
            insertPaymentMethodNeedsUpdateNotifyingTaskStatement({
              statementId: "statement1",
              retryCount: 0,
              executionTimeMs: 1000,
              createdTimeMs: 1000,
            }),
          ]);
          await transaction.commit();
        });
        let payloadCaptured: string;
        let sigCaptured: string;
        let secretCaptured: string;
        let stripeClientMock: any = {
          webhooks: {
            constructEvent: (payload: string, sig: string, secret: string) => {
              payloadCaptured = payload;
              sigCaptured = sig;
              secretCaptured = secret;
              return {
                type: "invoice.paid",
                data: {
                  object: {
                    metadata: {
                      statementId: "statement1",
                    },
                  },
                },
              };
            },
          },
        };
        let handler = new MarkPaymentDoneHandler(
          SPANNER_DATABASE,
          new Ref(stripeClientMock),
          () => 1000,
          "secret1",
        );

        // Execute
        await handler.handle("", Readable.from("event_input"), "sig1");

        // Verify
        assertThat(payloadCaptured, eq("event_input"), "payload");
        assertThat(sigCaptured, eq("sig1"), "sig");
        assertThat(secretCaptured, eq("secret1"), "secret");
        assertThat(
          await getPayment(SPANNER_DATABASE, {
            paymentStatementIdEq: "statement1",
          }),
          isArray([
            eqMessage(
              {
                paymentAccountId: "account1",
                paymentStatementId: "statement1",
                paymentState: PaymentState.PAID,
                paymentUpdatedTimeMs: 1000,
              },
              GET_PAYMENT_ROW,
            ),
          ]),
          "payment",
        );
        assertThat(
          await listPendingPaymentProfileSuspendingDueToPastDueTasks(
            SPANNER_DATABASE,
            {
              paymentProfileSuspendingDueToPastDueTaskExecutionTimeMsLe: 1000000,
            },
          ),
          isArray([]),
          "paymentProfileSuspendingDueToPastDueTasks",
        );
        assertThat(
          await listPendingPaymentMethodNeedsUpdateNotifyingTasks(
            SPANNER_DATABASE,
            {
              paymentMethodNeedsUpdateNotifyingTaskExecutionTimeMsLe: 1000000,
            },
          ),
          isArray([]),
          "paymentMethodNeedsUpdateNotifyingTasks",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deletePaymentStatement({ paymentStatementIdEq: "statement1" }),
            deletePaymentProfileSuspendingDueToPastDueTaskStatement({
              paymentProfileSuspendingDueToPastDueTaskStatementIdEq:
                "statement1",
            }),
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
