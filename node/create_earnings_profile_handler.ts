import { SPANNER_DATABASE } from "../common/spanner_database";
import {
  getEarningsProfile,
  insertEarningsProfileStatement,
  insertStripeConnectedAccountCreatingTaskStatement,
} from "../db/sql";
import { Database } from "@google-cloud/spanner";
import { CreateEarningsProfileHandlerInterface } from "@phading/commerce_service_interface/node/handler";
import {
  CreateEarningsProfileRequestBody,
  CreateEarningsProfileResponse,
} from "@phading/commerce_service_interface/node/interface";

export class CreateEarningsProfileHandler extends CreateEarningsProfileHandlerInterface {
  public static create(): CreateEarningsProfileHandler {
    return new CreateEarningsProfileHandler(SPANNER_DATABASE, () => Date.now());
  }

  public constructor(
    private database: Database,
    private getNow: () => number,
  ) {
    super();
  }

  public async handle(
    loggingPrefix: string,
    body: CreateEarningsProfileRequestBody,
  ): Promise<CreateEarningsProfileResponse> {
    await this.database.runTransactionAsync(async (transaction) => {
      let rows = await getEarningsProfile(transaction, {
        earningsProfileAccountIdEq: body.accountId,
      });
      if (rows.length > 0) {
        return;
      }
      let now = this.getNow();
      await transaction.batchUpdate([
        insertEarningsProfileStatement({
          accountId: body.accountId,
          createdTimeMs: now,
        }),
        insertStripeConnectedAccountCreatingTaskStatement({
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
