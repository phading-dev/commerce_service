import { SPANNER_DATABASE } from "../common/spanner_database";
import { listPendingStripeCustomerCreatingTasks } from "../db/sql";
import { Database } from "@google-cloud/spanner";
import { ListStripeCustomerCreatingTasksHandlerInterface } from "@phading/commerce_service_interface/node/handler";
import {
  ListStripeCustomerCreatingTasksRequestBody,
  ListStripeCustomerCreatingTasksResponse,
  ProcessStripeCustomerCreatingTaskRequestBody,
} from "@phading/commerce_service_interface/node/interface";

export class ListStripeCustomerCreatingTasksHandler extends ListStripeCustomerCreatingTasksHandlerInterface {
  public static create(): ListStripeCustomerCreatingTasksHandler {
    return new ListStripeCustomerCreatingTasksHandler(SPANNER_DATABASE, () =>
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
    body: ListStripeCustomerCreatingTasksRequestBody,
  ): Promise<ListStripeCustomerCreatingTasksResponse> {
    let rows = await listPendingStripeCustomerCreatingTasks(this.database, {
      stripeCustomerCreatingTaskExecutionTimeMsLe: this.getNow(),
    });
    return {
      tasks: rows.map(
        (row): ProcessStripeCustomerCreatingTaskRequestBody => ({
          taskId: row.stripeCustomerCreatingTaskTaskId,
          accountId: row.stripeCustomerCreatingTaskAccountId,
        }),
      ),
    };
  }
}
