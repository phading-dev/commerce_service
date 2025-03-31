import { SPANNER_DATABASE } from "../common/spanner_database";
import { PaymentState, PayoutState, TransactionStatement } from "../db/schema";
import {
  getTransactionStatementByMonth,
  insertPaymentStatement,
  insertPaymentTaskStatement,
  insertPayoutStatement,
  insertPayoutTaskStatement,
  insertTransactionStatementStatement,
} from "../db/sql";
import { ENV_VARS } from "../env_vars";
import { Database } from "@google-cloud/spanner";
import { GenerateTransactionStatementHandlerInterface } from "@phading/commerce_service_interface/node/handler";
import {
  GenerateTransactionStatementRequestBody,
  GenerateTransactionStatementResponse,
} from "@phading/commerce_service_interface/node/interface";
import { AmountType } from "@phading/price/amount_type";
import { calculateMoney } from "@phading/price_config/calculator";

export class GenerateTransactionStatementHandler extends GenerateTransactionStatementHandlerInterface {
  public static create(): GenerateTransactionStatementHandler {
    return new GenerateTransactionStatementHandler(
      SPANNER_DATABASE,
      () => crypto.randomUUID(),
      () => Date.now(),
    );
  }

  public constructor(
    private database: Database,
    private generateUuid: () => string,
    private getNow: () => number,
  ) {
    super();
  }

  public async handle(
    loggingPrefix: string,
    body: GenerateTransactionStatementRequestBody,
  ): Promise<GenerateTransactionStatementResponse> {
    await this.database.runTransactionAsync(async (transaction) => {
      let statementRows = await getTransactionStatementByMonth(transaction, {
        transactionStatementAccountIdEq: body.accountId,
        transactionStatementMonthEq: body.month,
      });
      if (statementRows.length > 0) {
        return;
      }

      let transactionStatement: TransactionStatement = {
        currency: ENV_VARS.defaultCurrency,
        positiveAmountType: body.positiveAmountType,
        items: [],
      };
      for (let item of body.lineItems) {
        let { price, amount } = calculateMoney(
          item.productID,
          ENV_VARS.defaultCurrency,
          body.month,
          item.quantity,
        );
        transactionStatement.items.push({
          productID: item.productID,
          amountType: price.amountType,
          unit: price.unit,
          quantity: item.quantity,
          amount,
        });
      }
      transactionStatement.totalAmount = transactionStatement.items.reduce(
        (total, item) =>
          total +
          (item.amountType === transactionStatement.positiveAmountType
            ? item.amount
            : -item.amount),
        0,
      );
      transactionStatement.totalAmountType =
        transactionStatement.totalAmount >= 0
          ? transactionStatement.positiveAmountType
          : transactionStatement.positiveAmountType === AmountType.CREDIT
            ? AmountType.DEBIT
            : AmountType.CREDIT;
      transactionStatement.totalAmount = Math.abs(
        transactionStatement.totalAmount,
      );

      let now = this.getNow();
      let statementId = this.generateUuid();
      await transaction.batchUpdate([
        insertTransactionStatementStatement({
          statementId,
          accountId: body.accountId,
          month: body.month,
          statement: transactionStatement,
          createdTimeMs: now,
        }),
        ...(transactionStatement.totalAmountType === AmountType.CREDIT
          ? [
              insertPayoutStatement({
                statementId,
                accountId: body.accountId,
                state: PayoutState.PROCESSING,
                updatedTimeMs: now,
                createdTimeMs: now,
              }),
              insertPayoutTaskStatement({
                statementId,
                retryCount: 0,
                executionTimeMs: now,
                createdTimeMs: now,
              }),
            ]
          : [
              insertPaymentStatement({
                statementId,
                accountId: body.accountId,
                state: PaymentState.PROCESSING,
                createdTimeMs: now,
                updatedTimeMs: now,
              }),
              insertPaymentTaskStatement({
                statementId,
                retryCount: 0,
                executionTimeMs: now,
                createdTimeMs: now,
              }),
            ]),
      ]);
      await transaction.commit();
    });
    return {};
  }
}
