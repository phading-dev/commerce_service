import { PLATFORM_NAME, SUPPORT_EMAIL_NAME } from "../common/constants";
import { LOCALIZATION } from "../common/localization";
import { SENDGRID_CLIENT } from "../common/sendgrid_client";
import { SERVICE_CLIENT } from "../common/service_client";
import { SPANNER_DATABASE } from "../common/spanner_database";
import {
  deletePayoutStripeTransferDisabledNotifyingTaskStatement,
  getPayoutStripeTransferDisabledNotifyingTaskMetadata,
  getTransactionStatement,
  updatePayoutStripeTransferDisabledNotifyingTaskMetadataStatement,
} from "../db/sql";
import { ENV_VARS } from "../env_vars";
import { Database } from "@google-cloud/spanner";
import { ProcessPayoutStripeTransferDisabledNotifyingTaskHandlerInterface } from "@phading/commerce_service_interface/node/handler";
import {
  ProcessPayoutStripeTransferDisabledNotifyingTaskRequestBody,
  ProcessPayoutStripeTransferDisabledNotifyingTaskResponse,
} from "@phading/commerce_service_interface/node/interface";
import { getDollarAmount } from "@phading/price_config/amount_conversion";
import { newGetAccountContactRequest } from "@phading/user_service_interface/node/client";
import { buildUrl } from "@phading/web_interface/url_builder";
import {
  newBadRequestError,
  newInternalServerErrorError,
} from "@selfage/http_error";
import { NodeServiceClient } from "@selfage/node_service_client";
import { ProcessTaskHandlerWrapper } from "@selfage/service_handler/process_task_handler_wrapper";

export class ProcessPayoutStripeTransferDisabledNotifyingTaskHandler extends ProcessPayoutStripeTransferDisabledNotifyingTaskHandlerInterface {
  public static create(): ProcessPayoutStripeTransferDisabledNotifyingTaskHandler {
    return new ProcessPayoutStripeTransferDisabledNotifyingTaskHandler(
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
    body: ProcessPayoutStripeTransferDisabledNotifyingTaskRequestBody,
  ): Promise<ProcessPayoutStripeTransferDisabledNotifyingTaskResponse> {
    loggingPrefix = `${loggingPrefix} Payout stripe transfer disabled notifying task for statement ${body.statementId}:`;
    await this.taskHandler.wrap(
      loggingPrefix,
      () => this.claimTask(loggingPrefix, body),
      () => this.processTask(loggingPrefix, body),
    );
    return {};
  }

  public async claimTask(
    loggingPrefix: string,
    body: ProcessPayoutStripeTransferDisabledNotifyingTaskRequestBody,
  ): Promise<void> {
    await this.database.runTransactionAsync(async (transaction) => {
      let rows = await getPayoutStripeTransferDisabledNotifyingTaskMetadata(
        transaction,
        {
          payoutStripeTransferDisabledNotifyingTaskStatementIdEq:
            body.statementId,
        },
      );
      if (rows.length === 0) {
        throw newBadRequestError(`Task is not found.`);
      }
      let task = rows[0];
      await transaction.batchUpdate([
        updatePayoutStripeTransferDisabledNotifyingTaskMetadataStatement({
          payoutStripeTransferDisabledNotifyingTaskStatementIdEq:
            body.statementId,
          setRetryCount:
            task.payoutStripeTransferDisabledNotifyingTaskRetryCount + 1,
          setExecutionTimeMs:
            this.getNow() +
            this.taskHandler.getBackoffTime(
              task.payoutStripeTransferDisabledNotifyingTaskRetryCount,
            ),
        }),
      ]);
      await transaction.commit();
    });
  }

  public async processTask(
    loggingPrefix: string,
    body: ProcessPayoutStripeTransferDisabledNotifyingTaskRequestBody,
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
    let accountResponse = await this.serviceClient.send(
      newGetAccountContactRequest({
        accountId: transactionStatement.transactionStatementAccountId,
      }),
    );
    let money = new Intl.NumberFormat(LOCALIZATION.locale, {
      style: "currency",
      currency: transactionStatement.transactionStatementStatement.currency,
    }).format(
      getDollarAmount(
        transactionStatement.transactionStatementStatement.totalAmount,
        transactionStatement.transactionStatementStatement.currency,
      ),
    );
    await this.sendgridClient.send({
      to: accountResponse.contactEmail,
      from: {
        email: ENV_VARS.supportEmail,
        name: SUPPORT_EMAIL_NAME,
      },
      templateId: LOCALIZATION.payoutDisabledEmailTemplateId,
      dynamicTemplateData: {
        name: accountResponse.naturalName,
        platformName: PLATFORM_NAME,
        month: transactionStatement.transactionStatementMonth,
        money,
        setupPayoutUrl: buildUrl(this.externalOrigin, {
          main: {
            chooseAccount: {
              accountId: transactionStatement.transactionStatementAccountId,
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
        deletePayoutStripeTransferDisabledNotifyingTaskStatement({
          payoutStripeTransferDisabledNotifyingTaskStatementIdEq:
            body.statementId,
        }),
      ]);
      await transaction.commit();
    });
  }
}
