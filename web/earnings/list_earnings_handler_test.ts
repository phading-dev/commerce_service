import "../../local/env";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import { PayoutState } from "../../db/schema";
import { deleteEarningsStatement, insertEarningsStatement } from "../../db/sql";
import { ListEarningsHandler } from "./list_earnings_handler";
import { LIST_EARNINGS_RESPONSE } from "@phading/commerce_service_interface/web/earnings/interface";
import { PayoutState as PayoutStateResponse } from "@phading/commerce_service_interface/web/earnings/statement";
import { ProductType } from "@phading/price";
import { ExchangeSessionAndCheckCapabilityResponse } from "@phading/user_session_service_interface/node/interface";
import { newBadRequestError } from "@selfage/http_error";
import { eqHttpError } from "@selfage/http_error/test_matcher";
import { eqMessage } from "@selfage/message/test_matcher";
import { NodeServiceClientMock } from "@selfage/node_service_client/client_mock";
import { assertReject, assertThat } from "@selfage/test_matcher";
import { TEST_RUNNER } from "@selfage/test_runner";

TEST_RUNNER.run({
  name: "ListEarningsHandlerTest",
  cases: [
    {
      name: "Success",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertEarningsStatement({
              earningsId: "earnings1",
              accountId: "account1",
              month: "2020-01",
              currency: "USD",
              totalAmount: 1200,
              state: PayoutState.FAILED,
              items: [
                {
                  productType: ProductType.SHOW_PAYOUT,
                  amount: 1200,
                  quantity: 22,
                },
              ],
            }),
            insertEarningsStatement({
              earningsId: "earnings2",
              accountId: "account1",
              month: "2020-02",
              currency: "USD",
              totalAmount: 1300,
              state: PayoutState.PAID,
              items: [
                {
                  productType: ProductType.SHOW_PAYOUT,
                  amount: 1300,
                  quantity: 23,
                },
              ],
            }),
            insertEarningsStatement({
              earningsId: "earnings3",
              accountId: "account1",
              month: "2020-03",
              currency: "USD",
              totalAmount: 1400,
              state: PayoutState.PROCESSING,
              items: [
                {
                  productType: ProductType.SHOW_PAYOUT,
                  amount: 1400,
                  quantity: 24,
                },
              ],
            }),
          ]);
          await transaction.commit();
        });
        let clientMock = new NodeServiceClientMock();
        clientMock.response = {
          accountId: "account1",
          capabilities: {
            canEarn: true,
          },
        } as ExchangeSessionAndCheckCapabilityResponse;
        let handler = new ListEarningsHandler(SPANNER_DATABASE, clientMock);

        // Execute
        let response = await handler.handle(
          "",
          {
            startMonth: "2020-01",
            endMonth: "2020-03",
          },
          "session1",
        );

        // Verify
        assertThat(
          response,
          eqMessage(
            {
              earnings: [
                {
                  earningsId: "earnings3",
                  month: "2020-03",
                  currency: "USD",
                  totalAmount: 1400,
                  state: PayoutStateResponse.PROCESSING,
                  items: [
                    {
                      productType: ProductType.SHOW_PAYOUT,
                      amount: 1400,
                      quantity: 24,
                    },
                  ],
                },
                {
                  earningsId: "earnings2",
                  month: "2020-02",
                  currency: "USD",
                  totalAmount: 1300,
                  state: PayoutStateResponse.PAID,
                  items: [
                    {
                      productType: ProductType.SHOW_PAYOUT,
                      amount: 1300,
                      quantity: 23,
                    },
                  ],
                },
                {
                  earningsId: "earnings1",
                  month: "2020-01",
                  currency: "USD",
                  totalAmount: 1200,
                  state: PayoutStateResponse.FAILED,
                  items: [
                    {
                      productType: ProductType.SHOW_PAYOUT,
                      amount: 1200,
                      quantity: 22,
                    },
                  ],
                },
              ],
            },
            LIST_EARNINGS_RESPONSE,
          ),
          "response",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deleteEarningsStatement("earnings1"),
            deleteEarningsStatement("earnings2"),
            deleteEarningsStatement("earnings3"),
          ]);
          await transaction.commit();
        });
      },
    },
    {
      name: "StartMonthInvalid",
      execute: async () => {
        // Prepare
        let clientMock = new NodeServiceClientMock();
        let handler = new ListEarningsHandler(SPANNER_DATABASE, clientMock);

        // Execute
        let error = await assertReject(
          handler.handle(
            "",
            {
              startMonth: "2020-13",
              endMonth: "2021-03",
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
        let clientMock = new NodeServiceClientMock();
        let handler = new ListEarningsHandler(SPANNER_DATABASE, clientMock);

        // Execute
        let error = await assertReject(
          handler.handle(
            "",
            {
              startMonth: "2020-01",
              endMonth: "2025-01",
            },
            "session1",
          ),
        );

        // Verify
        assertThat(
          error,
          eqHttpError(
            newBadRequestError(
              `The range between "startMonth" and "endMonth" is too long.`,
            ),
          ),
          "error",
        );
      },
    },
  ],
});
