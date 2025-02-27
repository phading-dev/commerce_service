import { SERVICE_CLIENT } from "../../common/service_client";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import { PayoutState } from "../../db/schema";
import { listEarnings } from "../../db/sql";
import { getMonthDifference } from "../common/date_helper";
import { Database } from "@google-cloud/spanner";
import { ListEarningsHandlerInterface } from "@phading/commerce_service_interface/web/earnings/handler";
import {
  ListEarningsRequestBody,
  ListEarningsResponse,
} from "@phading/commerce_service_interface/web/earnings/interface";
import {
  Earnings,
  PayoutState as PayoutStateResponse,
} from "@phading/commerce_service_interface/web/earnings/statement";
import { MAX_MONTH_RANGE } from "@phading/constants/commerce";
import { newExchangeSessionAndCheckCapabilityRequest } from "@phading/user_session_service_interface/node/client";
import {
  newBadRequestError,
  newInternalServerErrorError,
} from "@selfage/http_error";
import { NodeServiceClient } from "@selfage/node_service_client";

export class ListEarningsHandler extends ListEarningsHandlerInterface {
  public static create(): ListEarningsHandler {
    return new ListEarningsHandler(SPANNER_DATABASE, SERVICE_CLIENT);
  }

  public constructor(
    private database: Database,
    private serviceClient: NodeServiceClient,
  ) {
    super();
  }

  public async handle(
    loggingPrefix: string,
    body: ListEarningsRequestBody,
    sessionStr: string,
  ): Promise<ListEarningsResponse> {
    if (!body.startMonth) {
      throw newBadRequestError(`"startMonth" is required`);
    }
    if (!body.endMonth) {
      throw newBadRequestError(`"endMonth" is required`);
    }
    if (body.startMonth > body.endMonth) {
      throw newBadRequestError(`"startMonth" is after "endMonth".`);
    }
    let startDate = new Date(body.startMonth);
    if (isNaN(startDate.valueOf())) {
      throw newBadRequestError(`"startMonth" is not a valid ISO string.`);
    }
    let endDate = new Date(body.endMonth);
    if (isNaN(endDate.valueOf())) {
      throw newBadRequestError(`"endMonth" is not a valid ISO string.`);
    }
    if (getMonthDifference(startDate, endDate) > MAX_MONTH_RANGE) {
      throw newBadRequestError(
        `The range between "startMonth" and "endMonth" is too long.`,
      );
    }
    let { accountId, capabilities } = await this.serviceClient.send(
      newExchangeSessionAndCheckCapabilityRequest({
        signedSession: sessionStr,
        capabilitiesMask: {
          checkCanEarn: true,
        },
      }),
    );
    if (!capabilities.canEarn) {
      throw newInternalServerErrorError(
        `Account ${accountId} cannot list earnings.`,
      );
    }
    let earningsRows = await listEarnings(
      this.database,
      accountId,
      body.startMonth,
      body.endMonth,
    );
    return {
      earnings: earningsRows.map(
        (row): Earnings => ({
          earningsId: row.earningsData.earningsId,
          month: row.earningsData.month,
          currency: row.earningsData.currency,
          totalAmount: row.earningsData.totalAmount,
          state: this.convertState(row.earningsData.state),
          items: row.earningsData.items.map((item) => ({
            amount: item.amount,
            productType: item.productType,
            quantity: item.quantity,
          })),
        }),
      ),
    };
  }

  private convertState(state: PayoutState): PayoutStateResponse {
    switch (state) {
      case PayoutState.PROCESSING:
        return PayoutStateResponse.PROCESSING;
      case PayoutState.PAID:
        return PayoutStateResponse.PAID;
      case PayoutState.FAILED:
        return PayoutStateResponse.FAILED;
      default:
        throw newInternalServerErrorError(
          `Unknown state: ${PayoutState[state]}`,
        );
    }
  }
}
