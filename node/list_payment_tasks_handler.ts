import { SPANNER_DATABASE } from "../common/spanner_database";
import { listPendingPaymentTasks } from "../db/sql";
import { Database } from "@google-cloud/spanner";
import { ListPaymentTasksHandlerInterface } from "@phading/commerce_service_interface/node/handler";
import {
  ListPaymentTasksRequestBody,
  ListPaymentTasksResponse,
  ProcessPaymentTaskRequestBody,
} from "@phading/commerce_service_interface/node/interface";

export class ListPaymentTasksHandler extends ListPaymentTasksHandlerInterface {
  public static create(): ListPaymentTasksHandler {
    return new ListPaymentTasksHandler(SPANNER_DATABASE, () => Date.now());
  }

  public constructor(
    private database: Database,
    private getNow: () => number,
  ) {
    super();
  }

  public async handle(
    loggingPrefix: string,
    body: ListPaymentTasksRequestBody,
  ): Promise<ListPaymentTasksResponse> {
    let rows = await listPendingPaymentTasks(this.database, {
      paymentTaskExecutionTimeMsLe: this.getNow(),
    });
    return {
      tasks: rows.map(
        (row): ProcessPaymentTaskRequestBody => ({
          statementId: row.paymentTaskStatementId,
        }),
      ),
    };
  }
}
