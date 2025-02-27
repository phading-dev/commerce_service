import { SPANNER_DATABASE } from "../common/spanner_database";
import { listPendingUpdatePaymentMethodNotifyingTasks } from "../db/sql";
import { Database } from "@google-cloud/spanner";
import { ListUpdatePaymentMethodNotifyingTasksHandlerInterface } from "@phading/commerce_service_interface/node/handler";
import {
  ListUpdatePaymentMethodNotifyingTasksRequestBody,
  ListUpdatePaymentMethodNotifyingTasksResponse,
  ProcessUpdatePaymentMethodNotifyingTaskRequestBody,
} from "@phading/commerce_service_interface/node/interface";

export class ListUpdatePaymentMethodNotifyingTasksHandler extends ListUpdatePaymentMethodNotifyingTasksHandlerInterface {
  public static create(): ListUpdatePaymentMethodNotifyingTasksHandler {
    return new ListUpdatePaymentMethodNotifyingTasksHandler(
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
    body: ListUpdatePaymentMethodNotifyingTasksRequestBody,
  ): Promise<ListUpdatePaymentMethodNotifyingTasksResponse> {
    let rows = await listPendingUpdatePaymentMethodNotifyingTasks(
      this.database,
      this.getNow(),
    );
    return {
      tasks: rows.map(
        (row): ProcessUpdatePaymentMethodNotifyingTaskRequestBody => ({
          billingId: row.updatePaymentMethodNotifyingTaskBillingId,
        }),
      ),
    };
  }
}
