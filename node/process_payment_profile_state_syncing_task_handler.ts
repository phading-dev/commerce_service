import { SERVICE_CLIENT } from "../common/service_client";
import { SPANNER_DATABASE } from "../common/spanner_database";
import { PaymentProfileState } from "../db/schema";
import {
  deletePaymentProfileStateSyncingTaskStatement,
  getPaymentProfile,
  getPaymentProfileStateSyncingTaskMetadata,
  updatePaymentProfileStateSyncingTaskMetadataStatement,
} from "../db/sql";
import { Database } from "@google-cloud/spanner";
import { ProcessPaymentProfileStateSyncingTaskHandlerInterface } from "@phading/commerce_service_interface/node/handler";
import {
  ProcessPaymentProfileStateSyncingTaskRequestBody,
  ProcessPaymentProfileStateSyncingTaskResponse,
} from "@phading/commerce_service_interface/node/interface";
import { newSyncPaymentProfileStateRequest } from "@phading/user_service_interface/node/client";
import { PaymentProfileState as UserServicePaymentProfileState } from "@phading/user_service_interface/node/payment_profile_state";
import {
  newBadRequestError,
  newInternalServerErrorError,
} from "@selfage/http_error";
import { NodeServiceClient } from "@selfage/node_service_client";
import { ProcessTaskHandlerWrapper } from "@selfage/service_handler/process_task_handler_wrapper";

export class ProcessPaymentProfileStateSyncingTaskHandler extends ProcessPaymentProfileStateSyncingTaskHandlerInterface {
  public static create(): ProcessPaymentProfileStateSyncingTaskHandler {
    return new ProcessPaymentProfileStateSyncingTaskHandler(
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
    body: ProcessPaymentProfileStateSyncingTaskRequestBody,
  ): Promise<ProcessPaymentProfileStateSyncingTaskResponse> {
    loggingPrefix = `${loggingPrefix} Payment profile state syncing task for account ${body.accountId} version ${body.version}:`;
    await this.taskHandler.wrap(
      loggingPrefix,
      () => this.claimTask(loggingPrefix, body),
      () => this.processTask(loggingPrefix, body),
    );
    return {};
  }

  public async claimTask(
    loggingPrefix: string,
    body: ProcessPaymentProfileStateSyncingTaskRequestBody,
  ): Promise<void> {
    await this.database.runTransactionAsync(async (transaction) => {
      let rows = await getPaymentProfileStateSyncingTaskMetadata(transaction, {
        paymentProfileStateSyncingTaskAccountIdEq: body.accountId,
        paymentProfileStateSyncingTaskVersionEq: body.version,
      });
      if (rows.length === 0) {
        throw newBadRequestError(`Task is not found.`);
      }
      let task = rows[0];
      await transaction.batchUpdate([
        updatePaymentProfileStateSyncingTaskMetadataStatement({
          paymentProfileStateSyncingTaskAccountIdEq: body.accountId,
          paymentProfileStateSyncingTaskVersionEq: body.version,
          setRetryCount: task.paymentProfileStateSyncingTaskRetryCount + 1,
          setExecutionTimeMs:
            this.getNow() +
            this.taskHandler.getBackoffTime(
              task.paymentProfileStateSyncingTaskRetryCount,
            ),
        }),
      ]);
      await transaction.commit();
    });
  }

  public async processTask(
    loggingPrefix: string,
    body: ProcessPaymentProfileStateSyncingTaskRequestBody,
  ): Promise<void> {
    let rows = await getPaymentProfile(this.database, {
      paymentProfileAccountIdEq: body.accountId,
    });
    if (rows.length === 0) {
      throw newInternalServerErrorError(
        `Payment profile ${body.accountId} is not found.`,
      );
    }
    let row = rows[0];
    if (row.paymentProfileStateInfo.version !== body.version) {
      throw newBadRequestError(
        `Payment profile ${body.accountId} version is ${row.paymentProfileStateInfo.version} which doesn't match task version ${body.version}.`,
      );
    }
    await this.serviceClient.send(
      newSyncPaymentProfileStateRequest({
        accountId: body.accountId,
        paymentProfileStateVersion: row.paymentProfileStateInfo.version,
        paymentProfileState: this.convertState(
          row.paymentProfileStateInfo.state,
        ),
      }),
    );
    await this.database.runTransactionAsync(async (transaction) => {
      await transaction.batchUpdate([
        deletePaymentProfileStateSyncingTaskStatement({
          paymentProfileStateSyncingTaskAccountIdEq: body.accountId,
          paymentProfileStateSyncingTaskVersionEq:
            row.paymentProfileStateInfo.version,
        }),
      ]);
      await transaction.commit();
    });
  }

  private convertState(
    state: PaymentProfileState,
  ): UserServicePaymentProfileState {
    switch (state) {
      case PaymentProfileState.HEALTHY:
        return UserServicePaymentProfileState.HEALTHY;
      case PaymentProfileState.SUSPENDED:
        return UserServicePaymentProfileState.SUSPENDED;
      default:
        throw new Error(`Unknown state: ${PaymentProfileState[state]}`);
    }
  }
}
