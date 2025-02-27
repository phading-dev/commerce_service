import { SPANNER_DATABASE } from "../common/spanner_database";
import { listPendingStripeConnectedAccountCreatingTasks } from "../db/sql";
import { Database } from "@google-cloud/spanner";
import { ListStripeConnectedAccountCreatingTasksHandlerInterface } from "@phading/commerce_service_interface/node/handler";
import {
  ListStripeConnectedAccountCreatingTasksRequestBody,
  ListStripeConnectedAccountCreatingTasksResponse,
  ProcessStripeConnectedAccountCreatingTaskRequestBody,
} from "@phading/commerce_service_interface/node/interface";

export class ListStripeConnectedAccountCreatingTasksHandler extends ListStripeConnectedAccountCreatingTasksHandlerInterface {
  public static create(): ListStripeConnectedAccountCreatingTasksHandler {
    return new ListStripeConnectedAccountCreatingTasksHandler(
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
    body: ListStripeConnectedAccountCreatingTasksRequestBody,
  ): Promise<ListStripeConnectedAccountCreatingTasksResponse> {
    let rows = await listPendingStripeConnectedAccountCreatingTasks(
      this.database,
      this.getNow(),
    );
    return {
      tasks: rows.map(
        (row): ProcessStripeConnectedAccountCreatingTaskRequestBody => ({
          accountId: row.stripeConnectedAccountCreatingTaskAccountId,
        }),
      ),
    };
  }
}
