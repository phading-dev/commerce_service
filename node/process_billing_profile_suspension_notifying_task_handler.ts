import { APP_NAME } from "../common/constants";
import { LOCALIZATION } from "../common/localization";
import { SENDGRID_CLIENT } from "../common/sendgrid_client";
import { SERVICE_CLIENT } from "../common/service_client";
import { SPANNER_DATABASE } from "../common/spanner_database";
import {
  deleteBillingProfileSuspensionNotifyingTaskStatement,
  getBillingProfileSuspensionNotifyingTaskMetadata,
  updateBillingProfileSuspensionNotifyingTaskMetadataStatement,
} from "../db/sql";
import { ENV_VARS } from "../env_vars";
import { Database } from "@google-cloud/spanner";
import { ProcessBillingProfileSuspensionNotifyingTaskHandlerInterface } from "@phading/commerce_service_interface/node/handler";
import {
  ProcessBillingProfileSuspensionNotifyingTaskRequestBody,
  ProcessBillingProfileSuspensionNotifyingTaskResponse,
} from "@phading/commerce_service_interface/node/interface";
import { newGetAccountContactRequest } from "@phading/user_service_interface/node/client";
import { newBadRequestError } from "@selfage/http_error";
import { NodeServiceClient } from "@selfage/node_service_client";
import { ProcessTaskHandlerWrapper } from "@selfage/service_handler/process_task_handler_wrapper";

export class ProcessBillingProfileSuspensionNotifyingTaskHandler extends ProcessBillingProfileSuspensionNotifyingTaskHandlerInterface {
  public static create(): ProcessBillingProfileSuspensionNotifyingTaskHandler {
    return new ProcessBillingProfileSuspensionNotifyingTaskHandler(
      SPANNER_DATABASE,
      SERVICE_CLIENT,
      SENDGRID_CLIENT,
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
    private sendgridClient: any,
    private getNow: () => number,
  ) {
    super();
  }

  public async handle(
    loggingPrefix: string,
    body: ProcessBillingProfileSuspensionNotifyingTaskRequestBody,
  ): Promise<ProcessBillingProfileSuspensionNotifyingTaskResponse> {
    loggingPrefix = `${loggingPrefix} Billing profile suspension notifying task for account ${body.accountId} version ${body.version}:`;
    await this.taskHandler.wrap(
      loggingPrefix,
      () => this.claimTask(loggingPrefix, body),
      () => this.processTask(loggingPrefix, body),
    );
    return {};
  }

  public async claimTask(
    loggingPrefix: string,
    body: ProcessBillingProfileSuspensionNotifyingTaskRequestBody,
  ): Promise<void> {
    await this.database.runTransactionAsync(async (transaction) => {
      let rows = await getBillingProfileSuspensionNotifyingTaskMetadata(
        transaction,
        {
          billingProfileSuspensionNotifyingTaskAccountIdEq: body.accountId,
          billingProfileSuspensionNotifyingTaskVersionEq: body.version,
        },
      );
      if (rows.length === 0) {
        throw newBadRequestError(`Task is not found.`);
      }
      let task = rows[0];
      await transaction.batchUpdate([
        updateBillingProfileSuspensionNotifyingTaskMetadataStatement({
          billingProfileSuspensionNotifyingTaskAccountIdEq: body.accountId,
          billingProfileSuspensionNotifyingTaskVersionEq: body.version,
          setRetryCount:
            task.billingProfileSuspensionNotifyingTaskRetryCount + 1,
          setExecutionTimeMs:
            this.getNow() +
            this.taskHandler.getBackoffTime(
              task.billingProfileSuspensionNotifyingTaskRetryCount,
            ),
        }),
      ]);
      await transaction.commit();
    });
  }

  public async processTask(
    loggingPrefix: string,
    body: ProcessBillingProfileSuspensionNotifyingTaskRequestBody,
  ): Promise<void> {
    let accountResponse = await this.serviceClient.send(
      newGetAccountContactRequest({
        accountId: body.accountId,
      }),
    );
    await this.sendgridClient.send({
      to: accountResponse.contactEmail,
      from: ENV_VARS.contactEmail,
      templateId: LOCALIZATION.accountSuspensionEmailTemplateId,
      dynamicTemplateData: {
        name: accountResponse.naturalName,
        appName: APP_NAME,
        accountSuspensionContactEmail: ENV_VARS.contactEmail,
      },
    });
    await this.database.runTransactionAsync(async (transaction) => {
      await transaction.batchUpdate([
        deleteBillingProfileSuspensionNotifyingTaskStatement({
          billingProfileSuspensionNotifyingTaskAccountIdEq: body.accountId,
          billingProfileSuspensionNotifyingTaskVersionEq: body.version,
        }),
      ]);
      await transaction.commit();
    });
  }
}
