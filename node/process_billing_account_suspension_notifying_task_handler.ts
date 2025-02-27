import { APP_NAME } from "../common/constants";
import { LOCALIZATION } from "../common/localization";
import { SENDGRID_CLIENT } from "../common/sendgrid_client";
import { SERVICE_CLIENT } from "../common/service_client";
import { SPANNER_DATABASE } from "../common/spanner_database";
import {
  deleteBillingAccountSuspensionNotifyingTaskStatement,
  getBillingAccountSuspensionNotifyingTaskMetadata,
  updateBillingAccountSuspensionNotifyingTaskMetadataStatement,
} from "../db/sql";
import { ENV_VARS } from "../env";
import { Database } from "@google-cloud/spanner";
import { ProcessBillingAccountSuspensionNotifyingTaskHandlerInterface } from "@phading/commerce_service_interface/node/handler";
import {
  ProcessBillingAccountSuspensionNotifyingTaskRequestBody,
  ProcessBillingAccountSuspensionNotifyingTaskResponse,
} from "@phading/commerce_service_interface/node/interface";
import { newGetAccountContactRequest } from "@phading/user_service_interface/node/client";
import { newBadRequestError } from "@selfage/http_error";
import { NodeServiceClient } from "@selfage/node_service_client";
import { ProcessTaskHandlerWrapper } from "@selfage/service_handler/process_task_handler_wrapper";

export class ProcessBillingAccountSuspensionNotifyingTaskHandler extends ProcessBillingAccountSuspensionNotifyingTaskHandlerInterface {
  public static create(): ProcessBillingAccountSuspensionNotifyingTaskHandler {
    return new ProcessBillingAccountSuspensionNotifyingTaskHandler(
      SPANNER_DATABASE,
      SERVICE_CLIENT,
      SENDGRID_CLIENT,
      () => Date.now(),
    );
  }

  private taskHandler: ProcessTaskHandlerWrapper;

  public constructor(
    private database: Database,
    private serviceClient: NodeServiceClient,
    private sendgridClient: any,
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
    body: ProcessBillingAccountSuspensionNotifyingTaskRequestBody,
  ): Promise<ProcessBillingAccountSuspensionNotifyingTaskResponse> {
    loggingPrefix = `${loggingPrefix} Billing account suspension notifying task for account ${body.accountId} version ${body.version}:`;
    await this.taskHandler.wrap(
      loggingPrefix,
      () => this.claimTask(loggingPrefix, body),
      () => this.processTask(loggingPrefix, body),
    );
    return {};
  }

  public async claimTask(
    loggingPrefix: string,
    body: ProcessBillingAccountSuspensionNotifyingTaskRequestBody,
  ): Promise<void> {
    await this.database.runTransactionAsync(async (transaction) => {
      let rows = await getBillingAccountSuspensionNotifyingTaskMetadata(
        transaction,
        body.accountId,
        body.version,
      );
      if (rows.length === 0) {
        throw newBadRequestError(`Task is not found.`);
      }
      let task = rows[0];
      await transaction.batchUpdate([
        updateBillingAccountSuspensionNotifyingTaskMetadataStatement(
          body.accountId,
          body.version,
          task.billingAccountSuspensionNotifyingTaskRetryCount + 1,
          this.getNow() +
            this.taskHandler.getBackoffTime(
              task.billingAccountSuspensionNotifyingTaskRetryCount,
            ),
        ),
      ]);
      await transaction.commit();
    });
  }

  public async processTask(
    loggingPrefix: string,
    body: ProcessBillingAccountSuspensionNotifyingTaskRequestBody,
  ): Promise<void> {
    let accountResponse = await this.serviceClient.send(
      newGetAccountContactRequest({
        accountId: body.accountId,
      }),
    );
    await this.sendgridClient.send({
      to: accountResponse.contactEmail,
      from: ENV_VARS.fromEmailAddress,
      templateId: LOCALIZATION.accountSuspensionEmailTemplateId,
      dynamicTemplateData: {
        name: accountResponse.naturalName,
        appName: APP_NAME,
        accountSuspensionContactEmail:
          ENV_VARS.accountSuspensionContactEmailAddress,
      },
    });
    await this.database.runTransactionAsync(async (transaction) => {
      await transaction.batchUpdate([
        deleteBillingAccountSuspensionNotifyingTaskStatement(
          body.accountId,
          body.version,
        ),
      ]);
      await transaction.commit();
    });
  }
}
