import Stripe from "stripe";
import { SPANNER_DATABASE } from "../common/spanner_database";
import { STRIPE_CLIENT } from "../common/stripe_client";
import { Earnings, PayoutState } from "../db/schema";
import {
  deletePayoutTaskStatement,
  getEarnings,
  getEarningsAccountFromEarnings,
  getPayoutTaskMetadata,
  updateEarningsStatement,
  updatePayoutTaskMetadataStatement,
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
import { Ref } from "@selfage/ref";
import { ProcessTaskHandlerWrapper } from "@selfage/service_handler/process_task_handler_wrapper";

export class ProcessPayoutTaskHandler extends ProcessPayoutTaskHandlerInterface {
  public static create(): ProcessPayoutTaskHandler {
    return new ProcessPayoutTaskHandler(SPANNER_DATABASE, STRIPE_CLIENT, () =>
      Date.now(),
    );
  }

  private taskHandler: ProcessTaskHandlerWrapper;

  public constructor(
    private database: Database,
    private stripeClient: Ref<Stripe>,
    private getNow: () => number,
  ) {
    super();
    this.taskHandler = ProcessTaskHandlerWrapper.create(
      this.descriptor,
      5 * 60 * 1000,
      24 * 60 * 60 * 1000,
    );
  }

  public async handle(
    loggingPrefix: string,
    body: ProcessPayoutTaskRequestBody,
  ): Promise<ProcessPayoutTaskResponse> {
    loggingPrefix = `${loggingPrefix} Payout task for earnings ${body.earningsId}:`;
    await this.taskHandler.wrap(
      loggingPrefix,
      () => this.claimTask(loggingPrefix, body),
      () => this.processTask(loggingPrefix, body),
    );
    return {};
  }

  public async claimTask(
    loggingPrefix: string,
    body: ProcessPayoutTaskRequestBody,
  ): Promise<void> {
    await this.database.runTransactionAsync(async (transaction) => {
      let rows = await getPayoutTaskMetadata(transaction, body.earningsId);
      if (rows.length === 0) {
        throw newBadRequestError(`${loggingPrefix} Task is not found.`);
      }
      let task = rows[0];
      await transaction.batchUpdate([
        updatePayoutTaskMetadataStatement(
          body.earningsId,
          task.payoutTaskRetryCount + 1,
          this.getNow() +
            this.taskHandler.getBackoffTime(task.payoutTaskRetryCount),
        ),
      ]);
      await transaction.commit();
    });
  }

  public async processTask(
    loggingPrefix: string,
    body: ProcessPayoutTaskRequestBody,
  ): Promise<void> {
    let [earnings, accountRows] = await Promise.all([
      this.getValidEarnings(this.database, body.earningsId),
      getEarningsAccountFromEarnings(this.database, body.earningsId),
    ]);
    if (accountRows.length === 0) {
      throw newInternalServerErrorError(
        `${loggingPrefix} Earnings account ${earnings.accountId} is not found.`,
      );
    }
    let stripeConnectedAccountId =
      accountRows[0].aData.stripeConnectedAccountId;
    let connectedAccount = await this.stripeClient.val.accounts.retrieve(
      stripeConnectedAccountId,
    );
    if (!connectedAccount.payouts_enabled) {
      await this.reportFailure(loggingPrefix, earnings.earningsId);
      return;
    }

    // Any error will be retried.
    let transfer = await this.stripeClient.val.transfers.create(
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
    runner: Database | Transaction,
    earningsId: string,
  ): Promise<Earnings> {
    let rows = await getEarnings(runner, earningsId);
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
