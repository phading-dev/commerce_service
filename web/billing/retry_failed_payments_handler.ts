import { SERVICE_CLIENT } from "../../common/service_client";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import { PaymentState } from "../../db/schema";
import {
  insertPaymentTaskStatement,
  listPaymentsByState,
  updatePaymentStateStatement,
} from "../../db/sql";
import { Database } from "@google-cloud/spanner";
import { Statement } from "@google-cloud/spanner/build/src/transaction";
import { RetryFailedPaymentsHandlerInterface } from "@phading/commerce_service_interface/web/billing/handler";
import {
  RetryFailedPaymentsRequsetBody,
  RetryFailedPaymentsResponse,
} from "@phading/commerce_service_interface/web/billing/interface";
import { newFetchSessionAndCheckCapabilityRequest } from "@phading/user_session_service_interface/node/client";
import { newUnauthorizedError } from "@selfage/http_error";
import { NodeServiceClient } from "@selfage/node_service_client";

export class RetryFailedPaymentsHandler extends RetryFailedPaymentsHandlerInterface {
  public static create(): RetryFailedPaymentsHandler {
    return new RetryFailedPaymentsHandler(
      SPANNER_DATABASE,
      SERVICE_CLIENT,
      () => Date.now(),
    );
  }

  public constructor(
    private database: Database,
    private serviceClient: NodeServiceClient,
    private getNow: () => number,
  ) {
    super();
  }

  public async handle(
    loggingPrefix: string,
    body: RetryFailedPaymentsRequsetBody,
    sessionStr: string,
  ): Promise<RetryFailedPaymentsResponse> {
    let { accountId, capabilities } = await this.serviceClient.send(
      newFetchSessionAndCheckCapabilityRequest({
        signedSession: sessionStr,
        capabilitiesMask: {
          checkCanBeBilled: true,
        },
      }),
    );
    if (!capabilities.canBeBilled) {
      throw newUnauthorizedError(
        `Account ${accountId} is not allowed to retry failed payments.`,
      );
    }
    await this.database.runTransactionAsync(async (transaction) => {
      let paymentRows = await listPaymentsByState(transaction, {
        paymentAccountIdEq: accountId,
        paymentStateEq: PaymentState.FAILED,
      });
      let now = this.getNow();
      let statements = new Array<Statement>();
      for (let payment of paymentRows) {
        statements.push(
          updatePaymentStateStatement({
            paymentStatementIdEq: payment.paymentStatementId,
            setState: PaymentState.PROCESSING,
            setUpdatedTimeMs: now,
          }),
          insertPaymentTaskStatement({
            statementId: payment.paymentStatementId,
            retryCount: 0,
            executionTimeMs: now,
            createdTimeMs: now,
          }),
        );
      }
      if (statements.length > 0) {
        await transaction.batchUpdate(statements);
        await transaction.commit();
      }
    });
    return {};
  }
}
