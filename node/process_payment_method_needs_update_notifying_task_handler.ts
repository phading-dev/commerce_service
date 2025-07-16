import {
  GRACE_PERIOD_DAYS,
  PLATFORM_NAME,
  SUPPORT_EMAIL_NAME,
} from "../common/constants";
import { LOCALIZATION } from "../common/localization";
import { SENDGRID_CLIENT } from "../common/sendgrid_client";
import { SERVICE_CLIENT } from "../common/service_client";
import { SPANNER_DATABASE } from "../common/spanner_database";
import {
  deletePaymentMethodNeedsUpdateNotifyingTaskStatement,
  getPaymentMethodNeedsUpdateNotifyingTaskMetadata,
  getTransactionStatement,
  updatePaymentMethodNeedsUpdateNotifyingTaskMetadataStatement,
} from "../db/sql";
import { ENV_VARS } from "../env_vars";
import { Database } from "@google-cloud/spanner";
import { ProcessPaymentMethodNeedsUpdateNotifyingTaskHandlerInterface } from "@phading/commerce_service_interface/node/handler";
import {
  ProcessPaymentMethodNeedsUpdateNotifyingTaskRequestBody,
  ProcessPaymentMethodNeedsUpdateNotifyingTaskResponse,
} from "@phading/commerce_service_interface/node/interface";
import { newGetAccountContactRequest } from "@phading/user_service_interface/node/client";
import { buildUrl } from "@phading/web_interface/url_builder";
import {
  newBadRequestError,
  newInternalServerErrorError,
} from "@selfage/http_error";
import { NodeServiceClient } from "@selfage/node_service_client";
import { ProcessTaskHandlerWrapper } from "@selfage/service_handler/process_task_handler_wrapper";

export class ProcessPaymentMethodNeedsUpdateNotifyingTaskHandler extends ProcessPaymentMethodNeedsUpdateNotifyingTaskHandlerInterface {
  public static create(): ProcessPaymentMethodNeedsUpdateNotifyingTaskHandler {
    return new ProcessPaymentMethodNeedsUpdateNotifyingTaskHandler(
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
    body: ProcessPaymentMethodNeedsUpdateNotifyingTaskRequestBody,
  ): Promise<ProcessPaymentMethodNeedsUpdateNotifyingTaskResponse> {
    loggingPrefix = `${loggingPrefix} Update payment method notifying task for statement ${body.statementId}:`;
    await this.taskHandler.wrap(
      loggingPrefix,
      () => this.claimTask(loggingPrefix, body),
      () => this.processTask(loggingPrefix, body),
    );
    return {};
  }

  public async claimTask(
    loggingPrefix: string,
    body: ProcessPaymentMethodNeedsUpdateNotifyingTaskRequestBody,
  ): Promise<void> {
    await this.database.runTransactionAsync(async (transaction) => {
      let rows = await getPaymentMethodNeedsUpdateNotifyingTaskMetadata(
        transaction,
        {
          paymentMethodNeedsUpdateNotifyingTaskStatementIdEq: body.statementId,
        },
      );
      if (rows.length === 0) {
        throw newBadRequestError(`Task is not found.`);
      }
      let task = rows[0];
      await transaction.batchUpdate([
        updatePaymentMethodNeedsUpdateNotifyingTaskMetadataStatement({
          paymentMethodNeedsUpdateNotifyingTaskStatementIdEq: body.statementId,
          setRetryCount:
            task.paymentMethodNeedsUpdateNotifyingTaskRetryCount + 1,
          setExecutionTimeMs:
            this.getNow() +
            this.taskHandler.getBackoffTime(
              task.paymentMethodNeedsUpdateNotifyingTaskRetryCount,
            ),
        }),
      ]);
      await transaction.commit();
    });
  }

  public async processTask(
    loggingPrefix: string,
    body: ProcessPaymentMethodNeedsUpdateNotifyingTaskRequestBody,
  ): Promise<void> {
    let statementRows = await getTransactionStatement(this.database, {
      transactionStatementStatementIdEq: body.statementId,
    });
    if (statementRows.length === 0) {
      throw newInternalServerErrorError(
        `${loggingPrefix} Statement ${body.statementId} is not found.`,
      );
    }
    let transactionStatement = statementRows[0];
    let { naturalName, contactEmail } = await this.serviceClient.send(
      newGetAccountContactRequest({
        accountId: transactionStatement.transactionStatementAccountId,
      }),
    );
    await this.sendgridClient.send({
      to: contactEmail,
      from: {
        email: ENV_VARS.supportEmail,
        name: SUPPORT_EMAIL_NAME,
      },
      templateId: LOCALIZATION.updatePaymentMethodEmailTemplateId,
      dynamicTemplateData: {
        name: naturalName,
        platformName: PLATFORM_NAME,
        month: transactionStatement.transactionStatementMonth,
        gracePeriodDays: `${GRACE_PERIOD_DAYS}`,
        updatePaymentMethodUrl: buildUrl(this.externalOrigin, {
          main: {
            chooseAccount: {
              accountId: transactionStatement.transactionStatementAccountId,
            },
            account: {
              payment: {},
            },
          },
        }),
        statementPageUrl: buildUrl(this.externalOrigin, {
          main: {
            chooseAccount: {
              accountId: transactionStatement.transactionStatementAccountId,
            },
            account: {
              statements: {},
            },
          },
        }),
      },
    });
    await this.database.runTransactionAsync(async (transaction) => {
      await transaction.batchUpdate([
        deletePaymentMethodNeedsUpdateNotifyingTaskStatement({
          paymentMethodNeedsUpdateNotifyingTaskStatementIdEq: body.statementId,
        }),
      ]);
      await transaction.commit();
    });
  }
}
