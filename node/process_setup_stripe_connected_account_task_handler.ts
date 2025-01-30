import { FROM_EMAIL_ADDRESS } from "../common/env_vars";
import { LOCALIZATION } from "../common/localization";
import { SENDGRID_CLIENT } from "../common/sendgrid_client";
import { SERVICE_CLIENT } from "../common/service_client";
import { SPANNER_DATABASE } from "../common/spanner_database";
import {
  deleteSetupStripeConnectedAccountNotifyingTaskStatement,
  updateSetupStripeConnectedAccountNotifyingTaskStatement,
} from "../db/sql";
import { Database } from "@google-cloud/spanner";
import { ProcessSetupStripeConnectedAccountNotifyingTaskHandlerInterface } from "@phading/commerce_service_interface/node/handler";
import {
  ProcessSetupStripeConnectedAccountNotifyingTaskRequestBody,
  ProcessSetupStripeConnectedAccountNotifyingTaskResponse,
} from "@phading/commerce_service_interface/node/interface";
import { getAccountContact } from "@phading/user_service_interface/node/client";
import {
  URL_BUILDER,
  UrlBuilder,
  buildMainAppUrl,
} from "@phading/web_interface/url_builder";
import { NodeServiceClient } from "@selfage/node_service_client";

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

  private static RETRY_BACKOFF_MS = 5 * 60 * 1000;
  public doneCallbackFn = (): void => {};

  public constructor(
    private database: Database,
    private serviceClient: NodeServiceClient,
    private sendgridClient: any,
    private urlBuilder: UrlBuilder,
    private getNow: () => number,
  ) {
    super();
  }

  public async handle(
    loggingPrefix: string,
    body: ProcessSetupStripeConnectedAccountNotifyingTaskRequestBody,
  ): Promise<ProcessSetupStripeConnectedAccountNotifyingTaskResponse> {
    await this.database.runTransactionAsync(async (transaction) => {
      await transaction.batchUpdate([
        updateSetupStripeConnectedAccountNotifyingTaskStatement(
          body.accountId,
          this.getNow() +
            ProcessSetupStripeConnectedAccountNotifyingTaskHandler.RETRY_BACKOFF_MS,
        ),
      ]);
      await transaction.commit();
    });
    this.startProcessingAndCatchError(loggingPrefix, body.accountId);
    return {};
  }

  private async startProcessingAndCatchError(
    loggingPrefix: string,
    accountId: string,
  ): Promise<void> {
    try {
      let accountResponse = await getAccountContact(this.serviceClient, {
        accountId,
      });
      await this.sendgridClient.send({
        to: accountResponse.contactEmail,
        from: FROM_EMAIL_ADDRESS,
        templateId: LOCALIZATION.setupStripeConnectedAccountEmailTemplateId,
        dynamicTemplateData: {
          name: accountResponse.naturalName,
          completeSetupUrl: buildMainAppUrl(this.urlBuilder, {
            accountId,
            account: {
              earnings: {},
            },
          }),
        },
      });
      await this.database.runTransactionAsync(async (transaction) => {
        await transaction.batchUpdate([
          deleteSetupStripeConnectedAccountNotifyingTaskStatement(accountId),
        ]);
        await transaction.commit();
      });
    } catch (e) {
      console.log(
        `${loggingPrefix} For earnings account ${accountId}, failed to send setup Stripe connected account email. ${e.stack ?? e}`,
      );
    }
    this.doneCallbackFn();
  }
}
