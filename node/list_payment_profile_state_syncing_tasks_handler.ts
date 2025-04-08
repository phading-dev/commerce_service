import { SPANNER_DATABASE } from "../common/spanner_database";
import { listPendingPaymentProfileStateSyncingTasks } from "../db/sql";
import { Database } from "@google-cloud/spanner";
import { ListPaymentProfileStateSyncingTasksHandlerInterface } from "@phading/commerce_service_interface/node/handler";
import {
  ListPaymentProfileStateSyncingTasksRequestBody,
  ListPaymentProfileStateSyncingTasksResponse,
  ProcessPaymentProfileStateSyncingTaskRequestBody,
} from "@phading/commerce_service_interface/node/interface";

export class ListPaymentProfileStateSyncingTasksHandler extends ListPaymentProfileStateSyncingTasksHandlerInterface {
  public static create(): ListPaymentProfileStateSyncingTasksHandler {
    return new ListPaymentProfileStateSyncingTasksHandler(
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
    body: ListPaymentProfileStateSyncingTasksRequestBody,
  ): Promise<ListPaymentProfileStateSyncingTasksResponse> {
    let rows = await listPendingPaymentProfileStateSyncingTasks(this.database, {
      paymentProfileStateSyncingTaskExecutionTimeMsLe: this.getNow(),
    });
    return {
      tasks: rows.map(
        (row): ProcessPaymentProfileStateSyncingTaskRequestBody => ({
          accountId: row.paymentProfileStateSyncingTaskAccountId,
          version: row.paymentProfileStateSyncingTaskVersion,
        }),
      ),
    };
  }
}
