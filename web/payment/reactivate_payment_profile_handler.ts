import { SERVICE_CLIENT } from "../../common/service_client";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import { PaymentProfileState, PaymentState } from "../../db/schema";
import {
  deletePaymentProfileStateSyncingTaskStatement,
  getPaymentProfile,
  insertPaymentProfileStateSyncingTaskStatement,
  listPaymentsByState,
  updatePaymentProfileStateStatement,
} from "../../db/sql";
import { Database } from "@google-cloud/spanner";
import { ReactivatePaymentProfileHandlerInterface } from "@phading/commerce_service_interface/web/payment/handler";
import {
  ReactivatePaymentProfileRequestBody,
  ReactivatePaymentProfileResponse,
} from "@phading/commerce_service_interface/web/payment/interface";
import { newFetchSessionAndCheckCapabilityRequest } from "@phading/user_session_service_interface/node/client";
import {
  newBadRequestError,
  newNotFoundError,
  newUnauthorizedError,
} from "@selfage/http_error";
import { NodeServiceClient } from "@selfage/node_service_client";

export class ReactivatePaymentProfileHandler extends ReactivatePaymentProfileHandlerInterface {
  public static create(): ReactivatePaymentProfileHandler {
    return new ReactivatePaymentProfileHandler(
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
    body: ReactivatePaymentProfileRequestBody,
    sessionStr: string,
  ): Promise<ReactivatePaymentProfileResponse> {
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
        `Account ${accountId} is not allowed to reactivate payment profile.`,
      );
    }

    await this.database.runTransactionAsync(async (transaction) => {
      let [
        profileRows,
        failedWithoutInvoiceRows,
        failedWithInvoiceRows,
        waitingRows,
        creatingRows,
        payingRows,
      ] = await Promise.all([
        getPaymentProfile(this.database, {
          paymentProfileAccountIdEq: accountId,
        }),
        listPaymentsByState(this.database, {
          paymentAccountIdEq: accountId,
          paymentStateEq: PaymentState.FAILED_WITHOUT_INVOICE,
        }),
        listPaymentsByState(this.database, {
          paymentAccountIdEq: accountId,
          paymentStateEq: PaymentState.FAILED_WITH_INVOICE,
        }),
        listPaymentsByState(this.database, {
          paymentAccountIdEq: accountId,
          paymentStateEq: PaymentState.WAITING_FOR_INVOICE_PAYMENT,
        }),
        listPaymentsByState(this.database, {
          paymentAccountIdEq: accountId,
          paymentStateEq: PaymentState.CREATING_STRIPE_INVOICE,
        }),
        listPaymentsByState(this.database, {
          paymentAccountIdEq: accountId,
          paymentStateEq: PaymentState.PAYING_INVOICE,
        }),
      ]);
      if (profileRows.length === 0) {
        throw newNotFoundError(
          `Payment profile for account ${accountId} not found.`,
        );
      }
      let profile = profileRows[0];
      if (profile.paymentProfileStateInfo.state !== PaymentProfileState.SUSPENDED) {
        throw newBadRequestError(
          `Payment profile for account ${accountId} is not suspended.`,
        );
      }
      if (
        failedWithInvoiceRows.length > 0 ||
        failedWithoutInvoiceRows.length > 0 ||
        waitingRows.length > 0 ||
        creatingRows.length > 0 ||
        payingRows.length > 0
      ) {
        throw newBadRequestError(
          `Payment profile for account ${accountId} cannot be reactivated due to failed or processing payments.`,
        );
      }
      let now = this.getNow();
      let oldVersion = profile.paymentProfileStateInfo.version;
      let newVersion = profile.paymentProfileStateInfo.version + 1;
      await transaction.batchUpdate([
        updatePaymentProfileStateStatement({
          paymentProfileAccountIdEq: accountId,
          setStateInfo: {
            version: newVersion,
            state: PaymentProfileState.HEALTHY,
            updatedTimeMs: now,
          },
        }),
        insertPaymentProfileStateSyncingTaskStatement({
          accountId: profile.paymentProfileAccountId,
          version: newVersion,
          retryCount: 0,
          executionTimeMs: now,
          createdTimeMs: now,
        }),
        deletePaymentProfileStateSyncingTaskStatement({
          paymentProfileStateSyncingTaskAccountIdEq:
            profile.paymentProfileAccountId,
          paymentProfileStateSyncingTaskVersionEq: oldVersion,
        }),
      ]);
      await transaction.commit();
    });
    return {};
  }
}
