import { SPANNER_DATABASE } from "../common/spanner_database";
import { listPendingPayoutStripeTransferCreatingTasks } from "../db/sql";
import { Database } from "@google-cloud/spanner";
import { ListPayoutStripeTransferCreatingTasksHandlerInterface } from "@phading/commerce_service_interface/node/handler";
import {
  ListPayoutStripeTransferCreatingTasksRequestBody,
  ListPayoutStripeTransferCreatingTasksResponse,
  ProcessPayoutStripeTransferCreatingTaskRequestBody,
} from "@phading/commerce_service_interface/node/interface";

export class ListPayoutStripeTransferCreatingTasksHandler extends ListPayoutStripeTransferCreatingTasksHandlerInterface {
  public static create(): ListPayoutStripeTransferCreatingTasksHandler {
    return new ListPayoutStripeTransferCreatingTasksHandler(
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
    body: ListPayoutStripeTransferCreatingTasksRequestBody,
  ): Promise<ListPayoutStripeTransferCreatingTasksResponse> {
    let rows = await listPendingPayoutStripeTransferCreatingTasks(
      this.database,
      {
        payoutStripeTransferCreatingTaskExecutionTimeMsLe: this.getNow(),
      },
    );
    return {
      tasks: rows.map(
        (row): ProcessPayoutStripeTransferCreatingTaskRequestBody => ({
          taskId: row.payoutStripeTransferCreatingTaskTaskId,
          statementId: row.payoutStripeTransferCreatingTaskStatementId,
        }),
      ),
    };
  }
}
