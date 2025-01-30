import { FROM_EMAIL_ADDRESS } from "../common/env_vars";
import { LOCALIZATION } from "../common/localization";
import { GRACE_PERIOD_DAYS } from "../common/params";
import { SENDGRID_CLIENT } from "../common/sendgrid_client";
import { SERVICE_CLIENT } from "../common/service_client";
import { SPANNER_DATABASE } from "../common/spanner_database";
import {
  deleteUpdatePaymentMethodNotifyingTaskStatement,
  getBilling,
  updateUpdatePaymentMethodNotifyingTaskStatement,
} from "../db/sql";
import { Database } from "@google-cloud/spanner";
import { ProcessUpdatePaymentMethodNotifyingTaskHandlerInterface } from "@phading/commerce_service_interface/node/handler";
import {
  ProcessUpdatePaymentMethodNotifyingTaskRequestBody,
  ProcessUpdatePaymentMethodNotifyingTaskResponse,
} from "@phading/commerce_service_interface/node/interface";
import { getAccountContact } from "@phading/user_service_interface/node/client";
import {
  URL_BUILDER,
  UrlBuilder,
  buildMainAppUrl,
} from "@phading/web_interface/url_builder";
import { newInternalServerErrorError } from "@selfage/http_error";
import { NodeServiceClient } from "@selfage/node_service_client";

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
    body: ProcessUpdatePaymentMethodNotifyingTaskRequestBody,
  ): Promise<ProcessUpdatePaymentMethodNotifyingTaskResponse> {
    await this.database.runTransactionAsync(async (transaction) => {
      await transaction.batchUpdate([
        updateUpdatePaymentMethodNotifyingTaskStatement(
          body.billingId,
          this.getNow() +
            ProcessUpdatePaymentMethodNotifyingTaskHandler.RETRY_BACKOFF_MS,
        ),
      ]);
      await transaction.commit();
    });
    this.startProcessingAndCatchError(loggingPrefix, body.billingId);
    return {};
  }

  private async startProcessingAndCatchError(
    loggingPrefix: string,
    billingId: string,
  ): Promise<void> {
    try {
      let billingRows = await getBilling(this.database, billingId);
      if (billingRows.length === 0) {
        throw newInternalServerErrorError(
          `${loggingPrefix} Billing ${billingId} is not found.`,
        );
      }
      let billing = billingRows[0].billingData;
      let { naturalName, contactEmail } = await getAccountContact(
        this.serviceClient,
        { accountId: billing.accountId },
      );
      await this.sendgridClient.send({
        to: contactEmail,
        from: FROM_EMAIL_ADDRESS,
        templateId: LOCALIZATION.updatePaymentMethodEmailTemplateId,
        dynamicTemplateData: {
          month: billing.month,
          name: naturalName,
          gradePeriodDays: GRACE_PERIOD_DAYS,
          updatePaymentMethodUrl: buildMainAppUrl(this.urlBuilder, {
            accountId: billing.accountId,
            account: {
              billing: {},
            },
          }),
        },
      });
      await this.database.runTransactionAsync(async (transaction) => {
        await transaction.batchUpdate([
          deleteUpdatePaymentMethodNotifyingTaskStatement(billingId),
        ]);
        await transaction.commit();
      });
    } catch (e) {
      console.log(
        `${loggingPrefix} For billing ${billingId}, failed to send payment failed email. ${e.stack ?? e}`,
      );
    }
    this.doneCallbackFn();
  }
}
