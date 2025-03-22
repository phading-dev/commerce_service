import { SPANNER_DATABASE } from "../common/spanner_database";
import { listPendingStripePaymentCustomerCreatingTasks } from "../db/sql";
import { Database } from "@google-cloud/spanner";
import { ListStripePaymentCustomerCreatingTasksHandlerInterface } from "@phading/commerce_service_interface/node/handler";
import {
  ListStripePaymentCustomerCreatingTasksRequestBody,
  ListStripePaymentCustomerCreatingTasksResponse,
  ProcessStripePaymentCustomerCreatingTaskRequestBody,
} from "@phading/commerce_service_interface/node/interface";

export class ListStripePaymentCustomerCreatingTasksHandler extends ListStripePaymentCustomerCreatingTasksHandlerInterface {
  public static create(): ListStripePaymentCustomerCreatingTasksHandler {
    return new ListStripePaymentCustomerCreatingTasksHandler(
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
    body: ListStripePaymentCustomerCreatingTasksRequestBody,
  ): Promise<ListStripePaymentCustomerCreatingTasksResponse> {
    let rows = await listPendingStripePaymentCustomerCreatingTasks(
      this.database,
      { stripePaymentCustomerCreatingTaskExecutionTimeMsLe: this.getNow() },
    );
    return {
      tasks: rows.map(
        (row): ProcessStripePaymentCustomerCreatingTaskRequestBody => ({
          accountId: row.stripePaymentCustomerCreatingTaskAccountId,
        }),
      ),
    };
  }
}
