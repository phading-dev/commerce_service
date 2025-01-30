import { SPANNER_DATABASE } from "../common/spanner_database";
import { listPayoutTasks } from "../db/sql";
import { Database } from "@google-cloud/spanner";
import { ListPayoutTasksHandlerInterface } from "@phading/commerce_service_interface/node/handler";
import {
  ListPayoutTasksRequestBody,
  ListPayoutTasksResponse,
  ProcessPayoutTaskRequestBody,
} from "@phading/commerce_service_interface/node/interface";

export class ListPayoutTasksHandler extends ListPayoutTasksHandlerInterface {
  public static create(): ListPayoutTasksHandler {
    return new ListPayoutTasksHandler(SPANNER_DATABASE, () => Date.now());
  }

  public constructor(
    private database: Database,
    private getNow: () => number,
  ) {
    super();
  }

  public async handle(
    loggingPrefix: string,
    body: ListPayoutTasksRequestBody,
  ): Promise<ListPayoutTasksResponse> {
    let rows = await listPayoutTasks(this.database, this.getNow());
    return {
      tasks: rows.map(
        (row): ProcessPayoutTaskRequestBody => ({
          earningsId: row.payoutTaskEarningsId,
        }),
      ),
    };
  }
}
