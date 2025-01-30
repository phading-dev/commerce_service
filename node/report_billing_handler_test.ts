// Mixed data and sum up.
// Deplayed payment task.
// Earnings already exist.
import { SPANNER_DATABASE } from "../common/spanner_database";
import { PaymentState } from "../db/schema";
import {
  GET_BILLING_ROW,
  LIST_PAYMENT_TASKS_ROW,
  deleteBillingAccountStatement,
  deleteBillingStatement,
  deletePaymentTaskStatement,
  getBilling,
  insertBillingAccountStatement,
  insertBillingStatement,
  listPaymentTasks,
} from "../db/sql";
import { ReportBillingHandler } from "./report_billing_handler";
import { ProductType } from "@phading/price";
import { eqMessage } from "@selfage/message/test_matcher";
import { assertThat, isArray } from "@selfage/test_matcher";
import { TEST_RUNNER } from "@selfage/test_runner";

TEST_RUNNER.run({
  name: "ReportBillingHandlerTest",
  cases: [
    {
      name: "Success",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertBillingAccountStatement({
              accountId: "account1",
              paymentAfterMs: 100,
            }),
          ]);
          await transaction.commit();
        });
        let handler = new ReportBillingHandler(
          SPANNER_DATABASE,
          () => "billing1",
          () => 1000,
        );

        // Execute
        await handler.handle("", {
          accountId: "account1",
          month: "2021-01",
          watchTimeSec: 3700,
          uploadedMb: 5000,
          storageMbh: 12345000,
          transmittedMb: 2000,
        });

        // Verify
        assertThat(
          await getBilling(SPANNER_DATABASE, "billing1"),
          isArray([
            eqMessage(
              {
                billingData: {
                  accountId: "account1",
                  billingId: "billing1",
                  month: "2021-01",
                  currency: "USD",
                  totalAmount: 96,
                  state: PaymentState.PROCESSING,
                  createdTimeMs: 1000,
                  items: [
                    {
                      productType: ProductType.SHOW,
                      quantity: 3700,
                      amount: 11,
                    },
                    {
                      productType: ProductType.UPLAOD,
                      quantity: 5000,
                      amount: 59,
                    },
                    {
                      productType: ProductType.STORAGE,
                      quantity: 12345000,
                      amount: 26,
                    },
                    {
                      productType: ProductType.NETWORK,
                      quantity: 2000,
                      amount: 0,
                    },
                  ],
                },
              },
              GET_BILLING_ROW,
            ),
          ]),
          "billing",
        );
        assertThat(
          await listPaymentTasks(SPANNER_DATABASE, 1000000),
          isArray([
            eqMessage(
              {
                paymentTaskBillingId: "billing1",
                paymentTaskExecutionTimeMs: 1000,
              },
              LIST_PAYMENT_TASKS_ROW,
            ),
          ]),
          "paymentTasks",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deleteBillingAccountStatement("account1"),
            deleteBillingStatement("billing1"),
            deletePaymentTaskStatement("billing1"),
          ]);
          await transaction.commit();
        });
      },
    },
    {
      name: "DelayedPaymentTask",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertBillingAccountStatement({
              accountId: "account1",
              paymentAfterMs: 2000,
            }),
          ]);
          await transaction.commit();
        });
        let handler = new ReportBillingHandler(
          SPANNER_DATABASE,
          () => "billing1",
          () => 1000,
        );

        // Execute
        await handler.handle("", {
          accountId: "account1",
          month: "2021-01",
          watchTimeSec: 3700,
          uploadedMb: 5000,
          storageMbh: 12345000,
          transmittedMb: 2000,
        });

        // Verify
        assertThat(
          await listPaymentTasks(SPANNER_DATABASE, 1000000),
          isArray([
            eqMessage(
              {
                paymentTaskBillingId: "billing1",
                paymentTaskExecutionTimeMs: 2000,
              },
              LIST_PAYMENT_TASKS_ROW,
            ),
          ]),
          "paymentTasks",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deleteBillingAccountStatement("account1"),
            deleteBillingStatement("billing1"),
            deletePaymentTaskStatement("billing1"),
          ]);
          await transaction.commit();
        });
      },
    },
    {
      name: "BillingAlreadyExist",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertBillingAccountStatement({
              accountId: "account1",
              paymentAfterMs: 100,
            }),
            insertBillingStatement({
              billingId: "billing1",
              accountId: "account1",
              month: "2021-01",
              state: PaymentState.PROCESSING,
            }),
          ]);
          await transaction.commit();
        });
        let handler = new ReportBillingHandler(
          SPANNER_DATABASE,
          () => "billing1",
          () => 1000,
        );

        // Execute
        await handler.handle("", {
          accountId: "account1",
          month: "2021-01",
          watchTimeSec: 3700,
          uploadedMb: 5000,
          storageMbh: 12345000,
          transmittedMb: 2000,
        });

        // Verify
        assertThat(
          await getBilling(SPANNER_DATABASE, "billing1"),
          isArray([
            eqMessage(
              {
                billingData: {
                  accountId: "account1",
                  billingId: "billing1",
                  month: "2021-01",
                  state: PaymentState.PROCESSING,
                },
              },
              GET_BILLING_ROW,
            ),
          ]),
          "billing",
        );
        assertThat(
          await listPaymentTasks(SPANNER_DATABASE, 1000000),
          isArray([]),
          "paymentTasks",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deleteBillingAccountStatement("account1"),
            deleteBillingStatement("billing1"),
          ]);
          await transaction.commit();
        });
      },
    },
  ],
});
