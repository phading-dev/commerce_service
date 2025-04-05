import { SERVICE_CLIENT } from "../../common/service_client";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import { PaymentState } from "../../db/schema";
import { listPaymentsWithStatements } from "../../db/sql";
import { getMonthDifference } from "../common/date_helper";
import { Database } from "@google-cloud/spanner";
import { ListPaymentsHandlerInterface } from "@phading/commerce_service_interface/web/billing/handler";
import {
  ListPaymentsRequestBody,
  ListPaymentsResponse,
} from "@phading/commerce_service_interface/web/billing/interface";
import {
  Payment,
  PaymentState as PaymentStateResponse,
} from "@phading/commerce_service_interface/web/billing/payment";
import { MAX_MONTH_RANGE } from "@phading/constants/commerce";
import { newFetchSessionAndCheckCapabilityRequest } from "@phading/user_session_service_interface/node/client";
import { newBadRequestError, newUnauthorizedError } from "@selfage/http_error";
import { NodeServiceClient } from "@selfage/node_service_client";

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
    if (
      getMonthDifference(new Date(body.startMonth), new Date(body.endMonth)) >
      MAX_MONTH_RANGE
    ) {
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
          paymentId: row.paymentStatementId,
          month: row.transactionStatementMonth,
          amount: row.transactionStatementStatement.totalAmount,
          currency: row.transactionStatementStatement.currency,
          stripeInvoiceUrl: row.paymentStripeInvoiceUrl,
          state: this.convertPaymentState(row.paymentState),
          updatedTimeMs: row.paymentUpdatedTimeMs,
        }),
      ),
    };
  }

  private convertPaymentState(state: PaymentState): PaymentStateResponse {
    switch (state) {
      case PaymentState.PROCESSING:
      case PaymentState.CHARGING_VIA_STRIPE_INVOICE:
        return PaymentStateResponse.PROCESSING;
      case PaymentState.PAID:
        return PaymentStateResponse.PAID;
      case PaymentState.FAILED:
        return PaymentStateResponse.FAILED;
      default:
        throw new Error(`Unknown payment state: ${state}`);
    }
  }
}
