import { SPANNER_DATABASE } from "../common/spanner_database";
import { listPendingBillingProfileStateSyncingTasks } from "../db/sql";
import { Database } from "@google-cloud/spanner";
import { ListBillingProfileStateSyncingTasksHandlerInterface } from "@phading/commerce_service_interface/node/handler";
import {
  ListBillingProfileStateSyncingTasksRequestBody,
  ListBillingProfileStateSyncingTasksResponse,
  ProcessBillingProfileStateSyncingTaskRequestBody,
} from "@phading/commerce_service_interface/node/interface";

export class ListBillingProfileStateSyncingTasksHandler extends ListBillingProfileStateSyncingTasksHandlerInterface {
  public static create(): ListBillingProfileStateSyncingTasksHandler {
    return new ListBillingProfileStateSyncingTasksHandler(
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
    body: ListBillingProfileStateSyncingTasksRequestBody,
  ): Promise<ListBillingProfileStateSyncingTasksResponse> {
    let rows = await listPendingBillingProfileStateSyncingTasks(this.database, {
      billingProfileStateSyncingTaskExecutionTimeMsLe: this.getNow(),
    });
    return {
      tasks: rows.map(
        (row): ProcessBillingProfileStateSyncingTaskRequestBody => ({
          accountId: row.billingProfileStateSyncingTaskAccountId,
          version: row.billingProfileStateSyncingTaskVersion,
        }),
      ),
    };
  }
}
