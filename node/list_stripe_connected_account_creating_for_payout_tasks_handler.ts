import { SPANNER_DATABASE } from "../common/spanner_database";
import { listPendingStripeConnectedAccountForPayoutCreatingTasks } from "../db/sql";
import { Database } from "@google-cloud/spanner";
import { ListStripeConnectedAccountForPayoutCreatingTasksHandlerInterface } from "@phading/commerce_service_interface/node/handler";
import {
  ListStripeConnectedAccountForPayoutCreatingTasksRequestBody,
  ListStripeConnectedAccountForPayoutCreatingTasksResponse,
  ProcessStripeConnectedAccountForPayoutCreatingTaskRequestBody,
} from "@phading/commerce_service_interface/node/interface";

export class ListStripeConnectedAccountForPayoutCreatingTasksHandler extends ListStripeConnectedAccountForPayoutCreatingTasksHandlerInterface {
  public static create(): ListStripeConnectedAccountForPayoutCreatingTasksHandler {
    return new ListStripeConnectedAccountForPayoutCreatingTasksHandler(
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
    body: ListStripeConnectedAccountForPayoutCreatingTasksRequestBody,
  ): Promise<ListStripeConnectedAccountForPayoutCreatingTasksResponse> {
    let rows = await listPendingStripeConnectedAccountForPayoutCreatingTasks(
      this.database,
      {
        stripeConnectedAccountForPayoutCreatingTaskExecutionTimeMsLe:
          this.getNow(),
      },
    );
    return {
      tasks: rows.map(
        (
          row,
        ): ProcessStripeConnectedAccountForPayoutCreatingTaskRequestBody => ({
          taskId: row.stripeConnectedAccountForPayoutCreatingTaskTaskId,
          accountId: row.stripeConnectedAccountForPayoutCreatingTaskAccountId,
        }),
      ),
    };
  }
}
