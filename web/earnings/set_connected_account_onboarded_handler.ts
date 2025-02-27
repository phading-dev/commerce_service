import { SERVICE_CLIENT } from "../../common/service_client";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import { PayoutState, StripeConnectedAccountState } from "../../db/schema";
import {
  getEarningsAccount,
  insertPayoutTaskStatement,
  listEarningsByState,
  updateEarningsAccountStatement,
  updateEarningsStatement,
} from "../../db/sql";
import { Database } from "@google-cloud/spanner";
import { Statement } from "@google-cloud/spanner/build/src/transaction";
import { SetConnectedAccountOnboardedHandlerInterface } from "@phading/commerce_service_interface/web/earnings/handler";
import {
  SetConnectedAccountOnboardedRequestBody,
  SetConnectedAccountOnboardedResponse,
} from "@phading/commerce_service_interface/web/earnings/interface";
import { newExchangeSessionAndCheckCapabilityRequest } from "@phading/user_session_service_interface/node/client";
import {
  newInternalServerErrorError,
  newUnauthorizedError,
} from "@selfage/http_error";
import { NodeServiceClient } from "@selfage/node_service_client";

export class SetConnectedAccountOnboardedHandler extends SetConnectedAccountOnboardedHandlerInterface {
  public static create(): SetConnectedAccountOnboardedHandler {
    return new SetConnectedAccountOnboardedHandler(
      SPANNER_DATABASE,
      SERVICE_CLIENT,
      () => Date.now(),
    );
  }

  public constructor(
    private database: Database,
    private serviceClient: NodeServiceClient,
    private getNow: () => number,
  ) {
    super();
  }

  public async handle(
    loggingPrefix: string,
    body: SetConnectedAccountOnboardedRequestBody,
    sessionStr: string,
  ): Promise<SetConnectedAccountOnboardedResponse> {
    let { accountId, capabilities } = await this.serviceClient.send(
      newExchangeSessionAndCheckCapabilityRequest({
        signedSession: sessionStr,
        capabilitiesMask: {
          checkCanEarn: true,
        },
      }),
    );
    if (accountId !== body.accountId) {
      throw newUnauthorizedError(
        `Account ${body.accountId} cannot be updated by logged-in account ${accountId}.`,
      );
    }
    if (!capabilities.canEarn) {
      throw newUnauthorizedError(
        `Account ${accountId} cannot set connected account onboarded.`,
      );
    }
    await this.database.runTransactionAsync(async (transaction) => {
      let [accountRows, earningsRows] = await Promise.all([
        getEarningsAccount(transaction, accountId),
        listEarningsByState(transaction, accountId, PayoutState.FAILED),
      ]);
      if (accountRows.length === 0) {
        throw newInternalServerErrorError(
          `Earnings account ${accountId} is not found.`,
        );
      }
      let account = accountRows[0].earningsAccountData;
      account.stripeConnectedAccountState =
        StripeConnectedAccountState.ONBOARDED;
      let statements: Array<Statement> = [
        updateEarningsAccountStatement(account),
      ];
      let now = this.getNow();
      earningsRows.forEach((row) => {
        let earnings = row.earningsData;
        earnings.state = PayoutState.PROCESSING;
        statements.push(
          updateEarningsStatement(earnings),
          insertPayoutTaskStatement(earnings.earningsId, 0, now, now),
        );
      });
      await transaction.batchUpdate(statements);
      await transaction.commit();
    });
    return {};
  }
}
