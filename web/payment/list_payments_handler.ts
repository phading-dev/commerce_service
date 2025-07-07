import { SERVICE_CLIENT } from "../../common/service_client";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import { PaymentState } from "../../db/schema";
import { listPaymentsWithStatements } from "../../db/sql";
import { ENV_VARS } from "../../env_vars";
import { Database } from "@google-cloud/spanner";
import { ListPaymentsHandlerInterface } from "@phading/commerce_service_interface/web/payment/handler";
import {
  ListPaymentsRequestBody,
  ListPaymentsResponse,
} from "@phading/commerce_service_interface/web/payment/interface";
import {
  Payment,
  PaymentState as PaymentStateResponse,
} from "@phading/commerce_service_interface/web/payment/payment";
import { MAX_MONTH_RANGE } from "@phading/constants/commerce";
import { newFetchSessionAndCheckCapabilityRequest } from "@phading/user_session_service_interface/node/client";
import { newBadRequestError, newUnauthorizedError } from "@selfage/http_error";
import { NodeServiceClient } from "@selfage/node_service_client";
import { TzDate } from "@selfage/tz_date";

export class ListPaymentsHandler extends ListPaymentsHandlerInterface {
  public static create(): ListPaymentsHandler {
    return new ListPaymentsHandler(SPANNER_DATABASE, SERVICE_CLIENT);
  }

  public constructor(
    private database: Database,
    private serviceClient: NodeServiceClient,
  ) {
    super();
  }

  public async handle(
    loggingPrefix: string,
    body: ListPaymentsRequestBody,
    sessionStr: string,
  ): Promise<ListPaymentsResponse> {
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
          checkCanBeBilled: true,
        },
      }),
    );
    if (!capabilities.canBeBilled) {
      throw newUnauthorizedError(
        `Account ${accountId} is not allowed to list payments.`,
      );
    }
    let rows = await listPaymentsWithStatements(this.database, {
      paymentAccountIdEq: accountId,
      transactionStatementMonthGe: body.startMonth,
      transactionStatementMonthLe: body.endMonth,
    });
    return {
      payments: rows.map(
        (row): Payment => ({
          month: row.transactionStatementMonth,
          amount: row.transactionStatementStatement.totalAmount,
          currency: row.transactionStatementStatement.currency,
          state: this.convertPaymentState(row.paymentState),
          updatedTimeMs: row.paymentUpdatedTimeMs,
        }),
      ),
    };
  }

  private convertPaymentState(state: PaymentState): PaymentStateResponse {
    switch (state) {
      case PaymentState.CREATING_STRIPE_INVOICE:
      case PaymentState.WAITING_FOR_INVOICE_PAYMENT:
      case PaymentState.PAYING_INVOICE:
        return PaymentStateResponse.PROCESSING;
      case PaymentState.PAID:
        return PaymentStateResponse.PAID;
      case PaymentState.FAILED_WITH_INVOICE:
      case PaymentState.FAILED_WITHOUT_INVOICE:
        return PaymentStateResponse.FAILED;
      default:
        throw new Error(`Unknown payment state: ${state}`);
    }
  }
}
