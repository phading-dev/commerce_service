import { GRACE_PERIOD_DAYS } from "../common/constants";
import { LOCALIZATION } from "../common/localization";
import { SENDGRID_CLIENT } from "../common/sendgrid_client";
import { SERVICE_CLIENT } from "../common/service_client";
import { SPANNER_DATABASE } from "../common/spanner_database";
import { URL_BUILDER } from "../common/url_builder";
import {
  deleteUpdatePaymentMethodNotifyingTaskStatement,
  getBilling,
  getUpdatePaymentMethodNotifyingTaskMetadata,
  updateUpdatePaymentMethodNotifyingTaskMetadataStatement,
} from "../db/sql";
import { ENV_VARS } from "../env_vars";
import { Database } from "@google-cloud/spanner";
import { ProcessUpdatePaymentMethodNotifyingTaskHandlerInterface } from "@phading/commerce_service_interface/node/handler";
import {
  ProcessUpdatePaymentMethodNotifyingTaskRequestBody,
  ProcessUpdatePaymentMethodNotifyingTaskResponse,
} from "@phading/commerce_service_interface/node/interface";
import { newGetAccountContactRequest } from "@phading/user_service_interface/node/client";
import { UrlBuilder } from "@phading/web_interface/url_builder";
import {
  newBadRequestError,
  newInternalServerErrorError,
} from "@selfage/http_error";
import { NodeServiceClient } from "@selfage/node_service_client";
import { ProcessTaskHandlerWrapper } from "@selfage/service_handler/process_task_handler_wrapper";

export class ProcessUpdatePaymentMethodNotifyingTaskHandler extends ProcessUpdatePaymentMethodNotifyingTaskHandlerInterface {
  public static create(): ProcessUpdatePaymentMethodNotifyingTaskHandler {
    return new ProcessUpdatePaymentMethodNotifyingTaskHandler(
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
    body: ProcessUpdatePaymentMethodNotifyingTaskRequestBody,
  ): Promise<ProcessUpdatePaymentMethodNotifyingTaskResponse> {
    loggingPrefix = `${loggingPrefix} Update payment method notifying task for billing ${body.billingId}:`;
    await this.taskHandler.wrap(
      loggingPrefix,
      () => this.claimTask(loggingPrefix, body),
      () => this.processTask(loggingPrefix, body),
    );
    return {};
  }

  public async claimTask(
    loggingPrefix: string,
    body: ProcessUpdatePaymentMethodNotifyingTaskRequestBody,
  ): Promise<void> {
    await this.database.runTransactionAsync(async (transaction) => {
      let rows = await getUpdatePaymentMethodNotifyingTaskMetadata(
        transaction,
        body.billingId,
      );
      if (rows.length === 0) {
        throw newBadRequestError(`Task is not found.`);
      }
      let task = rows[0];
      await transaction.batchUpdate([
        updateUpdatePaymentMethodNotifyingTaskMetadataStatement(
          body.billingId,
          task.updatePaymentMethodNotifyingTaskRetryCount + 1,
          this.getNow() +
            this.taskHandler.getBackoffTime(
              task.updatePaymentMethodNotifyingTaskRetryCount,
            ),
        ),
      ]);
      await transaction.commit();
    });
  }

  public async processTask(
    loggingPrefix: string,
    body: ProcessUpdatePaymentMethodNotifyingTaskRequestBody,
  ): Promise<void> {
    let billingRows = await getBilling(this.database, body.billingId);
    if (billingRows.length === 0) {
      throw newInternalServerErrorError(
        `${loggingPrefix} Billing ${body.billingId} is not found.`,
      );
    }
    let billing = billingRows[0].billingData;
    let { naturalName, contactEmail } = await this.serviceClient.send(
      newGetAccountContactRequest({ accountId: billing.accountId }),
    );
    await this.sendgridClient.send({
      to: contactEmail,
      from: ENV_VARS.fromEmailAddress,
      templateId: LOCALIZATION.updatePaymentMethodEmailTemplateId,
      dynamicTemplateData: {
        month: billing.month,
        name: naturalName,
        gradePeriodDays: GRACE_PERIOD_DAYS,
        updatePaymentMethodUrl: this.urlBuilder.build({
          main: {
            accountId: billing.accountId,
            account: {
              billing: {},
            },
          },
        }),
      },
    });
    await this.database.runTransactionAsync(async (transaction) => {
      await transaction.batchUpdate([
        deleteUpdatePaymentMethodNotifyingTaskStatement(body.billingId),
      ]);
      await transaction.commit();
    });
  }
}
