import { SPANNER_DATABASE } from "../common/spanner_database";
import { BillingAccountState } from "../db/schema";
import {
  deleteBillingAccountStateSyncingTaskStatement,
  deleteBillingAccountSuspendingDueToPastDueTaskStatement,
  getBillingAccountFromBilling,
  insertBillingAccountStateSyncingTaskStatement,
  insertBillingAccountSuspensionNotifyingTaskStatement,
  updateBillingAccountStatement,
} from "../db/sql";
import { Database } from "@google-cloud/spanner";
import { Statement } from "@google-cloud/spanner/build/src/transaction";
import { ProcessBillingAccountSuspendingDueToPastDueTaskHandlerInterface } from "@phading/commerce_service_interface/node/handler";
import {
  ProcessBillingAccountSuspendingDueToPastDueTaskRequestBody,
  ProcessBillingAccountSuspendingDueToPastDueTaskResponse,
} from "@phading/commerce_service_interface/node/interface";
import { newInternalServerErrorError } from "@selfage/http_error";

export class ProcessBillingAccountSuspendingDueToPastDueTaskHandler extends ProcessBillingAccountSuspendingDueToPastDueTaskHandlerInterface {
  public static create(): ProcessBillingAccountSuspendingDueToPastDueTaskHandler {
    return new ProcessBillingAccountSuspendingDueToPastDueTaskHandler(
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
    body: ProcessBillingAccountSuspendingDueToPastDueTaskRequestBody,
  ): Promise<ProcessBillingAccountSuspendingDueToPastDueTaskResponse> {
    await this.database.runTransactionAsync(async (transaction) => {
      let rows = await getBillingAccountFromBilling(
        transaction,
        body.billingId,
      );
      if (rows.length === 0) {
        throw newInternalServerErrorError(
          `${loggingPrefix} Billing ${body.billingId} is not found.`,
        );
      }
      let billingAccount = rows[0].aData;
      let statements: Array<Statement> = [
        deleteBillingAccountSuspendingDueToPastDueTaskStatement(body.billingId),
      ];
      if (billingAccount.stateInfo.state !== BillingAccountState.SUSPENDED) {
        let now = this.getNow();
        billingAccount.stateInfo.state = BillingAccountState.SUSPENDED;
        billingAccount.stateInfo.updatedTimeMs = now;
        let prevVersion = billingAccount.stateInfo.version++;
        statements.push(
          updateBillingAccountStatement(billingAccount),
          insertBillingAccountSuspensionNotifyingTaskStatement(
            billingAccount.accountId,
            billingAccount.stateInfo.version,
            0,
            now,
            now,
          ),
          insertBillingAccountStateSyncingTaskStatement(
            billingAccount.accountId,
            billingAccount.stateInfo.version,
            0,
            now,
            now,
          ),
          deleteBillingAccountStateSyncingTaskStatement(
            billingAccount.accountId,
            prevVersion,
          ),
        );
      }
      await transaction.batchUpdate(statements);
      await transaction.commit();
    });
    return {};
  }
}
