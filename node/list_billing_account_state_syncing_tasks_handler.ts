import { SPANNER_DATABASE } from "../common/spanner_database";
import { listBillingAccountStateSyncingTasks } from "../db/sql";
import { Database } from "@google-cloud/spanner";
import { ListBillingAccountStateSyncingTasksHandlerInterface } from "@phading/commerce_service_interface/node/handler";
import {
  ListBillingAccountStateSyncingTasksRequestBody,
  ListBillingAccountStateSyncingTasksResponse,
  ProcessBillingAccountStateSyncingTaskRequestBody,
} from "@phading/commerce_service_interface/node/interface";

export class ListBillingAccountStateSyncingTasksHandler extends ListBillingAccountStateSyncingTasksHandlerInterface {
  public static create(): ListBillingAccountStateSyncingTasksHandler {
    return new ListBillingAccountStateSyncingTasksHandler(
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
    body: ListBillingAccountStateSyncingTasksRequestBody,
  ): Promise<ListBillingAccountStateSyncingTasksResponse> {
    let rows = await listBillingAccountStateSyncingTasks(
      this.database,
      this.getNow(),
    );
    return {
      tasks: rows.map(
        (row): ProcessBillingAccountStateSyncingTaskRequestBody => ({
          accountId: row.billingAccountStateSyncingTaskAccountId,
          version: row.billingAccountStateSyncingTaskVersion,
        }),
      ),
    };
  }
}
