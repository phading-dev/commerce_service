import { SERVICE_CLIENT } from "../../common/service_client";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import { PaymentState, PayoutState } from "../../db/schema";
import { listTransactionStatements } from "../../db/sql";
import { Database } from "@google-cloud/spanner";
import { ListTransactionStatementsHandlerInterface } from "@phading/commerce_service_interface/web/statements/handler";
import {
  ListTransactionStatementsRequestBody,
  ListTransactionStatementsResponse,
} from "@phading/commerce_service_interface/web/statements/interface";
import {
  LineItem,
  PaymentState as PaymentStateResponse,
  PayoutState as PayoutStateResponse,
  TransactionStatement,
} from "@phading/commerce_service_interface/web/statements/transaction_statement";
import { newFetchSessionAndCheckCapabilityRequest } from "@phading/user_session_service_interface/node/client";
import { NodeServiceClient } from "@selfage/node_service_client";

export class ListTransactionStatementsHandler extends ListTransactionStatementsHandlerInterface {
  public static create(): ListTransactionStatementsHandler {
    return new ListTransactionStatementsHandler(
      SPANNER_DATABASE,
      SERVICE_CLIENT,
    );
  }

  public constructor(
    private database: Database,
    private serviceClient: NodeServiceClient,
  ) {
    super();
  }

  public async handle(
    loggingPrefix: string,
    body: ListTransactionStatementsRequestBody,
    sessionStr: string,
  ): Promise<ListTransactionStatementsResponse> {
    let { accountId } = await this.serviceClient.send(
      newFetchSessionAndCheckCapabilityRequest({
        signedSession: sessionStr,
      }),
    );
    let rows = await listTransactionStatements(this.database, {
      transactionStatementAccountIdEq: accountId,
      transactionStatementMonthGe: body.startMonth,
      transactionStatementMonthLe: body.endMonth,
    });
    return {
      statements: rows.map(
        (row): TransactionStatement => ({
          statementId: row.transactionStatementStatementId,
          month: row.transactionStatementMonth,
          currency: row.transactionStatementStatement.currency,
          totalAmount: row.transactionStatementStatement.totalAmount,
          totalAmountType: row.transactionStatementStatement.totalAmountType,
          positiveAmountType:
            row.transactionStatementStatement.positiveAmountType,
          items: row.transactionStatementStatement.items.map(
            (item): LineItem => ({
              productID: item.productID,
              amountType: item.amountType,
              unit: item.unit,
              quantity: item.quantity,
              amount: item.amount,
            }),
          ),
          payment: row.paymentStatementId
            ? {
                state: this.convertPaymentState(row.paymentState),
                stripeInvoiceUrl: row.paymentStripeInvoiceUrl,
              }
            : undefined,
          payout: row.payoutStatementId
            ? {
                state: this.convertPayoutState(row.payoutState),
              }
            : undefined,
        }),
      ),
    };
  }

  private convertPaymentState(state: PaymentState): PaymentStateResponse {
    switch (state) {
      case PaymentState.PROCESSING:
        return PaymentStateResponse.PROCESSING;
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

  private convertPayoutState(state: PayoutState): PayoutStateResponse {
    switch (state) {
      case PayoutState.PROCESSING:
        return PayoutStateResponse.PROCESSING;
      case PayoutState.PAID:
        return PayoutStateResponse.PAID;
      case PayoutState.FAILED:
        return PayoutStateResponse.FAILED;
      default:
        throw new Error(`Unknown payout state: ${state}`);
    }
  }
}
