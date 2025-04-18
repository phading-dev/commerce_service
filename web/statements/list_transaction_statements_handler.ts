import { SERVICE_CLIENT } from "../../common/service_client";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import { listTransactionStatements } from "../../db/sql";
import { ENV_VARS } from "../../env_vars";
import { Database } from "@google-cloud/spanner";
import { ListTransactionStatementsHandlerInterface } from "@phading/commerce_service_interface/web/statements/handler";
import {
  ListTransactionStatementsRequestBody,
  ListTransactionStatementsResponse,
} from "@phading/commerce_service_interface/web/statements/interface";
import {
  LineItem,
  TransactionStatement,
} from "@phading/commerce_service_interface/web/statements/transaction_statement";
import { MAX_MONTH_RANGE } from "@phading/constants/commerce";
import { newFetchSessionAndCheckCapabilityRequest } from "@phading/user_session_service_interface/node/client";
import { newBadRequestError } from "@selfage/http_error";
import { NodeServiceClient } from "@selfage/node_service_client";
import { TzDate } from "@selfage/tz_date";

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
    let { accountId } = await this.serviceClient.send(
      newFetchSessionAndCheckCapabilityRequest({
        signedSession: sessionStr,
      }),
    );
    let rows = await listTransactionStatements(this.database, {
      transactionStatementAccountIdEq: accountId,
      transactionStatementMonthGe: startMonth.toLocalMonthISOString(),
      transactionStatementMonthLe: endMonth.toLocalMonthISOString(),
    });
    return {
      statements: rows.map(
        (row): TransactionStatement => ({
          statementId: row.transactionStatementStatementId,
          month: row.transactionStatementMonth,
          currency: row.transactionStatementStatement.currency,
          totalAmount: row.transactionStatementStatement.totalAmount,
          totalAmountType: row.transactionStatementStatement.totalAmountType,
          items: row.transactionStatementStatement.items.map(
            (item): LineItem => ({
              productID: item.productID,
              amountType: item.amountType,
              unit: item.unit,
              quantity: item.quantity,
              amount: item.amount,
            }),
          ),
        }),
      ),
    };
  }
}
