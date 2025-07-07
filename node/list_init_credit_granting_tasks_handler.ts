import { SPANNER_DATABASE } from "../common/spanner_database";
import { listPendingInitCreditGrantingTasks } from "../db/sql";
import { Database } from "@google-cloud/spanner";
import { ListInitCreditGrantingTasksHandlerInterface } from "@phading/commerce_service_interface/node/handler";
import {
  ListInitCreditGrantingTasksRequestBody,
  ListInitCreditGrantingTasksResponse,
  ProcessInitCreditGrantingTaskRequestBody,
} from "@phading/commerce_service_interface/node/interface";

export class ListInitCreditGrantingTasksHandler extends ListInitCreditGrantingTasksHandlerInterface {
  public static create(): ListInitCreditGrantingTasksHandler {
    return new ListInitCreditGrantingTasksHandler(SPANNER_DATABASE, () =>
      Date.now(),
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
    body: ListInitCreditGrantingTasksRequestBody,
  ): Promise<ListInitCreditGrantingTasksResponse> {
    let rows = await listPendingInitCreditGrantingTasks(this.database, {
      initCreditGrantingTaskExecutionTimeMsLe: this.getNow(),
    });
    return {
      tasks: rows.map(
        (row): ProcessInitCreditGrantingTaskRequestBody => ({
          taskId: row.initCreditGrantingTaskTaskId,
          accountId: row.initCreditGrantingTaskAccountId,
        }),
      ),
    };
  }
}
