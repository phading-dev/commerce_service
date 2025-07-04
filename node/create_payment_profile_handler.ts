import { SPANNER_DATABASE } from "../common/spanner_database";
import { PaymentProfileState } from "../db/schema";
import {
  getPaymentProfile,
  insertPaymentProfileStatement,
  insertStripePaymentCustomerCreatingTaskStatement,
} from "../db/sql";
import { ENV_VARS } from "../env_vars";
import { Database } from "@google-cloud/spanner";
import { CreatePaymentProfileHandlerInterface } from "@phading/commerce_service_interface/node/handler";
import {
  CreatePaymentProfileRequestBody,
  CreatePaymentProfileResponse,
} from "@phading/commerce_service_interface/node/interface";
import { TzDate } from "@selfage/tz_date";

export class CreatePaymentProfileHandler extends CreatePaymentProfileHandlerInterface {
  public static create(): CreatePaymentProfileHandler {
    return new CreatePaymentProfileHandler(SPANNER_DATABASE, () => Date.now());
  }

  private static DELAYED_PAYMENT_MS = 20 * 24 * 60 * 60 * 1000; // 20 days

  public constructor(
    private database: Database,
    private getNow: () => number,
  ) {
    super();
  }

  public async handle(
    loggingPrefix: string,
    body: CreatePaymentProfileRequestBody,
  ): Promise<CreatePaymentProfileResponse> {
    await this.database.runTransactionAsync(async (transaction) => {
      let rows = await getPaymentProfile(transaction, {
        paymentProfileAccountIdEq: body.accountId,
      });
      if (rows.length > 0) {
        return;
      }
      let now = this.getNow();
      let firstPaymentTimeMs = TzDate.fromTimestampMs(
        now + CreatePaymentProfileHandler.DELAYED_PAYMENT_MS,
        ENV_VARS.timezoneNegativeOffset,
      )
        .moveToFirstDayOfMonth()
        .addMonths(1)
        .toTimestampMs();
      await transaction.batchUpdate([
        insertPaymentProfileStatement({
          accountId: body.accountId,
          stateInfo: {
            version: 0,
            state: PaymentProfileState.HEALTHY,
            updatedTimeMs: now,
          },
          firstPaymentTimeMs,
          createdTimeMs: now,
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
