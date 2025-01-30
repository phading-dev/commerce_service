import { CURRENCY } from "../common/params";
import { SPANNER_DATABASE } from "../common/spanner_database";
import { Earnings, PayoutState } from "../db/schema";
import {
  getEarningsByMonth,
  insertEarningsStatement,
  insertPayoutTaskStatement,
} from "../db/sql";
import { Database } from "@google-cloud/spanner";
import { ReportEarningsHandlerInterface } from "@phading/commerce_service_interface/node/handler";
import {
  ReportEarningsRequestBody,
  ReportEarningsResponse,
} from "@phading/commerce_service_interface/node/interface";
import { ProductType } from "@phading/price";
import { calculateMoney } from "@phading/price_config/calculator";

export class ReportEarningsHandler extends ReportEarningsHandlerInterface {
  public static create(): ReportEarningsHandler {
    return new ReportEarningsHandler(
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
    body: ReportEarningsRequestBody,
  ): Promise<ReportEarningsResponse> {
    await this.database.runTransactionAsync(async (transaction) => {
      let earningsRows = await getEarningsByMonth(
        transaction,
        body.accountId,
        body.month,
      );
      if (earningsRows.length > 0) {
        return;
      }

      let now = this.getNow();
      let earnings: Earnings = {
        accountId: body.accountId,
        earningsId: this.generateUuid(),
        month: body.month,
        currency: CURRENCY,
        state: PayoutState.PROCESSING,
        createdTimeMs: now,
        items: [],
      };
      if (body.watchTimeSec) {
        earnings.items.push({
          productType: ProductType.SHOW_PAYOUT,
          quantity: body.watchTimeSec,
          amount: calculateMoney(
            ProductType.SHOW_PAYOUT,
            CURRENCY,
            body.month,
            body.watchTimeSec,
          ).amount,
        });
      }
      earnings.totalAmount = earnings.items.reduce(
        (total, item) => total + item.amount,
        0,
      );
      await transaction.batchUpdate([
        insertEarningsStatement(earnings),
        insertPayoutTaskStatement(earnings.earningsId, now, now),
      ]);
      await transaction.commit();
    });
    return {};
  }
}
