import { SERVICE_CLIENT } from "../../common/service_client";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import { PayoutState } from "../../db/schema";
import { listPayoutsWithStatements } from "../../db/sql";
import { ENV_VARS } from "../../env_vars";
import { Database } from "@google-cloud/spanner";
import { ListPayoutsHandlerInterface } from "@phading/commerce_service_interface/web/payout/handler";
import {
  ListPayoutsRequestBody,
  ListPayoutsResponse,
} from "@phading/commerce_service_interface/web/payout/interface";
import {
  Payout,
  PayoutState as PayoutStateResponse,
} from "@phading/commerce_service_interface/web/payout/payout";
import { MAX_MONTH_RANGE } from "@phading/constants/commerce";
import { newFetchSessionAndCheckCapabilityRequest } from "@phading/user_session_service_interface/node/client";
import { newBadRequestError, newUnauthorizedError } from "@selfage/http_error";
import { NodeServiceClient } from "@selfage/node_service_client";
import { TzDate } from "@selfage/tz_date";

export class ListPayoutsHandler extends ListPayoutsHandlerInterface {
  public static create(): ListPayoutsHandler {
    return new ListPayoutsHandler(SPANNER_DATABASE, SERVICE_CLIENT);
  }

  public constructor(
    private database: Database,
    private serviceClient: NodeServiceClient,
  ) {
    super();
  }

  public async handle(
    loggingPrefix: string,
    body: ListPayoutsRequestBody,
    sessionStr: string,
  ): Promise<ListPayoutsResponse> {
    if (!body.startMonth) {
      throw newBadRequestError(`"startMonth" is required.`);
    }
    if (!body.endMonth) {
      throw newBadRequestError(`"endMonth" is required.`);
    }
    let startMonth = TzDate.fromLocalDateString(
      body.startMonth,
      ENV_VARS.timezoneNegativeOffset,
    );
    if (isNaN(startMonth.toTimestampMs())) {
      throw newBadRequestError(`"startMonth" is not a valid date.`);
    }
    let endMonth = TzDate.fromLocalDateString(
      body.endMonth,
      ENV_VARS.timezoneNegativeOffset,
    );
    if (isNaN(endMonth.toTimestampMs())) {
      throw newBadRequestError(`"endMonth" is not a valid date.`);
    }
    if (startMonth.toTimestampMs() > endMonth.toTimestampMs()) {
      throw newBadRequestError(`"startMonth" must be smaller than "endMonth".`);
    }
    if (endMonth.minusDateInMonths(startMonth) + 1 > MAX_MONTH_RANGE) {
      throw newBadRequestError(`The range of months is too long.`);
    }
    let { accountId, capabilities } = await this.serviceClient.send(
      newFetchSessionAndCheckCapabilityRequest({
        signedSession: sessionStr,
        capabilitiesMask: {
          checkCanEarn: true,
        },
      }),
    );
    if (!capabilities.canEarn) {
      throw newUnauthorizedError(
        `Account ${accountId} is not allowed to list payouts.`,
      );
    }
    let rows = await listPayoutsWithStatements(this.database, {
      payoutAccountIdEq: accountId,
      transactionStatementMonthGe: body.startMonth,
      transactionStatementMonthLe: body.endMonth,
    });
    return {
      payouts: rows.map(
        (row): Payout => ({
          month: row.transactionStatementMonth,
          amount: row.transactionStatementStatement.totalAmount,
          currency: row.transactionStatementStatement.currency,
          state: this.convertPayoutState(row.payoutState),
          updatedTimeMs: row.payoutUpdatedTimeMs,
        }),
      ),
    };
  }

  private convertPayoutState(state: PayoutState): PayoutStateResponse {
    switch (state) {
      case PayoutState.PROCESSING:
        return PayoutStateResponse.PROCESSING;
      case PayoutState.PAID:
        return PayoutStateResponse.PAID;
      case PayoutState.DISABLED:
        return PayoutStateResponse.DISABLED;
      default:
        throw new Error(`Unknown payout state: ${state}`);
    }
  }
}
