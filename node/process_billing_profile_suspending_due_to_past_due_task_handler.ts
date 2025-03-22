import { SPANNER_DATABASE } from "../common/spanner_database";
import { BillingProfileState, PaymentState } from "../db/schema";
import {
  deleteBillingProfileStateSyncingTaskStatement,
  deleteBillingProfileSuspendingDueToPastDueTaskStatement,
  getBillingProfileFromStatement,
  getPayment,
  insertBillingProfileStateSyncingTaskStatement,
  insertBillingProfileSuspensionNotifyingTaskStatement,
  updateBillingProfileStateStatement,
} from "../db/sql";
import { Database } from "@google-cloud/spanner";
import { Statement } from "@google-cloud/spanner/build/src/transaction";
import { ProcessBillingProfileSuspendingDueToPastDueTaskHandlerInterface } from "@phading/commerce_service_interface/node/handler";
import {
  ProcessBillingProfileSuspendingDueToPastDueTaskRequestBody,
  ProcessBillingProfileSuspendingDueToPastDueTaskResponse,
} from "@phading/commerce_service_interface/node/interface";
import { newInternalServerErrorError } from "@selfage/http_error";

export class ProcessBillingProfileSuspendingDueToPastDueTaskHandler extends ProcessBillingProfileSuspendingDueToPastDueTaskHandlerInterface {
  public static create(): ProcessBillingProfileSuspendingDueToPastDueTaskHandler {
    return new ProcessBillingProfileSuspendingDueToPastDueTaskHandler(
      SPANNER_DATABASE,
      () => Date.now(),
    );
  }

  public constructor(
    private database: Database,
    private getNow: () => number,
  ) {
    super();
  }

  public async handle(
    loggingPrefix: string,
    body: ProcessBillingProfileSuspendingDueToPastDueTaskRequestBody,
  ): Promise<ProcessBillingProfileSuspendingDueToPastDueTaskResponse> {
    await this.database.runTransactionAsync(async (transaction) => {
      let [profileRows, paymentRows] = await Promise.all([
        getBillingProfileFromStatement(transaction, {
          transactionStatementStatementIdEq: body.statementId,
        }),
        getPayment(transaction, {
          paymentStatementIdEq: body.statementId,
        }),
      ]);
      if (profileRows.length === 0) {
        throw newInternalServerErrorError(
          `${loggingPrefix} Billing profile for statement ${body.statementId} is not found.`,
        );
      }
      if (paymentRows.length === 0) {
        throw newInternalServerErrorError(
          `${loggingPrefix} Payment for statement ${body.statementId} is not found.`,
        );
      }
      let payment = paymentRows[0];
      let profile = profileRows[0];
      let statements: Array<Statement> = [
        deleteBillingProfileSuspendingDueToPastDueTaskStatement({
          billingProfileSuspendingDueToPastDueTaskStatementIdEq:
            body.statementId,
        }),
      ];
      if (
        payment.paymentState === PaymentState.FAILED &&
        profile.billingProfileStateInfo.state !== BillingProfileState.SUSPENDED
      ) {
        // If payment still failed and billing profile not suspended yet, suspend it.
        let now = this.getNow();
        let oldVersion = profile.billingProfileStateInfo.version;
        let newVersion = profile.billingProfileStateInfo.version + 1;
        statements.push(
          updateBillingProfileStateStatement({
            billingProfileAccountIdEq: profile.billingProfileAccountId,
            setStateInfo: {
              version: newVersion,
              state: BillingProfileState.SUSPENDED,
              updatedTimeMs: now,
            },
          }),
          insertBillingProfileSuspensionNotifyingTaskStatement({
            accountId: profile.billingProfileAccountId,
            version: newVersion,
            retryCount: 0,
            executionTimeMs: now,
            createdTimeMs: now,
          }),
          insertBillingProfileStateSyncingTaskStatement({
            accountId: profile.billingProfileAccountId,
            version: newVersion,
            retryCount: 0,
            executionTimeMs: now,
            createdTimeMs: now,
          }),
          deleteBillingProfileStateSyncingTaskStatement({
            billingProfileStateSyncingTaskAccountIdEq:
              profile.billingProfileAccountId,
            billingProfileStateSyncingTaskVersionEq: oldVersion,
          }),
        );
      }
      await transaction.batchUpdate(statements);
      await transaction.commit();
    });
    return {};
  }
}
