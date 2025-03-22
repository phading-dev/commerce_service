import { SPANNER_DATABASE } from "../common/spanner_database";
import { listPendingPaymentMethodNeedsUpdateNotifyingTasks } from "../db/sql";
import { Database } from "@google-cloud/spanner";
import { ListPaymentMethodNeedsUpdateNotifyingTasksHandlerInterface } from "@phading/commerce_service_interface/node/handler";
import {
  ListPaymentMethodNeedsUpdateNotifyingTasksRequestBody,
  ListPaymentMethodNeedsUpdateNotifyingTasksResponse,
  ProcessPaymentMethodNeedsUpdateNotifyingTaskRequestBody,
} from "@phading/commerce_service_interface/node/interface";

export class ListPaymentMethodNeedsUpdateNotifyingTasksHandler extends ListPaymentMethodNeedsUpdateNotifyingTasksHandlerInterface {
  public static create(): ListPaymentMethodNeedsUpdateNotifyingTasksHandler {
    return new ListPaymentMethodNeedsUpdateNotifyingTasksHandler(
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
    body: ListPaymentMethodNeedsUpdateNotifyingTasksRequestBody,
  ): Promise<ListPaymentMethodNeedsUpdateNotifyingTasksResponse> {
    let rows = await listPendingPaymentMethodNeedsUpdateNotifyingTasks(
      this.database,
      { paymentMethodNeedsUpdateNotifyingTaskExecutionTimeMsLe: this.getNow() },
    );
    return {
      tasks: rows.map(
        (row): ProcessPaymentMethodNeedsUpdateNotifyingTaskRequestBody => ({
          statementId: row.paymentMethodNeedsUpdateNotifyingTaskStatementId,
        }),
      ),
    };
  }
}
