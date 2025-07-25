import { LOCALIZATION } from "../common/localization";
import { SENDGRID_CLIENT } from "../common/sendgrid_client";
import { SERVICE_CLIENT } from "../common/service_client";
import { SPANNER_DATABASE } from "../common/spanner_database";
import {
  deletePaymentProfileSuspensionNotifyingTaskStatement,
  getPaymentProfileSuspensionNotifyingTaskMetadata,
  updatePaymentProfileSuspensionNotifyingTaskMetadataStatement,
} from "../db/sql";
import { ENV_VARS } from "../env_vars";
import { Database } from "@google-cloud/spanner";
import { ProcessPaymentProfileSuspensionNotifyingTaskHandlerInterface } from "@phading/commerce_service_interface/node/handler";
import {
  ProcessPaymentProfileSuspensionNotifyingTaskRequestBody,
  ProcessPaymentProfileSuspensionNotifyingTaskResponse,
} from "@phading/commerce_service_interface/node/interface";
import { newGetAccountContactRequest } from "@phading/user_service_interface/node/client";
import { buildUrl } from "@phading/web_interface/url_builder";
import { newBadRequestError } from "@selfage/http_error";
import { NodeServiceClient } from "@selfage/node_service_client";
import { ProcessTaskHandlerWrapper } from "@selfage/service_handler/process_task_handler_wrapper";

export class ProcessPaymentProfileSuspensionNotifyingTaskHandler extends ProcessPaymentProfileSuspensionNotifyingTaskHandlerInterface {
  public static create(): ProcessPaymentProfileSuspensionNotifyingTaskHandler {
    return new ProcessPaymentProfileSuspensionNotifyingTaskHandler(
      SPANNER_DATABASE,
      SERVICE_CLIENT,
      SENDGRID_CLIENT,
      ENV_VARS.externalOrigin,
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
    private externalOrigin: string,
    private getNow: () => number,
  ) {
    super();
  }

  public async handle(
    loggingPrefix: string,
    body: ProcessPaymentProfileSuspensionNotifyingTaskRequestBody,
  ): Promise<ProcessPaymentProfileSuspensionNotifyingTaskResponse> {
    loggingPrefix = `${loggingPrefix} Payment profile suspension notifying task for account ${body.accountId} version ${body.version}:`;
    await this.taskHandler.wrap(
      loggingPrefix,
      () => this.claimTask(loggingPrefix, body),
      () => this.processTask(loggingPrefix, body),
    );
    return {};
  }

  public async claimTask(
    loggingPrefix: string,
    body: ProcessPaymentProfileSuspensionNotifyingTaskRequestBody,
  ): Promise<void> {
    await this.database.runTransactionAsync(async (transaction) => {
      let rows = await getPaymentProfileSuspensionNotifyingTaskMetadata(
        transaction,
        {
          paymentProfileSuspensionNotifyingTaskAccountIdEq: body.accountId,
          paymentProfileSuspensionNotifyingTaskVersionEq: body.version,
        },
      );
      if (rows.length === 0) {
        throw newBadRequestError(`Task is not found.`);
      }
      let task = rows[0];
      await transaction.batchUpdate([
        updatePaymentProfileSuspensionNotifyingTaskMetadataStatement({
          paymentProfileSuspensionNotifyingTaskAccountIdEq: body.accountId,
          paymentProfileSuspensionNotifyingTaskVersionEq: body.version,
          setRetryCount:
            task.paymentProfileSuspensionNotifyingTaskRetryCount + 1,
          setExecutionTimeMs:
            this.getNow() +
            this.taskHandler.getBackoffTime(
              task.paymentProfileSuspensionNotifyingTaskRetryCount,
            ),
        }),
      ]);
      await transaction.commit();
    });
  }

  public async processTask(
    loggingPrefix: string,
    body: ProcessPaymentProfileSuspensionNotifyingTaskRequestBody,
  ): Promise<void> {
    let accountResponse = await this.serviceClient.send(
      newGetAccountContactRequest({
        accountId: body.accountId,
      }),
    );
    await this.sendgridClient.send({
      to: accountResponse.contactEmail,
      from: {
        email: ENV_VARS.supportEmail,
        name: ENV_VARS.supportEmailName,
      },
      templateId: LOCALIZATION.profileSuspensionEmailTemplateId,
      dynamicTemplateData: {
        name: accountResponse.name,
        platformName: ENV_VARS.platformName,
        paymentPageUrl: buildUrl(this.externalOrigin, {
          main: {
            chooseAccount: {
              accountId: body.accountId,
            },
            account: {
              payment: {},
            },
          },
        }),
        yearAndCompany: ENV_VARS.emailFooterYearAndCompany,
        companyAddress: ENV_VARS.emailFooterCompanyAddress,
      },
    });
    await this.database.runTransactionAsync(async (transaction) => {
      await transaction.batchUpdate([
        deletePaymentProfileSuspensionNotifyingTaskStatement({
          paymentProfileSuspensionNotifyingTaskAccountIdEq: body.accountId,
          paymentProfileSuspensionNotifyingTaskVersionEq: body.version,
        }),
      ]);
      await transaction.commit();
    });
  }
}
