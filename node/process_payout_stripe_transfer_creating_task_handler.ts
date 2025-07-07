import Stripe from "stripe";
import { SPANNER_DATABASE } from "../common/spanner_database";
import { STRIPE_CLIENT } from "../common/stripe_client";
import { PayoutState } from "../db/schema";
import {
  GetPayoutRow,
  deletePayoutStripeTransferCreatingTaskStatement,
  getPayout,
  getPayoutProfileFromStatement,
  getPayoutStripeTransferCreatingTaskMetadata,
  getTransactionStatement,
  updatePayoutStateAndStripeTransferStatement,
  updatePayoutStateStatement,
  updatePayoutStripeTransferCreatingTaskMetadataStatement,
} from "../db/sql";
import { Database, Transaction } from "@google-cloud/spanner";
import { ProcessPayoutStripeTransferCreatingTaskHandlerInterface } from "@phading/commerce_service_interface/node/handler";
import {
  ProcessPayoutStripeTransferCreatingTaskRequestBody,
  ProcessPayoutStripeTransferCreatingTaskResponse,
} from "@phading/commerce_service_interface/node/interface";
import { AmountType } from "@phading/price/amount_type";
import {
  newBadRequestError,
  newInternalServerErrorError,
} from "@selfage/http_error";
import { Ref } from "@selfage/ref";
import { ProcessTaskHandlerWrapper } from "@selfage/service_handler/process_task_handler_wrapper";

export class ProcessPayoutStripeTransferCreatingTaskHandler extends ProcessPayoutStripeTransferCreatingTaskHandlerInterface {
  public static create(): ProcessPayoutStripeTransferCreatingTaskHandler {
    return new ProcessPayoutStripeTransferCreatingTaskHandler(
      SPANNER_DATABASE,
      STRIPE_CLIENT,
      () => Date.now(),
    );
  }

  private taskHandler = ProcessTaskHandlerWrapper.create(
    this.descriptor,
    5 * 60 * 1000,
    24 * 60 * 60 * 1000,
  );

  public constructor(
    private database: Database,
    private stripeClient: Ref<Stripe>,
    private getNow: () => number,
  ) {
    super();
  }

  public async handle(
    loggingPrefix: string,
    body: ProcessPayoutStripeTransferCreatingTaskRequestBody,
  ): Promise<ProcessPayoutStripeTransferCreatingTaskResponse> {
    loggingPrefix = `${loggingPrefix} Payout Stripe transfer creating task ${body.taskId} with payout ${body.statementId}:`;
    await this.taskHandler.wrap(
      loggingPrefix,
      () => this.claimTask(loggingPrefix, body),
      () => this.processTask(loggingPrefix, body),
    );
    return {};
  }

  public async claimTask(
    loggingPrefix: string,
    body: ProcessPayoutStripeTransferCreatingTaskRequestBody,
  ): Promise<void> {
    await this.database.runTransactionAsync(async (transaction) => {
      let rows = await getPayoutStripeTransferCreatingTaskMetadata(
        transaction,
        {
          payoutStripeTransferCreatingTaskTaskIdEq: body.taskId,
        },
      );
      if (rows.length === 0) {
        throw newBadRequestError(`Task is not found.`);
      }
      let task = rows[0];
      await transaction.batchUpdate([
        updatePayoutStripeTransferCreatingTaskMetadataStatement({
          payoutStripeTransferCreatingTaskTaskIdEq: body.taskId,
          setRetryCount: task.payoutStripeTransferCreatingTaskRetryCount + 1,
          setExecutionTimeMs:
            this.getNow() +
            this.taskHandler.getBackoffTime(
              task.payoutStripeTransferCreatingTaskRetryCount,
            ),
        }),
      ]);
      await transaction.commit();
    });
  }

