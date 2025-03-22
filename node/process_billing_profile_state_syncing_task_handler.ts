import { SERVICE_CLIENT } from "../common/service_client";
import { SPANNER_DATABASE } from "../common/spanner_database";
import { BillingProfileState } from "../db/schema";
import {
  deleteBillingProfileStateSyncingTaskStatement,
  getBillingProfile,
  getBillingProfileStateSyncingTaskMetadata,
  updateBillingProfileStateSyncingTaskMetadataStatement,
} from "../db/sql";
import { Database } from "@google-cloud/spanner";
import { ProcessBillingProfileStateSyncingTaskHandlerInterface } from "@phading/commerce_service_interface/node/handler";
import {
  ProcessBillingProfileStateSyncingTaskRequestBody,
  ProcessBillingProfileStateSyncingTaskResponse,
} from "@phading/commerce_service_interface/node/interface";
import { BillingProfileState as UserServiceBillingProfileState } from "@phading/user_service_interface/node/billing_profile_state";
import { newSyncBillingProfileStateRequest } from "@phading/user_service_interface/node/client";
import {
  newBadRequestError,
  newInternalServerErrorError,
} from "@selfage/http_error";
import { NodeServiceClient } from "@selfage/node_service_client";
import { ProcessTaskHandlerWrapper } from "@selfage/service_handler/process_task_handler_wrapper";

export class ProcessBillingProfileStateSyncingTaskHandler extends ProcessBillingProfileStateSyncingTaskHandlerInterface {
  public static create(): ProcessBillingProfileStateSyncingTaskHandler {
    return new ProcessBillingProfileStateSyncingTaskHandler(
      SPANNER_DATABASE,
      SERVICE_CLIENT,
      () => Date.now(),
    );
  }

  private taskHandler = ProcessTaskHandlerWrapper.create(
    this.descriptor,
    5 * 60 * 1000,
    24 * 60 * 60 * 1000,
  );

  public constructor(
    private database: Database,
    private serviceClient: NodeServiceClient,
    private getNow: () => number,
  ) {
    super();
  }

  public async handle(
    loggingPrefix: string,
    body: ProcessBillingProfileStateSyncingTaskRequestBody,
  ): Promise<ProcessBillingProfileStateSyncingTaskResponse> {
    loggingPrefix = `${loggingPrefix} Billing profile state syncing task for account ${body.accountId} version ${body.version}:`;
    await this.taskHandler.wrap(
      loggingPrefix,
      () => this.claimTask(loggingPrefix, body),
      () => this.processTask(loggingPrefix, body),
    );
    return {};
  }

  public async claimTask(
    loggingPrefix: string,
    body: ProcessBillingProfileStateSyncingTaskRequestBody,
  ): Promise<void> {
    await this.database.runTransactionAsync(async (transaction) => {
      let rows = await getBillingProfileStateSyncingTaskMetadata(transaction, {
        billingProfileStateSyncingTaskAccountIdEq: body.accountId,
        billingProfileStateSyncingTaskVersionEq: body.version,
      });
      if (rows.length === 0) {
        throw newBadRequestError(`Task is not found.`);
      }
      let task = rows[0];
      await transaction.batchUpdate([
        updateBillingProfileStateSyncingTaskMetadataStatement({
          billingProfileStateSyncingTaskAccountIdEq: body.accountId,
          billingProfileStateSyncingTaskVersionEq: body.version,
          setRetryCount: task.billingProfileStateSyncingTaskRetryCount + 1,
          setExecutionTimeMs:
            this.getNow() +
            this.taskHandler.getBackoffTime(
              task.billingProfileStateSyncingTaskRetryCount,
            ),
        }),
      ]);
      await transaction.commit();
    });
  }

  public async processTask(
    loggingPrefix: string,
    body: ProcessBillingProfileStateSyncingTaskRequestBody,
  ): Promise<void> {
    let rows = await getBillingProfile(this.database, {
      billingProfileAccountIdEq: body.accountId,
    });
    if (rows.length === 0) {
      throw newInternalServerErrorError(
        `Billing profile ${body.accountId} is not found.`,
      );
    }
    let row = rows[0];
    if (row.billingProfileStateInfo.version !== body.version) {
      throw newBadRequestError(
        `Billing profile ${body.accountId} version is ${row.billingProfileStateInfo.version} which doesn't match task version ${body.version}.`,
      );
    }
    await this.serviceClient.send(
      newSyncBillingProfileStateRequest({
        accountId: body.accountId,
        billingProfileStateVersion: row.billingProfileStateInfo.version,
        billingProfileState: this.convertState(
          row.billingProfileStateInfo.state,
        ),
      }),
    );
    await this.database.runTransactionAsync(async (transaction) => {
      await transaction.batchUpdate([
        deleteBillingProfileStateSyncingTaskStatement({
          billingProfileStateSyncingTaskAccountIdEq: body.accountId,
          billingProfileStateSyncingTaskVersionEq:
            row.billingProfileStateInfo.version,
        }),
      ]);
      await transaction.commit();
    });
  }

  private convertState(
    state: BillingProfileState,
  ): UserServiceBillingProfileState {
    switch (state) {
      case BillingProfileState.HEALTHY:
        return UserServiceBillingProfileState.HEALTHY;
      case BillingProfileState.SUSPENDED:
        return UserServiceBillingProfileState.SUSPENDED;
      default:
        throw new Error(`Unknown state: ${BillingProfileState[state]}`);
    }
  }
}
