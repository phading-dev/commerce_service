import {
  ACCOUNT_SUSPENSION_CONTACT_EMAIL_ADDRESS,
  FROM_EMAIL_ADDRESS,
} from "../common/env_vars";
import { LOCALIZATION } from "../common/localization";
import { APP_NAME } from "../common/params";
import { SENDGRID_CLIENT } from "../common/sendgrid_client";
import { SERVICE_CLIENT } from "../common/service_client";
import { SPANNER_DATABASE } from "../common/spanner_database";
import {
  deleteBillingAccountSuspensionNotifyingTaskStatement,
  updateBillingAccountSuspensionNotifyingTaskStatement,
} from "../db/sql";
import { Database } from "@google-cloud/spanner";
import { ProcessBillingAccountSuspensionNotifyingTaskHandlerInterface } from "@phading/commerce_service_interface/node/handler";
import {
  ProcessBillingAccountSuspensionNotifyingTaskRequestBody,
  ProcessBillingAccountSuspensionNotifyingTaskResponse,
} from "@phading/commerce_service_interface/node/interface";
import { getAccountContact } from "@phading/user_service_interface/node/client";
import { NodeServiceClient } from "@selfage/node_service_client";

export class ProcessBillingAccountSuspensionNotifyingTaskHandler extends ProcessBillingAccountSuspensionNotifyingTaskHandlerInterface {
  public static create(): ProcessBillingAccountSuspensionNotifyingTaskHandler {
    return new ProcessBillingAccountSuspensionNotifyingTaskHandler(
      SPANNER_DATABASE,
      SERVICE_CLIENT,
      SENDGRID_CLIENT,
      () => Date.now(),
    );
  }

  private static RETRY_BACKOFF_MS = 5 * 60 * 1000;
  public doneCallbackFn = (): void => {};

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
    body: ProcessBillingAccountSuspensionNotifyingTaskRequestBody,
  ): Promise<ProcessBillingAccountSuspensionNotifyingTaskResponse> {
    await this.database.runTransactionAsync(async (transaction) => {
      await transaction.batchUpdate([
        updateBillingAccountSuspensionNotifyingTaskStatement(
          body.accountId,
          body.version,
          this.getNow() +
            ProcessBillingAccountSuspensionNotifyingTaskHandler.RETRY_BACKOFF_MS,
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
      let accountResponse = await getAccountContact(this.serviceClient, {
        accountId,
      });
      await this.sendgridClient.send({
        to: accountResponse.contactEmail,
        from: FROM_EMAIL_ADDRESS,
        templateId: LOCALIZATION.accountSuspensionEmailTemplateId,
        dynamicTemplateData: {
          name: accountResponse.naturalName,
          appName: APP_NAME,
          accountSuspensionContactEmail:
            ACCOUNT_SUSPENSION_CONTACT_EMAIL_ADDRESS,
        },
      });
      await this.database.runTransactionAsync(async (transaction) => {
        await transaction.batchUpdate([
          deleteBillingAccountSuspensionNotifyingTaskStatement(
            accountId,
            version,
          ),
        ]);
        await transaction.commit();
      });
    } catch (e) {
      console.log(
        `${loggingPrefix} For billing account ${accountId} and version ${version}, failed to send account suspension email. ${e.stack ?? e}`,
      );
    }
    this.doneCallbackFn();
  }
}
