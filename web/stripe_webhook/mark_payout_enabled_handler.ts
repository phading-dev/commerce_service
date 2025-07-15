import crypto from "crypto";
import getStream from "get-stream";
import Stripe from "stripe";
import { CONNECTED_ACCOUNT_METADATA_ACCOUNT_ID_KEY } from "../../common/constants";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import { STRIPE_CLIENT } from "../../common/stripe_client";
import { PayoutState, StripeConnectedAccountState } from "../../db/schema";
import {
  getPayoutProfile,
  insertPayoutStripeTransferCreatingTaskStatement,
  listPayoutsByState,
  updatePayoutProfileConnectedAccountStateStatement,
  updatePayoutStateStatement,
} from "../../db/sql";
import { Database } from "@google-cloud/spanner";
import { Statement } from "@google-cloud/spanner/build/src/transaction";
import { MarkPayoutEnabledHandlerInterface } from "@phading/commerce_service_interface/web/stripe_webhook/handler";
import { Empty } from "@phading/commerce_service_interface/web/stripe_webhook/interface";
import {
  newBadRequestError,
  newInternalServerErrorError,
} from "@selfage/http_error";
import { Ref } from "@selfage/ref";
import { Readable } from "stream";

export class MarkPayoutEnabledHandler extends MarkPayoutEnabledHandlerInterface {
  public static create(
    stripeMarkPayoutEnabledSecretKey: string,
  ): MarkPayoutEnabledHandler {
    return new MarkPayoutEnabledHandler(
      SPANNER_DATABASE,
      STRIPE_CLIENT,
      () => crypto.randomUUID(),
      () => Date.now(),
      stripeMarkPayoutEnabledSecretKey,
    );
  }

  public constructor(
    private database: Database,
    private stripeClient: Ref<Stripe>,
    private generateUuid: () => string,
    private getNow: () => number,
    private stripeSecretKey: string,
  ) {
    super();
  }

  public async handle(
    loggingPrefix: string,
    body: Readable,
    authStr: string,
  ): Promise<Empty> {
    let event = this.stripeClient.val.webhooks.constructEvent(
      await getStream(body),
      authStr,
      this.stripeSecretKey,
    );
    if (event.type !== "account.updated") {
      throw newBadRequestError(
        `Expecting account.updated event, but got ${event.type}.`,
      );
    }
    if (event.data.previous_attributes.payouts_enabled === undefined) {
      return {};
    }
    if (!event.data.object.payouts_enabled) {
      return {};
    }
    let accountId =
      event.data.object.metadata[CONNECTED_ACCOUNT_METADATA_ACCOUNT_ID_KEY];
    await this.database.runTransactionAsync(async (transaction) => {
      let [profileRows, payoutRows] = await Promise.all([
        getPayoutProfile(transaction, {
          payoutProfileAccountIdEq: accountId,
        }),
        listPayoutsByState(transaction, {
          payoutAccountIdEq: accountId,
          payoutStateEq: PayoutState.DISABLED,
        }),
      ]);
      if (profileRows.length === 0) {
        throw newInternalServerErrorError(
          `Payout profile ${accountId} is not found.`,
        );
      }
      let statements: Array<Statement> = [
        updatePayoutProfileConnectedAccountStateStatement({
          payoutProfileAccountIdEq: accountId,
          setStripeConnectedAccountState: StripeConnectedAccountState.ONBOARDED,
        }),
      ];
      let now = this.getNow();
      payoutRows.forEach((payout) => {
        statements.push(
          updatePayoutStateStatement({
            payoutStatementIdEq: payout.payoutStatementId,
            setState: PayoutState.PROCESSING,
            setUpdatedTimeMs: now,
          }),
          insertPayoutStripeTransferCreatingTaskStatement({
            taskId: this.generateUuid(),
            statementId: payout.payoutStatementId,
            retryCount: 0,
            executionTimeMs: now,
            createdTimeMs: now,
          }),
        );
      });
      await transaction.batchUpdate(statements);
      await transaction.commit();
    });
    return {};
  }
}