  public async processTask(
    loggingPrefix: string,
    body: ProcessPayoutStripeTransferCreatingTaskRequestBody,
  ): Promise<void> {
    console.log(`${loggingPrefix} Processing task...`);
    let [profileRows, statementRows] = await Promise.all([
      getPayoutProfileFromStatement(this.database, {
        transactionStatementStatementIdEq: body.statementId,
      }),
      getTransactionStatement(this.database, {
        transactionStatementStatementIdEq: body.statementId,
      }),
      this.getvalidPayout(this.database, body.statementId),
    ]);
    if (profileRows.length === 0) {
      throw newBadRequestError(
        `${loggingPrefix} Payout profile for statement ${body.statementId} is not found.`,
      );
    }
    if (statementRows.length === 0) {
      throw newBadRequestError(
        `${loggingPrefix} Statement ${body.statementId} is not found.`,
      );
    }
    let transactionStatement = statementRows[0];
    if (
      transactionStatement.transactionStatementStatement.totalAmountType !==
      AmountType.CREDIT
    ) {
      throw newInternalServerErrorError(
        `Transaction statement ${body.statementId}'s total amount is not a credit.`,
      );
    }
    let stripeConnectedAccountId =
      profileRows[0].payoutProfileStripeConnectedAccountId;
    let connectedAccount = await this.stripeClient.val.accounts.retrieve(
      stripeConnectedAccountId,
    );
    if (!connectedAccount.payouts_enabled) {
      await this.reportFailure(loggingPrefix, body.taskId, body.statementId);
      return;
    }

    let transfer = await this.stripeClient.val.transfers.create(
      {
        amount: transactionStatement.transactionStatementStatement.totalAmount,
        currency:
          transactionStatement.transactionStatementStatement.currency.toLowerCase(),
        destination: stripeConnectedAccountId,
      },
      {
        idempotencyKey: `po${body.taskId}`,
      },
    );
    let transferId = transfer.id;
    await this.finalize(
      loggingPrefix,
      body.taskId,
      body.statementId,
      transferId,
    );
  }

  private async reportFailure(
    loggingPrefix: string,
    taskId: string,
    statementId: string,
  ) {
    await this.database.runTransactionAsync(async (transaction) => {
      await this.getvalidPayout(transaction, statementId);
      await transaction.batchUpdate([
        updatePayoutStateStatement({
          payoutStatementIdEq: statementId,
          setState: PayoutState.DISABLED,
          setUpdatedTimeMs: this.getNow(),
        }),
        deletePayoutStripeTransferCreatingTaskStatement({
          payoutStripeTransferCreatingTaskTaskIdEq: taskId,
        }),
      ]);
      await transaction.commit();
    });
  }

  private async finalize(
    loggingPrefix: string,
    taskId: string,
    statementId: string,
    transferId: string,
  ) {
    await this.database.runTransactionAsync(async (transaction) => {
      await this.getvalidPayout(transaction, statementId);
      await transaction.batchUpdate([
        updatePayoutStateAndStripeTransferStatement({
          payoutStatementIdEq: statementId,
          setState: PayoutState.PAID,
          setStripeTransferId: transferId,
          setUpdatedTimeMs: this.getNow(),
        }),
        deletePayoutStripeTransferCreatingTaskStatement({
          payoutStripeTransferCreatingTaskTaskIdEq: taskId,
        }),
      ]);
      await transaction.commit();
    });
  }

  private async getvalidPayout(
    runner: Database | Transaction,
    statementId: string,
  ): Promise<GetPayoutRow> {
    let rows = await getPayout(runner, { payoutStatementIdEq: statementId });
    if (rows.length === 0) {
      // Payout should almost never be deleted, or should be drained by a long lead time.
      throw newInternalServerErrorError(`Payout ${statementId} is not found.`);
    }
    let row = rows[0];
    if (row.payoutState !== PayoutState.PROCESSING) {
      throw newBadRequestError(
        `Payout ${statementId} is not in PROCESSING state.`,
      );
    }
    return row;
  }
}
