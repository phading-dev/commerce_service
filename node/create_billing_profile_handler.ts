import { SPANNER_DATABASE } from "../common/spanner_database";
import { BillingProfileState } from "../db/schema";
import {
  getBillingProfile,
  insertBillingProfileStatement,
  insertStripePaymentCustomerCreatingTaskStatement,
} from "../db/sql";
import { Database } from "@google-cloud/spanner";
import { CreateBillingProfileHandlerInterface } from "@phading/commerce_service_interface/node/handler";
import {
  CreateBillingProfileRequestBody,
  CreateBillingProfileResponse,
} from "@phading/commerce_service_interface/node/interface";

export class CreateBillingProfileHandler extends CreateBillingProfileHandlerInterface {
  public static create(): CreateBillingProfileHandler {
    return new CreateBillingProfileHandler(SPANNER_DATABASE, () => Date.now());
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
    body: CreateBillingProfileRequestBody,
  ): Promise<CreateBillingProfileResponse> {
    await this.database.runTransactionAsync(async (transaction) => {
      let rows = await getBillingProfile(transaction, {
        billingProfileAccountIdEq: body.accountId,
      });
      if (rows.length > 0) {
        return;
      }
      let now = this.getNow();
      await transaction.batchUpdate([
        insertBillingProfileStatement({
          accountId: body.accountId,
          stateInfo: {
            version: 0,
            state: BillingProfileState.HEALTHY,
            updatedTimeMs: now,
          },
          paymentAfterMs: now + CreateBillingProfileHandler.DELAYED_PAYMENT_MS,
        }),
        insertStripePaymentCustomerCreatingTaskStatement({
          accountId: body.accountId,
          retryCount: 0,
          executionTimeMs: now,
          createdTimeMs: now,
        }),
      ]);
      await transaction.commit();
    });
    return {};
  }
}
