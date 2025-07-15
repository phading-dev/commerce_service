import { SPANNER_DATABASE } from "../common/spanner_database";
import { listPendingPayoutStripeTransferSuccessNotifyingTasks } from "../db/sql";
import { Database } from "@google-cloud/spanner";
import { ListPayoutStripeTransferSuccessNotifyingTasksHandlerInterface } from "@phading/commerce_service_interface/node/handler";
import {
  ListPayoutStripeTransferSuccessNotifyingTasksRequestBody,
  ListPayoutStripeTransferSuccessNotifyingTasksResponse,
  ProcessPayoutStripeTransferSuccessNotifyingTaskRequestBody,
} from "@phading/commerce_service_interface/node/interface";

export class ListPayoutStripeTransferSuccessNotifyingTasksHandler extends ListPayoutStripeTransferSuccessNotifyingTasksHandlerInterface {
  public static create(): ListPayoutStripeTransferSuccessNotifyingTasksHandler {
    return new ListPayoutStripeTransferSuccessNotifyingTasksHandler(
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
    body: ListPayoutStripeTransferSuccessNotifyingTasksRequestBody,
  ): Promise<ListPayoutStripeTransferSuccessNotifyingTasksResponse> {
    let rows = await listPendingPayoutStripeTransferSuccessNotifyingTasks(
      this.database,
      {
        payoutStripeTransferSuccessNotifyingTaskExecutionTimeMsLe:
          this.getNow(),
      },
    );
    return {
      tasks: rows.map(
        (row): ProcessPayoutStripeTransferSuccessNotifyingTaskRequestBody => ({
          statementId: row.payoutStripeTransferSuccessNotifyingTaskStatementId,
        }),
      ),
    };
  }
}
