import { SERVICE_CLIENT } from "../../common/service_client";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import { PayoutState, StripeConnectedAccountState } from "../../db/schema";
import {
  getEarningsProfile,
  insertPayoutTaskStatement,
  listPayoutsByState,
  updateEarningsProfileConnectedAccountStateStatement,
  updatePayoutStateStatement,
} from "../../db/sql";
import { Database } from "@google-cloud/spanner";
import { Statement } from "@google-cloud/spanner/build/src/transaction";
import { SetConnectedAccountOnboardedHandlerInterface } from "@phading/commerce_service_interface/web/earnings/handler";
import {
  SetConnectedAccountOnboardedRequestBody,
  SetConnectedAccountOnboardedResponse,
} from "@phading/commerce_service_interface/web/earnings/interface";
import { newFetchSessionAndCheckCapabilityRequest } from "@phading/user_session_service_interface/node/client";
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
      newFetchSessionAndCheckCapabilityRequest({
        signedSession: sessionStr,
        capabilitiesMask: {
          checkCanEarn: true,
        },
      }),
    );
    if (!capabilities.canEarn) {
      throw newUnauthorizedError(
        `Account ${accountId} is not allowed to set connected account onboarded.`,
      );
    }
    if (accountId !== body.accountId) {
      throw newUnauthorizedError(
        `Earnings profile ${body.accountId} cannot be updated by the logged-in account ${accountId}.`,
      );
    }
    await this.database.runTransactionAsync(async (transaction) => {
      let [profileRows, payoutRows] = await Promise.all([
        getEarningsProfile(transaction, {
          earningsProfileAccountIdEq: accountId,
        }),
        listPayoutsByState(transaction, {
          payoutAccountIdEq: accountId,
          payoutStateEq: PayoutState.FAILED,
        }),
      ]);
      if (profileRows.length === 0) {
        throw newInternalServerErrorError(
          `Earnings account ${accountId} is not found.`,
        );
      }
      let statements: Array<Statement> = [
        updateEarningsProfileConnectedAccountStateStatement({
          earningsProfileAccountIdEq: accountId,
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
          insertPayoutTaskStatement({
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
