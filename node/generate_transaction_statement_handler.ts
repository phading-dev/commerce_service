import { SPANNER_DATABASE } from "../common/spanner_database";
import { PaymentState, PayoutState, TransactionStatement } from "../db/schema";
import {
  getPaymentProfile,
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
import { newInternalServerErrorError } from "@selfage/http_error";

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
      let [profileRows, statementRows] = await Promise.all([
        getPaymentProfile(transaction, {
          paymentProfileAccountIdEq: body.accountId,
        }),
        getTransactionStatementByMonth(transaction, {
          transactionStatementAccountIdEq: body.accountId,
          transactionStatementMonthEq: body.month,
        }),
      ]);
      if (profileRows.length === 0) {
        throw newInternalServerErrorError(
          `Account ${body.accountId} does not have a payment profile.`,
        );
      }
      if (statementRows.length > 0) {
        return;
      }

      let transactionStatement: TransactionStatement = {
        currency: ENV_VARS.defaultCurrency,
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
      let creditAmount = 0;
      let debitAmount = 0;
      transactionStatement.items.forEach((item) => {
        switch (item.amountType) {
          case AmountType.CREDIT:
            creditAmount += item.amount;
            break;
          case AmountType.DEBIT:
            debitAmount += item.amount;
            break;
          default:
            throw newInternalServerErrorError(
              `Invalid amount type: ${AmountType[item.amountType]}`,
            );
        }
      });
      transactionStatement.totalAmountType =
        debitAmount >= creditAmount ? AmountType.DEBIT : AmountType.CREDIT;
      transactionStatement.totalAmount = Math.abs(debitAmount - creditAmount);

      let profile = profileRows[0];
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
        ...(transactionStatement.totalAmount === 0
          ? []
          : transactionStatement.totalAmountType === AmountType.CREDIT
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
                  executionTimeMs:
                    now > profile.paymentProfileFirstPaymentTimeMs
                      ? now
                      : profile.paymentProfileFirstPaymentTimeMs,
                  createdTimeMs: now,
                }),
              ]),
      ]);
      await transaction.commit();
    });
    return {};
  }
}
