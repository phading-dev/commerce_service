import Stripe from "stripe";
import { SPANNER_DATABASE } from "../common/spanner_database";
import { STRIPE_CLIENT } from "../common/stripe_client";
import { InitCreditGrantingState } from "../db/schema";
import {
  GetPaymentProfileRow,
  deleteInitCreditGrantingTaskStatement,
  getInitCreditGrantingTaskMetadata,
  getPaymentProfile,
  updateInitCreditGrantingTaskMetadataStatement,
  updatePaymentProfileInitCreditGrantingStateStatement,
} from "../db/sql";
import { ENV_VARS } from "../env_vars";
import { Database, Transaction } from "@google-cloud/spanner";
import { ProcessInitCreditGrantingTaskHandlerInterface } from "@phading/commerce_service_interface/node/handler";
import {
  ProcessInitCreditGrantingTaskRequestBody,
  ProcessInitCreditGrantingTaskResponse,
} from "@phading/commerce_service_interface/node/interface";
import {
  newBadRequestError,
  newConflictError,
  newInternalServerErrorError,
} from "@selfage/http_error";
import { Ref } from "@selfage/ref";
import { ProcessTaskHandlerWrapper } from "@selfage/service_handler/process_task_handler_wrapper";

export class ProcessInitCreditGrantingTaskHandler extends ProcessInitCreditGrantingTaskHandlerInterface {
  public static create(): ProcessInitCreditGrantingTaskHandler {
    return new ProcessInitCreditGrantingTaskHandler(
      SPANNER_DATABASE,
      STRIPE_CLIENT,
      () => Date.now(),
    );
  }

  public constructor(
    private database: Database,
    private stripeClient: Ref<Stripe>,
    private getNow: () => number,
  ) {
    super();
  }

  private static CREDIT_DESCRIPTION = "Sign up bonus credit";
  private taskHandler = ProcessTaskHandlerWrapper.create(
    this.descriptor,
    5 * 60 * 1000,
    24 * 60 * 60 * 1000,
  );

  public async handle(
    loggingPrefix: string,
    body: ProcessInitCreditGrantingTaskRequestBody,
  ): Promise<ProcessInitCreditGrantingTaskResponse> {
    loggingPrefix = `${loggingPrefix} Init credit granting task ${body.taskId}:`;
    await this.taskHandler.wrap(
      loggingPrefix,
      () => this.claimTask(loggingPrefix, body),
      () => this.processTask(loggingPrefix, body),
    );
    return {};
  }

  public async claimTask(
    loggingPrefix: string,
    body: ProcessInitCreditGrantingTaskRequestBody,
  ): Promise<void> {
    await this.database.runTransactionAsync(async (transaction) => {
      let rows = await getInitCreditGrantingTaskMetadata(transaction, {
        initCreditGrantingTaskTaskIdEq: body.taskId,
      });
      if (rows.length === 0) {
        throw newBadRequestError(`Task is not found.`);
      }
      let task = rows[0];
      await transaction.batchUpdate([
        updateInitCreditGrantingTaskMetadataStatement({
          initCreditGrantingTaskTaskIdEq: body.taskId,
          setRetryCount: task.initCreditGrantingTaskRetryCount + 1,
          setExecutionTimeMs:
            this.getNow() +
            this.taskHandler.getBackoffTime(
              task.initCreditGrantingTaskRetryCount,
            ),
        }),
      ]);
      await transaction.commit();
    });
  }

  public async processTask(
    loggingPrefix: string,
    body: ProcessInitCreditGrantingTaskRequestBody,
  ): Promise<void> {
    let profile = await this.getValidPaymentProfile(
      this.database,
      body.accountId,
    );
    await this.stripeClient.val.customers.createBalanceTransaction(
      profile.paymentProfileStripePaymentCustomerId,
      {
        // Pass in credit as a negative amount.
        amount: -1 * ENV_VARS.initCreditAmount,
        currency: ENV_VARS.defaultCurrency.toLowerCase(),
        description: ProcessInitCreditGrantingTaskHandler.CREDIT_DESCRIPTION,
      },
      {
        idempotencyKey: `ic${body.taskId}`,
      },
    );
    await this.database.runTransactionAsync(async (transaction) => {
      await this.getValidPaymentProfile(transaction, body.accountId);
      await transaction.batchUpdate([
        updatePaymentProfileInitCreditGrantingStateStatement({
          paymentProfileAccountIdEq: body.accountId,
          setInitCreditGrantingState: InitCreditGrantingState.GRANTED,
        }),
        deleteInitCreditGrantingTaskStatement({
          initCreditGrantingTaskTaskIdEq: body.taskId,
        }),
      ]);
      await transaction.commit();
    });
  }

  private async getValidPaymentProfile(
    runner: Database | Transaction,
    accountId: string,
  ): Promise<GetPaymentProfileRow> {
    let profileRows = await getPaymentProfile(runner, {
      paymentProfileAccountIdEq: accountId,
    });
    if (profileRows.length === 0) {
      throw newInternalServerErrorError(
        `No payment profile found for account ${accountId}.`,
      );
    }
    let profile = profileRows[0];
    if (!profile.paymentProfileStripePaymentCustomerId) {
      throw newInternalServerErrorError(
        `Payment profile for account ${accountId} does not have a Stripe customer ID.`,
      );
    }
    if (
      profile.paymentProfileInitCreditGrantingState !==
      InitCreditGrantingState.GRANTING
    ) {
      throw newConflictError(
        `Payment profile for account ${accountId} is not in granting state.`,
      );
    }
    return profile;
  }
}
