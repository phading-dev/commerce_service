import { SPANNER_DATABASE } from "../common/spanner_database";
import { listPendingStripeConnectedAccountNeedsSetupNotifyingTasks } from "../db/sql";
import { Database } from "@google-cloud/spanner";
import { ListStripeConnectedAccountNeedsSetupNotifyingTasksHandlerInterface } from "@phading/commerce_service_interface/node/handler";
import {
  ListStripeConnectedAccountNeedsSetupNotifyingTasksRequestBody,
  ListStripeConnectedAccountNeedsSetupNotifyingTasksResponse,
  ProcessStripeConnectedAccountNeedsSetupNotifyingTaskRequestBody,
} from "@phading/commerce_service_interface/node/interface";

export class ListStripeConnectedAccountNeedsSetupNotifyingTasksHandler extends ListStripeConnectedAccountNeedsSetupNotifyingTasksHandlerInterface {
  public static create(): ListStripeConnectedAccountNeedsSetupNotifyingTasksHandler {
    return new ListStripeConnectedAccountNeedsSetupNotifyingTasksHandler(
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
    body: ListStripeConnectedAccountNeedsSetupNotifyingTasksRequestBody,
  ): Promise<ListStripeConnectedAccountNeedsSetupNotifyingTasksResponse> {
    let rows = await listPendingStripeConnectedAccountNeedsSetupNotifyingTasks(
      this.database,
      {
        stripeConnectedAccountNeedsSetupNotifyingTaskExecutionTimeMsLe:
          this.getNow(),
      },
    );
    return {
      tasks: rows.map(
        (
          row,
        ): ProcessStripeConnectedAccountNeedsSetupNotifyingTaskRequestBody => ({
          accountId: row.stripeConnectedAccountNeedsSetupNotifyingTaskAccountId,
        }),
      ),
    };
  }
}
