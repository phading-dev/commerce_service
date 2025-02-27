import { SPANNER_DATABASE } from "../common/spanner_database";
import {
  getEarningsAccount,
  insertEarningsAccountStatement,
  insertStripeConnectedAccountCreatingTaskStatement,
} from "../db/sql";
import { Database } from "@google-cloud/spanner";
import { CreateEarningsAccountHandlerInterface } from "@phading/commerce_service_interface/node/handler";
import {
  CreateEarningsAccountRequestBody,
  CreateEarningsAccountResponse,
} from "@phading/commerce_service_interface/node/interface";

export class CreateEarningsAccountHandler extends CreateEarningsAccountHandlerInterface {
  public static create(): CreateEarningsAccountHandler {
    return new CreateEarningsAccountHandler(SPANNER_DATABASE, () => Date.now());
  }

  public constructor(
    private database: Database,
    private getNow: () => number,
  ) {
    super();
  }

  public async handle(
    loggingPrefix: string,
    body: CreateEarningsAccountRequestBody,
  ): Promise<CreateEarningsAccountResponse> {
    await this.database.runTransactionAsync(async (transaction) => {
      let accountRows = await getEarningsAccount(transaction, body.accountId);
      if (accountRows.length > 0) {
        return;
      }
      let now = this.getNow();
      await transaction.batchUpdate([
        insertEarningsAccountStatement({
          accountId: body.accountId,
        }),
        insertStripeConnectedAccountCreatingTaskStatement(
          body.accountId,
          0,
          now,
          now,
        ),
      ]);
      await transaction.commit();
    });
    return {};
  }
}
