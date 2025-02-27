import { SPANNER_DATABASE } from "../common/spanner_database";
import { PaymentState } from "../db/schema";
import {
  GET_BILLING_ACCOUNT_SUSPENDING_DUE_TO_PAST_DUE_TASK_ROW,
  GET_BILLING_ROW,
  GET_PAYMENT_TASK_METADATA_ROW,
  GET_UPDATE_PAYMENT_METHOD_NOTIFYING_TASK_ROW,
  deleteBillingAccountStatement,
  deleteBillingAccountSuspendingDueToPastDueTaskStatement,
  deleteBillingStatement,
  deletePaymentTaskStatement,
  deleteUpdatePaymentMethodNotifyingTaskStatement,
  getBilling,
  getBillingAccountSuspendingDueToPastDueTask,
  getPaymentTaskMetadata,
  getUpdatePaymentMethodNotifyingTask,
  insertBillingAccountStatement,
  insertBillingStatement,
  insertPaymentTaskStatement,
  listPendingPaymentTasks,
} from "../db/sql";
import { ProcessPaymentTaskHandler } from "./process_payment_task_handler";
import { newBadRequestError } from "@selfage/http_error";
import { eqHttpError } from "@selfage/http_error/test_matcher";
import { eqMessage } from "@selfage/message/test_matcher";
import { Ref } from "@selfage/ref";
import {
  assertReject,
  assertThat,
  eq,
  eqError,
  isArray,
} from "@selfage/test_matcher";
import { TEST_RUNNER } from "@selfage/test_runner";

let ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

async function cleanupAll(): Promise<void> {
  await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
    await transaction.batchUpdate([
      deleteBillingAccountStatement("account1"),
      deleteBillingStatement("billing1"),
      deletePaymentTaskStatement("billing1"),
      deleteUpdatePaymentMethodNotifyingTaskStatement("billing1"),
      deleteBillingAccountSuspendingDueToPastDueTaskStatement("billing1"),
    ]);
    await transaction.commit();
  });
}

