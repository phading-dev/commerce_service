import crypto = require("crypto");
import { SERVICE_CLIENT } from "../../common/service_client";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import { PaymentState } from "../../db/schema";
import {
  insertPaymentStripeInvoiceCreatingTaskStatement,
  insertPaymentStripeInvoicePayingTaskStatement,
  listPaymentsByState,
  updatePaymentStateStatement,
} from "../../db/sql";
import { Database } from "@google-cloud/spanner";
import { Statement } from "@google-cloud/spanner/build/src/transaction";
import { RetryFailedPaymentsHandlerInterface } from "@phading/commerce_service_interface/web/payment/handler";
import {
  RetryFailedPaymentsRequsetBody,
  RetryFailedPaymentsResponse,
} from "@phading/commerce_service_interface/web/payment/interface";
import { newFetchSessionAndCheckCapabilityRequest } from "@phading/user_session_service_interface/node/client";
import { newUnauthorizedError } from "@selfage/http_error";
import { NodeServiceClient } from "@selfage/node_service_client";

export class RetryFailedPaymentsHandler extends RetryFailedPaymentsHandlerInterface {
  public static create(): RetryFailedPaymentsHandler {
    return new RetryFailedPaymentsHandler(
      SPANNER_DATABASE,
      SERVICE_CLIENT,
      () => crypto.randomUUID(),
      () => Date.now(),
    );
  }

  public constructor(
    private database: Database,
    private serviceClient: NodeServiceClient,
    private generateUuid: () => string,
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
      let [withoutInvoiceRows, withInvoiceRows] = await Promise.all([
        listPaymentsByState(transaction, {
          paymentAccountIdEq: accountId,
          paymentStateEq: PaymentState.FAILED_WITHOUT_INVOICE,
        }),
        listPaymentsByState(transaction, {
          paymentAccountIdEq: accountId,
          paymentStateEq: PaymentState.FAILED_WITH_INVOICE,
        }),
      ]);
      let now = this.getNow();
      let statements = new Array<Statement>();
      for (let payment of withoutInvoiceRows) {
        statements.push(
          updatePaymentStateStatement({
            paymentStatementIdEq: payment.paymentStatementId,
            setState: PaymentState.CREATING_STRIPE_INVOICE,
            setUpdatedTimeMs: now,
          }),
          insertPaymentStripeInvoiceCreatingTaskStatement({
            taskId: this.generateUuid(),
            statementId: payment.paymentStatementId,
            retryCount: 0,
            executionTimeMs: now,
            createdTimeMs: now,
          }),
        );
      }
      for (let payment of withInvoiceRows) {
        statements.push(
          updatePaymentStateStatement({
            paymentStatementIdEq: payment.paymentStatementId,
            setState: PaymentState.PAYING_INVOICE,
            setUpdatedTimeMs: now,
          }),
          insertPaymentStripeInvoicePayingTaskStatement({
            taskId: this.generateUuid(),
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
