import "../local/env";
import { SPANNER_DATABASE } from "../common/spanner_database";
import {
  GET_PAYMENT_PROFILE_ROW,
  GET_STRIPE_PAYMENT_CUSTOMER_CREATING_TASK_METADATA_ROW,
  deletePaymentProfileStatement,
  deleteStripePaymentCustomerCreatingTaskStatement,
  getPaymentProfile,
  getStripePaymentCustomerCreatingTaskMetadata,
  insertPaymentProfileStatement,
  insertStripePaymentCustomerCreatingTaskStatement,
  listPendingStripePaymentCustomerCreatingTasks,
} from "../db/sql";
import { ProcessStripePaymentCustomerCreatingTaskHandler } from "./process_stripe_payment_customer_creating_task_handler";
import { GetAccountContactResponse } from "@phading/user_service_interface/node/interface";
import {
  newBadRequestError,
  newInternalServerErrorError,
} from "@selfage/http_error";
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
  name: "ProcessStripePaymentCustomerCreatingTaskHandlerTest",
  cases: [
    {
      name: "ProcessTask",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertPaymentProfileStatement({
              accountId: "account1",
            }),
            insertStripePaymentCustomerCreatingTaskStatement({
              accountId: "account1",
              retryCount: 0,
              executionTimeMs: 100,
              createdTimeMs: 100,
            }),
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
        let handler = new ProcessStripePaymentCustomerCreatingTaskHandler(
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
          await getPaymentProfile(SPANNER_DATABASE, {
            paymentProfileAccountIdEq: "account1",
          }),
          isArray([
            eqMessage(
              {
                paymentProfileAccountId: "account1",
                paymentProfileStripePaymentCustomerId: "stripeCustomer1",
              },
              GET_PAYMENT_PROFILE_ROW,
            ),
          ]),
          "paymentAccount",
        );
        assertThat(
          await listPendingStripePaymentCustomerCreatingTasks(
            SPANNER_DATABASE,
            { stripePaymentCustomerCreatingTaskExecutionTimeMsLe: 1000000 },
          ),
          isArray([]),
          "stripeCustomerCreatingTasks",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deletePaymentProfileStatement({
              paymentProfileAccountIdEq: "account1",
            }),
            deleteStripePaymentCustomerCreatingTaskStatement({
              stripePaymentCustomerCreatingTaskAccountIdEq: "account1",
            }),
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
            insertPaymentProfileStatement({
              accountId: "account1",
              stripePaymentCustomerId: "stripeCustomer1",
            }),
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
        let handler = new ProcessStripePaymentCustomerCreatingTaskHandler(
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
            newBadRequestError(
              "Payment profile account1 already has a stripe customer id stripeCustomer1.",
            ),
          ),
          "error",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deletePaymentProfileStatement({
              paymentProfileAccountIdEq: "account1",
            }),
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
            insertPaymentProfileStatement({
              accountId: "account1",
              stripePaymentCustomerId: "stripeCustomer1",
            }),
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
        let handler = new ProcessStripePaymentCustomerCreatingTaskHandler(
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
              "Payment profile account1 already has a stripe customer id stripeCustomer1 which is different from the new one stripeCustomer2.",
            ),
          ),
          "error",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deletePaymentProfileStatement({
              paymentProfileAccountIdEq: "account1",
            }),
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
            insertPaymentProfileStatement({
              accountId: "account1",
            }),
            insertStripePaymentCustomerCreatingTaskStatement({
              accountId: "account1",
              retryCount: 0,
              executionTimeMs: 100,
              createdTimeMs: 100,
            }),
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
        let handler = new ProcessStripePaymentCustomerCreatingTaskHandler(
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
            deletePaymentProfileStatement({
              paymentProfileAccountIdEq: "account1",
            }),
            deleteStripePaymentCustomerCreatingTaskStatement({
              stripePaymentCustomerCreatingTaskAccountIdEq: "account1",
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
            insertStripePaymentCustomerCreatingTaskStatement({
              accountId: "account1",
              retryCount: 0,
              executionTimeMs: 100,
              createdTimeMs: 100,
            }),
          ]);
          await transaction.commit();
        });
        let handler = new ProcessStripePaymentCustomerCreatingTaskHandler(
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
          await getStripePaymentCustomerCreatingTaskMetadata(SPANNER_DATABASE, {
            stripePaymentCustomerCreatingTaskAccountIdEq: "account1",
          }),
          isArray([
            eqMessage(
              {
                stripePaymentCustomerCreatingTaskRetryCount: 1,
                stripePaymentCustomerCreatingTaskExecutionTimeMs: 301000,
              },
              GET_STRIPE_PAYMENT_CUSTOMER_CREATING_TASK_METADATA_ROW,
            ),
          ]),
          "stripeCustomerCreatingTasks",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deleteStripePaymentCustomerCreatingTaskStatement({
              stripePaymentCustomerCreatingTaskAccountIdEq: "account1",
            }),
          ]);
          await transaction.commit();
        });
      },
    },
  ],
});
