import { SPANNER_DATABASE } from "../common/spanner_database";
import { listPendingPaymentProfileSuspendingDueToPastDueTasks } from "../db/sql";
import { Database } from "@google-cloud/spanner";
import { ListPaymentProfileSuspendingDueToPastDueTasksHandlerInterface } from "@phading/commerce_service_interface/node/handler";
import {
  ListPaymentProfileSuspendingDueToPastDueTasksRequestBody,
  ListPaymentProfileSuspendingDueToPastDueTasksResponse,
  ProcessPaymentProfileSuspendingDueToPastDueTaskRequestBody,
} from "@phading/commerce_service_interface/node/interface";

export class ListPaymentProfileSuspendingDueToPastDueTasksHandler extends ListPaymentProfileSuspendingDueToPastDueTasksHandlerInterface {
  public static create(): ListPaymentProfileSuspendingDueToPastDueTasksHandler {
    return new ListPaymentProfileSuspendingDueToPastDueTasksHandler(
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
    body: ListPaymentProfileSuspendingDueToPastDueTasksRequestBody,
  ): Promise<ListPaymentProfileSuspendingDueToPastDueTasksResponse> {
    let accountRows =
      await listPendingPaymentProfileSuspendingDueToPastDueTasks(
        this.database,
        {
          paymentProfileSuspendingDueToPastDueTaskExecutionTimeMsLe:
            this.getNow(),
        },
      );
    return {
      tasks: accountRows.map(
        (row): ProcessPaymentProfileSuspendingDueToPastDueTaskRequestBody => ({
          statementId: row.paymentProfileSuspendingDueToPastDueTaskStatementId,
        }),
      ),
    };
  }
}
