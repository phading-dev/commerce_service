import { SPANNER_DATABASE } from "../common/spanner_database";
import { PaymentProfileState, PaymentState } from "../db/schema";
import {
  deletePaymentProfileStateSyncingTaskStatement,
  deletePaymentProfileSuspendingDueToPastDueTaskStatement,
  getPayment,
  getPaymentProfileFromStatement,
  insertPaymentProfileStateSyncingTaskStatement,
  insertPaymentProfileSuspensionNotifyingTaskStatement,
  updatePaymentProfileStateStatement,
} from "../db/sql";
import { Database } from "@google-cloud/spanner";
import { Statement } from "@google-cloud/spanner/build/src/transaction";
import { ProcessPaymentProfileSuspendingDueToPastDueTaskHandlerInterface } from "@phading/commerce_service_interface/node/handler";
import {
  ProcessPaymentProfileSuspendingDueToPastDueTaskRequestBody,
  ProcessPaymentProfileSuspendingDueToPastDueTaskResponse,
} from "@phading/commerce_service_interface/node/interface";
import { newInternalServerErrorError } from "@selfage/http_error";

export class ProcessPaymentProfileSuspendingDueToPastDueTaskHandler extends ProcessPaymentProfileSuspendingDueToPastDueTaskHandlerInterface {
  public static create(): ProcessPaymentProfileSuspendingDueToPastDueTaskHandler {
    return new ProcessPaymentProfileSuspendingDueToPastDueTaskHandler(
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
    body: ProcessPaymentProfileSuspendingDueToPastDueTaskRequestBody,
  ): Promise<ProcessPaymentProfileSuspendingDueToPastDueTaskResponse> {
    await this.database.runTransactionAsync(async (transaction) => {
      let [profileRows, paymentRows] = await Promise.all([
        getPaymentProfileFromStatement(transaction, {
          transactionStatementStatementIdEq: body.statementId,
        }),
        getPayment(transaction, {
          paymentStatementIdEq: body.statementId,
        }),
      ]);
      if (profileRows.length === 0) {
        throw newInternalServerErrorError(
          `${loggingPrefix} Payment profile for statement ${body.statementId} is not found.`,
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
        deletePaymentProfileSuspendingDueToPastDueTaskStatement({
          paymentProfileSuspendingDueToPastDueTaskStatementIdEq:
            body.statementId,
        }),
      ];
      if (
        payment.paymentState !== PaymentState.PAID &&
        profile.paymentProfileStateInfo.state !== PaymentProfileState.SUSPENDED
      ) {
        // If payment still failed and payment profile not suspended yet, suspend it.
        let now = this.getNow();
        let oldVersion = profile.paymentProfileStateInfo.version;
        let newVersion = profile.paymentProfileStateInfo.version + 1;
        statements.push(
          updatePaymentProfileStateStatement({
            paymentProfileAccountIdEq: profile.paymentProfileAccountId,
            setStateInfo: {
              version: newVersion,
              state: PaymentProfileState.SUSPENDED,
              updatedTimeMs: now,
            },
          }),
          insertPaymentProfileSuspensionNotifyingTaskStatement({
            accountId: profile.paymentProfileAccountId,
            version: newVersion,
            retryCount: 0,
            executionTimeMs: now,
            createdTimeMs: now,
          }),
          insertPaymentProfileStateSyncingTaskStatement({
            accountId: profile.paymentProfileAccountId,
            version: newVersion,
            retryCount: 0,
            executionTimeMs: now,
            createdTimeMs: now,
          }),
          deletePaymentProfileStateSyncingTaskStatement({
            paymentProfileStateSyncingTaskAccountIdEq:
              profile.paymentProfileAccountId,
            paymentProfileStateSyncingTaskVersionEq: oldVersion,
          }),
        );
      }
      await transaction.batchUpdate(statements);
      await transaction.commit();
    });
    return {};
  }
}
