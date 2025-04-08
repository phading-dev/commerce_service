import { SPANNER_DATABASE } from "../common/spanner_database";
import { listPendingPaymentProfileSuspensionNotifyingTasks } from "../db/sql";
import { Database } from "@google-cloud/spanner";
import { ListPaymentProfileSuspensionNotifyingTasksHandlerInterface } from "@phading/commerce_service_interface/node/handler";
import {
  ListPaymentProfileSuspensionNotifyingTasksRequestBody,
  ListPaymentProfileSuspensionNotifyingTasksResponse,
  ProcessPaymentProfileSuspensionNotifyingTaskRequestBody,
} from "@phading/commerce_service_interface/node/interface";

export class ListPaymentProfileSuspensionNotifyingTasksHandler extends ListPaymentProfileSuspensionNotifyingTasksHandlerInterface {
  public static create(): ListPaymentProfileSuspensionNotifyingTasksHandler {
    return new ListPaymentProfileSuspensionNotifyingTasksHandler(
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
    body: ListPaymentProfileSuspensionNotifyingTasksRequestBody,
  ): Promise<ListPaymentProfileSuspensionNotifyingTasksResponse> {
    let rows = await listPendingPaymentProfileSuspensionNotifyingTasks(
      this.database,
      { paymentProfileSuspensionNotifyingTaskExecutionTimeMsLe: this.getNow() },
    );
    return {
      tasks: rows.map(
        (row): ProcessPaymentProfileSuspensionNotifyingTaskRequestBody => ({
          accountId: row.paymentProfileSuspensionNotifyingTaskAccountId,
          version: row.paymentProfileSuspensionNotifyingTaskVersion,
        }),
      ),
    };
  }
}
