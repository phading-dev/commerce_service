import { SPANNER_DATABASE } from "../common/spanner_database";
import {
  GET_BILLING_ACCOUNT_ROW,
  LIST_STRIPE_CUSTOMER_CREATING_TASKS_ROW,
  deleteBillingAccountStatement,
  deleteStripeCustomerCreatingTaskStatement,
  getBillingAccount,
  insertBillingAccountStatement,
  insertStripeCustomerCreatingTaskStatement,
  listStripeCustomerCreatingTasks,
} from "../db/sql";
import { ProcessStripeCustomerCreatingTaskHandler } from "./process_stripe_customer_creating_task_handler";
import { GetAccountContactResponse } from "@phading/user_service_interface/node/interface";
import { eqMessage } from "@selfage/message/test_matcher";
import { NodeServiceClientMock } from "@selfage/node_service_client/client_mock";
import { assertThat, eq, isArray } from "@selfage/test_matcher";
import { TEST_RUNNER } from "@selfage/test_runner";

TEST_RUNNER.run({
  name: "ProcessStripeCustomerCreatingTaskHandlerTest",
  cases: [
    {
      name: "Success",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertBillingAccountStatement({
              accountId: "account1",
            }),
            insertStripeCustomerCreatingTaskStatement("account1", 100, 100),
          ]);
          await transaction.commit();
        });
        let clientMock = new NodeServiceClientMock();
        clientMock.response = {
          contactEmail: "contact@email.com",
          naturalName: "First Second",
        } as GetAccountContactResponse;
        let createCustomerParamsCapture: any;
        let optionsCapture: any;
        let stripeClientMock: any = {
          customers: {
            create: async (createCustomerParams: any, options: any) => {
              createCustomerParamsCapture = createCustomerParams;
              optionsCapture = options;
              return {
                id: "stripeCustomer1",
              };
            },
          },
        };
        let handler = new ProcessStripeCustomerCreatingTaskHandler(
          SPANNER_DATABASE,
          clientMock,
          stripeClientMock,
          () => 1000,
        );

        // Execute
        handler.handle("", {
          accountId: "account1",
        });
        await new Promise<void>(
          (resolve) => (handler.doneCallbackFn = resolve),
        );

        // Verify
        assertThat(
          createCustomerParamsCapture.email,
          eq("contact@email.com"),
          "createCustomerParams.email",
        );
        assertThat(
          createCustomerParamsCapture.name,
          eq("First Second"),
          "createCustomerParams.name",
        );
        assertThat(
          optionsCapture.idempotencyKey,
          eq("account1"),
          "options.idempotencyKey",
        );
        assertThat(
          await getBillingAccount(SPANNER_DATABASE, "account1"),
          isArray([
            eqMessage(
              {
                billingAccountData: {
                  accountId: "account1",
                  stripeCustomerId: "stripeCustomer1",
                },
              },
              GET_BILLING_ACCOUNT_ROW,
            ),
          ]),
          "billingAccount",
        );
        assertThat(
          await listStripeCustomerCreatingTasks(SPANNER_DATABASE, 1000000),
          isArray([]),
          "stripeCustomerCreatingTasks",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deleteBillingAccountStatement("account1"),
            deleteStripeCustomerCreatingTaskStatement("account1"),
          ]);
          await transaction.commit();
        });
      },
    },
    {
      name: "CustomerCreateionFailedAndRetried",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertBillingAccountStatement({
              accountId: "account1",
            }),
            insertStripeCustomerCreatingTaskStatement("account1", 100, 100),
          ]);
          await transaction.commit();
        });
        let clientMock = new NodeServiceClientMock();
        clientMock.response = {
          contactEmail: "contact@email.com",
          naturalName: "First Second",
        } as GetAccountContactResponse;
        let stripeClientMock: any = {
          customers: {
            create: async (createCustomerParams: any) => {
              throw new Error("Fake error.");
            },
          },
        };
        let handler = new ProcessStripeCustomerCreatingTaskHandler(
          SPANNER_DATABASE,
          clientMock,
          stripeClientMock,
          () => 1000,
        );

        // Execute
        handler.handle("", {
          accountId: "account1",
        });
        await new Promise<void>(
          (resolve) => (handler.doneCallbackFn = resolve),
        );

        // Verify
        assertThat(
          await listStripeCustomerCreatingTasks(SPANNER_DATABASE, 1000000),
          isArray([
            eqMessage(
              {
                stripeCustomerCreatingTaskAccountId: "account1",
                stripeCustomerCreatingTaskExecutionTimeMs: 301000,
              },
              LIST_STRIPE_CUSTOMER_CREATING_TASKS_ROW,
            ),
          ]),
          "stripeCustomerCreatingTasks",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deleteBillingAccountStatement("account1"),
            deleteStripeCustomerCreatingTaskStatement("account1"),
          ]);
          await transaction.commit();
        });
      },
    },
    // TODO: Add a test case for when created customer id mismatches.
  ],
});
