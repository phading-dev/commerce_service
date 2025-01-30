import { SPANNER_DATABASE } from "../common/spanner_database";
import { listSetupStripeConnectedAccountNotifyingTasks } from "../db/sql";
import { Database } from "@google-cloud/spanner";
import { ListSetupStripeConnectedAccountNotifyingTasksHandlerInterface } from "@phading/commerce_service_interface/node/handler";
import {
  ListSetupStripeConnectedAccountNotifyingTasksRequestBody,
  ListSetupStripeConnectedAccountNotifyingTasksResponse,
  ProcessSetupStripeConnectedAccountNotifyingTaskRequestBody,
} from "@phading/commerce_service_interface/node/interface";

export class ListSetupStripeConnectedAccountNotifyingTasksHandler extends ListSetupStripeConnectedAccountNotifyingTasksHandlerInterface {
  public static create(): ListSetupStripeConnectedAccountNotifyingTasksHandler {
    return new ListSetupStripeConnectedAccountNotifyingTasksHandler(
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
    body: ListSetupStripeConnectedAccountNotifyingTasksRequestBody,
  ): Promise<ListSetupStripeConnectedAccountNotifyingTasksResponse> {
    let rows = await listSetupStripeConnectedAccountNotifyingTasks(
      this.database,
      this.getNow(),
    );
    return {
      tasks: rows.map(
        (row): ProcessSetupStripeConnectedAccountNotifyingTaskRequestBody => ({
          accountId: row.setupStripeConnectedAccountNotifyingTaskAccountId,
        }),
      ),
    };
  }
}
