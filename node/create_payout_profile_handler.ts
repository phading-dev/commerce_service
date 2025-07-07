import crypto = require("crypto");
import { SPANNER_DATABASE } from "../common/spanner_database";
import {
  getPayoutProfile,
  insertPayoutProfileStatement,
  insertStripeConnectedAccountForPayoutCreatingTaskStatement,
} from "../db/sql";
import { Database } from "@google-cloud/spanner";
import { CreatePayoutProfileHandlerInterface } from "@phading/commerce_service_interface/node/handler";
import {
  CreatePayoutProfileRequestBody,
  CreatePayoutProfileResponse,
} from "@phading/commerce_service_interface/node/interface";

export class CreatePayoutProfileHandler extends CreatePayoutProfileHandlerInterface {
  public static create(): CreatePayoutProfileHandler {
    return new CreatePayoutProfileHandler(
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
    body: CreatePayoutProfileRequestBody,
  ): Promise<CreatePayoutProfileResponse> {
    await this.database.runTransactionAsync(async (transaction) => {
      let rows = await getPayoutProfile(transaction, {
        payoutProfileAccountIdEq: body.accountId,
      });
      if (rows.length > 0) {
        return;
      }
      let now = this.getNow();
      await transaction.batchUpdate([
        insertPayoutProfileStatement({
          accountId: body.accountId,
          createdTimeMs: now,
        }),
        insertStripeConnectedAccountForPayoutCreatingTaskStatement({
          taskId: this.generateUuid(),
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
