import { SPANNER_DATABASE } from "../common/spanner_database";
import { listPendingInitPaymentCreditGrantingTasks } from "../db/sql";
import { Database } from "@google-cloud/spanner";
import { ListInitPaymentCreditGrantingTasksHandlerInterface } from "@phading/commerce_service_interface/node/handler";
import {
  ListInitPaymentCreditGrantingTasksRequestBody,
  ListInitPaymentCreditGrantingTasksResponse,
  ProcessInitPaymentCreditGrantingTaskRequestBody,
} from "@phading/commerce_service_interface/node/interface";

export class ListInitPaymentCreditGrantingTasksHandler extends ListInitPaymentCreditGrantingTasksHandlerInterface {
  public static create(): ListInitPaymentCreditGrantingTasksHandler {
    return new ListInitPaymentCreditGrantingTasksHandler(SPANNER_DATABASE, () =>
      Date.now(),
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
    body: ListInitPaymentCreditGrantingTasksRequestBody,
  ): Promise<ListInitPaymentCreditGrantingTasksResponse> {
    let rows = await listPendingInitPaymentCreditGrantingTasks(this.database, {
      initPaymentCreditGrantingTaskExecutionTimeMsLe: this.getNow(),
    });
    return {
      tasks: rows.map(
        (row): ProcessInitPaymentCreditGrantingTaskRequestBody => ({
          accountId: row.initPaymentCreditGrantingTaskAccountId,
        }),
      ),
    };
  }
}
