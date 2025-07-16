import { LOCALIZATION } from "../common/localization";
import { SENDGRID_CLIENT } from "../common/sendgrid_client";
import { SERVICE_CLIENT } from "../common/service_client";
import { SPANNER_DATABASE } from "../common/spanner_database";
import {
  deleteStripeConnectedAccountNeedsSetupNotifyingTaskStatement,
  getStripeConnectedAccountNeedsSetupNotifyingTaskMetadata,
  updateStripeConnectedAccountNeedsSetupNotifyingTaskMetadataStatement,
} from "../db/sql";
import { ENV_VARS } from "../env_vars";
import { Database } from "@google-cloud/spanner";
import { ProcessStripeConnectedAccountNeedsSetupNotifyingTaskHandlerInterface } from "@phading/commerce_service_interface/node/handler";
import {
  ProcessStripeConnectedAccountNeedsSetupNotifyingTaskRequestBody,
  ProcessStripeConnectedAccountNeedsSetupNotifyingTaskResponse,
} from "@phading/commerce_service_interface/node/interface";
import { newGetAccountContactRequest } from "@phading/user_service_interface/node/client";
import { buildUrl } from "@phading/web_interface/url_builder";
import { newBadRequestError } from "@selfage/http_error";
import { NodeServiceClient } from "@selfage/node_service_client";
import { ProcessTaskHandlerWrapper } from "@selfage/service_handler/process_task_handler_wrapper";
import { PLATFORM_NAME } from "../common/constants";

export class ProcessStripeConnectedAccountNeedsSetupNotifyingTaskHandler extends ProcessStripeConnectedAccountNeedsSetupNotifyingTaskHandlerInterface {
  public static create(): ProcessStripeConnectedAccountNeedsSetupNotifyingTaskHandler {
    return new ProcessStripeConnectedAccountNeedsSetupNotifyingTaskHandler(
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
    body: ProcessStripeConnectedAccountNeedsSetupNotifyingTaskRequestBody,
  ): Promise<ProcessStripeConnectedAccountNeedsSetupNotifyingTaskResponse> {
    loggingPrefix = `${loggingPrefix} Stripe connected account needs setup notifying task for payout profile ${body.accountId}:`;
    await this.taskHandler.wrap(
      loggingPrefix,
      () => this.claimTask(loggingPrefix, body),
      () => this.processTask(loggingPrefix, body),
    );
    return {};
  }

  public async claimTask(
    loggingPrefix: string,
    body: ProcessStripeConnectedAccountNeedsSetupNotifyingTaskRequestBody,
  ): Promise<void> {
    await this.database.runTransactionAsync(async (transaction) => {
      let rows = await getStripeConnectedAccountNeedsSetupNotifyingTaskMetadata(
        transaction,
        {
          stripeConnectedAccountNeedsSetupNotifyingTaskAccountIdEq:
            body.accountId,
        },
      );
      if (rows.length === 0) {
        throw newBadRequestError(`Task is not found.`);
      }
      let task = rows[0];
      await transaction.batchUpdate([
        updateStripeConnectedAccountNeedsSetupNotifyingTaskMetadataStatement({
          stripeConnectedAccountNeedsSetupNotifyingTaskAccountIdEq:
            body.accountId,
          setRetryCount:
            task.stripeConnectedAccountNeedsSetupNotifyingTaskRetryCount + 1,
          setExecutionTimeMs:
            this.getNow() +
            this.taskHandler.getBackoffTime(
              task.stripeConnectedAccountNeedsSetupNotifyingTaskRetryCount,
            ),
        }),
      ]);
      await transaction.commit();
    });
  }

  public async processTask(
    loggingPrefix: string,
    body: ProcessStripeConnectedAccountNeedsSetupNotifyingTaskRequestBody,
  ): Promise<void> {
    let contactResponse = await this.serviceClient.send(
      newGetAccountContactRequest({
        accountId: body.accountId,
      }),
    );
    await this.sendgridClient.send({
      to: contactResponse.contactEmail,
      from: {
        email: ENV_VARS.supportEmail,
        name: "Secount support",
      },
      templateId: LOCALIZATION.setupStripeConnectedAccountEmailTemplateId,
      dynamicTemplateData: {
        name: contactResponse.naturalName,
        platformName: PLATFORM_NAME,
        completeSetupUrl: buildUrl(this.externalOrigin, {
          main: {
            chooseAccount: {
              accountId: body.accountId,
            },
            account: {
              payout: {},
            },
          },
        }),
      },
    });
    await this.database.runTransactionAsync(async (transaction) => {
      await transaction.batchUpdate([
        deleteStripeConnectedAccountNeedsSetupNotifyingTaskStatement({
          stripeConnectedAccountNeedsSetupNotifyingTaskAccountIdEq:
            body.accountId,
        }),
      ]);
      await transaction.commit();
    });
  }
}
