import { SERVICE_CLIENT } from "../common/service_client";
import { SPANNER_DATABASE } from "../common/spanner_database";
import { BillingAccountState } from "../db/schema";
import {
  deleteBillingAccountStateSyncingTaskStatement,
  getBillingAccount,
  updateBillingAccountStateSyncingTaskStatement,
} from "../db/sql";
import { Database } from "@google-cloud/spanner";
import { ProcessBillingAccountStateSyncingTaskHandlerInterface } from "@phading/commerce_service_interface/node/handler";
import {
  ProcessBillingAccountStateSyncingTaskRequestBody,
  ProcessBillingAccountStateSyncingTaskResponse,
} from "@phading/commerce_service_interface/node/interface";
import { BillingAccountState as UserServiceBillingAccountState } from "@phading/user_service_interface/node/billing_account_state";
import { syncBillingAccountState } from "@phading/user_service_interface/node/client";
import {
  newBadRequestError,
  newInternalServerErrorError,
} from "@selfage/http_error";
import { NodeServiceClient } from "@selfage/node_service_client";

export class ProcessBillingAccountStateSyncingTaskHandler extends ProcessBillingAccountStateSyncingTaskHandlerInterface {
  public static create(): ProcessBillingAccountStateSyncingTaskHandler {
    return new ProcessBillingAccountStateSyncingTaskHandler(
      SPANNER_DATABASE,
      SERVICE_CLIENT,
      () => Date.now(),
    );
  }

  private static RETRY_BACKOFF_MS = 5 * 60 * 1000;
  public doneCallbackFn: () => void = () => {};

  public constructor(
    private database: Database,
    private serviceClient: NodeServiceClient,
    private getNow: () => number,
  ) {
    super();
  }

  public async handle(
    loggingPrefix: string,
    body: ProcessBillingAccountStateSyncingTaskRequestBody,
  ): Promise<ProcessBillingAccountStateSyncingTaskResponse> {
    await this.database.runTransactionAsync(async (transaction) => {
      await transaction.batchUpdate([
        updateBillingAccountStateSyncingTaskStatement(
          body.accountId,
          body.version,
          this.getNow() +
            ProcessBillingAccountStateSyncingTaskHandler.RETRY_BACKOFF_MS,
        ),
      ]);
      await transaction.commit();
    });
    this.startProcessingAndCatchError(
      loggingPrefix,
      body.accountId,
      body.version,
    );
    return {};
  }

  private async startProcessingAndCatchError(
    loggingPrefix: string,
    accountId: string,
    version: number,
  ): Promise<void> {
    try {
      let rows = await getBillingAccount(this.database, accountId);
      if (rows.length === 0) {
        throw newInternalServerErrorError(`Account ${accountId} is not found.`);
      }
      let account = rows[0].billingAccountData;
      if (account.stateInfo.version !== version) {
        throw newBadRequestError(
          `Account ${accountId} version is ${account.stateInfo.version} which doesn't match ${version}.`,
        );
      }
      let stateInfo = account.stateInfo;
      await syncBillingAccountState(this.serviceClient, {
        accountId,
        billingAccountStateVersion: stateInfo.version,
        billingAccountState: this.convertState(stateInfo.state),
      });
      await this.database.runTransactionAsync(async (transaction) => {
        await transaction.batchUpdate([
          deleteBillingAccountStateSyncingTaskStatement(
            accountId,
            stateInfo.version,
          ),
        ]);
        await transaction.commit();
      });
    } catch (e) {
      console.log(
        `${loggingPrefix} For account ${accountId}, failed to sync the state of version ${version}. ${e.stack ?? e}`,
      );
    }
    this.doneCallbackFn();
  }

  private convertState(
    state: BillingAccountState,
  ): UserServiceBillingAccountState {
    switch (state) {
      case BillingAccountState.HEALTHY:
        return UserServiceBillingAccountState.HEALTHY;
      case BillingAccountState.SUSPENDED:
        return UserServiceBillingAccountState.SUSPENDED;
      default:
        throw new Error(`Unknown state: ${BillingAccountState[state]}`);
    }
  }
}
