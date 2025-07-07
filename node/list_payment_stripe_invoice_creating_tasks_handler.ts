import { SPANNER_DATABASE } from "../common/spanner_database";
import { listPendingPaymentStripeInvoiceCreatingTasks } from "../db/sql";
import { Database } from "@google-cloud/spanner";
import { ListPaymentStripeInvoiceCreatingTasksHandlerInterface } from "@phading/commerce_service_interface/node/handler";
import {
  ListPaymentStripeInvoiceCreatingTasksRequestBody,
  ListPaymentStripeInvoiceCreatingTasksResponse,
  ProcessPaymentStripeInvoiceCreatingTaskRequestBody,
} from "@phading/commerce_service_interface/node/interface";

export class ListPaymentStripeInvoiceCreatingTasksHandler extends ListPaymentStripeInvoiceCreatingTasksHandlerInterface {
  public static create(): ListPaymentStripeInvoiceCreatingTasksHandler {
    return new ListPaymentStripeInvoiceCreatingTasksHandler(
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
    body: ListPaymentStripeInvoiceCreatingTasksRequestBody,
  ): Promise<ListPaymentStripeInvoiceCreatingTasksResponse> {
    let rows = await listPendingPaymentStripeInvoiceCreatingTasks(
      this.database,
      {
        paymentStripeInvoiceCreatingTaskExecutionTimeMsLe: this.getNow(),
      },
    );
    return {
      tasks: rows.map(
        (row): ProcessPaymentStripeInvoiceCreatingTaskRequestBody => ({
          taskId: row.paymentStripeInvoiceCreatingTaskTaskId,
          statementId: row.paymentStripeInvoiceCreatingTaskStatementId,
        }),
      ),
    };
  }
}
