import { LOCALIZATION } from "../common/localization";
import { SENDGRID_CLIENT } from "../common/sendgrid_client";
import { SERVICE_CLIENT } from "../common/service_client";
import { SPANNER_DATABASE } from "../common/spanner_database";
import { URL_BUILDER } from "../common/url_builder";
import {
  deleteSetupStripeConnectedAccountNotifyingTaskStatement,
  getSetupStripeConnectedAccountNotifyingTaskMetadata,
  updateSetupStripeConnectedAccountNotifyingTaskMetadataStatement,
} from "../db/sql";
import { ENV_VARS } from "../env_vars";
import { Database } from "@google-cloud/spanner";
import { ProcessSetupStripeConnectedAccountNotifyingTaskHandlerInterface } from "@phading/commerce_service_interface/node/handler";
import {
  ProcessSetupStripeConnectedAccountNotifyingTaskRequestBody,
  ProcessSetupStripeConnectedAccountNotifyingTaskResponse,
} from "@phading/commerce_service_interface/node/interface";
import { newGetAccountContactRequest } from "@phading/user_service_interface/node/client";
import { UrlBuilder } from "@phading/web_interface/url_builder";
import { newBadRequestError } from "@selfage/http_error";
import { NodeServiceClient } from "@selfage/node_service_client";
import { ProcessTaskHandlerWrapper } from "@selfage/service_handler/process_task_handler_wrapper";

export class ProcessSetupStripeConnectedAccountNotifyingTaskHandler extends ProcessSetupStripeConnectedAccountNotifyingTaskHandlerInterface {
  public static create(): ProcessSetupStripeConnectedAccountNotifyingTaskHandler {
    return new ProcessSetupStripeConnectedAccountNotifyingTaskHandler(
      SPANNER_DATABASE,
      SERVICE_CLIENT,
      SENDGRID_CLIENT,
      URL_BUILDER,
      () => Date.now(),
    );
  }

  private taskHandler: ProcessTaskHandlerWrapper;

  public constructor(
    private database: Database,
    private serviceClient: NodeServiceClient,
    private sendgridClient: any,
    private urlBuilder: UrlBuilder,
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
    body: ProcessSetupStripeConnectedAccountNotifyingTaskRequestBody,
  ): Promise<ProcessSetupStripeConnectedAccountNotifyingTaskResponse> {
    loggingPrefix = `${loggingPrefix} Setup stripe connected account notifying task for earnings account ${body.accountId}:`;
    await this.taskHandler.wrap(
      loggingPrefix,
      () => this.claimTask(loggingPrefix, body),
      () => this.processTask(loggingPrefix, body),
    );
    return {};
  }

  public async claimTask(
    loggingPrefix: string,
    body: ProcessSetupStripeConnectedAccountNotifyingTaskRequestBody,
  ): Promise<void> {
    await this.database.runTransactionAsync(async (transaction) => {
      let rows = await getSetupStripeConnectedAccountNotifyingTaskMetadata(
        transaction,
        body.accountId,
      );
      if (rows.length === 0) {
        throw newBadRequestError(`Task is not found.`);
      }
      let task = rows[0];
      await transaction.batchUpdate([
        updateSetupStripeConnectedAccountNotifyingTaskMetadataStatement(
          body.accountId,
          task.setupStripeConnectedAccountNotifyingTaskRetryCount + 1,
          this.getNow() +
            this.taskHandler.getBackoffTime(
              task.setupStripeConnectedAccountNotifyingTaskRetryCount,
            ),
        ),
      ]);
      await transaction.commit();
    });
  }

  public async processTask(
    loggingPrefix: string,
    body: ProcessSetupStripeConnectedAccountNotifyingTaskRequestBody,
  ): Promise<void> {
    let accountResponse = await this.serviceClient.send(
      newGetAccountContactRequest({
        accountId: body.accountId,
      }),
    );
    await this.sendgridClient.send({
      to: accountResponse.contactEmail,
      from: ENV_VARS.fromEmailAddress,
      templateId: LOCALIZATION.setupStripeConnectedAccountEmailTemplateId,
      dynamicTemplateData: {
        name: accountResponse.naturalName,
        completeSetupUrl: this.urlBuilder.build({
          main: {
            accountId: body.accountId,
            account: {
              earnings: {},
            },
          },
        }),
      },
    });
    await this.database.runTransactionAsync(async (transaction) => {
      await transaction.batchUpdate([
        deleteSetupStripeConnectedAccountNotifyingTaskStatement(body.accountId),
      ]);
      await transaction.commit();
    });
  }
}
