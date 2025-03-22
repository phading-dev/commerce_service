import "../../local/env";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import { PaymentState } from "../../db/schema";
import {
  GET_PAYMENT_ROW,
  GET_PAYMENT_TASK_ROW,
  deleteBillingProfileStatement,
  deletePaymentStatement,
  deletePaymentTaskStatement,
  getPayment,
  getPaymentTask,
  insertBillingProfileStatement,
  insertPaymentStatement,
} from "../../db/sql";
import { ReplacePrimaryPaymentMethodHandler } from "./replace_primary_payment_method_handler";
import { FetchSessionAndCheckCapabilityResponse } from "@phading/user_session_service_interface/node/interface";
import { eqMessage } from "@selfage/message/test_matcher";
import { NodeServiceClientMock } from "@selfage/node_service_client/client_mock";
import { Ref } from "@selfage/ref";
import {
  assertThat,
  eq,
  isArray,
  isUnorderedArray,
} from "@selfage/test_matcher";
import { TEST_RUNNER } from "@selfage/test_runner";

TEST_RUNNER.run({
  name: "ReplacePrimaryPaymentMethodHandlerTest",
  cases: [
    {
      name: "SetPrimaryPaymentMethodOnly",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertBillingProfileStatement({
              accountId: "account1",
              stripePaymentCustomerId: "stripeCustomer1",
            }),
          ]);
          await transaction.commit();
        });
        let checkoutSessionIdCaptured: string;
        let stripeCustomerIdCaptured: string;
        let customerUpdateParamCaptured: any;
        let stripeClientMock: any = {
          checkout: {
            sessions: {
              retrieve: (checkoutSessionId: string) => {
                checkoutSessionIdCaptured = checkoutSessionId;
                return {
                  setup_intent: {
                    payment_method: "paymentMethod1",
                  },
                };
              },
            },
          },
          customers: {
            update: (stripeCustomerId: string, customerUpdateParam: any) => {
              stripeCustomerIdCaptured = stripeCustomerId;
              customerUpdateParamCaptured = customerUpdateParam;
              return {};
            },
            listPaymentMethods: () => {
              return {
                data: [],
              } as any;
            },
          },
        };
        let clientMock = new NodeServiceClientMock();
        clientMock.response = {
          accountId: "account1",
          capabilities: {
            canBeBilled: true,
          },
        } as FetchSessionAndCheckCapabilityResponse;
        let handler = new ReplacePrimaryPaymentMethodHandler(
          SPANNER_DATABASE,
          new Ref(stripeClientMock),
          clientMock,
          () => 1000,
        );

        // Execute
        await handler.handle(
          "",
          {
            checkoutSessionId: "checkoutSession1",
          },
          "session1",
        );

        // Verify
        assertThat(
          checkoutSessionIdCaptured,
          eq("checkoutSession1"),
          "checkoutSessionId",
        );
        assertThat(
          stripeCustomerIdCaptured,
          eq("stripeCustomer1"),
          "stripeCustomerId",
        );
        assertThat(
          customerUpdateParamCaptured.invoice_settings.default_payment_method,
          eq("paymentMethod1"),
          "paymentMethodId",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deleteBillingProfileStatement({
              billingProfileAccountIdEq: "account1",
            }),
          ]);
          await transaction.commit();
        });
      },
    },
    {
      name: "SetPrimaryAndRetryFailedPayments",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertBillingProfileStatement({
              accountId: "account1",
              stripePaymentCustomerId: "stripeCustomer1",
            }),
            insertPaymentStatement({
              statementId: "statement1",
              accountId: "account1",
              state: PaymentState.FAILED,
            }),
            insertPaymentStatement({
              statementId: "statement2",
              accountId: "account1",
              state: PaymentState.PROCESSING,
            }),
            insertPaymentStatement({
              statementId: "statement3",
              accountId: "account1",
              state: PaymentState.CHARGING_VIA_STRIPE_INVOICE,
            }),
            insertPaymentStatement({
              statementId: "statement4",
              accountId: "account1",
              state: PaymentState.PAID,
            }),
            insertPaymentStatement({
              statementId: "statement5",
              accountId: "account1",
              state: PaymentState.FAILED,
            }),
          ]);
          await transaction.commit();
        });
        let stripeClientMock: any = {
          checkout: {
            sessions: {
              retrieve: () => {
                return {
                  setup_intent: {
                    payment_method: "paymentMethod1",
                  },
                };
              },
            },
          },
          customers: {
            update: () => {
              return {};
            },
            listPaymentMethods: () => {
              return {
                data: [],
              } as any;
            },
          },
        };
        let clientMock = new NodeServiceClientMock();
        clientMock.response = {
          accountId: "account1",
          capabilities: {
            canBeBilled: true,
          },
        } as FetchSessionAndCheckCapabilityResponse;
        let handler = new ReplacePrimaryPaymentMethodHandler(
          SPANNER_DATABASE,
          new Ref(stripeClientMock),
          clientMock,
          () => 1000,
        );

        // Execute
        await handler.handle(
          "",
          {
            checkoutSessionId: "checkoutSession1",
          },
          "session1",
        );

        // Verify
        assertThat(
          await getPayment(SPANNER_DATABASE, {
            paymentStatementIdEq: "statement1",
          }),
          isArray([
            eqMessage(
              {
                paymentAccountId: "account1",
                paymentStatementId: "statement1",
                paymentState: PaymentState.PROCESSING,
                paymentUpdatedTimeMs: 1000,
              },
              GET_PAYMENT_ROW,
            ),
          ]),
          "payment for statement1",
        );
        assertThat(
          await getPayment(SPANNER_DATABASE, {
            paymentStatementIdEq: "statement2",
          }),
          isArray([
            eqMessage(
              {
                paymentAccountId: "account1",
                paymentStatementId: "statement2",
                paymentState: PaymentState.PROCESSING,
              },
              GET_PAYMENT_ROW,
            ),
          ]),
          "payment for statement2",
        );
        assertThat(
          await getPayment(SPANNER_DATABASE, {
            paymentStatementIdEq: "statement3",
          }),
          isArray([
            eqMessage(
              {
                paymentAccountId: "account1",
                paymentStatementId: "statement3",
                paymentState: PaymentState.CHARGING_VIA_STRIPE_INVOICE,
              },
              GET_PAYMENT_ROW,
            ),
          ]),
          "payment for statement3",
        );
        assertThat(
          await getPayment(SPANNER_DATABASE, {
            paymentStatementIdEq: "statement4",
          }),
          isArray([
            eqMessage(
              {
                paymentAccountId: "account1",
                paymentStatementId: "statement4",
                paymentState: PaymentState.PAID,
              },
              GET_PAYMENT_ROW,
            ),
          ]),
          "payment for statement4",
        );
        assertThat(
          await getPayment(SPANNER_DATABASE, {
            paymentStatementIdEq: "statement5",
          }),
          isArray([
            eqMessage(
              {
                paymentAccountId: "account1",
                paymentStatementId: "statement5",
                paymentState: PaymentState.PROCESSING,
                paymentUpdatedTimeMs: 1000,
              },
              GET_PAYMENT_ROW,
            ),
          ]),
          "payment for statement5",
        );
        assertThat(
          await getPaymentTask(SPANNER_DATABASE, {
            paymentTaskStatementIdEq: "statement1",
          }),
          isUnorderedArray([
            eqMessage(
              {
                paymentTaskStatementId: "statement1",
                paymentTaskRetryCount: 0,
                paymentTaskExecutionTimeMs: 1000,
                paymentTaskCreatedTimeMs: 1000,
              },
              GET_PAYMENT_TASK_ROW,
            ),
          ]),
          "paymentTask for statement1",
        );
        assertThat(
          await getPaymentTask(SPANNER_DATABASE, {
            paymentTaskStatementIdEq: "statement5",
          }),
          isUnorderedArray([
            eqMessage(
              {
                paymentTaskStatementId: "statement5",
                paymentTaskRetryCount: 0,
                paymentTaskExecutionTimeMs: 1000,
                paymentTaskCreatedTimeMs: 1000,
              },
              GET_PAYMENT_TASK_ROW,
            ),
          ]),
          "paymentTask for statement5",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deleteBillingProfileStatement({
              billingProfileAccountIdEq: "account1",
            }),
            deletePaymentStatement({ paymentStatementIdEq: "statement1" }),
            deletePaymentStatement({ paymentStatementIdEq: "statement2" }),
            deletePaymentStatement({ paymentStatementIdEq: "statement3" }),
            deletePaymentStatement({ paymentStatementIdEq: "statement4" }),
            deletePaymentStatement({ paymentStatementIdEq: "statement5" }),
            deletePaymentTaskStatement({
              paymentTaskStatementIdEq: "statement1",
            }),
            deletePaymentTaskStatement({
              paymentTaskStatementIdEq: "statement2",
            }),
            deletePaymentTaskStatement({
              paymentTaskStatementIdEq: "statement3",
            }),
            deletePaymentTaskStatement({
              paymentTaskStatementIdEq: "statement4",
            }),
            deletePaymentTaskStatement({
              paymentTaskStatementIdEq: "statement5",
            }),
          ]);
          await transaction.commit();
        });
      },
    },
    {
      name: "SetPrimaryAndDetachOtherPaymentMethods",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertBillingProfileStatement({
              accountId: "account1",
              stripePaymentCustomerId: "stripeCustomer1",
            }),
          ]);
          await transaction.commit();
        });
        let stripeCustomerIdCaptured: string;
        let detachPaymentMethodIds: string[] = [];
        let stripeClientMock: any = {
          checkout: {
            sessions: {
              retrieve: () => {
                return {
                  setup_intent: {
                    payment_method: "paymentMethod1",
                  },
                };
              },
            },
          },
          customers: {
            update: () => {
              return {};
            },
            listPaymentMethods: (stripeCustomerId: string) => {
              stripeCustomerIdCaptured = stripeCustomerId;
              return {
                data: [
                  {
                    id: "paymentMethod1",
                  },
                  {
                    id: "paymentMethod2",
                  },
                  {
                    id: "paymentMethod3",
                  },
                ],
              } as any;
            },
          },
          paymentMethods: {
            detach: (paymentMethodId: string) => {
              detachPaymentMethodIds.push(paymentMethodId);
              return {};
            },
          },
        };
        let clientMock = new NodeServiceClientMock();
        clientMock.response = {
          accountId: "account1",
          capabilities: {
            canBeBilled: true,
          },
        } as FetchSessionAndCheckCapabilityResponse;
        let handler = new ReplacePrimaryPaymentMethodHandler(
          SPANNER_DATABASE,
          new Ref(stripeClientMock),
          clientMock,
          () => 1000,
        );

        // Execute
        await handler.handle(
          "",
          {
            checkoutSessionId: "checkoutSession1",
          },
          "session1",
        );

        // Verify
        assertThat(
          stripeCustomerIdCaptured,
          eq("stripeCustomer1"),
          "stripeCustomerId",
        );
        assertThat(
          detachPaymentMethodIds,
          isArray([eq("paymentMethod2"), eq("paymentMethod3")]),
          "detachPaymentMethodIds",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deleteBillingProfileStatement({
              billingProfileAccountIdEq: "account1",
            }),
          ]);
          await transaction.commit();
        });
      },
    },
  ],
});
