import { SERVICE_CLIENT } from "../common/service_client";
import { SPANNER_DATABASE } from "../common/spanner_database";
import { BillingAccountState } from "../db/schema";
import {
  deleteBillingAccountStateSyncingTaskStatement,
  getBillingAccount,
  getBillingAccountStateSyncingTaskMetadata,
  updateBillingAccountStateSyncingTaskMetadataStatement,
} from "../db/sql";
import { Database } from "@google-cloud/spanner";
import { ProcessBillingAccountStateSyncingTaskHandlerInterface } from "@phading/commerce_service_interface/node/handler";
import {
  ProcessBillingAccountStateSyncingTaskRequestBody,
  ProcessBillingAccountStateSyncingTaskResponse,
} from "@phading/commerce_service_interface/node/interface";
import { BillingAccountState as UserServiceBillingAccountState } from "@phading/user_service_interface/node/billing_account_state";
import { newSyncBillingAccountStateRequest } from "@phading/user_service_interface/node/client";
import {
  newBadRequestError,
  newInternalServerErrorError,
} from "@selfage/http_error";
import { NodeServiceClient } from "@selfage/node_service_client";
import { ProcessTaskHandlerWrapper } from "@selfage/service_handler/process_task_handler_wrapper";

export class ProcessBillingAccountStateSyncingTaskHandler extends ProcessBillingAccountStateSyncingTaskHandlerInterface {
  public static create(): ProcessBillingAccountStateSyncingTaskHandler {
    return new ProcessBillingAccountStateSyncingTaskHandler(
      SPANNER_DATABASE,
      SERVICE_CLIENT,
      () => Date.now(),
    );
  }

  private taskHandler: ProcessTaskHandlerWrapper;

  public constructor(
    private database: Database,
    private serviceClient: NodeServiceClient,
    private getNow: () => number,
  ) {
    super();
    this.taskHandler = ProcessTaskHandlerWrapper.create(
      this.descriptor,
      5 * 60 * 1000,
      24 * 60 * 60 * 1000,
    );
  }

  public async handle(
    loggingPrefix: string,
    body: ProcessBillingAccountStateSyncingTaskRequestBody,
  ): Promise<ProcessBillingAccountStateSyncingTaskResponse> {
    loggingPrefix = `${loggingPrefix} Billing account state syncing task for account ${body.accountId} version ${body.version}:`;
    await this.taskHandler.wrap(
      loggingPrefix,
      () => this.claimTask(loggingPrefix, body),
      () => this.processTask(loggingPrefix, body),
    );
    return {};
  }

  public async claimTask(
    loggingPrefix: string,
    body: ProcessBillingAccountStateSyncingTaskRequestBody,
  ): Promise<void> {
    await this.database.runTransactionAsync(async (transaction) => {
      let rows = await getBillingAccountStateSyncingTaskMetadata(
        transaction,
        body.accountId,
        body.version,
      );
      if (rows.length === 0) {
        throw newBadRequestError(`Task is not found.`);
      }
      let task = rows[0];
      await transaction.batchUpdate([
        updateBillingAccountStateSyncingTaskMetadataStatement(
          body.accountId,
          body.version,
          task.billingAccountStateSyncingTaskRetryCount + 1,
          this.getNow() +
            this.taskHandler.getBackoffTime(
              task.billingAccountStateSyncingTaskRetryCount,
            ),
        ),
      ]);
      await transaction.commit();
    });
  }

  public async processTask(
    loggingPrefix: string,
    body: ProcessBillingAccountStateSyncingTaskRequestBody,
  ): Promise<void> {
    let rows = await getBillingAccount(this.database, body.accountId);
    if (rows.length === 0) {
      throw newInternalServerErrorError(
        `Billing account ${body.accountId} is not found.`,
      );
    }
    let account = rows[0].billingAccountData;
    if (account.stateInfo.version !== body.version) {
      throw newBadRequestError(
        `Billing account ${body.accountId} version is ${account.stateInfo.version} which doesn't match task version ${body.version}.`,
      );
    }
    let stateInfo = account.stateInfo;
    await this.serviceClient.send(
      newSyncBillingAccountStateRequest({
        accountId: body.accountId,
        billingAccountStateVersion: stateInfo.version,
        billingAccountState: this.convertState(stateInfo.state),
      }),
    );
    await this.database.runTransactionAsync(async (transaction) => {
      await transaction.batchUpdate([
        deleteBillingAccountStateSyncingTaskStatement(
          body.accountId,
          stateInfo.version,
        ),
      ]);
      await transaction.commit();
    });
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