TEST_RUNNER.run({
  name: "ProcessPaymentTaskHandlerTest",
  cases: [
    {
      name: "Success",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertBillingAccountStatement({
              accountId: "account1",
              stripeCustomerId: "stripeCustomer1",
            }),
            insertBillingStatement({
              billingId: "billing1",
              accountId: "account1",
              state: PaymentState.PROCESSING,
              month: "2021-01",
              totalAmount: 1200,
              currency: "USD",
            }),
            insertPaymentTaskStatement("billing1", 0, 100, 100),
          ]);
          await transaction.commit();
        });
        let stripeCustomerIdCaptured: string;
        let createInvoiceParamsCaptured: any;
        let createInvoiceOptionCaptured: any;
        let addLinesInvoiceIdCaptured: string;
        let addLinesParamsCaptured: any;
        let addLinesOptionCaptured: any;
        let finalizeInvoiceIdCaptured: string;
        let finalizeInvoiceParamsCaptured: any;
        let finalizeInvoiceOptionCaptured: any;
        let stripeClientMock: any = {
          customers: {
            retrieve: async (stripeCustomerId: string) => {
              stripeCustomerIdCaptured = stripeCustomerId;
              return {
                invoice_settings: {
                  default_payment_method: "paymentMethod1",
                },
              };
            },
          },
          invoices: {
            create: async (
              createInvoiceParams: any,
              createInvoiceOption: any,
            ) => {
              createInvoiceParamsCaptured = createInvoiceParams;
              createInvoiceOptionCaptured = createInvoiceOption;
              return {
                id: "invoice1",
              };
            },
            addLines: async (
              addLinesInvoiceId: string,
              addLinesParams: any,
              addLinesOption: any,
            ) => {
              addLinesInvoiceIdCaptured = addLinesInvoiceId;
              addLinesParamsCaptured = addLinesParams;
              addLinesOptionCaptured = addLinesOption;
            },
            finalizeInvoice: async (
              finalizeInvoiceId: string,
              finalizeInvoiceParams: any,
              finalizeInvoiceOption: any,
            ) => {
              finalizeInvoiceIdCaptured = finalizeInvoiceId;
              finalizeInvoiceParamsCaptured = finalizeInvoiceParams;
              finalizeInvoiceOptionCaptured = finalizeInvoiceOption;
              return {
                id: "invoice1",
                hosted_invoice_url: "https://stripe.invoice.url",
              };
            },
          },
        };
        let handler = new ProcessPaymentTaskHandler(
          SPANNER_DATABASE,
          new Ref(stripeClientMock),
          () => 1000,
        );

        // Execute
        await handler.processTask("", { billingId: "billing1" });

        // Verify
        assertThat(
          stripeCustomerIdCaptured,
          eq("stripeCustomer1"),
          "stripeCustomerId",
        );
        assertThat(
          createInvoiceParamsCaptured.customer,
          eq("stripeCustomer1"),
          "createInvoiceParams.customer",
        );
        assertThat(
          createInvoiceParamsCaptured.description,
          eq("2021-01"),
          "createInvoiceParams.description",
        );
        assertThat(
          createInvoiceParamsCaptured.metadata.billingId,
          eq("billing1"),
          "createInvoiceParams.metadata.billingId",
        );
        assertThat(
          createInvoiceParamsCaptured.currency,
          eq("usd"),
          "createInvoiceParams.currency",
        );
        assertThat(
          createInvoiceOptionCaptured.idempotencyKey,
          eq("billing1"),
          "createInvoiceOption.idempotencyKey",
        );
        assertThat(
          addLinesInvoiceIdCaptured,
          eq("invoice1"),
          "addLinesInvoiceId",
        );
        assertThat(
          addLinesParamsCaptured.lines[0].description,
          eq("Total usage"),
          "addLinesParams.lines[0].description",
        );
        assertThat(
          addLinesParamsCaptured.lines[0].amount,
          eq(1200),
          "addLinesParams.lines[0].amount",
        );
        assertThat(
          addLinesOptionCaptured.idempotencyKey,
          eq("billing1"),
          "addLinesOption.idempotencyKey",
        );
        assertThat(
          finalizeInvoiceIdCaptured,
          eq("invoice1"),
          "finalizeInvoiceId",
        );
        assertThat(
          finalizeInvoiceParamsCaptured.auto_advance,
          eq(true),
          "finalizeInvoiceParams.auto_advance",
        );
        assertThat(
          finalizeInvoiceOptionCaptured.idempotencyKey,
          eq("billing1"),
          "finalizeInvoiceOption.idempotencyKey",
        );
        assertThat(
          await getBilling(SPANNER_DATABASE, "billing1"),
          isArray([
            eqMessage(
              {
                billingData: {
                  billingId: "billing1",
                  accountId: "account1",
                  state: PaymentState.CHARGING,
                  month: "2021-01",
                  totalAmount: 1200,
                  currency: "USD",
                  stripeInvoiceId: "invoice1",
                  stripeInvoiceUrl: "https://stripe.invoice.url",
                },
              },
              GET_BILLING_ROW,
            ),
          ]),
          "billing",
        );
        assertThat(
          await listPendingPaymentTasks(SPANNER_DATABASE, ONE_YEAR_MS),
          isArray([]),
          "tasks",
        );
      },
      tearDown: async () => {
        await cleanupAll();
      },
    },
    {
      name: "CreateInvoiceFailed",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertBillingAccountStatement({
              accountId: "account1",
              stripeCustomerId: "stripeCustomer1",
            }),
            insertBillingStatement({
              billingId: "billing1",
              accountId: "account1",
              state: PaymentState.PROCESSING,
              month: "2021-01",
              totalAmount: 1200,
              currency: "USD",
            }),
            insertPaymentTaskStatement("billing1", 0, 100, 100),
          ]);
          await transaction.commit();
        });
        let stripeClientMock: any = {
          customers: {
            retrieve: async () => {
              return {
                invoice_settings: {
                  default_payment_method: "paymentMethod1",
                },
              };
            },
          },
          invoices: {
            create: async () => {
              throw new Error("Fake error");
            },
          },
        };
        let handler = new ProcessPaymentTaskHandler(
          SPANNER_DATABASE,
          new Ref(stripeClientMock),
          () => 1000,
        );

        // Execute
        let error = await assertReject(
          handler.processTask("", { billingId: "billing1" }),
        );

        // Verify
        assertThat(error, eqError(new Error("Fake error")), "error");
        assertThat(
          await getBilling(SPANNER_DATABASE, "billing1"),
          isArray([
            eqMessage(
              {
                billingData: {
                  billingId: "billing1",
                  accountId: "account1",
                  state: PaymentState.PROCESSING,
                  month: "2021-01",
                  totalAmount: 1200,
                  currency: "USD",
                },
              },
              GET_BILLING_ROW,
            ),
          ]),
          "billing",
        );
      },
      tearDown: async () => {
        await cleanupAll();
      },
    },
    {
      name: "MissingDefaultPaymentMethodAndReportFailure",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertBillingAccountStatement({
              accountId: "account1",
              stripeCustomerId: "stripeCustomer1",
            }),
            insertBillingStatement({
              billingId: "billing1",
              accountId: "account1",
              state: PaymentState.PROCESSING,
              month: "2021-01",
              totalAmount: 1200,
              currency: "USD",
            }),
            insertPaymentTaskStatement("billing1", 0, 100, 100),
          ]);
          await transaction.commit();
        });
        let stripeClientMock: any = {
          customers: {
            retrieve: async () => {
              return {
                invoice_settings: {
                  default_payment_method: null,
                },
              } as any;
            },
          },
        };
        let handler = new ProcessPaymentTaskHandler(
          SPANNER_DATABASE,
          new Ref(stripeClientMock),
          () => 1000,
        );

        // Execute
        await handler.processTask("", { billingId: "billing1" });

        // Verify
        assertThat(
          await getBilling(SPANNER_DATABASE, "billing1"),
          isArray([
            eqMessage(
              {
                billingData: {
                  billingId: "billing1",
                  accountId: "account1",
                  state: PaymentState.FAILED,
                  month: "2021-01",
                  totalAmount: 1200,
                  currency: "USD",
                },
              },
              GET_BILLING_ROW,
            ),
          ]),
          "billing",
        );
        assertThat(
          await listPendingPaymentTasks(SPANNER_DATABASE, ONE_YEAR_MS),
          isArray([]),
          "tasks",
        );
        assertThat(
          await getUpdatePaymentMethodNotifyingTask(
            SPANNER_DATABASE,
            "billing1",
          ),
          isArray([
            eqMessage(
              {
                updatePaymentMethodNotifyingTaskBillingId: "billing1",
                updatePaymentMethodNotifyingTaskRetryCount: 0,
                updatePaymentMethodNotifyingTaskExecutionTimeMs: 1000,
                updatePaymentMethodNotifyingTaskCreatedTimeMs: 1000,
              },
              GET_UPDATE_PAYMENT_METHOD_NOTIFYING_TASK_ROW,
            ),
          ]),
          "updatePaymentMethodNotifyingTasks",
        );
        assertThat(
          await getBillingAccountSuspendingDueToPastDueTask(
            SPANNER_DATABASE,
            "billing1",
          ),
          isArray([
            eqMessage(
              {
                billingAccountSuspendingDueToPastDueTaskBillingId: "billing1",
                billingAccountSuspendingDueToPastDueTaskRetryCount: 0,
                billingAccountSuspendingDueToPastDueTaskExecutionTimeMs: 864001000,
                billingAccountSuspendingDueToPastDueTaskCreatedTimeMs: 1000,
              },
              GET_BILLING_ACCOUNT_SUSPENDING_DUE_TO_PAST_DUE_TASK_ROW,
            ),
          ]),
          "billingAccountSuspendingDueToPastDueTasks",
        );
      },
      tearDown: async () => {
        await cleanupAll();
      },
    },
    {
      name: "BillingNotInProcessingState",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertBillingAccountStatement({
              accountId: "account1",
              stripeCustomerId: "stripeCustomer1",
            }),
            insertBillingStatement({
              billingId: "billing1",
              accountId: "account1",
              state: PaymentState.FAILED,
              month: "2021-01",
              totalAmount: 1200,
              currency: "USD",
            }),
          ]);
          await transaction.commit();
        });
        let stripeClientMock: any = {};
        let handler = new ProcessPaymentTaskHandler(
          SPANNER_DATABASE,
          new Ref(stripeClientMock),
          () => 1000,
        );

        // Execute
        let error = await assertReject(
          handler.processTask("", { billingId: "billing1" }),
        );

        // Verify
        assertThat(
          error,
          eqHttpError(
            newBadRequestError("Billing billing1 is not in PROCESSING state"),
          ),
          "error",
        );
      },
      tearDown: async () => {
        await cleanupAll();
      },
    },
    {
      name: "ClaimTask",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertPaymentTaskStatement("billing1", 0, 100, 100),
          ]);
          await transaction.commit();
        });
        let handler = new ProcessPaymentTaskHandler(
          SPANNER_DATABASE,
          undefined,
          () => 1000,
        );

        // Execute
        await handler.claimTask("", { billingId: "billing1" });

        // Verify
        assertThat(
          await getPaymentTaskMetadata(SPANNER_DATABASE, "billing1"),
          isArray([
            eqMessage(
              {
                paymentTaskRetryCount: 1,
                paymentTaskExecutionTimeMs: 301000,
              },
              GET_PAYMENT_TASK_METADATA_ROW,
            ),
          ]),
          "tasks",
        );
      },
      tearDown: async () => {
        await cleanupAll();
      },
    },
  ],
});
