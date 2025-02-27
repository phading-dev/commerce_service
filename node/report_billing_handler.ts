import { CURRENCY } from "../common/constants";
import { SPANNER_DATABASE } from "../common/spanner_database";
import { Billing, PaymentState } from "../db/schema";
import {
  getBillingAccount,
  getBillingByMonth,
  insertBillingStatement,
  insertPaymentTaskStatement,
} from "../db/sql";
import { Database } from "@google-cloud/spanner";
import { ReportBillingHandlerInterface } from "@phading/commerce_service_interface/node/handler";
import {
  ReportBillingRequestBody,
  ReportBillingResponse,
} from "@phading/commerce_service_interface/node/interface";
import { ProductType } from "@phading/price";
import { calculateMoney } from "@phading/price_config/calculator";

export class ReportBillingHandler extends ReportBillingHandlerInterface {
  public static create(): ReportBillingHandler {
    return new ReportBillingHandler(
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
    body: ReportBillingRequestBody,
  ): Promise<ReportBillingResponse> {
    await this.database.runTransactionAsync(async (transaction) => {
      let [accountRows, billingRows] = await Promise.all([
        getBillingAccount(transaction, body.accountId),
        getBillingByMonth(transaction, body.accountId, body.month),
      ]);
      if (billingRows.length > 0) {
        return;
      }

      let now = this.getNow();
      let billing: Billing = {
        accountId: body.accountId,
        billingId: this.generateUuid(),
        month: body.month,
        currency: CURRENCY,
        state: PaymentState.PROCESSING,
        createdTimeMs: now,
        items: [],
      };
      if (body.watchTimeSec) {
        billing.items.push({
          productType: ProductType.SHOW,
          quantity: body.watchTimeSec,
          amount: calculateMoney(
            ProductType.SHOW,
            CURRENCY,
            body.month,
            body.watchTimeSec,
          ).amount,
        });
      }
      if (body.uploadedMb) {
        billing.items.push({
          productType: ProductType.UPLAOD,
          quantity: body.uploadedMb,
          amount: calculateMoney(
            ProductType.UPLAOD,
            CURRENCY,
            body.month,
            body.uploadedMb,
          ).amount,
        });
      }
      if (body.storageMbh) {
        billing.items.push({
          productType: ProductType.STORAGE,
          quantity: body.storageMbh,
          amount: calculateMoney(
            ProductType.STORAGE,
            CURRENCY,
            body.month,
            body.storageMbh,
          ).amount,
        });
      }
      if (body.transmittedMb) {
        billing.items.push({
          productType: ProductType.NETWORK,
          quantity: body.transmittedMb,
          amount: calculateMoney(
            ProductType.NETWORK,
            CURRENCY,
            body.month,
            body.transmittedMb,
          ).amount,
        });
      }
      billing.totalAmount = billing.items.reduce(
        (total, item) => total + item.amount,
        0,
      );

      let account = accountRows[0].billingAccountData;
      await transaction.batchUpdate([
        insertBillingStatement(billing),
        insertPaymentTaskStatement(
          billing.billingId,
          0,
          account.paymentAfterMs > now ? account.paymentAfterMs : now,
          now,
        ),
      ]);
      await transaction.commit();
    });
    return {};
  }
}
