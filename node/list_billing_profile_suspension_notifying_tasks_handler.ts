import { SPANNER_DATABASE } from "../common/spanner_database";
import { listPendingBillingProfileSuspensionNotifyingTasks } from "../db/sql";
import { Database } from "@google-cloud/spanner";
import { ListBillingProfileSuspensionNotifyingTasksHandlerInterface } from "@phading/commerce_service_interface/node/handler";
import {
  ListBillingProfileSuspensionNotifyingTasksRequestBody,
  ListBillingProfileSuspensionNotifyingTasksResponse,
  ProcessBillingProfileSuspensionNotifyingTaskRequestBody,
} from "@phading/commerce_service_interface/node/interface";

export class ListBillingProfileSuspensionNotifyingTasksHandler extends ListBillingProfileSuspensionNotifyingTasksHandlerInterface {
  public static create(): ListBillingProfileSuspensionNotifyingTasksHandler {
    return new ListBillingProfileSuspensionNotifyingTasksHandler(
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
    body: ListBillingProfileSuspensionNotifyingTasksRequestBody,
  ): Promise<ListBillingProfileSuspensionNotifyingTasksResponse> {
    let rows = await listPendingBillingProfileSuspensionNotifyingTasks(
      this.database,
      { billingProfileSuspensionNotifyingTaskExecutionTimeMsLe: this.getNow() },
    );
    return {
      tasks: rows.map(
        (row): ProcessBillingProfileSuspensionNotifyingTaskRequestBody => ({
          accountId: row.billingProfileSuspensionNotifyingTaskAccountId,
          version: row.billingProfileSuspensionNotifyingTaskVersion,
        }),
      ),
    };
  }
}
