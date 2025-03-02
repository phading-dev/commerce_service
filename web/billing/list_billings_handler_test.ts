import "../../local/env";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import { PaymentState } from "../../db/schema";
import { deleteBillingStatement, insertBillingStatement } from "../../db/sql";
import { ListBillingsHandler } from "./list_billings_handler";
import { LIST_BILLINGS_RESPONSE } from "@phading/commerce_service_interface/web/billing/interface";
import { PaymentState as PaymentStateResponse } from "@phading/commerce_service_interface/web/billing/statement";
import { ProductType } from "@phading/price";
import { ExchangeSessionAndCheckCapabilityResponse } from "@phading/user_session_service_interface/node/interface";
import { newBadRequestError } from "@selfage/http_error";
import { eqHttpError } from "@selfage/http_error/test_matcher";
import { eqMessage } from "@selfage/message/test_matcher";
import { NodeServiceClientMock } from "@selfage/node_service_client/client_mock";
import { assertReject, assertThat } from "@selfage/test_matcher";
import { TEST_RUNNER } from "@selfage/test_runner";

TEST_RUNNER.run({
  name: "ListBillingsHandlerTest",
  cases: [
    {
      name: "MixedData",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertBillingStatement({
              accountId: "account1",
              billingId: "billing1",
              month: "2021-01",
              currency: "USD",
              totalAmount: 1300,
              state: PaymentState.PROCESSING,
              items: [
                {
                  productType: ProductType.SHOW,
                  amount: 1000,
                  quantity: 20,
                },
                {
                  productType: ProductType.STORAGE,
                  amount: 300,
                  quantity: 40,
                },
              ],
              stripeInvoiceUrl: "https://example.com/invoice1",
            }),
            insertBillingStatement({
              accountId: "account1",
              billingId: "billing2",
              month: "2021-02",
              currency: "USD",
              totalAmount: 1500,
              state: PaymentState.CHARGING,
              items: [
                {
                  productType: ProductType.SHOW,
                  amount: 1000,
                  quantity: 30,
                },
                {
                  productType: ProductType.STORAGE,
                  amount: 500,
                  quantity: 20,
                },
              ],
              stripeInvoiceUrl: "https://example.com/invoice2",
            }),
            insertBillingStatement({
              accountId: "account1",
              billingId: "billing3",
              month: "2021-03",
              currency: "USD",
              totalAmount: 1200,
              state: PaymentState.PAID,
              items: [
                {
                  productType: ProductType.SHOW,
                  amount: 1000,
                  quantity: 20,
                },
                {
                  productType: ProductType.STORAGE,
                  amount: 200,
                  quantity: 40,
                },
              ],
              stripeInvoiceUrl: "https://example.com/invoice3",
            }),
            insertBillingStatement({
              accountId: "account1",
              billingId: "billing4",
              month: "2021-04",
              currency: "USD",
              totalAmount: 1400,
              state: PaymentState.FAILED,
              items: [
                {
                  productType: ProductType.SHOW,
                  amount: 1000,
                  quantity: 30,
                },
                {
                  productType: ProductType.STORAGE,
                  amount: 400,
                  quantity: 20,
                },
              ],
              stripeInvoiceUrl: "https://example.com/invoice4",
            }),
          ]);
          await transaction.commit();
        });
        let clientMock = new NodeServiceClientMock();
        clientMock.response = {
          accountId: "account1",
          capabilities: {
            canBeBilled: true,
          },
        } as ExchangeSessionAndCheckCapabilityResponse;
        let handler = new ListBillingsHandler(SPANNER_DATABASE, clientMock);

        // Execute
        let response = await handler.handle(
          "",
          {
            startMonth: "2021-01",
            endMonth: "2021-04",
          },
          "session1",
        );

        // Verify
        assertThat(
          response,
          eqMessage(
            {
              billings: [
                {
                  billingId: "billing4",
                  month: "2021-04",
                  currency: "USD",
                  totalAmount: 1400,
                  state: PaymentStateResponse.FAILED,
                  items: [
                    {
                      amount: 1000,
                      productType: ProductType.SHOW,
                      quantity: 30,
                    },
                    {
                      amount: 400,
                      productType: ProductType.STORAGE,
                      quantity: 20,
                    },
                  ],
                  stripeInvoiceUrl: "https://example.com/invoice4",
                },
                {
                  billingId: "billing3",
                  month: "2021-03",
                  currency: "USD",
                  totalAmount: 1200,
                  state: PaymentStateResponse.PAID,
                  items: [
                    {
                      amount: 1000,
                      productType: ProductType.SHOW,
                      quantity: 20,
                    },
                    {
                      amount: 200,
                      productType: ProductType.STORAGE,
                      quantity: 40,
                    },
                  ],
                  stripeInvoiceUrl: "https://example.com/invoice3",
                },
                {
                  billingId: "billing2",
                  month: "2021-02",
                  currency: "USD",
                  totalAmount: 1500,
                  state: PaymentStateResponse.PROCESSING,
                  items: [
                    {
                      amount: 1000,
                      productType: ProductType.SHOW,
                      quantity: 30,
                    },
                    {
                      amount: 500,
                      productType: ProductType.STORAGE,
                      quantity: 20,
                    },
                  ],
                  stripeInvoiceUrl: "https://example.com/invoice2",
                },
                {
                  billingId: "billing1",
                  month: "2021-01",
                  currency: "USD",
                  totalAmount: 1300,
                  state: PaymentStateResponse.PROCESSING,
                  items: [
                    {
                      amount: 1000,
                      productType: ProductType.SHOW,
                      quantity: 20,
                    },
                    {
                      amount: 300,
                      productType: ProductType.STORAGE,
                      quantity: 40,
                    },
                  ],
                  stripeInvoiceUrl: "https://example.com/invoice1",
                },
              ],
            },
            LIST_BILLINGS_RESPONSE,
          ),
          "response",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deleteBillingStatement("billing1"),
            deleteBillingStatement("billing2"),
            deleteBillingStatement("billing3"),
            deleteBillingStatement("billing4"),
          ]);
          await transaction.commit();
        });
      },
    },
    {
      name: "StartMonthInvalid",
      execute: async () => {
        // Prepare
        let handler = new ListBillingsHandler(
          SPANNER_DATABASE,
          new NodeServiceClientMock(),
        );

        // Execute
        let error = await assertReject(
          handler.handle(
            "",
            {
              startMonth: "2020-13",
              endMonth: "2021-01",
            },
            "session1",
          ),
        );

        // Verify
        assertThat(
          error,
          eqHttpError(
            newBadRequestError(`"startMonth" is not a valid ISO string.`),
          ),
          "error",
        );
      },
    },
    {
      name: "MonthRangeTooLarge",
      execute: async () => {
        // Prepare
        let handler = new ListBillingsHandler(
          SPANNER_DATABASE,
          new NodeServiceClientMock(),
        );

        // Execute
        let error = await assertReject(
          handler.handle(
            "",
            {
              startMonth: "2021-01",
              endMonth: "2024-10",
            },
            "session1",
          ),
        );

        // Verify
        assertThat(
          error,
          eqHttpError(
            newBadRequestError(
              `The range between "startMonth" and "endMonth" is too large.`,
            ),
          ),
          "error",
        );
      },
    },
  ],
});
