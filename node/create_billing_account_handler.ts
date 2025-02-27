import { SPANNER_DATABASE } from "../common/spanner_database";
import { BillingAccountState } from "../db/schema";
import {
  getBillingAccount,
  insertBillingAccountStatement,
  insertStripeCustomerCreatingTaskStatement,
} from "../db/sql";
import { Database } from "@google-cloud/spanner";
import { CreateBillingAccountHandlerInterface } from "@phading/commerce_service_interface/node/handler";
import {
  CreateBillingAccountRequestBody,
  CreateBillingAccountResponse,
} from "@phading/commerce_service_interface/node/interface";

export class CreateBillingAccountHandler extends CreateBillingAccountHandlerInterface {
  public static create(): CreateBillingAccountHandler {
    return new CreateBillingAccountHandler(SPANNER_DATABASE, () => Date.now());
  }

  private static DELAYED_PAYMENT_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

  public constructor(
    private database: Database,
    private getNow: () => number,
  ) {
    super();
  }

  public async handle(
    loggingPrefix: string,
    body: CreateBillingAccountRequestBody,
  ): Promise<CreateBillingAccountResponse> {
    await this.database.runTransactionAsync(async (transaction) => {
      let accountRows = await getBillingAccount(transaction, body.accountId);
      if (accountRows.length > 0) {
        return;
      }
      let now = this.getNow();
      await transaction.batchUpdate([
        insertBillingAccountStatement({
          accountId: body.accountId,
          stateInfo: {
            version: 0,
            state: BillingAccountState.HEALTHY,
            updatedTimeMs: now,
          },
          paymentAfterMs: now + CreateBillingAccountHandler.DELAYED_PAYMENT_MS,
        }),
        insertStripeCustomerCreatingTaskStatement(body.accountId, 0, now, now),
      ]);
      await transaction.commit();
    });
    return {};
  }
}
