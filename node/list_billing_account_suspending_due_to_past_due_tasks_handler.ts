import { SPANNER_DATABASE } from "../common/spanner_database";
import { listBillingAccountSuspendingDueToPastDueTasks } from "../db/sql";
import { Database } from "@google-cloud/spanner";
import { ListBillingAccountSuspendingDueToPastDueTasksHandlerInterface } from "@phading/commerce_service_interface/node/handler";
import {
  ListBillingAccountSuspendingDueToPastDueTasksRequestBody,
  ListBillingAccountSuspendingDueToPastDueTasksResponse,
  ProcessBillingAccountSuspendingDueToPastDueTaskRequestBody,
} from "@phading/commerce_service_interface/node/interface";

export class ListBillingAccountSuspendingDueToPastDueTasksHandler extends ListBillingAccountSuspendingDueToPastDueTasksHandlerInterface {
  public static create(): ListBillingAccountSuspendingDueToPastDueTasksHandler {
    return new ListBillingAccountSuspendingDueToPastDueTasksHandler(
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
    body: ListBillingAccountSuspendingDueToPastDueTasksRequestBody,
  ): Promise<ListBillingAccountSuspendingDueToPastDueTasksResponse> {
    let accountRows = await listBillingAccountSuspendingDueToPastDueTasks(
      this.database,
      this.getNow(),
    );
    return {
      tasks: accountRows.map(
        (row): ProcessBillingAccountSuspendingDueToPastDueTaskRequestBody => ({
          billingId: row.billingAccountSuspendingDueToPastDueTaskBillingId,
        }),
      ),
    };
  }
}
