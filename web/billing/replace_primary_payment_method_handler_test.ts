import { SPANNER_DATABASE } from "../../common/spanner_database";
import { PaymentState } from "../../db/schema";
import {
  GET_PAYMENT_TASK_ROW,
  LIST_BILLINGS_ROW,
  deleteBillingAccountStatement,
  deleteBillingStatement,
  deletePaymentTaskStatement,
  getPaymentTask,
  insertBillingAccountStatement,
  insertBillingStatement,
  listBillings,
} from "../../db/sql";
import { ReplacePrimaryPaymentMethodHandler } from "./replace_primary_payment_method_handler";
import { ExchangeSessionAndCheckCapabilityResponse } from "@phading/user_session_service_interface/node/interface";
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
            insertBillingAccountStatement({
              accountId: "account1",
              stripeCustomerId: "stripeCustomer1",
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
        } as ExchangeSessionAndCheckCapabilityResponse;
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
            deleteBillingAccountStatement("account1"),
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
            insertBillingAccountStatement({
              accountId: "account1",
              stripeCustomerId: "stripeCustomer1",
            }),
            insertBillingStatement({
              billingId: "billing1",
              accountId: "account1",
              state: PaymentState.FAILED,
              month: "2021-01",
            }),
            insertBillingStatement({
              billingId: "billing2",
              accountId: "account1",
              state: PaymentState.PROCESSING,
              month: "2021-02",
            }),
            insertBillingStatement({
              billingId: "billing3",
              accountId: "account1",
              state: PaymentState.CHARGING,
              month: "2021-03",
            }),
            insertBillingStatement({
              billingId: "billing4",
              accountId: "account1",
              state: PaymentState.PAID,
              month: "2021-04",
            }),
            insertBillingStatement({
              billingId: "billing5",
              accountId: "account1",
              state: PaymentState.FAILED,
              month: "2021-05",
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
        } as ExchangeSessionAndCheckCapabilityResponse;
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
          await listBillings(
            SPANNER_DATABASE,
            "account1",
            "2021-01",
            "2021-05",
          ),
          isArray([
            eqMessage(
              {
                billingData: {
                  billingId: "billing5",
                  accountId: "account1",
                  state: PaymentState.PROCESSING,
                  month: "2021-05",
                },
              },
              LIST_BILLINGS_ROW,
            ),
            eqMessage(
              {
                billingData: {
                  billingId: "billing4",
                  accountId: "account1",
                  state: PaymentState.PAID,
                  month: "2021-04",
                },
              },
              LIST_BILLINGS_ROW,
            ),
            eqMessage(
              {
                billingData: {
                  billingId: "billing3",
                  accountId: "account1",
                  state: PaymentState.CHARGING,
                  month: "2021-03",
                },
              },
              LIST_BILLINGS_ROW,
            ),
            eqMessage(
              {
                billingData: {
                  billingId: "billing2",
                  accountId: "account1",
                  state: PaymentState.PROCESSING,
                  month: "2021-02",
                },
              },
              LIST_BILLINGS_ROW,
            ),
            eqMessage(
              {
                billingData: {
                  billingId: "billing1",
                  accountId: "account1",
                  state: PaymentState.PROCESSING,
                  month: "2021-01",
                },
              },
              LIST_BILLINGS_ROW,
            ),
          ]),
          "billings",
        );
        assertThat(
          await getPaymentTask(SPANNER_DATABASE, "billing1"),
          isUnorderedArray([
            eqMessage(
              {
                paymentTaskBillingId: "billing1",
                paymentTaskRetryCount: 0,
                paymentTaskExecutionTimeMs: 1000,
                paymentTaskCreatedTimeMs: 1000,
              },
              GET_PAYMENT_TASK_ROW,
            ),
          ]),
          "paymentTask for billing1",
        );
        assertThat(
          await getPaymentTask(SPANNER_DATABASE, "billing5"),
          isUnorderedArray([
            eqMessage(
              {
                paymentTaskBillingId: "billing5",
                paymentTaskRetryCount: 0,
                paymentTaskExecutionTimeMs: 1000,
                paymentTaskCreatedTimeMs: 1000,
              },
              GET_PAYMENT_TASK_ROW,
            ),
          ]),
          "paymentTask for billing5",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deleteBillingAccountStatement("account1"),
            deleteBillingStatement("billing1"),
            deleteBillingStatement("billing2"),
            deleteBillingStatement("billing3"),
            deleteBillingStatement("billing4"),
            deleteBillingStatement("billing5"),
            deletePaymentTaskStatement("billing1"),
            deletePaymentTaskStatement("billing2"),
            deletePaymentTaskStatement("billing3"),
            deletePaymentTaskStatement("billing4"),
            deletePaymentTaskStatement("billing5"),
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
            insertBillingAccountStatement({
              accountId: "account1",
              stripeCustomerId: "stripeCustomer1",
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
        } as ExchangeSessionAndCheckCapabilityResponse;
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
            deleteBillingAccountStatement("account1"),
          ]);
          await transaction.commit();
        });
      },
    },
  ],
});
