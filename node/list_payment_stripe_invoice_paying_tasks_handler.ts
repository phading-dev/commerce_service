import { SPANNER_DATABASE } from "../common/spanner_database";
import { listPendingPaymentStripeInvoicePayingTasks } from "../db/sql";
import { Database } from "@google-cloud/spanner";
import { ListPaymentStripeInvoicePayingTasksHandlerInterface } from "@phading/commerce_service_interface/node/handler";
import {
  ListPaymentStripeInvoicePayingTasksRequestBody,
  ListPaymentStripeInvoicePayingTasksResponse,
  ProcessPaymentStripeInvoicePayingTaskRequestBody,
} from "@phading/commerce_service_interface/node/interface";

export class ListPaymentStripeInvoicePayingTasksHandler extends ListPaymentStripeInvoicePayingTasksHandlerInterface {
  public static create(): ListPaymentStripeInvoicePayingTasksHandler {
    return new ListPaymentStripeInvoicePayingTasksHandler(
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
    body: ListPaymentStripeInvoicePayingTasksRequestBody,
  ): Promise<ListPaymentStripeInvoicePayingTasksResponse> {
    let rows = await listPendingPaymentStripeInvoicePayingTasks(this.database, {
      paymentStripeInvoicePayingTaskExecutionTimeMsLe: this.getNow(),
    });
    return {
      tasks: rows.map(
        (row): ProcessPaymentStripeInvoicePayingTaskRequestBody => ({
          taskId: row.paymentStripeInvoicePayingTaskTaskId,
          statementId: row.paymentStripeInvoicePayingTaskStatementId,
        }),
      ),
    };
  }
}
