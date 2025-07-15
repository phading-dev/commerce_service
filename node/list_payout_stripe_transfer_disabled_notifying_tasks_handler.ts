import { SPANNER_DATABASE } from "../common/spanner_database";
import { listPendingPayoutStripeTransferDisabledNotifyingTasks } from "../db/sql";
import { Database } from "@google-cloud/spanner";
import { ListPayoutStripeTransferDisabledNotifyingTasksHandlerInterface } from "@phading/commerce_service_interface/node/handler";
import {
  ListPayoutStripeTransferDisabledNotifyingTasksRequestBody,
  ListPayoutStripeTransferDisabledNotifyingTasksResponse,
  ProcessPayoutStripeTransferDisabledNotifyingTaskRequestBody,
} from "@phading/commerce_service_interface/node/interface";

export class ListPayoutStripeTransferDisabledNotifyingTasksHandler extends ListPayoutStripeTransferDisabledNotifyingTasksHandlerInterface {
  public static create(): ListPayoutStripeTransferDisabledNotifyingTasksHandler {
    return new ListPayoutStripeTransferDisabledNotifyingTasksHandler(
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
    body: ListPayoutStripeTransferDisabledNotifyingTasksRequestBody,
  ): Promise<ListPayoutStripeTransferDisabledNotifyingTasksResponse> {
    let rows = await listPendingPayoutStripeTransferDisabledNotifyingTasks(
      this.database,
      {
        payoutStripeTransferDisabledNotifyingTaskExecutionTimeMsLe:
          this.getNow(),
      },
    );
    return {
      tasks: rows.map(
        (row): ProcessPayoutStripeTransferDisabledNotifyingTaskRequestBody => ({
          statementId: row.payoutStripeTransferDisabledNotifyingTaskStatementId,
        }),
      ),
    };
  }
}
