import { SPANNER_DATABASE } from "../common/spanner_database";
import {
  GET_BILLING_ACCOUNT_ROW,
  GET_STRIPE_CUSTOMER_CREATING_TASK_METADATA_ROW,
  deleteBillingAccountStatement,
  deleteStripeCustomerCreatingTaskStatement,
  getBillingAccount,
  getStripeCustomerCreatingTaskMetadata,
  insertBillingAccountStatement,
  insertStripeCustomerCreatingTaskStatement,
  listPendingStripeCustomerCreatingTasks,
} from "../db/sql";
import { ProcessStripeCustomerCreatingTaskHandler } from "./process_stripe_customer_creating_task_handler";
import { GetAccountContactResponse } from "@phading/user_service_interface/node/interface";
import { newInternalServerErrorError } from "@selfage/http_error";
import { eqHttpError } from "@selfage/http_error/test_matcher";
import { eqMessage } from "@selfage/message/test_matcher";
import { NodeServiceClientMock } from "@selfage/node_service_client/client_mock";
import { Ref } from "@selfage/ref";
import {
  assertReject,
  assertThat,
  eq,
  eqError,
  isArray,
} from "@selfage/test_matcher";
import { TEST_RUNNER } from "@selfage/test_runner";

TEST_RUNNER.run({
  name: "ProcessStripeCustomerCreatingTaskHandlerTest",
  cases: [
    {
      name: "ProcessTask",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertBillingAccountStatement({
              accountId: "account1",
            }),
            insertStripeCustomerCreatingTaskStatement("account1", 0, 100, 100),
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
          new Ref(stripeClientMock),
          () => 1000,
        );

        // Execute
        await handler.processTask("", {
          accountId: "account1",
        });

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
          await listPendingStripeCustomerCreatingTasks(
            SPANNER_DATABASE,
            1000000,
          ),
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
      name: "CustomerAlreadyCreated",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertBillingAccountStatement({
              accountId: "account1",
              stripeCustomerId: "stripeCustomer1",
            }),
            insertStripeCustomerCreatingTaskStatement("account1", 0, 100, 100),
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
            create: async (createCustomerParams: any, options: any) => {
              return {
                id: "stripeCustomer1",
              };
            },
          },
        };
        let handler = new ProcessStripeCustomerCreatingTaskHandler(
          SPANNER_DATABASE,
          clientMock,
          new Ref(stripeClientMock),
          () => 1000,
        );

        // Execute
        await handler.processTask("", {
          accountId: "account1",
        });

        // Verify
        assertThat(
          await listPendingStripeCustomerCreatingTasks(
            SPANNER_DATABASE,
            1000000,
          ),
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
      name: "CustomerCreatedWithDifferentId",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertBillingAccountStatement({
              accountId: "account1",
              stripeCustomerId: "stripeCustomer1",
            }),
            insertStripeCustomerCreatingTaskStatement("account1", 0, 100, 100),
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
            create: async (createCustomerParams: any, options: any) => {
              return {
                id: "stripeCustomer2",
              };
            },
          },
        };
        let handler = new ProcessStripeCustomerCreatingTaskHandler(
          SPANNER_DATABASE,
          clientMock,
          new Ref(stripeClientMock),
          () => 1000,
        );

        // Execute
        let error = await assertReject(
          handler.processTask("", {
            accountId: "account1",
          }),
        );

        // Verify
        assertThat(
          error,
          eqHttpError(
            newInternalServerErrorError(
              "Billing account account1 already has a stripe customer id stripeCustomer1 which is different from the new one stripeCustomer2.",
            ),
          ),
          "error",
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
      name: "CustomerCreationFailed",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertBillingAccountStatement({
              accountId: "account1",
            }),
            insertStripeCustomerCreatingTaskStatement("account1", 0, 100, 100),
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
          new Ref(stripeClientMock),
          () => 1000,
        );

        // Execute
        let error = await assertReject(
          handler.processTask("", {
            accountId: "account1",
          }),
        );

        // Verify
        assertThat(error, eqError(new Error("Fake error.")), "error");
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
      name: "ClaimTask",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertStripeCustomerCreatingTaskStatement("account1", 0, 100, 100),
          ]);
          await transaction.commit();
        });
        let handler = new ProcessStripeCustomerCreatingTaskHandler(
          SPANNER_DATABASE,
          undefined,
          undefined,
          () => 1000,
        );

        // Execute
        await handler.claimTask("", {
          accountId: "account1",
        });

        // Verify
        assertThat(
          await getStripeCustomerCreatingTaskMetadata(
            SPANNER_DATABASE,
            "account1",
          ),
          isArray([
            eqMessage(
              {
                stripeCustomerCreatingTaskRetryCount: 1,
                stripeCustomerCreatingTaskExecutionTimeMs: 301000,
              },
              GET_STRIPE_CUSTOMER_CREATING_TASK_METADATA_ROW,
            ),
          ]),
          "stripeCustomerCreatingTasks",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deleteStripeCustomerCreatingTaskStatement("account1"),
          ]);
          await transaction.commit();
        });
      },
    },
  ],
});
