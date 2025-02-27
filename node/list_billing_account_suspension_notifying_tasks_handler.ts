import { SPANNER_DATABASE } from "../common/spanner_database";
import { listPendingBillingAccountSuspensionNotifyingTasks } from "../db/sql";
import { Database } from "@google-cloud/spanner";
import { ListBillingAccountSuspensionNotifyingTasksHandlerInterface } from "@phading/commerce_service_interface/node/handler";
import {
  ListBillingAccountSuspensionNotifyingTasksRequestBody,
  ListBillingAccountSuspensionNotifyingTasksResponse,
  ProcessBillingAccountSuspensionNotifyingTaskRequestBody,
} from "@phading/commerce_service_interface/node/interface";

export class ListBillingAccountSuspensionNotifyingTasksHandler extends ListBillingAccountSuspensionNotifyingTasksHandlerInterface {
  public static create(): ListBillingAccountSuspensionNotifyingTasksHandler {
    return new ListBillingAccountSuspensionNotifyingTasksHandler(
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
    body: ListBillingAccountSuspensionNotifyingTasksRequestBody,
  ): Promise<ListBillingAccountSuspensionNotifyingTasksResponse> {
    let rows = await listPendingBillingAccountSuspensionNotifyingTasks(
      this.database,
      this.getNow(),
    );
    return {
      tasks: rows.map(
        (row): ProcessBillingAccountSuspensionNotifyingTaskRequestBody => ({
          accountId: row.billingAccountSuspensionNotifyingTaskAccountId,
          version: row.billingAccountSuspensionNotifyingTaskVersion,
        }),
      ),
    };
  }
}
