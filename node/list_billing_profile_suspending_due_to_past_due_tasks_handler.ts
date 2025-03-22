import { SPANNER_DATABASE } from "../common/spanner_database";
import { listPendingBillingProfileSuspendingDueToPastDueTasks } from "../db/sql";
import { Database } from "@google-cloud/spanner";
import { ListBillingProfileSuspendingDueToPastDueTasksHandlerInterface } from "@phading/commerce_service_interface/node/handler";
import {
  ListBillingProfileSuspendingDueToPastDueTasksRequestBody,
  ListBillingProfileSuspendingDueToPastDueTasksResponse,
  ProcessBillingProfileSuspendingDueToPastDueTaskRequestBody,
} from "@phading/commerce_service_interface/node/interface";

export class ListBillingProfileSuspendingDueToPastDueTasksHandler extends ListBillingProfileSuspendingDueToPastDueTasksHandlerInterface {
  public static create(): ListBillingProfileSuspendingDueToPastDueTasksHandler {
    return new ListBillingProfileSuspendingDueToPastDueTasksHandler(
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
    body: ListBillingProfileSuspendingDueToPastDueTasksRequestBody,
  ): Promise<ListBillingProfileSuspendingDueToPastDueTasksResponse> {
    let accountRows =
      await listPendingBillingProfileSuspendingDueToPastDueTasks(
        this.database,
        {
          billingProfileSuspendingDueToPastDueTaskExecutionTimeMsLe:
            this.getNow(),
        },
      );
    return {
      tasks: accountRows.map(
        (row): ProcessBillingProfileSuspendingDueToPastDueTaskRequestBody => ({
          statementId: row.billingProfileSuspendingDueToPastDueTaskStatementId,
        }),
      ),
    };
  }
}
