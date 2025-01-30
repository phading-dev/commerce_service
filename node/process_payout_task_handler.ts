import Stripe from "stripe";
import { SPANNER_DATABASE } from "../common/spanner_database";
import { STRIPE_CLIENT } from "../common/stripe_client";
import { Earnings, PayoutState } from "../db/schema";
import {
  deletePayoutTaskStatement,
  getEarnings,
  getEarningsAccount,
  updateEarningsStatement,
  updatePayoutTaskStatement,
} from "../db/sql";
import { Database, Transaction } from "@google-cloud/spanner";
import { ProcessPayoutTaskHandlerInterface } from "@phading/commerce_service_interface/node/handler";
import {
  ProcessPayoutTaskRequestBody,
  ProcessPayoutTaskResponse,
} from "@phading/commerce_service_interface/node/interface";
import {
  newBadRequestError,
  newInternalServerErrorError,
} from "@selfage/http_error";

export class ProcessPayoutTaskHandler extends ProcessPayoutTaskHandlerInterface {
  public static create(): ProcessPayoutTaskHandler {
    return new ProcessPayoutTaskHandler(SPANNER_DATABASE, STRIPE_CLIENT, () =>
      Date.now(),
    );
  }

  private static RETRY_BACKOFF_MS = 5 * 60 * 1000;
  public doneCallbackFn = (): void => {};

  public constructor(
    private database: Database,
    private stripeClient: Stripe,
    private getNow: () => number,
  ) {
    super();
  }

  public async handle(
    loggingPrefix: string,
    body: ProcessPayoutTaskRequestBody,
  ): Promise<ProcessPayoutTaskResponse> {
    loggingPrefix = `${loggingPrefix} Payout task for earnings ${body.earningsId}:`;
    let { earnings } = await this.getPayloadAndClaimTask(
      loggingPrefix,
      body.earningsId,
    );
    this.startProcessingAndCatchError(loggingPrefix, earnings);
    return {};
  }

  private async getPayloadAndClaimTask(
    loggingPrefix: string,
    earningsId: string,
  ): Promise<{
    earnings: Earnings;
  }> {
    let earnings: Earnings;
    await this.database.runTransactionAsync(async (transaction) => {
      earnings = await this.getValidEarnings(transaction, earningsId);
      let delayedTimeMs =
        this.getNow() + ProcessPayoutTaskHandler.RETRY_BACKOFF_MS;
      console.log(
        `${loggingPrefix} Claiming the task by delaying it to ${delayedTimeMs}.`,
      );
      await transaction.batchUpdate([
        updatePayoutTaskStatement(earningsId, delayedTimeMs),
      ]);
      await transaction.commit();
    });
    return { earnings };
  }

  private async startProcessingAndCatchError(
    loggingPrefix: string,
    earnings: Earnings,
  ) {
    try {
      await this.startProcessing(loggingPrefix, earnings);
      console.log(`${loggingPrefix} Task completed.`);
    } catch (e) {
      console.error(`${loggingPrefix} Task failed! ${e.stack ?? e}`);
    }
    this.doneCallbackFn();
  }

  private async startProcessing(loggingPrefix: string, earnings: Earnings) {
    let accountRows = await getEarningsAccount(
      this.database,
      earnings.accountId,
    );
    if (accountRows.length === 0) {
      throw newInternalServerErrorError(
        `${loggingPrefix} Earnings account ${earnings.accountId} is not found.`,
      );
    }
    let stripeConnectedAccountId =
      accountRows[0].earningsAccountData.stripeConnectedAccountId;
    let connectedAccount = await this.stripeClient.accounts.retrieve(
      stripeConnectedAccountId,
    );
    if (!connectedAccount.payouts_enabled) {
      await this.reportFailure(loggingPrefix, earnings.earningsId);
    }

    // Any error will be retried.
    let transfer = await this.stripeClient.transfers.create(
      {
        amount: earnings.totalAmount,
        currency: earnings.currency.toLowerCase(),
        destination: stripeConnectedAccountId,
      },
      {
        idempotencyKey: earnings.earningsId,
      },
    );
    let transferId = transfer.id;
    await this.finalize(loggingPrefix, earnings.earningsId, transferId);
  }

  private async reportFailure(loggingPrefix: string, earningsId: string) {
    await this.database.runTransactionAsync(async (transaction) => {
      let earnings = await this.getValidEarnings(transaction, earningsId);
      earnings.state = PayoutState.FAILED;
      await transaction.batchUpdate([
        updateEarningsStatement(earnings),
        deletePayoutTaskStatement(earningsId),
      ]);
      await transaction.commit();
    });
  }

  private async finalize(
    loggingPrefix: string,
    earningsId: string,
    transferId: string,
  ) {
    await this.database.runTransactionAsync(async (transaction) => {
      let earnings = await this.getValidEarnings(transaction, earningsId);
      earnings.state = PayoutState.PAID;
      earnings.stripeTransferId = transferId;
      await transaction.batchUpdate([
        updateEarningsStatement(earnings),
        deletePayoutTaskStatement(earningsId),
      ]);
      await transaction.commit();
    });
  }

  private async getValidEarnings(
    transaction: Transaction,
    earningsId: string,
  ): Promise<Earnings> {
    let rows = await getEarnings(transaction, earningsId);
    if (rows.length === 0) {
      // Earnings should almost never be deleted, or should be drained by a long lead time.
      throw newInternalServerErrorError(`Earnings ${earningsId} is not found.`);
    }
    let earnings = rows[0].earningsData;
    if (earnings.state !== PayoutState.PROCESSING) {
      throw newBadRequestError(
        `Earnings ${earningsId} is not in PROCESSING state.`,
      );
    }
    return earnings;
  }
}
