import { SPANNER_DATABASE } from "../common/spanner_database";
import { InitCreditGrantingState, PaymentProfileState } from "../db/schema";
import {
  getPaymentProfile,
  insertPaymentProfileStatement,
  insertStripePaymentCustomerCreatingTaskStatement,
} from "../db/sql";
import { Database } from "@google-cloud/spanner";
import { CreatePaymentProfileHandlerInterface } from "@phading/commerce_service_interface/node/handler";
import {
  CreatePaymentProfileRequestBody,
  CreatePaymentProfileResponse,
} from "@phading/commerce_service_interface/node/interface";

export class CreatePaymentProfileHandler extends CreatePaymentProfileHandlerInterface {
  public static create(): CreatePaymentProfileHandler {
    return new CreatePaymentProfileHandler(SPANNER_DATABASE, () => Date.now());
  }

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
      await transaction.batchUpdate([
        insertPaymentProfileStatement({
          accountId: body.accountId,
          stateInfo: {
            version: 0,
            state: PaymentProfileState.HEALTHY,
            updatedTimeMs: now,
          },
          initCreditGrantingState: InitCreditGrantingState.NOT_GRANTED,
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
