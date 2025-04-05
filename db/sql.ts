import { BillingProfileStateInfo, BILLING_PROFILE_STATE_INFO, StripeConnectedAccountState, STRIPE_CONNECTED_ACCOUNT_STATE, TransactionStatement, TRANSACTION_STATEMENT, PaymentState, PAYMENT_STATE, PayoutState, PAYOUT_STATE } from './schema';
import { serializeMessage, deserializeMessage, toEnumFromNumber } from '@selfage/message/serializer';
import { Spanner, Database, Transaction } from '@google-cloud/spanner';
import { Statement } from '@google-cloud/spanner/build/src/transaction';
import { PrimitiveType, MessageDescriptor } from '@selfage/message/descriptor';

export function insertBillingProfileStatement(
  args: {
    accountId: string,
    stripePaymentCustomerId?: string,
    stateInfo?: BillingProfileStateInfo,
    paymentAfterMs?: number,
    createdTimeMs?: number,
  }
): Statement {
  return {
    sql: "INSERT BillingProfile (accountId, stripePaymentCustomerId, stateInfo, paymentAfterMs, createdTimeMs) VALUES (@accountId, @stripePaymentCustomerId, @stateInfo, @paymentAfterMs, @createdTimeMs)",
    params: {
      accountId: args.accountId,
      stripePaymentCustomerId: args.stripePaymentCustomerId == null ? null : args.stripePaymentCustomerId,
      stateInfo: args.stateInfo == null ? null : Buffer.from(serializeMessage(args.stateInfo, BILLING_PROFILE_STATE_INFO).buffer),
      paymentAfterMs: args.paymentAfterMs == null ? null : Spanner.float(args.paymentAfterMs),
      createdTimeMs: args.createdTimeMs == null ? null : Spanner.float(args.createdTimeMs),
    },
    types: {
      accountId: { type: "string" },
      stripePaymentCustomerId: { type: "string" },
      stateInfo: { type: "bytes" },
      paymentAfterMs: { type: "float64" },
      createdTimeMs: { type: "float64" },
    }
  };
}

export function deleteBillingProfileStatement(
  args: {
    billingProfileAccountIdEq: string,
  }
): Statement {
  return {
    sql: "DELETE BillingProfile WHERE (BillingProfile.accountId = @billingProfileAccountIdEq)",
    params: {
      billingProfileAccountIdEq: args.billingProfileAccountIdEq,
    },
    types: {
      billingProfileAccountIdEq: { type: "string" },
    }
  };
}

export interface GetBillingProfileRow {
  billingProfileAccountId?: string,
  billingProfileStripePaymentCustomerId?: string,
  billingProfileStateInfo?: BillingProfileStateInfo,
  billingProfilePaymentAfterMs?: number,
  billingProfileCreatedTimeMs?: number,
}

export let GET_BILLING_PROFILE_ROW: MessageDescriptor<GetBillingProfileRow> = {
  name: 'GetBillingProfileRow',
  fields: [{
    name: 'billingProfileAccountId',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'billingProfileStripePaymentCustomerId',
    index: 2,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'billingProfileStateInfo',
    index: 3,
    messageType: BILLING_PROFILE_STATE_INFO,
  }, {
    name: 'billingProfilePaymentAfterMs',
    index: 4,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'billingProfileCreatedTimeMs',
    index: 5,
    primitiveType: PrimitiveType.NUMBER,
  }],
};

export async function getBillingProfile(
  runner: Database | Transaction,
  args: {
    billingProfileAccountIdEq: string,
  }
): Promise<Array<GetBillingProfileRow>> {
  let [rows] = await runner.run({
    sql: "SELECT BillingProfile.accountId, BillingProfile.stripePaymentCustomerId, BillingProfile.stateInfo, BillingProfile.paymentAfterMs, BillingProfile.createdTimeMs FROM BillingProfile WHERE (BillingProfile.accountId = @billingProfileAccountIdEq)",
    params: {
      billingProfileAccountIdEq: args.billingProfileAccountIdEq,
    },
    types: {
      billingProfileAccountIdEq: { type: "string" },
    }
  });
  let resRows = new Array<GetBillingProfileRow>();
  for (let row of rows) {
    resRows.push({
      billingProfileAccountId: row.at(0).value == null ? undefined : row.at(0).value,
      billingProfileStripePaymentCustomerId: row.at(1).value == null ? undefined : row.at(1).value,
      billingProfileStateInfo: row.at(2).value == null ? undefined : deserializeMessage(row.at(2).value, BILLING_PROFILE_STATE_INFO),
      billingProfilePaymentAfterMs: row.at(3).value == null ? undefined : row.at(3).value.value,
      billingProfileCreatedTimeMs: row.at(4).value == null ? undefined : row.at(4).value.value,
    });
  }
  return resRows;
}

export function insertEarningsProfileStatement(
  args: {
    accountId: string,
    stripeConnectedAccountId?: string,
    stripeConnectedAccountState?: StripeConnectedAccountState,
    createdTimeMs?: number,
  }
): Statement {
  return {
    sql: "INSERT EarningsProfile (accountId, stripeConnectedAccountId, stripeConnectedAccountState, createdTimeMs) VALUES (@accountId, @stripeConnectedAccountId, @stripeConnectedAccountState, @createdTimeMs)",
    params: {
      accountId: args.accountId,
      stripeConnectedAccountId: args.stripeConnectedAccountId == null ? null : args.stripeConnectedAccountId,
      stripeConnectedAccountState: args.stripeConnectedAccountState == null ? null : Spanner.float(args.stripeConnectedAccountState),
      createdTimeMs: args.createdTimeMs == null ? null : Spanner.float(args.createdTimeMs),
    },
    types: {
      accountId: { type: "string" },
      stripeConnectedAccountId: { type: "string" },
      stripeConnectedAccountState: { type: "float64" },
      createdTimeMs: { type: "float64" },
    }
  };
}

export function deleteEarningsProfileStatement(
  args: {
    earningsProfileAccountIdEq: string,
  }
): Statement {
  return {
    sql: "DELETE EarningsProfile WHERE (EarningsProfile.accountId = @earningsProfileAccountIdEq)",
    params: {
      earningsProfileAccountIdEq: args.earningsProfileAccountIdEq,
    },
    types: {
      earningsProfileAccountIdEq: { type: "string" },
    }
  };
}

export interface GetEarningsProfileRow {
  earningsProfileAccountId?: string,
  earningsProfileStripeConnectedAccountId?: string,
  earningsProfileStripeConnectedAccountState?: StripeConnectedAccountState,
  earningsProfileCreatedTimeMs?: number,
}

export let GET_EARNINGS_PROFILE_ROW: MessageDescriptor<GetEarningsProfileRow> = {
  name: 'GetEarningsProfileRow',
  fields: [{
    name: 'earningsProfileAccountId',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'earningsProfileStripeConnectedAccountId',
    index: 2,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'earningsProfileStripeConnectedAccountState',
    index: 3,
    enumType: STRIPE_CONNECTED_ACCOUNT_STATE,
  }, {
    name: 'earningsProfileCreatedTimeMs',
    index: 4,
    primitiveType: PrimitiveType.NUMBER,
  }],
};

export async function getEarningsProfile(
  runner: Database | Transaction,
  args: {
    earningsProfileAccountIdEq: string,
  }
): Promise<Array<GetEarningsProfileRow>> {
  let [rows] = await runner.run({
    sql: "SELECT EarningsProfile.accountId, EarningsProfile.stripeConnectedAccountId, EarningsProfile.stripeConnectedAccountState, EarningsProfile.createdTimeMs FROM EarningsProfile WHERE (EarningsProfile.accountId = @earningsProfileAccountIdEq)",
    params: {
      earningsProfileAccountIdEq: args.earningsProfileAccountIdEq,
    },
    types: {
      earningsProfileAccountIdEq: { type: "string" },
    }
  });
  let resRows = new Array<GetEarningsProfileRow>();
  for (let row of rows) {
    resRows.push({
      earningsProfileAccountId: row.at(0).value == null ? undefined : row.at(0).value,
      earningsProfileStripeConnectedAccountId: row.at(1).value == null ? undefined : row.at(1).value,
      earningsProfileStripeConnectedAccountState: row.at(2).value == null ? undefined : toEnumFromNumber(row.at(2).value.value, STRIPE_CONNECTED_ACCOUNT_STATE),
      earningsProfileCreatedTimeMs: row.at(3).value == null ? undefined : row.at(3).value.value,
    });
  }
  return resRows;
}

export function insertTransactionStatementStatement(
  args: {
    statementId: string,
    accountId?: string,
    month?: string,
    statement?: TransactionStatement,
    createdTimeMs?: number,
  }
): Statement {
  return {
    sql: "INSERT TransactionStatement (statementId, accountId, month, statement, createdTimeMs) VALUES (@statementId, @accountId, @month, @statement, @createdTimeMs)",
    params: {
      statementId: args.statementId,
      accountId: args.accountId == null ? null : args.accountId,
      month: args.month == null ? null : args.month,
      statement: args.statement == null ? null : Buffer.from(serializeMessage(args.statement, TRANSACTION_STATEMENT).buffer),
      createdTimeMs: args.createdTimeMs == null ? null : Spanner.float(args.createdTimeMs),
    },
    types: {
      statementId: { type: "string" },
      accountId: { type: "string" },
      month: { type: "string" },
      statement: { type: "bytes" },
      createdTimeMs: { type: "float64" },
    }
  };
}

export function deleteTransactionStatementStatement(
  args: {
    transactionStatementStatementIdEq: string,
  }
): Statement {
  return {
    sql: "DELETE TransactionStatement WHERE (TransactionStatement.statementId = @transactionStatementStatementIdEq)",
    params: {
      transactionStatementStatementIdEq: args.transactionStatementStatementIdEq,
    },
    types: {
      transactionStatementStatementIdEq: { type: "string" },
    }
  };
}

export interface GetTransactionStatementRow {
  transactionStatementStatementId?: string,
  transactionStatementAccountId?: string,
  transactionStatementMonth?: string,
  transactionStatementStatement?: TransactionStatement,
  transactionStatementCreatedTimeMs?: number,
}

export let GET_TRANSACTION_STATEMENT_ROW: MessageDescriptor<GetTransactionStatementRow> = {
  name: 'GetTransactionStatementRow',
  fields: [{
    name: 'transactionStatementStatementId',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'transactionStatementAccountId',
    index: 2,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'transactionStatementMonth',
    index: 3,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'transactionStatementStatement',
    index: 4,
    messageType: TRANSACTION_STATEMENT,
  }, {
    name: 'transactionStatementCreatedTimeMs',
    index: 5,
    primitiveType: PrimitiveType.NUMBER,
  }],
};

export async function getTransactionStatement(
  runner: Database | Transaction,
  args: {
    transactionStatementStatementIdEq: string,
  }
): Promise<Array<GetTransactionStatementRow>> {
  let [rows] = await runner.run({
    sql: "SELECT TransactionStatement.statementId, TransactionStatement.accountId, TransactionStatement.month, TransactionStatement.statement, TransactionStatement.createdTimeMs FROM TransactionStatement WHERE (TransactionStatement.statementId = @transactionStatementStatementIdEq)",
    params: {
      transactionStatementStatementIdEq: args.transactionStatementStatementIdEq,
    },
    types: {
      transactionStatementStatementIdEq: { type: "string" },
    }
  });
  let resRows = new Array<GetTransactionStatementRow>();
  for (let row of rows) {
    resRows.push({
      transactionStatementStatementId: row.at(0).value == null ? undefined : row.at(0).value,
      transactionStatementAccountId: row.at(1).value == null ? undefined : row.at(1).value,
      transactionStatementMonth: row.at(2).value == null ? undefined : row.at(2).value,
      transactionStatementStatement: row.at(3).value == null ? undefined : deserializeMessage(row.at(3).value, TRANSACTION_STATEMENT),
      transactionStatementCreatedTimeMs: row.at(4).value == null ? undefined : row.at(4).value.value,
    });
  }
  return resRows;
}

export function insertPaymentStatement(
  args: {
    statementId: string,
    accountId?: string,
    state?: PaymentState,
    stripeInvoiceId?: string,
    stripeInvoiceUrl?: string,
    updatedTimeMs?: number,
    createdTimeMs?: number,
  }
): Statement {
  return {
    sql: "INSERT Payment (statementId, accountId, state, stripeInvoiceId, stripeInvoiceUrl, updatedTimeMs, createdTimeMs) VALUES (@statementId, @accountId, @state, @stripeInvoiceId, @stripeInvoiceUrl, @updatedTimeMs, @createdTimeMs)",
    params: {
      statementId: args.statementId,
      accountId: args.accountId == null ? null : args.accountId,
      state: args.state == null ? null : Spanner.float(args.state),
      stripeInvoiceId: args.stripeInvoiceId == null ? null : args.stripeInvoiceId,
      stripeInvoiceUrl: args.stripeInvoiceUrl == null ? null : args.stripeInvoiceUrl,
      updatedTimeMs: args.updatedTimeMs == null ? null : Spanner.float(args.updatedTimeMs),
      createdTimeMs: args.createdTimeMs == null ? null : Spanner.float(args.createdTimeMs),
    },
    types: {
      statementId: { type: "string" },
      accountId: { type: "string" },
      state: { type: "float64" },
      stripeInvoiceId: { type: "string" },
      stripeInvoiceUrl: { type: "string" },
      updatedTimeMs: { type: "float64" },
      createdTimeMs: { type: "float64" },
    }
  };
}

export function deletePaymentStatement(
  args: {
    paymentStatementIdEq: string,
  }
): Statement {
  return {
    sql: "DELETE Payment WHERE (Payment.statementId = @paymentStatementIdEq)",
    params: {
      paymentStatementIdEq: args.paymentStatementIdEq,
    },
    types: {
      paymentStatementIdEq: { type: "string" },
    }
  };
}

export interface GetPaymentRow {
  paymentStatementId?: string,
  paymentAccountId?: string,
  paymentState?: PaymentState,
  paymentStripeInvoiceId?: string,
  paymentStripeInvoiceUrl?: string,
  paymentUpdatedTimeMs?: number,
  paymentCreatedTimeMs?: number,
}

export let GET_PAYMENT_ROW: MessageDescriptor<GetPaymentRow> = {
  name: 'GetPaymentRow',
  fields: [{
    name: 'paymentStatementId',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'paymentAccountId',
    index: 2,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'paymentState',
    index: 3,
    enumType: PAYMENT_STATE,
  }, {
    name: 'paymentStripeInvoiceId',
    index: 4,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'paymentStripeInvoiceUrl',
    index: 5,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'paymentUpdatedTimeMs',
    index: 6,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'paymentCreatedTimeMs',
    index: 7,
    primitiveType: PrimitiveType.NUMBER,
  }],
};

export async function getPayment(
  runner: Database | Transaction,
  args: {
    paymentStatementIdEq: string,
  }
): Promise<Array<GetPaymentRow>> {
  let [rows] = await runner.run({
    sql: "SELECT Payment.statementId, Payment.accountId, Payment.state, Payment.stripeInvoiceId, Payment.stripeInvoiceUrl, Payment.updatedTimeMs, Payment.createdTimeMs FROM Payment WHERE (Payment.statementId = @paymentStatementIdEq)",
    params: {
      paymentStatementIdEq: args.paymentStatementIdEq,
    },
    types: {
      paymentStatementIdEq: { type: "string" },
    }
  });
  let resRows = new Array<GetPaymentRow>();
  for (let row of rows) {
    resRows.push({
      paymentStatementId: row.at(0).value == null ? undefined : row.at(0).value,
      paymentAccountId: row.at(1).value == null ? undefined : row.at(1).value,
      paymentState: row.at(2).value == null ? undefined : toEnumFromNumber(row.at(2).value.value, PAYMENT_STATE),
      paymentStripeInvoiceId: row.at(3).value == null ? undefined : row.at(3).value,
      paymentStripeInvoiceUrl: row.at(4).value == null ? undefined : row.at(4).value,
      paymentUpdatedTimeMs: row.at(5).value == null ? undefined : row.at(5).value.value,
      paymentCreatedTimeMs: row.at(6).value == null ? undefined : row.at(6).value.value,
    });
  }
  return resRows;
}

export function insertPayoutStatement(
  args: {
    statementId: string,
    accountId?: string,
    state?: PayoutState,
    stripeTransferId?: string,
    updatedTimeMs?: number,
    createdTimeMs?: number,
  }
): Statement {
  return {
    sql: "INSERT Payout (statementId, accountId, state, stripeTransferId, updatedTimeMs, createdTimeMs) VALUES (@statementId, @accountId, @state, @stripeTransferId, @updatedTimeMs, @createdTimeMs)",
    params: {
      statementId: args.statementId,
      accountId: args.accountId == null ? null : args.accountId,
      state: args.state == null ? null : Spanner.float(args.state),
      stripeTransferId: args.stripeTransferId == null ? null : args.stripeTransferId,
      updatedTimeMs: args.updatedTimeMs == null ? null : Spanner.float(args.updatedTimeMs),
      createdTimeMs: args.createdTimeMs == null ? null : Spanner.float(args.createdTimeMs),
    },
    types: {
      statementId: { type: "string" },
      accountId: { type: "string" },
      state: { type: "float64" },
      stripeTransferId: { type: "string" },
      updatedTimeMs: { type: "float64" },
      createdTimeMs: { type: "float64" },
    }
  };
}

export function deletePayoutStatement(
  args: {
    payoutStatementIdEq: string,
  }
): Statement {
  return {
    sql: "DELETE Payout WHERE (Payout.statementId = @payoutStatementIdEq)",
    params: {
      payoutStatementIdEq: args.payoutStatementIdEq,
    },
    types: {
      payoutStatementIdEq: { type: "string" },
    }
  };
}

export interface GetPayoutRow {
  payoutStatementId?: string,
  payoutAccountId?: string,
  payoutState?: PayoutState,
  payoutStripeTransferId?: string,
  payoutUpdatedTimeMs?: number,
  payoutCreatedTimeMs?: number,
}

export let GET_PAYOUT_ROW: MessageDescriptor<GetPayoutRow> = {
  name: 'GetPayoutRow',
  fields: [{
    name: 'payoutStatementId',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'payoutAccountId',
    index: 2,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'payoutState',
    index: 3,
    enumType: PAYOUT_STATE,
  }, {
    name: 'payoutStripeTransferId',
    index: 4,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'payoutUpdatedTimeMs',
    index: 5,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'payoutCreatedTimeMs',
    index: 6,
    primitiveType: PrimitiveType.NUMBER,
  }],
};

export async function getPayout(
  runner: Database | Transaction,
  args: {
    payoutStatementIdEq: string,
  }
): Promise<Array<GetPayoutRow>> {
  let [rows] = await runner.run({
    sql: "SELECT Payout.statementId, Payout.accountId, Payout.state, Payout.stripeTransferId, Payout.updatedTimeMs, Payout.createdTimeMs FROM Payout WHERE (Payout.statementId = @payoutStatementIdEq)",
    params: {
      payoutStatementIdEq: args.payoutStatementIdEq,
    },
    types: {
      payoutStatementIdEq: { type: "string" },
    }
  });
  let resRows = new Array<GetPayoutRow>();
  for (let row of rows) {
    resRows.push({
      payoutStatementId: row.at(0).value == null ? undefined : row.at(0).value,
      payoutAccountId: row.at(1).value == null ? undefined : row.at(1).value,
      payoutState: row.at(2).value == null ? undefined : toEnumFromNumber(row.at(2).value.value, PAYOUT_STATE),
      payoutStripeTransferId: row.at(3).value == null ? undefined : row.at(3).value,
      payoutUpdatedTimeMs: row.at(4).value == null ? undefined : row.at(4).value.value,
      payoutCreatedTimeMs: row.at(5).value == null ? undefined : row.at(5).value.value,
    });
  }
  return resRows;
}

export function insertStripePaymentCustomerCreatingTaskStatement(
  args: {
    accountId: string,
    retryCount?: number,
    executionTimeMs?: number,
    createdTimeMs?: number,
  }
): Statement {
  return {
    sql: "INSERT StripePaymentCustomerCreatingTask (accountId, retryCount, executionTimeMs, createdTimeMs) VALUES (@accountId, @retryCount, @executionTimeMs, @createdTimeMs)",
    params: {
      accountId: args.accountId,
      retryCount: args.retryCount == null ? null : Spanner.float(args.retryCount),
      executionTimeMs: args.executionTimeMs == null ? null : new Date(args.executionTimeMs).toISOString(),
      createdTimeMs: args.createdTimeMs == null ? null : new Date(args.createdTimeMs).toISOString(),
    },
    types: {
      accountId: { type: "string" },
      retryCount: { type: "float64" },
      executionTimeMs: { type: "timestamp" },
      createdTimeMs: { type: "timestamp" },
    }
  };
}

export function deleteStripePaymentCustomerCreatingTaskStatement(
  args: {
    stripePaymentCustomerCreatingTaskAccountIdEq: string,
  }
): Statement {
  return {
    sql: "DELETE StripePaymentCustomerCreatingTask WHERE (StripePaymentCustomerCreatingTask.accountId = @stripePaymentCustomerCreatingTaskAccountIdEq)",
    params: {
      stripePaymentCustomerCreatingTaskAccountIdEq: args.stripePaymentCustomerCreatingTaskAccountIdEq,
    },
    types: {
      stripePaymentCustomerCreatingTaskAccountIdEq: { type: "string" },
    }
  };
}

export interface GetStripePaymentCustomerCreatingTaskRow {
  stripePaymentCustomerCreatingTaskAccountId?: string,
  stripePaymentCustomerCreatingTaskRetryCount?: number,
  stripePaymentCustomerCreatingTaskExecutionTimeMs?: number,
  stripePaymentCustomerCreatingTaskCreatedTimeMs?: number,
}

export let GET_STRIPE_PAYMENT_CUSTOMER_CREATING_TASK_ROW: MessageDescriptor<GetStripePaymentCustomerCreatingTaskRow> = {
  name: 'GetStripePaymentCustomerCreatingTaskRow',
  fields: [{
    name: 'stripePaymentCustomerCreatingTaskAccountId',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'stripePaymentCustomerCreatingTaskRetryCount',
    index: 2,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'stripePaymentCustomerCreatingTaskExecutionTimeMs',
    index: 3,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'stripePaymentCustomerCreatingTaskCreatedTimeMs',
    index: 4,
    primitiveType: PrimitiveType.NUMBER,
  }],
};

export async function getStripePaymentCustomerCreatingTask(
  runner: Database | Transaction,
  args: {
    stripePaymentCustomerCreatingTaskAccountIdEq: string,
  }
): Promise<Array<GetStripePaymentCustomerCreatingTaskRow>> {
  let [rows] = await runner.run({
    sql: "SELECT StripePaymentCustomerCreatingTask.accountId, StripePaymentCustomerCreatingTask.retryCount, StripePaymentCustomerCreatingTask.executionTimeMs, StripePaymentCustomerCreatingTask.createdTimeMs FROM StripePaymentCustomerCreatingTask WHERE (StripePaymentCustomerCreatingTask.accountId = @stripePaymentCustomerCreatingTaskAccountIdEq)",
    params: {
      stripePaymentCustomerCreatingTaskAccountIdEq: args.stripePaymentCustomerCreatingTaskAccountIdEq,
    },
    types: {
      stripePaymentCustomerCreatingTaskAccountIdEq: { type: "string" },
    }
  });
  let resRows = new Array<GetStripePaymentCustomerCreatingTaskRow>();
  for (let row of rows) {
    resRows.push({
      stripePaymentCustomerCreatingTaskAccountId: row.at(0).value == null ? undefined : row.at(0).value,
      stripePaymentCustomerCreatingTaskRetryCount: row.at(1).value == null ? undefined : row.at(1).value.value,
      stripePaymentCustomerCreatingTaskExecutionTimeMs: row.at(2).value == null ? undefined : row.at(2).value.valueOf(),
      stripePaymentCustomerCreatingTaskCreatedTimeMs: row.at(3).value == null ? undefined : row.at(3).value.valueOf(),
    });
  }
  return resRows;
}

export interface ListPendingStripePaymentCustomerCreatingTasksRow {
  stripePaymentCustomerCreatingTaskAccountId?: string,
}

export let LIST_PENDING_STRIPE_PAYMENT_CUSTOMER_CREATING_TASKS_ROW: MessageDescriptor<ListPendingStripePaymentCustomerCreatingTasksRow> = {
  name: 'ListPendingStripePaymentCustomerCreatingTasksRow',
  fields: [{
    name: 'stripePaymentCustomerCreatingTaskAccountId',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }],
};

export async function listPendingStripePaymentCustomerCreatingTasks(
  runner: Database | Transaction,
  args: {
    stripePaymentCustomerCreatingTaskExecutionTimeMsLe?: number,
  }
): Promise<Array<ListPendingStripePaymentCustomerCreatingTasksRow>> {
  let [rows] = await runner.run({
    sql: "SELECT StripePaymentCustomerCreatingTask.accountId FROM StripePaymentCustomerCreatingTask WHERE StripePaymentCustomerCreatingTask.executionTimeMs <= @stripePaymentCustomerCreatingTaskExecutionTimeMsLe",
    params: {
      stripePaymentCustomerCreatingTaskExecutionTimeMsLe: args.stripePaymentCustomerCreatingTaskExecutionTimeMsLe == null ? null : new Date(args.stripePaymentCustomerCreatingTaskExecutionTimeMsLe).toISOString(),
    },
    types: {
      stripePaymentCustomerCreatingTaskExecutionTimeMsLe: { type: "timestamp" },
    }
  });
  let resRows = new Array<ListPendingStripePaymentCustomerCreatingTasksRow>();
  for (let row of rows) {
    resRows.push({
      stripePaymentCustomerCreatingTaskAccountId: row.at(0).value == null ? undefined : row.at(0).value,
    });
  }
  return resRows;
}

export interface GetStripePaymentCustomerCreatingTaskMetadataRow {
  stripePaymentCustomerCreatingTaskRetryCount?: number,
  stripePaymentCustomerCreatingTaskExecutionTimeMs?: number,
}

export let GET_STRIPE_PAYMENT_CUSTOMER_CREATING_TASK_METADATA_ROW: MessageDescriptor<GetStripePaymentCustomerCreatingTaskMetadataRow> = {
  name: 'GetStripePaymentCustomerCreatingTaskMetadataRow',
  fields: [{
    name: 'stripePaymentCustomerCreatingTaskRetryCount',
    index: 1,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'stripePaymentCustomerCreatingTaskExecutionTimeMs',
    index: 2,
    primitiveType: PrimitiveType.NUMBER,
  }],
};

export async function getStripePaymentCustomerCreatingTaskMetadata(
  runner: Database | Transaction,
  args: {
    stripePaymentCustomerCreatingTaskAccountIdEq: string,
  }
): Promise<Array<GetStripePaymentCustomerCreatingTaskMetadataRow>> {
  let [rows] = await runner.run({
    sql: "SELECT StripePaymentCustomerCreatingTask.retryCount, StripePaymentCustomerCreatingTask.executionTimeMs FROM StripePaymentCustomerCreatingTask WHERE (StripePaymentCustomerCreatingTask.accountId = @stripePaymentCustomerCreatingTaskAccountIdEq)",
    params: {
      stripePaymentCustomerCreatingTaskAccountIdEq: args.stripePaymentCustomerCreatingTaskAccountIdEq,
    },
    types: {
      stripePaymentCustomerCreatingTaskAccountIdEq: { type: "string" },
    }
  });
  let resRows = new Array<GetStripePaymentCustomerCreatingTaskMetadataRow>();
  for (let row of rows) {
    resRows.push({
      stripePaymentCustomerCreatingTaskRetryCount: row.at(0).value == null ? undefined : row.at(0).value.value,
      stripePaymentCustomerCreatingTaskExecutionTimeMs: row.at(1).value == null ? undefined : row.at(1).value.valueOf(),
    });
  }
  return resRows;
}

export function updateStripePaymentCustomerCreatingTaskMetadataStatement(
  args: {
    stripePaymentCustomerCreatingTaskAccountIdEq: string,
    setRetryCount?: number,
    setExecutionTimeMs?: number,
  }
): Statement {
  return {
    sql: "UPDATE StripePaymentCustomerCreatingTask SET retryCount = @setRetryCount, executionTimeMs = @setExecutionTimeMs WHERE (StripePaymentCustomerCreatingTask.accountId = @stripePaymentCustomerCreatingTaskAccountIdEq)",
    params: {
      stripePaymentCustomerCreatingTaskAccountIdEq: args.stripePaymentCustomerCreatingTaskAccountIdEq,
      setRetryCount: args.setRetryCount == null ? null : Spanner.float(args.setRetryCount),
      setExecutionTimeMs: args.setExecutionTimeMs == null ? null : new Date(args.setExecutionTimeMs).toISOString(),
    },
    types: {
      stripePaymentCustomerCreatingTaskAccountIdEq: { type: "string" },
      setRetryCount: { type: "float64" },
      setExecutionTimeMs: { type: "timestamp" },
    }
  };
}

export function insertStripeConnectedAccountCreatingTaskStatement(
  args: {
    accountId: string,
    retryCount?: number,
    executionTimeMs?: number,
    createdTimeMs?: number,
  }
): Statement {
  return {
    sql: "INSERT StripeConnectedAccountCreatingTask (accountId, retryCount, executionTimeMs, createdTimeMs) VALUES (@accountId, @retryCount, @executionTimeMs, @createdTimeMs)",
    params: {
      accountId: args.accountId,
      retryCount: args.retryCount == null ? null : Spanner.float(args.retryCount),
      executionTimeMs: args.executionTimeMs == null ? null : new Date(args.executionTimeMs).toISOString(),
      createdTimeMs: args.createdTimeMs == null ? null : new Date(args.createdTimeMs).toISOString(),
    },
    types: {
      accountId: { type: "string" },
      retryCount: { type: "float64" },
      executionTimeMs: { type: "timestamp" },
      createdTimeMs: { type: "timestamp" },
    }
  };
}

export function deleteStripeConnectedAccountCreatingTaskStatement(
  args: {
    stripeConnectedAccountCreatingTaskAccountIdEq: string,
  }
): Statement {
  return {
    sql: "DELETE StripeConnectedAccountCreatingTask WHERE (StripeConnectedAccountCreatingTask.accountId = @stripeConnectedAccountCreatingTaskAccountIdEq)",
    params: {
      stripeConnectedAccountCreatingTaskAccountIdEq: args.stripeConnectedAccountCreatingTaskAccountIdEq,
    },
    types: {
      stripeConnectedAccountCreatingTaskAccountIdEq: { type: "string" },
    }
  };
}

export interface GetStripeConnectedAccountCreatingTaskRow {
  stripeConnectedAccountCreatingTaskAccountId?: string,
  stripeConnectedAccountCreatingTaskRetryCount?: number,
  stripeConnectedAccountCreatingTaskExecutionTimeMs?: number,
  stripeConnectedAccountCreatingTaskCreatedTimeMs?: number,
}

export let GET_STRIPE_CONNECTED_ACCOUNT_CREATING_TASK_ROW: MessageDescriptor<GetStripeConnectedAccountCreatingTaskRow> = {
  name: 'GetStripeConnectedAccountCreatingTaskRow',
  fields: [{
    name: 'stripeConnectedAccountCreatingTaskAccountId',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'stripeConnectedAccountCreatingTaskRetryCount',
    index: 2,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'stripeConnectedAccountCreatingTaskExecutionTimeMs',
    index: 3,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'stripeConnectedAccountCreatingTaskCreatedTimeMs',
    index: 4,
    primitiveType: PrimitiveType.NUMBER,
  }],
};

export async function getStripeConnectedAccountCreatingTask(
  runner: Database | Transaction,
  args: {
    stripeConnectedAccountCreatingTaskAccountIdEq: string,
  }
): Promise<Array<GetStripeConnectedAccountCreatingTaskRow>> {
  let [rows] = await runner.run({
    sql: "SELECT StripeConnectedAccountCreatingTask.accountId, StripeConnectedAccountCreatingTask.retryCount, StripeConnectedAccountCreatingTask.executionTimeMs, StripeConnectedAccountCreatingTask.createdTimeMs FROM StripeConnectedAccountCreatingTask WHERE (StripeConnectedAccountCreatingTask.accountId = @stripeConnectedAccountCreatingTaskAccountIdEq)",
    params: {
      stripeConnectedAccountCreatingTaskAccountIdEq: args.stripeConnectedAccountCreatingTaskAccountIdEq,
    },
    types: {
      stripeConnectedAccountCreatingTaskAccountIdEq: { type: "string" },
    }
  });
  let resRows = new Array<GetStripeConnectedAccountCreatingTaskRow>();
  for (let row of rows) {
    resRows.push({
      stripeConnectedAccountCreatingTaskAccountId: row.at(0).value == null ? undefined : row.at(0).value,
      stripeConnectedAccountCreatingTaskRetryCount: row.at(1).value == null ? undefined : row.at(1).value.value,
      stripeConnectedAccountCreatingTaskExecutionTimeMs: row.at(2).value == null ? undefined : row.at(2).value.valueOf(),
      stripeConnectedAccountCreatingTaskCreatedTimeMs: row.at(3).value == null ? undefined : row.at(3).value.valueOf(),
    });
  }
  return resRows;
}

export interface ListPendingStripeConnectedAccountCreatingTasksRow {
  stripeConnectedAccountCreatingTaskAccountId?: string,
}

export let LIST_PENDING_STRIPE_CONNECTED_ACCOUNT_CREATING_TASKS_ROW: MessageDescriptor<ListPendingStripeConnectedAccountCreatingTasksRow> = {
  name: 'ListPendingStripeConnectedAccountCreatingTasksRow',
  fields: [{
    name: 'stripeConnectedAccountCreatingTaskAccountId',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }],
};

export async function listPendingStripeConnectedAccountCreatingTasks(
  runner: Database | Transaction,
  args: {
    stripeConnectedAccountCreatingTaskExecutionTimeMsLe?: number,
  }
): Promise<Array<ListPendingStripeConnectedAccountCreatingTasksRow>> {
  let [rows] = await runner.run({
    sql: "SELECT StripeConnectedAccountCreatingTask.accountId FROM StripeConnectedAccountCreatingTask WHERE StripeConnectedAccountCreatingTask.executionTimeMs <= @stripeConnectedAccountCreatingTaskExecutionTimeMsLe",
    params: {
      stripeConnectedAccountCreatingTaskExecutionTimeMsLe: args.stripeConnectedAccountCreatingTaskExecutionTimeMsLe == null ? null : new Date(args.stripeConnectedAccountCreatingTaskExecutionTimeMsLe).toISOString(),
    },
    types: {
      stripeConnectedAccountCreatingTaskExecutionTimeMsLe: { type: "timestamp" },
    }
  });
  let resRows = new Array<ListPendingStripeConnectedAccountCreatingTasksRow>();
  for (let row of rows) {
    resRows.push({
      stripeConnectedAccountCreatingTaskAccountId: row.at(0).value == null ? undefined : row.at(0).value,
    });
  }
  return resRows;
}

export interface GetStripeConnectedAccountCreatingTaskMetadataRow {
  stripeConnectedAccountCreatingTaskRetryCount?: number,
  stripeConnectedAccountCreatingTaskExecutionTimeMs?: number,
}

export let GET_STRIPE_CONNECTED_ACCOUNT_CREATING_TASK_METADATA_ROW: MessageDescriptor<GetStripeConnectedAccountCreatingTaskMetadataRow> = {
  name: 'GetStripeConnectedAccountCreatingTaskMetadataRow',
  fields: [{
    name: 'stripeConnectedAccountCreatingTaskRetryCount',
    index: 1,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'stripeConnectedAccountCreatingTaskExecutionTimeMs',
    index: 2,
    primitiveType: PrimitiveType.NUMBER,
  }],
};

export async function getStripeConnectedAccountCreatingTaskMetadata(
  runner: Database | Transaction,
  args: {
    stripeConnectedAccountCreatingTaskAccountIdEq: string,
  }
): Promise<Array<GetStripeConnectedAccountCreatingTaskMetadataRow>> {
  let [rows] = await runner.run({
    sql: "SELECT StripeConnectedAccountCreatingTask.retryCount, StripeConnectedAccountCreatingTask.executionTimeMs FROM StripeConnectedAccountCreatingTask WHERE (StripeConnectedAccountCreatingTask.accountId = @stripeConnectedAccountCreatingTaskAccountIdEq)",
    params: {
      stripeConnectedAccountCreatingTaskAccountIdEq: args.stripeConnectedAccountCreatingTaskAccountIdEq,
    },
    types: {
      stripeConnectedAccountCreatingTaskAccountIdEq: { type: "string" },
    }
  });
  let resRows = new Array<GetStripeConnectedAccountCreatingTaskMetadataRow>();
  for (let row of rows) {
    resRows.push({
      stripeConnectedAccountCreatingTaskRetryCount: row.at(0).value == null ? undefined : row.at(0).value.value,
      stripeConnectedAccountCreatingTaskExecutionTimeMs: row.at(1).value == null ? undefined : row.at(1).value.valueOf(),
    });
  }
  return resRows;
}

export function updateStripeConnectedAccountCreatingTaskMetadataStatement(
  args: {
    stripeConnectedAccountCreatingTaskAccountIdEq: string,
    setRetryCount?: number,
    setExecutionTimeMs?: number,
  }
): Statement {
  return {
    sql: "UPDATE StripeConnectedAccountCreatingTask SET retryCount = @setRetryCount, executionTimeMs = @setExecutionTimeMs WHERE (StripeConnectedAccountCreatingTask.accountId = @stripeConnectedAccountCreatingTaskAccountIdEq)",
    params: {
      stripeConnectedAccountCreatingTaskAccountIdEq: args.stripeConnectedAccountCreatingTaskAccountIdEq,
      setRetryCount: args.setRetryCount == null ? null : Spanner.float(args.setRetryCount),
      setExecutionTimeMs: args.setExecutionTimeMs == null ? null : new Date(args.setExecutionTimeMs).toISOString(),
    },
    types: {
      stripeConnectedAccountCreatingTaskAccountIdEq: { type: "string" },
      setRetryCount: { type: "float64" },
      setExecutionTimeMs: { type: "timestamp" },
    }
  };
}

export function insertStripeConnectedAccountNeedsSetupNotifyingTaskStatement(
  args: {
    accountId: string,
    retryCount?: number,
    executionTimeMs?: number,
    createdTimeMs?: number,
  }
): Statement {
  return {
    sql: "INSERT StripeConnectedAccountNeedsSetupNotifyingTask (accountId, retryCount, executionTimeMs, createdTimeMs) VALUES (@accountId, @retryCount, @executionTimeMs, @createdTimeMs)",
    params: {
      accountId: args.accountId,
      retryCount: args.retryCount == null ? null : Spanner.float(args.retryCount),
      executionTimeMs: args.executionTimeMs == null ? null : new Date(args.executionTimeMs).toISOString(),
      createdTimeMs: args.createdTimeMs == null ? null : new Date(args.createdTimeMs).toISOString(),
    },
    types: {
      accountId: { type: "string" },
      retryCount: { type: "float64" },
      executionTimeMs: { type: "timestamp" },
      createdTimeMs: { type: "timestamp" },
    }
  };
}

export function deleteStripeConnectedAccountNeedsSetupNotifyingTaskStatement(
  args: {
    stripeConnectedAccountNeedsSetupNotifyingTaskAccountIdEq: string,
  }
): Statement {
  return {
    sql: "DELETE StripeConnectedAccountNeedsSetupNotifyingTask WHERE (StripeConnectedAccountNeedsSetupNotifyingTask.accountId = @stripeConnectedAccountNeedsSetupNotifyingTaskAccountIdEq)",
    params: {
      stripeConnectedAccountNeedsSetupNotifyingTaskAccountIdEq: args.stripeConnectedAccountNeedsSetupNotifyingTaskAccountIdEq,
    },
    types: {
      stripeConnectedAccountNeedsSetupNotifyingTaskAccountIdEq: { type: "string" },
    }
  };
}

export interface GetStripeConnectedAccountNeedsSetupNotifyingTaskRow {
  stripeConnectedAccountNeedsSetupNotifyingTaskAccountId?: string,
  stripeConnectedAccountNeedsSetupNotifyingTaskRetryCount?: number,
  stripeConnectedAccountNeedsSetupNotifyingTaskExecutionTimeMs?: number,
  stripeConnectedAccountNeedsSetupNotifyingTaskCreatedTimeMs?: number,
}

export let GET_STRIPE_CONNECTED_ACCOUNT_NEEDS_SETUP_NOTIFYING_TASK_ROW: MessageDescriptor<GetStripeConnectedAccountNeedsSetupNotifyingTaskRow> = {
  name: 'GetStripeConnectedAccountNeedsSetupNotifyingTaskRow',
  fields: [{
    name: 'stripeConnectedAccountNeedsSetupNotifyingTaskAccountId',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'stripeConnectedAccountNeedsSetupNotifyingTaskRetryCount',
    index: 2,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'stripeConnectedAccountNeedsSetupNotifyingTaskExecutionTimeMs',
    index: 3,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'stripeConnectedAccountNeedsSetupNotifyingTaskCreatedTimeMs',
    index: 4,
    primitiveType: PrimitiveType.NUMBER,
  }],
};

export async function getStripeConnectedAccountNeedsSetupNotifyingTask(
  runner: Database | Transaction,
  args: {
    stripeConnectedAccountNeedsSetupNotifyingTaskAccountIdEq: string,
  }
): Promise<Array<GetStripeConnectedAccountNeedsSetupNotifyingTaskRow>> {
  let [rows] = await runner.run({
    sql: "SELECT StripeConnectedAccountNeedsSetupNotifyingTask.accountId, StripeConnectedAccountNeedsSetupNotifyingTask.retryCount, StripeConnectedAccountNeedsSetupNotifyingTask.executionTimeMs, StripeConnectedAccountNeedsSetupNotifyingTask.createdTimeMs FROM StripeConnectedAccountNeedsSetupNotifyingTask WHERE (StripeConnectedAccountNeedsSetupNotifyingTask.accountId = @stripeConnectedAccountNeedsSetupNotifyingTaskAccountIdEq)",
    params: {
      stripeConnectedAccountNeedsSetupNotifyingTaskAccountIdEq: args.stripeConnectedAccountNeedsSetupNotifyingTaskAccountIdEq,
    },
    types: {
      stripeConnectedAccountNeedsSetupNotifyingTaskAccountIdEq: { type: "string" },
    }
  });
  let resRows = new Array<GetStripeConnectedAccountNeedsSetupNotifyingTaskRow>();
  for (let row of rows) {
    resRows.push({
      stripeConnectedAccountNeedsSetupNotifyingTaskAccountId: row.at(0).value == null ? undefined : row.at(0).value,
      stripeConnectedAccountNeedsSetupNotifyingTaskRetryCount: row.at(1).value == null ? undefined : row.at(1).value.value,
      stripeConnectedAccountNeedsSetupNotifyingTaskExecutionTimeMs: row.at(2).value == null ? undefined : row.at(2).value.valueOf(),
      stripeConnectedAccountNeedsSetupNotifyingTaskCreatedTimeMs: row.at(3).value == null ? undefined : row.at(3).value.valueOf(),
    });
  }
  return resRows;
}

export interface ListPendingStripeConnectedAccountNeedsSetupNotifyingTasksRow {
  stripeConnectedAccountNeedsSetupNotifyingTaskAccountId?: string,
}

export let LIST_PENDING_STRIPE_CONNECTED_ACCOUNT_NEEDS_SETUP_NOTIFYING_TASKS_ROW: MessageDescriptor<ListPendingStripeConnectedAccountNeedsSetupNotifyingTasksRow> = {
  name: 'ListPendingStripeConnectedAccountNeedsSetupNotifyingTasksRow',
  fields: [{
    name: 'stripeConnectedAccountNeedsSetupNotifyingTaskAccountId',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }],
};

export async function listPendingStripeConnectedAccountNeedsSetupNotifyingTasks(
  runner: Database | Transaction,
  args: {
    stripeConnectedAccountNeedsSetupNotifyingTaskExecutionTimeMsLe?: number,
  }
): Promise<Array<ListPendingStripeConnectedAccountNeedsSetupNotifyingTasksRow>> {
  let [rows] = await runner.run({
    sql: "SELECT StripeConnectedAccountNeedsSetupNotifyingTask.accountId FROM StripeConnectedAccountNeedsSetupNotifyingTask WHERE StripeConnectedAccountNeedsSetupNotifyingTask.executionTimeMs <= @stripeConnectedAccountNeedsSetupNotifyingTaskExecutionTimeMsLe",
    params: {
      stripeConnectedAccountNeedsSetupNotifyingTaskExecutionTimeMsLe: args.stripeConnectedAccountNeedsSetupNotifyingTaskExecutionTimeMsLe == null ? null : new Date(args.stripeConnectedAccountNeedsSetupNotifyingTaskExecutionTimeMsLe).toISOString(),
    },
    types: {
      stripeConnectedAccountNeedsSetupNotifyingTaskExecutionTimeMsLe: { type: "timestamp" },
    }
  });
  let resRows = new Array<ListPendingStripeConnectedAccountNeedsSetupNotifyingTasksRow>();
  for (let row of rows) {
    resRows.push({
      stripeConnectedAccountNeedsSetupNotifyingTaskAccountId: row.at(0).value == null ? undefined : row.at(0).value,
    });
  }
  return resRows;
}

export interface GetStripeConnectedAccountNeedsSetupNotifyingTaskMetadataRow {
  stripeConnectedAccountNeedsSetupNotifyingTaskRetryCount?: number,
  stripeConnectedAccountNeedsSetupNotifyingTaskExecutionTimeMs?: number,
}

export let GET_STRIPE_CONNECTED_ACCOUNT_NEEDS_SETUP_NOTIFYING_TASK_METADATA_ROW: MessageDescriptor<GetStripeConnectedAccountNeedsSetupNotifyingTaskMetadataRow> = {
  name: 'GetStripeConnectedAccountNeedsSetupNotifyingTaskMetadataRow',
  fields: [{
    name: 'stripeConnectedAccountNeedsSetupNotifyingTaskRetryCount',
    index: 1,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'stripeConnectedAccountNeedsSetupNotifyingTaskExecutionTimeMs',
    index: 2,
    primitiveType: PrimitiveType.NUMBER,
  }],
};

export async function getStripeConnectedAccountNeedsSetupNotifyingTaskMetadata(
  runner: Database | Transaction,
  args: {
    stripeConnectedAccountNeedsSetupNotifyingTaskAccountIdEq: string,
  }
): Promise<Array<GetStripeConnectedAccountNeedsSetupNotifyingTaskMetadataRow>> {
  let [rows] = await runner.run({
    sql: "SELECT StripeConnectedAccountNeedsSetupNotifyingTask.retryCount, StripeConnectedAccountNeedsSetupNotifyingTask.executionTimeMs FROM StripeConnectedAccountNeedsSetupNotifyingTask WHERE (StripeConnectedAccountNeedsSetupNotifyingTask.accountId = @stripeConnectedAccountNeedsSetupNotifyingTaskAccountIdEq)",
    params: {
      stripeConnectedAccountNeedsSetupNotifyingTaskAccountIdEq: args.stripeConnectedAccountNeedsSetupNotifyingTaskAccountIdEq,
    },
    types: {
      stripeConnectedAccountNeedsSetupNotifyingTaskAccountIdEq: { type: "string" },
    }
  });
  let resRows = new Array<GetStripeConnectedAccountNeedsSetupNotifyingTaskMetadataRow>();
  for (let row of rows) {
    resRows.push({
      stripeConnectedAccountNeedsSetupNotifyingTaskRetryCount: row.at(0).value == null ? undefined : row.at(0).value.value,
      stripeConnectedAccountNeedsSetupNotifyingTaskExecutionTimeMs: row.at(1).value == null ? undefined : row.at(1).value.valueOf(),
    });
  }
  return resRows;
}

export function updateStripeConnectedAccountNeedsSetupNotifyingTaskMetadataStatement(
  args: {
    stripeConnectedAccountNeedsSetupNotifyingTaskAccountIdEq: string,
    setRetryCount?: number,
    setExecutionTimeMs?: number,
  }
): Statement {
  return {
    sql: "UPDATE StripeConnectedAccountNeedsSetupNotifyingTask SET retryCount = @setRetryCount, executionTimeMs = @setExecutionTimeMs WHERE (StripeConnectedAccountNeedsSetupNotifyingTask.accountId = @stripeConnectedAccountNeedsSetupNotifyingTaskAccountIdEq)",
    params: {
      stripeConnectedAccountNeedsSetupNotifyingTaskAccountIdEq: args.stripeConnectedAccountNeedsSetupNotifyingTaskAccountIdEq,
      setRetryCount: args.setRetryCount == null ? null : Spanner.float(args.setRetryCount),
      setExecutionTimeMs: args.setExecutionTimeMs == null ? null : new Date(args.setExecutionTimeMs).toISOString(),
    },
    types: {
      stripeConnectedAccountNeedsSetupNotifyingTaskAccountIdEq: { type: "string" },
      setRetryCount: { type: "float64" },
      setExecutionTimeMs: { type: "timestamp" },
    }
  };
}

export function insertPaymentTaskStatement(
  args: {
    statementId: string,
    retryCount?: number,
    executionTimeMs?: number,
    createdTimeMs?: number,
  }
): Statement {
  return {
    sql: "INSERT PaymentTask (statementId, retryCount, executionTimeMs, createdTimeMs) VALUES (@statementId, @retryCount, @executionTimeMs, @createdTimeMs)",
    params: {
      statementId: args.statementId,
      retryCount: args.retryCount == null ? null : Spanner.float(args.retryCount),
      executionTimeMs: args.executionTimeMs == null ? null : new Date(args.executionTimeMs).toISOString(),
      createdTimeMs: args.createdTimeMs == null ? null : new Date(args.createdTimeMs).toISOString(),
    },
    types: {
      statementId: { type: "string" },
      retryCount: { type: "float64" },
      executionTimeMs: { type: "timestamp" },
      createdTimeMs: { type: "timestamp" },
    }
  };
}

export function deletePaymentTaskStatement(
  args: {
    paymentTaskStatementIdEq: string,
  }
): Statement {
  return {
    sql: "DELETE PaymentTask WHERE (PaymentTask.statementId = @paymentTaskStatementIdEq)",
    params: {
      paymentTaskStatementIdEq: args.paymentTaskStatementIdEq,
    },
    types: {
      paymentTaskStatementIdEq: { type: "string" },
    }
  };
}

export interface GetPaymentTaskRow {
  paymentTaskStatementId?: string,
  paymentTaskRetryCount?: number,
  paymentTaskExecutionTimeMs?: number,
  paymentTaskCreatedTimeMs?: number,
}

export let GET_PAYMENT_TASK_ROW: MessageDescriptor<GetPaymentTaskRow> = {
  name: 'GetPaymentTaskRow',
  fields: [{
    name: 'paymentTaskStatementId',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'paymentTaskRetryCount',
    index: 2,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'paymentTaskExecutionTimeMs',
    index: 3,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'paymentTaskCreatedTimeMs',
    index: 4,
    primitiveType: PrimitiveType.NUMBER,
  }],
};

export async function getPaymentTask(
  runner: Database | Transaction,
  args: {
    paymentTaskStatementIdEq: string,
  }
): Promise<Array<GetPaymentTaskRow>> {
  let [rows] = await runner.run({
    sql: "SELECT PaymentTask.statementId, PaymentTask.retryCount, PaymentTask.executionTimeMs, PaymentTask.createdTimeMs FROM PaymentTask WHERE (PaymentTask.statementId = @paymentTaskStatementIdEq)",
    params: {
      paymentTaskStatementIdEq: args.paymentTaskStatementIdEq,
    },
    types: {
      paymentTaskStatementIdEq: { type: "string" },
    }
  });
  let resRows = new Array<GetPaymentTaskRow>();
  for (let row of rows) {
    resRows.push({
      paymentTaskStatementId: row.at(0).value == null ? undefined : row.at(0).value,
      paymentTaskRetryCount: row.at(1).value == null ? undefined : row.at(1).value.value,
      paymentTaskExecutionTimeMs: row.at(2).value == null ? undefined : row.at(2).value.valueOf(),
      paymentTaskCreatedTimeMs: row.at(3).value == null ? undefined : row.at(3).value.valueOf(),
    });
  }
  return resRows;
}

export interface ListPendingPaymentTasksRow {
  paymentTaskStatementId?: string,
}

export let LIST_PENDING_PAYMENT_TASKS_ROW: MessageDescriptor<ListPendingPaymentTasksRow> = {
  name: 'ListPendingPaymentTasksRow',
  fields: [{
    name: 'paymentTaskStatementId',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }],
};

export async function listPendingPaymentTasks(
  runner: Database | Transaction,
  args: {
    paymentTaskExecutionTimeMsLe?: number,
  }
): Promise<Array<ListPendingPaymentTasksRow>> {
  let [rows] = await runner.run({
    sql: "SELECT PaymentTask.statementId FROM PaymentTask WHERE PaymentTask.executionTimeMs <= @paymentTaskExecutionTimeMsLe",
    params: {
      paymentTaskExecutionTimeMsLe: args.paymentTaskExecutionTimeMsLe == null ? null : new Date(args.paymentTaskExecutionTimeMsLe).toISOString(),
    },
    types: {
      paymentTaskExecutionTimeMsLe: { type: "timestamp" },
    }
  });
  let resRows = new Array<ListPendingPaymentTasksRow>();
  for (let row of rows) {
    resRows.push({
      paymentTaskStatementId: row.at(0).value == null ? undefined : row.at(0).value,
    });
  }
  return resRows;
}

export interface GetPaymentTaskMetadataRow {
  paymentTaskRetryCount?: number,
  paymentTaskExecutionTimeMs?: number,
}

export let GET_PAYMENT_TASK_METADATA_ROW: MessageDescriptor<GetPaymentTaskMetadataRow> = {
  name: 'GetPaymentTaskMetadataRow',
  fields: [{
    name: 'paymentTaskRetryCount',
    index: 1,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'paymentTaskExecutionTimeMs',
    index: 2,
    primitiveType: PrimitiveType.NUMBER,
  }],
};

export async function getPaymentTaskMetadata(
  runner: Database | Transaction,
  args: {
    paymentTaskStatementIdEq: string,
  }
): Promise<Array<GetPaymentTaskMetadataRow>> {
  let [rows] = await runner.run({
    sql: "SELECT PaymentTask.retryCount, PaymentTask.executionTimeMs FROM PaymentTask WHERE (PaymentTask.statementId = @paymentTaskStatementIdEq)",
    params: {
      paymentTaskStatementIdEq: args.paymentTaskStatementIdEq,
    },
    types: {
      paymentTaskStatementIdEq: { type: "string" },
    }
  });
  let resRows = new Array<GetPaymentTaskMetadataRow>();
  for (let row of rows) {
    resRows.push({
      paymentTaskRetryCount: row.at(0).value == null ? undefined : row.at(0).value.value,
      paymentTaskExecutionTimeMs: row.at(1).value == null ? undefined : row.at(1).value.valueOf(),
    });
  }
  return resRows;
}

export function updatePaymentTaskMetadataStatement(
  args: {
    paymentTaskStatementIdEq: string,
    setRetryCount?: number,
    setExecutionTimeMs?: number,
  }
): Statement {
  return {
    sql: "UPDATE PaymentTask SET retryCount = @setRetryCount, executionTimeMs = @setExecutionTimeMs WHERE (PaymentTask.statementId = @paymentTaskStatementIdEq)",
    params: {
      paymentTaskStatementIdEq: args.paymentTaskStatementIdEq,
      setRetryCount: args.setRetryCount == null ? null : Spanner.float(args.setRetryCount),
      setExecutionTimeMs: args.setExecutionTimeMs == null ? null : new Date(args.setExecutionTimeMs).toISOString(),
    },
    types: {
      paymentTaskStatementIdEq: { type: "string" },
      setRetryCount: { type: "float64" },
      setExecutionTimeMs: { type: "timestamp" },
    }
  };
}

export function insertPaymentMethodNeedsUpdateNotifyingTaskStatement(
  args: {
    statementId: string,
    retryCount?: number,
    executionTimeMs?: number,
    createdTimeMs?: number,
  }
): Statement {
  return {
    sql: "INSERT PaymentMethodNeedsUpdateNotifyingTask (statementId, retryCount, executionTimeMs, createdTimeMs) VALUES (@statementId, @retryCount, @executionTimeMs, @createdTimeMs)",
    params: {
      statementId: args.statementId,
      retryCount: args.retryCount == null ? null : Spanner.float(args.retryCount),
      executionTimeMs: args.executionTimeMs == null ? null : new Date(args.executionTimeMs).toISOString(),
      createdTimeMs: args.createdTimeMs == null ? null : new Date(args.createdTimeMs).toISOString(),
    },
    types: {
      statementId: { type: "string" },
      retryCount: { type: "float64" },
      executionTimeMs: { type: "timestamp" },
      createdTimeMs: { type: "timestamp" },
    }
  };
}

export function deletePaymentMethodNeedsUpdateNotifyingTaskStatement(
  args: {
    paymentMethodNeedsUpdateNotifyingTaskStatementIdEq: string,
  }
): Statement {
  return {
    sql: "DELETE PaymentMethodNeedsUpdateNotifyingTask WHERE (PaymentMethodNeedsUpdateNotifyingTask.statementId = @paymentMethodNeedsUpdateNotifyingTaskStatementIdEq)",
    params: {
      paymentMethodNeedsUpdateNotifyingTaskStatementIdEq: args.paymentMethodNeedsUpdateNotifyingTaskStatementIdEq,
    },
    types: {
      paymentMethodNeedsUpdateNotifyingTaskStatementIdEq: { type: "string" },
    }
  };
}

export interface GetPaymentMethodNeedsUpdateNotifyingTaskRow {
  paymentMethodNeedsUpdateNotifyingTaskStatementId?: string,
  paymentMethodNeedsUpdateNotifyingTaskRetryCount?: number,
  paymentMethodNeedsUpdateNotifyingTaskExecutionTimeMs?: number,
  paymentMethodNeedsUpdateNotifyingTaskCreatedTimeMs?: number,
}

export let GET_PAYMENT_METHOD_NEEDS_UPDATE_NOTIFYING_TASK_ROW: MessageDescriptor<GetPaymentMethodNeedsUpdateNotifyingTaskRow> = {
  name: 'GetPaymentMethodNeedsUpdateNotifyingTaskRow',
  fields: [{
    name: 'paymentMethodNeedsUpdateNotifyingTaskStatementId',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'paymentMethodNeedsUpdateNotifyingTaskRetryCount',
    index: 2,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'paymentMethodNeedsUpdateNotifyingTaskExecutionTimeMs',
    index: 3,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'paymentMethodNeedsUpdateNotifyingTaskCreatedTimeMs',
    index: 4,
    primitiveType: PrimitiveType.NUMBER,
  }],
};

export async function getPaymentMethodNeedsUpdateNotifyingTask(
  runner: Database | Transaction,
  args: {
    paymentMethodNeedsUpdateNotifyingTaskStatementIdEq: string,
  }
): Promise<Array<GetPaymentMethodNeedsUpdateNotifyingTaskRow>> {
  let [rows] = await runner.run({
    sql: "SELECT PaymentMethodNeedsUpdateNotifyingTask.statementId, PaymentMethodNeedsUpdateNotifyingTask.retryCount, PaymentMethodNeedsUpdateNotifyingTask.executionTimeMs, PaymentMethodNeedsUpdateNotifyingTask.createdTimeMs FROM PaymentMethodNeedsUpdateNotifyingTask WHERE (PaymentMethodNeedsUpdateNotifyingTask.statementId = @paymentMethodNeedsUpdateNotifyingTaskStatementIdEq)",
    params: {
      paymentMethodNeedsUpdateNotifyingTaskStatementIdEq: args.paymentMethodNeedsUpdateNotifyingTaskStatementIdEq,
    },
    types: {
      paymentMethodNeedsUpdateNotifyingTaskStatementIdEq: { type: "string" },
    }
  });
  let resRows = new Array<GetPaymentMethodNeedsUpdateNotifyingTaskRow>();
  for (let row of rows) {
    resRows.push({
      paymentMethodNeedsUpdateNotifyingTaskStatementId: row.at(0).value == null ? undefined : row.at(0).value,
      paymentMethodNeedsUpdateNotifyingTaskRetryCount: row.at(1).value == null ? undefined : row.at(1).value.value,
      paymentMethodNeedsUpdateNotifyingTaskExecutionTimeMs: row.at(2).value == null ? undefined : row.at(2).value.valueOf(),
      paymentMethodNeedsUpdateNotifyingTaskCreatedTimeMs: row.at(3).value == null ? undefined : row.at(3).value.valueOf(),
    });
  }
  return resRows;
}

export interface ListPendingPaymentMethodNeedsUpdateNotifyingTasksRow {
  paymentMethodNeedsUpdateNotifyingTaskStatementId?: string,
}

export let LIST_PENDING_PAYMENT_METHOD_NEEDS_UPDATE_NOTIFYING_TASKS_ROW: MessageDescriptor<ListPendingPaymentMethodNeedsUpdateNotifyingTasksRow> = {
  name: 'ListPendingPaymentMethodNeedsUpdateNotifyingTasksRow',
  fields: [{
    name: 'paymentMethodNeedsUpdateNotifyingTaskStatementId',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }],
};

export async function listPendingPaymentMethodNeedsUpdateNotifyingTasks(
  runner: Database | Transaction,
  args: {
    paymentMethodNeedsUpdateNotifyingTaskExecutionTimeMsLe?: number,
  }
): Promise<Array<ListPendingPaymentMethodNeedsUpdateNotifyingTasksRow>> {
  let [rows] = await runner.run({
    sql: "SELECT PaymentMethodNeedsUpdateNotifyingTask.statementId FROM PaymentMethodNeedsUpdateNotifyingTask WHERE PaymentMethodNeedsUpdateNotifyingTask.executionTimeMs <= @paymentMethodNeedsUpdateNotifyingTaskExecutionTimeMsLe",
    params: {
      paymentMethodNeedsUpdateNotifyingTaskExecutionTimeMsLe: args.paymentMethodNeedsUpdateNotifyingTaskExecutionTimeMsLe == null ? null : new Date(args.paymentMethodNeedsUpdateNotifyingTaskExecutionTimeMsLe).toISOString(),
    },
    types: {
      paymentMethodNeedsUpdateNotifyingTaskExecutionTimeMsLe: { type: "timestamp" },
    }
  });
  let resRows = new Array<ListPendingPaymentMethodNeedsUpdateNotifyingTasksRow>();
  for (let row of rows) {
    resRows.push({
      paymentMethodNeedsUpdateNotifyingTaskStatementId: row.at(0).value == null ? undefined : row.at(0).value,
    });
  }
  return resRows;
}

export interface GetPaymentMethodNeedsUpdateNotifyingTaskMetadataRow {
  paymentMethodNeedsUpdateNotifyingTaskRetryCount?: number,
  paymentMethodNeedsUpdateNotifyingTaskExecutionTimeMs?: number,
}

export let GET_PAYMENT_METHOD_NEEDS_UPDATE_NOTIFYING_TASK_METADATA_ROW: MessageDescriptor<GetPaymentMethodNeedsUpdateNotifyingTaskMetadataRow> = {
  name: 'GetPaymentMethodNeedsUpdateNotifyingTaskMetadataRow',
  fields: [{
    name: 'paymentMethodNeedsUpdateNotifyingTaskRetryCount',
    index: 1,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'paymentMethodNeedsUpdateNotifyingTaskExecutionTimeMs',
    index: 2,
    primitiveType: PrimitiveType.NUMBER,
  }],
};

export async function getPaymentMethodNeedsUpdateNotifyingTaskMetadata(
  runner: Database | Transaction,
  args: {
    paymentMethodNeedsUpdateNotifyingTaskStatementIdEq: string,
  }
): Promise<Array<GetPaymentMethodNeedsUpdateNotifyingTaskMetadataRow>> {
  let [rows] = await runner.run({
    sql: "SELECT PaymentMethodNeedsUpdateNotifyingTask.retryCount, PaymentMethodNeedsUpdateNotifyingTask.executionTimeMs FROM PaymentMethodNeedsUpdateNotifyingTask WHERE (PaymentMethodNeedsUpdateNotifyingTask.statementId = @paymentMethodNeedsUpdateNotifyingTaskStatementIdEq)",
    params: {
      paymentMethodNeedsUpdateNotifyingTaskStatementIdEq: args.paymentMethodNeedsUpdateNotifyingTaskStatementIdEq,
    },
    types: {
      paymentMethodNeedsUpdateNotifyingTaskStatementIdEq: { type: "string" },
    }
  });
  let resRows = new Array<GetPaymentMethodNeedsUpdateNotifyingTaskMetadataRow>();
  for (let row of rows) {
    resRows.push({
      paymentMethodNeedsUpdateNotifyingTaskRetryCount: row.at(0).value == null ? undefined : row.at(0).value.value,
      paymentMethodNeedsUpdateNotifyingTaskExecutionTimeMs: row.at(1).value == null ? undefined : row.at(1).value.valueOf(),
    });
  }
  return resRows;
}

export function updatePaymentMethodNeedsUpdateNotifyingTaskMetadataStatement(
  args: {
    paymentMethodNeedsUpdateNotifyingTaskStatementIdEq: string,
    setRetryCount?: number,
    setExecutionTimeMs?: number,
  }
): Statement {
  return {
    sql: "UPDATE PaymentMethodNeedsUpdateNotifyingTask SET retryCount = @setRetryCount, executionTimeMs = @setExecutionTimeMs WHERE (PaymentMethodNeedsUpdateNotifyingTask.statementId = @paymentMethodNeedsUpdateNotifyingTaskStatementIdEq)",
    params: {
      paymentMethodNeedsUpdateNotifyingTaskStatementIdEq: args.paymentMethodNeedsUpdateNotifyingTaskStatementIdEq,
      setRetryCount: args.setRetryCount == null ? null : Spanner.float(args.setRetryCount),
      setExecutionTimeMs: args.setExecutionTimeMs == null ? null : new Date(args.setExecutionTimeMs).toISOString(),
    },
    types: {
      paymentMethodNeedsUpdateNotifyingTaskStatementIdEq: { type: "string" },
      setRetryCount: { type: "float64" },
      setExecutionTimeMs: { type: "timestamp" },
    }
  };
}

export function insertBillingProfileSuspendingDueToPastDueTaskStatement(
  args: {
    statementId: string,
    retryCount?: number,
    executionTimeMs?: number,
    createdTimeMs?: number,
  }
): Statement {
  return {
    sql: "INSERT BillingProfileSuspendingDueToPastDueTask (statementId, retryCount, executionTimeMs, createdTimeMs) VALUES (@statementId, @retryCount, @executionTimeMs, @createdTimeMs)",
    params: {
      statementId: args.statementId,
      retryCount: args.retryCount == null ? null : Spanner.float(args.retryCount),
      executionTimeMs: args.executionTimeMs == null ? null : new Date(args.executionTimeMs).toISOString(),
      createdTimeMs: args.createdTimeMs == null ? null : new Date(args.createdTimeMs).toISOString(),
    },
    types: {
      statementId: { type: "string" },
      retryCount: { type: "float64" },
      executionTimeMs: { type: "timestamp" },
      createdTimeMs: { type: "timestamp" },
    }
  };
}

export function deleteBillingProfileSuspendingDueToPastDueTaskStatement(
  args: {
    billingProfileSuspendingDueToPastDueTaskStatementIdEq: string,
  }
): Statement {
  return {
    sql: "DELETE BillingProfileSuspendingDueToPastDueTask WHERE (BillingProfileSuspendingDueToPastDueTask.statementId = @billingProfileSuspendingDueToPastDueTaskStatementIdEq)",
    params: {
      billingProfileSuspendingDueToPastDueTaskStatementIdEq: args.billingProfileSuspendingDueToPastDueTaskStatementIdEq,
    },
    types: {
      billingProfileSuspendingDueToPastDueTaskStatementIdEq: { type: "string" },
    }
  };
}

export interface GetBillingProfileSuspendingDueToPastDueTaskRow {
  billingProfileSuspendingDueToPastDueTaskStatementId?: string,
  billingProfileSuspendingDueToPastDueTaskRetryCount?: number,
  billingProfileSuspendingDueToPastDueTaskExecutionTimeMs?: number,
  billingProfileSuspendingDueToPastDueTaskCreatedTimeMs?: number,
}

export let GET_BILLING_PROFILE_SUSPENDING_DUE_TO_PAST_DUE_TASK_ROW: MessageDescriptor<GetBillingProfileSuspendingDueToPastDueTaskRow> = {
  name: 'GetBillingProfileSuspendingDueToPastDueTaskRow',
  fields: [{
    name: 'billingProfileSuspendingDueToPastDueTaskStatementId',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'billingProfileSuspendingDueToPastDueTaskRetryCount',
    index: 2,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'billingProfileSuspendingDueToPastDueTaskExecutionTimeMs',
    index: 3,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'billingProfileSuspendingDueToPastDueTaskCreatedTimeMs',
    index: 4,
    primitiveType: PrimitiveType.NUMBER,
  }],
};

export async function getBillingProfileSuspendingDueToPastDueTask(
  runner: Database | Transaction,
  args: {
    billingProfileSuspendingDueToPastDueTaskStatementIdEq: string,
  }
): Promise<Array<GetBillingProfileSuspendingDueToPastDueTaskRow>> {
  let [rows] = await runner.run({
    sql: "SELECT BillingProfileSuspendingDueToPastDueTask.statementId, BillingProfileSuspendingDueToPastDueTask.retryCount, BillingProfileSuspendingDueToPastDueTask.executionTimeMs, BillingProfileSuspendingDueToPastDueTask.createdTimeMs FROM BillingProfileSuspendingDueToPastDueTask WHERE (BillingProfileSuspendingDueToPastDueTask.statementId = @billingProfileSuspendingDueToPastDueTaskStatementIdEq)",
    params: {
      billingProfileSuspendingDueToPastDueTaskStatementIdEq: args.billingProfileSuspendingDueToPastDueTaskStatementIdEq,
    },
    types: {
      billingProfileSuspendingDueToPastDueTaskStatementIdEq: { type: "string" },
    }
  });
  let resRows = new Array<GetBillingProfileSuspendingDueToPastDueTaskRow>();
  for (let row of rows) {
    resRows.push({
      billingProfileSuspendingDueToPastDueTaskStatementId: row.at(0).value == null ? undefined : row.at(0).value,
      billingProfileSuspendingDueToPastDueTaskRetryCount: row.at(1).value == null ? undefined : row.at(1).value.value,
      billingProfileSuspendingDueToPastDueTaskExecutionTimeMs: row.at(2).value == null ? undefined : row.at(2).value.valueOf(),
      billingProfileSuspendingDueToPastDueTaskCreatedTimeMs: row.at(3).value == null ? undefined : row.at(3).value.valueOf(),
    });
  }
  return resRows;
}

export interface ListPendingBillingProfileSuspendingDueToPastDueTasksRow {
  billingProfileSuspendingDueToPastDueTaskStatementId?: string,
}

export let LIST_PENDING_BILLING_PROFILE_SUSPENDING_DUE_TO_PAST_DUE_TASKS_ROW: MessageDescriptor<ListPendingBillingProfileSuspendingDueToPastDueTasksRow> = {
  name: 'ListPendingBillingProfileSuspendingDueToPastDueTasksRow',
  fields: [{
    name: 'billingProfileSuspendingDueToPastDueTaskStatementId',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }],
};

export async function listPendingBillingProfileSuspendingDueToPastDueTasks(
  runner: Database | Transaction,
  args: {
    billingProfileSuspendingDueToPastDueTaskExecutionTimeMsLe?: number,
  }
): Promise<Array<ListPendingBillingProfileSuspendingDueToPastDueTasksRow>> {
  let [rows] = await runner.run({
    sql: "SELECT BillingProfileSuspendingDueToPastDueTask.statementId FROM BillingProfileSuspendingDueToPastDueTask WHERE BillingProfileSuspendingDueToPastDueTask.executionTimeMs <= @billingProfileSuspendingDueToPastDueTaskExecutionTimeMsLe",
    params: {
      billingProfileSuspendingDueToPastDueTaskExecutionTimeMsLe: args.billingProfileSuspendingDueToPastDueTaskExecutionTimeMsLe == null ? null : new Date(args.billingProfileSuspendingDueToPastDueTaskExecutionTimeMsLe).toISOString(),
    },
    types: {
      billingProfileSuspendingDueToPastDueTaskExecutionTimeMsLe: { type: "timestamp" },
    }
  });
  let resRows = new Array<ListPendingBillingProfileSuspendingDueToPastDueTasksRow>();
  for (let row of rows) {
    resRows.push({
      billingProfileSuspendingDueToPastDueTaskStatementId: row.at(0).value == null ? undefined : row.at(0).value,
    });
  }
  return resRows;
}

export interface GetBillingProfileSuspendingDueToPastDueTaskMetadataRow {
  billingProfileSuspendingDueToPastDueTaskRetryCount?: number,
  billingProfileSuspendingDueToPastDueTaskExecutionTimeMs?: number,
}

export let GET_BILLING_PROFILE_SUSPENDING_DUE_TO_PAST_DUE_TASK_METADATA_ROW: MessageDescriptor<GetBillingProfileSuspendingDueToPastDueTaskMetadataRow> = {
  name: 'GetBillingProfileSuspendingDueToPastDueTaskMetadataRow',
  fields: [{
    name: 'billingProfileSuspendingDueToPastDueTaskRetryCount',
    index: 1,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'billingProfileSuspendingDueToPastDueTaskExecutionTimeMs',
    index: 2,
    primitiveType: PrimitiveType.NUMBER,
  }],
};

export async function getBillingProfileSuspendingDueToPastDueTaskMetadata(
  runner: Database | Transaction,
  args: {
    billingProfileSuspendingDueToPastDueTaskStatementIdEq: string,
  }
): Promise<Array<GetBillingProfileSuspendingDueToPastDueTaskMetadataRow>> {
  let [rows] = await runner.run({
    sql: "SELECT BillingProfileSuspendingDueToPastDueTask.retryCount, BillingProfileSuspendingDueToPastDueTask.executionTimeMs FROM BillingProfileSuspendingDueToPastDueTask WHERE (BillingProfileSuspendingDueToPastDueTask.statementId = @billingProfileSuspendingDueToPastDueTaskStatementIdEq)",
    params: {
      billingProfileSuspendingDueToPastDueTaskStatementIdEq: args.billingProfileSuspendingDueToPastDueTaskStatementIdEq,
    },
    types: {
      billingProfileSuspendingDueToPastDueTaskStatementIdEq: { type: "string" },
    }
  });
  let resRows = new Array<GetBillingProfileSuspendingDueToPastDueTaskMetadataRow>();
  for (let row of rows) {
    resRows.push({
      billingProfileSuspendingDueToPastDueTaskRetryCount: row.at(0).value == null ? undefined : row.at(0).value.value,
      billingProfileSuspendingDueToPastDueTaskExecutionTimeMs: row.at(1).value == null ? undefined : row.at(1).value.valueOf(),
    });
  }
  return resRows;
}

export function updateBillingProfileSuspendingDueToPastDueTaskMetadataStatement(
  args: {
    billingProfileSuspendingDueToPastDueTaskStatementIdEq: string,
    setRetryCount?: number,
    setExecutionTimeMs?: number,
  }
): Statement {
  return {
    sql: "UPDATE BillingProfileSuspendingDueToPastDueTask SET retryCount = @setRetryCount, executionTimeMs = @setExecutionTimeMs WHERE (BillingProfileSuspendingDueToPastDueTask.statementId = @billingProfileSuspendingDueToPastDueTaskStatementIdEq)",
    params: {
      billingProfileSuspendingDueToPastDueTaskStatementIdEq: args.billingProfileSuspendingDueToPastDueTaskStatementIdEq,
      setRetryCount: args.setRetryCount == null ? null : Spanner.float(args.setRetryCount),
      setExecutionTimeMs: args.setExecutionTimeMs == null ? null : new Date(args.setExecutionTimeMs).toISOString(),
    },
    types: {
      billingProfileSuspendingDueToPastDueTaskStatementIdEq: { type: "string" },
      setRetryCount: { type: "float64" },
      setExecutionTimeMs: { type: "timestamp" },
    }
  };
}

export function insertBillingProfileSuspensionNotifyingTaskStatement(
  args: {
    accountId: string,
    version: number,
    retryCount?: number,
    executionTimeMs?: number,
    createdTimeMs?: number,
  }
): Statement {
  return {
    sql: "INSERT BillingProfileSuspensionNotifyingTask (accountId, version, retryCount, executionTimeMs, createdTimeMs) VALUES (@accountId, @version, @retryCount, @executionTimeMs, @createdTimeMs)",
    params: {
      accountId: args.accountId,
      version: Spanner.float(args.version),
      retryCount: args.retryCount == null ? null : Spanner.float(args.retryCount),
      executionTimeMs: args.executionTimeMs == null ? null : new Date(args.executionTimeMs).toISOString(),
      createdTimeMs: args.createdTimeMs == null ? null : new Date(args.createdTimeMs).toISOString(),
    },
    types: {
      accountId: { type: "string" },
      version: { type: "float64" },
      retryCount: { type: "float64" },
      executionTimeMs: { type: "timestamp" },
      createdTimeMs: { type: "timestamp" },
    }
  };
}

export function deleteBillingProfileSuspensionNotifyingTaskStatement(
  args: {
    billingProfileSuspensionNotifyingTaskAccountIdEq: string,
    billingProfileSuspensionNotifyingTaskVersionEq: number,
  }
): Statement {
  return {
    sql: "DELETE BillingProfileSuspensionNotifyingTask WHERE (BillingProfileSuspensionNotifyingTask.accountId = @billingProfileSuspensionNotifyingTaskAccountIdEq AND BillingProfileSuspensionNotifyingTask.version = @billingProfileSuspensionNotifyingTaskVersionEq)",
    params: {
      billingProfileSuspensionNotifyingTaskAccountIdEq: args.billingProfileSuspensionNotifyingTaskAccountIdEq,
      billingProfileSuspensionNotifyingTaskVersionEq: Spanner.float(args.billingProfileSuspensionNotifyingTaskVersionEq),
    },
    types: {
      billingProfileSuspensionNotifyingTaskAccountIdEq: { type: "string" },
      billingProfileSuspensionNotifyingTaskVersionEq: { type: "float64" },
    }
  };
}

export interface GetBillingProfileSuspensionNotifyingTaskRow {
  billingProfileSuspensionNotifyingTaskAccountId?: string,
  billingProfileSuspensionNotifyingTaskVersion?: number,
  billingProfileSuspensionNotifyingTaskRetryCount?: number,
  billingProfileSuspensionNotifyingTaskExecutionTimeMs?: number,
  billingProfileSuspensionNotifyingTaskCreatedTimeMs?: number,
}

export let GET_BILLING_PROFILE_SUSPENSION_NOTIFYING_TASK_ROW: MessageDescriptor<GetBillingProfileSuspensionNotifyingTaskRow> = {
  name: 'GetBillingProfileSuspensionNotifyingTaskRow',
  fields: [{
    name: 'billingProfileSuspensionNotifyingTaskAccountId',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'billingProfileSuspensionNotifyingTaskVersion',
    index: 2,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'billingProfileSuspensionNotifyingTaskRetryCount',
    index: 3,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'billingProfileSuspensionNotifyingTaskExecutionTimeMs',
    index: 4,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'billingProfileSuspensionNotifyingTaskCreatedTimeMs',
    index: 5,
    primitiveType: PrimitiveType.NUMBER,
  }],
};

export async function getBillingProfileSuspensionNotifyingTask(
  runner: Database | Transaction,
  args: {
    billingProfileSuspensionNotifyingTaskAccountIdEq: string,
    billingProfileSuspensionNotifyingTaskVersionEq: number,
  }
): Promise<Array<GetBillingProfileSuspensionNotifyingTaskRow>> {
  let [rows] = await runner.run({
    sql: "SELECT BillingProfileSuspensionNotifyingTask.accountId, BillingProfileSuspensionNotifyingTask.version, BillingProfileSuspensionNotifyingTask.retryCount, BillingProfileSuspensionNotifyingTask.executionTimeMs, BillingProfileSuspensionNotifyingTask.createdTimeMs FROM BillingProfileSuspensionNotifyingTask WHERE (BillingProfileSuspensionNotifyingTask.accountId = @billingProfileSuspensionNotifyingTaskAccountIdEq AND BillingProfileSuspensionNotifyingTask.version = @billingProfileSuspensionNotifyingTaskVersionEq)",
    params: {
      billingProfileSuspensionNotifyingTaskAccountIdEq: args.billingProfileSuspensionNotifyingTaskAccountIdEq,
      billingProfileSuspensionNotifyingTaskVersionEq: Spanner.float(args.billingProfileSuspensionNotifyingTaskVersionEq),
    },
    types: {
      billingProfileSuspensionNotifyingTaskAccountIdEq: { type: "string" },
      billingProfileSuspensionNotifyingTaskVersionEq: { type: "float64" },
    }
  });
  let resRows = new Array<GetBillingProfileSuspensionNotifyingTaskRow>();
  for (let row of rows) {
    resRows.push({
      billingProfileSuspensionNotifyingTaskAccountId: row.at(0).value == null ? undefined : row.at(0).value,
      billingProfileSuspensionNotifyingTaskVersion: row.at(1).value == null ? undefined : row.at(1).value.value,
      billingProfileSuspensionNotifyingTaskRetryCount: row.at(2).value == null ? undefined : row.at(2).value.value,
      billingProfileSuspensionNotifyingTaskExecutionTimeMs: row.at(3).value == null ? undefined : row.at(3).value.valueOf(),
      billingProfileSuspensionNotifyingTaskCreatedTimeMs: row.at(4).value == null ? undefined : row.at(4).value.valueOf(),
    });
  }
  return resRows;
}

export interface ListPendingBillingProfileSuspensionNotifyingTasksRow {
  billingProfileSuspensionNotifyingTaskAccountId?: string,
  billingProfileSuspensionNotifyingTaskVersion?: number,
}

export let LIST_PENDING_BILLING_PROFILE_SUSPENSION_NOTIFYING_TASKS_ROW: MessageDescriptor<ListPendingBillingProfileSuspensionNotifyingTasksRow> = {
  name: 'ListPendingBillingProfileSuspensionNotifyingTasksRow',
  fields: [{
    name: 'billingProfileSuspensionNotifyingTaskAccountId',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'billingProfileSuspensionNotifyingTaskVersion',
    index: 2,
    primitiveType: PrimitiveType.NUMBER,
  }],
};

export async function listPendingBillingProfileSuspensionNotifyingTasks(
  runner: Database | Transaction,
  args: {
    billingProfileSuspensionNotifyingTaskExecutionTimeMsLe?: number,
  }
): Promise<Array<ListPendingBillingProfileSuspensionNotifyingTasksRow>> {
  let [rows] = await runner.run({
    sql: "SELECT BillingProfileSuspensionNotifyingTask.accountId, BillingProfileSuspensionNotifyingTask.version FROM BillingProfileSuspensionNotifyingTask WHERE BillingProfileSuspensionNotifyingTask.executionTimeMs <= @billingProfileSuspensionNotifyingTaskExecutionTimeMsLe",
    params: {
      billingProfileSuspensionNotifyingTaskExecutionTimeMsLe: args.billingProfileSuspensionNotifyingTaskExecutionTimeMsLe == null ? null : new Date(args.billingProfileSuspensionNotifyingTaskExecutionTimeMsLe).toISOString(),
    },
    types: {
      billingProfileSuspensionNotifyingTaskExecutionTimeMsLe: { type: "timestamp" },
    }
  });
  let resRows = new Array<ListPendingBillingProfileSuspensionNotifyingTasksRow>();
  for (let row of rows) {
    resRows.push({
      billingProfileSuspensionNotifyingTaskAccountId: row.at(0).value == null ? undefined : row.at(0).value,
      billingProfileSuspensionNotifyingTaskVersion: row.at(1).value == null ? undefined : row.at(1).value.value,
    });
  }
  return resRows;
}

export interface GetBillingProfileSuspensionNotifyingTaskMetadataRow {
  billingProfileSuspensionNotifyingTaskRetryCount?: number,
  billingProfileSuspensionNotifyingTaskExecutionTimeMs?: number,
}

export let GET_BILLING_PROFILE_SUSPENSION_NOTIFYING_TASK_METADATA_ROW: MessageDescriptor<GetBillingProfileSuspensionNotifyingTaskMetadataRow> = {
  name: 'GetBillingProfileSuspensionNotifyingTaskMetadataRow',
  fields: [{
    name: 'billingProfileSuspensionNotifyingTaskRetryCount',
    index: 1,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'billingProfileSuspensionNotifyingTaskExecutionTimeMs',
    index: 2,
    primitiveType: PrimitiveType.NUMBER,
  }],
};

export async function getBillingProfileSuspensionNotifyingTaskMetadata(
  runner: Database | Transaction,
  args: {
    billingProfileSuspensionNotifyingTaskAccountIdEq: string,
    billingProfileSuspensionNotifyingTaskVersionEq: number,
  }
): Promise<Array<GetBillingProfileSuspensionNotifyingTaskMetadataRow>> {
  let [rows] = await runner.run({
    sql: "SELECT BillingProfileSuspensionNotifyingTask.retryCount, BillingProfileSuspensionNotifyingTask.executionTimeMs FROM BillingProfileSuspensionNotifyingTask WHERE (BillingProfileSuspensionNotifyingTask.accountId = @billingProfileSuspensionNotifyingTaskAccountIdEq AND BillingProfileSuspensionNotifyingTask.version = @billingProfileSuspensionNotifyingTaskVersionEq)",
    params: {
      billingProfileSuspensionNotifyingTaskAccountIdEq: args.billingProfileSuspensionNotifyingTaskAccountIdEq,
      billingProfileSuspensionNotifyingTaskVersionEq: Spanner.float(args.billingProfileSuspensionNotifyingTaskVersionEq),
    },
    types: {
      billingProfileSuspensionNotifyingTaskAccountIdEq: { type: "string" },
      billingProfileSuspensionNotifyingTaskVersionEq: { type: "float64" },
    }
  });
  let resRows = new Array<GetBillingProfileSuspensionNotifyingTaskMetadataRow>();
  for (let row of rows) {
    resRows.push({
      billingProfileSuspensionNotifyingTaskRetryCount: row.at(0).value == null ? undefined : row.at(0).value.value,
      billingProfileSuspensionNotifyingTaskExecutionTimeMs: row.at(1).value == null ? undefined : row.at(1).value.valueOf(),
    });
  }
  return resRows;
}

export function updateBillingProfileSuspensionNotifyingTaskMetadataStatement(
  args: {
    billingProfileSuspensionNotifyingTaskAccountIdEq: string,
    billingProfileSuspensionNotifyingTaskVersionEq: number,
    setRetryCount?: number,
    setExecutionTimeMs?: number,
  }
): Statement {
  return {
    sql: "UPDATE BillingProfileSuspensionNotifyingTask SET retryCount = @setRetryCount, executionTimeMs = @setExecutionTimeMs WHERE (BillingProfileSuspensionNotifyingTask.accountId = @billingProfileSuspensionNotifyingTaskAccountIdEq AND BillingProfileSuspensionNotifyingTask.version = @billingProfileSuspensionNotifyingTaskVersionEq)",
    params: {
      billingProfileSuspensionNotifyingTaskAccountIdEq: args.billingProfileSuspensionNotifyingTaskAccountIdEq,
      billingProfileSuspensionNotifyingTaskVersionEq: Spanner.float(args.billingProfileSuspensionNotifyingTaskVersionEq),
      setRetryCount: args.setRetryCount == null ? null : Spanner.float(args.setRetryCount),
      setExecutionTimeMs: args.setExecutionTimeMs == null ? null : new Date(args.setExecutionTimeMs).toISOString(),
    },
    types: {
      billingProfileSuspensionNotifyingTaskAccountIdEq: { type: "string" },
      billingProfileSuspensionNotifyingTaskVersionEq: { type: "float64" },
      setRetryCount: { type: "float64" },
      setExecutionTimeMs: { type: "timestamp" },
    }
  };
}

export function insertBillingProfileStateSyncingTaskStatement(
  args: {
    accountId: string,
    version: number,
    retryCount?: number,
    executionTimeMs?: number,
    createdTimeMs?: number,
  }
): Statement {
  return {
    sql: "INSERT BillingProfileStateSyncingTask (accountId, version, retryCount, executionTimeMs, createdTimeMs) VALUES (@accountId, @version, @retryCount, @executionTimeMs, @createdTimeMs)",
    params: {
      accountId: args.accountId,
      version: Spanner.float(args.version),
      retryCount: args.retryCount == null ? null : Spanner.float(args.retryCount),
      executionTimeMs: args.executionTimeMs == null ? null : new Date(args.executionTimeMs).toISOString(),
      createdTimeMs: args.createdTimeMs == null ? null : new Date(args.createdTimeMs).toISOString(),
    },
    types: {
      accountId: { type: "string" },
      version: { type: "float64" },
      retryCount: { type: "float64" },
      executionTimeMs: { type: "timestamp" },
      createdTimeMs: { type: "timestamp" },
    }
  };
}

export function deleteBillingProfileStateSyncingTaskStatement(
  args: {
    billingProfileStateSyncingTaskAccountIdEq: string,
    billingProfileStateSyncingTaskVersionEq: number,
  }
): Statement {
  return {
    sql: "DELETE BillingProfileStateSyncingTask WHERE (BillingProfileStateSyncingTask.accountId = @billingProfileStateSyncingTaskAccountIdEq AND BillingProfileStateSyncingTask.version = @billingProfileStateSyncingTaskVersionEq)",
    params: {
      billingProfileStateSyncingTaskAccountIdEq: args.billingProfileStateSyncingTaskAccountIdEq,
      billingProfileStateSyncingTaskVersionEq: Spanner.float(args.billingProfileStateSyncingTaskVersionEq),
    },
    types: {
      billingProfileStateSyncingTaskAccountIdEq: { type: "string" },
      billingProfileStateSyncingTaskVersionEq: { type: "float64" },
    }
  };
}

export interface GetBillingProfileStateSyncingTaskRow {
  billingProfileStateSyncingTaskAccountId?: string,
  billingProfileStateSyncingTaskVersion?: number,
  billingProfileStateSyncingTaskRetryCount?: number,
  billingProfileStateSyncingTaskExecutionTimeMs?: number,
  billingProfileStateSyncingTaskCreatedTimeMs?: number,
}

export let GET_BILLING_PROFILE_STATE_SYNCING_TASK_ROW: MessageDescriptor<GetBillingProfileStateSyncingTaskRow> = {
  name: 'GetBillingProfileStateSyncingTaskRow',
  fields: [{
    name: 'billingProfileStateSyncingTaskAccountId',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'billingProfileStateSyncingTaskVersion',
    index: 2,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'billingProfileStateSyncingTaskRetryCount',
    index: 3,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'billingProfileStateSyncingTaskExecutionTimeMs',
    index: 4,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'billingProfileStateSyncingTaskCreatedTimeMs',
    index: 5,
    primitiveType: PrimitiveType.NUMBER,
  }],
};

export async function getBillingProfileStateSyncingTask(
  runner: Database | Transaction,
  args: {
    billingProfileStateSyncingTaskAccountIdEq: string,
    billingProfileStateSyncingTaskVersionEq: number,
  }
): Promise<Array<GetBillingProfileStateSyncingTaskRow>> {
  let [rows] = await runner.run({
    sql: "SELECT BillingProfileStateSyncingTask.accountId, BillingProfileStateSyncingTask.version, BillingProfileStateSyncingTask.retryCount, BillingProfileStateSyncingTask.executionTimeMs, BillingProfileStateSyncingTask.createdTimeMs FROM BillingProfileStateSyncingTask WHERE (BillingProfileStateSyncingTask.accountId = @billingProfileStateSyncingTaskAccountIdEq AND BillingProfileStateSyncingTask.version = @billingProfileStateSyncingTaskVersionEq)",
    params: {
      billingProfileStateSyncingTaskAccountIdEq: args.billingProfileStateSyncingTaskAccountIdEq,
      billingProfileStateSyncingTaskVersionEq: Spanner.float(args.billingProfileStateSyncingTaskVersionEq),
    },
    types: {
      billingProfileStateSyncingTaskAccountIdEq: { type: "string" },
      billingProfileStateSyncingTaskVersionEq: { type: "float64" },
    }
  });
  let resRows = new Array<GetBillingProfileStateSyncingTaskRow>();
  for (let row of rows) {
    resRows.push({
      billingProfileStateSyncingTaskAccountId: row.at(0).value == null ? undefined : row.at(0).value,
      billingProfileStateSyncingTaskVersion: row.at(1).value == null ? undefined : row.at(1).value.value,
      billingProfileStateSyncingTaskRetryCount: row.at(2).value == null ? undefined : row.at(2).value.value,
      billingProfileStateSyncingTaskExecutionTimeMs: row.at(3).value == null ? undefined : row.at(3).value.valueOf(),
      billingProfileStateSyncingTaskCreatedTimeMs: row.at(4).value == null ? undefined : row.at(4).value.valueOf(),
    });
  }
  return resRows;
}

export interface ListPendingBillingProfileStateSyncingTasksRow {
  billingProfileStateSyncingTaskAccountId?: string,
  billingProfileStateSyncingTaskVersion?: number,
}

export let LIST_PENDING_BILLING_PROFILE_STATE_SYNCING_TASKS_ROW: MessageDescriptor<ListPendingBillingProfileStateSyncingTasksRow> = {
  name: 'ListPendingBillingProfileStateSyncingTasksRow',
  fields: [{
    name: 'billingProfileStateSyncingTaskAccountId',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'billingProfileStateSyncingTaskVersion',
    index: 2,
    primitiveType: PrimitiveType.NUMBER,
  }],
};

export async function listPendingBillingProfileStateSyncingTasks(
  runner: Database | Transaction,
  args: {
    billingProfileStateSyncingTaskExecutionTimeMsLe?: number,
  }
): Promise<Array<ListPendingBillingProfileStateSyncingTasksRow>> {
  let [rows] = await runner.run({
    sql: "SELECT BillingProfileStateSyncingTask.accountId, BillingProfileStateSyncingTask.version FROM BillingProfileStateSyncingTask WHERE BillingProfileStateSyncingTask.executionTimeMs <= @billingProfileStateSyncingTaskExecutionTimeMsLe",
    params: {
      billingProfileStateSyncingTaskExecutionTimeMsLe: args.billingProfileStateSyncingTaskExecutionTimeMsLe == null ? null : new Date(args.billingProfileStateSyncingTaskExecutionTimeMsLe).toISOString(),
    },
    types: {
      billingProfileStateSyncingTaskExecutionTimeMsLe: { type: "timestamp" },
    }
  });
  let resRows = new Array<ListPendingBillingProfileStateSyncingTasksRow>();
  for (let row of rows) {
    resRows.push({
      billingProfileStateSyncingTaskAccountId: row.at(0).value == null ? undefined : row.at(0).value,
      billingProfileStateSyncingTaskVersion: row.at(1).value == null ? undefined : row.at(1).value.value,
    });
  }
  return resRows;
}

export interface GetBillingProfileStateSyncingTaskMetadataRow {
  billingProfileStateSyncingTaskRetryCount?: number,
  billingProfileStateSyncingTaskExecutionTimeMs?: number,
}

export let GET_BILLING_PROFILE_STATE_SYNCING_TASK_METADATA_ROW: MessageDescriptor<GetBillingProfileStateSyncingTaskMetadataRow> = {
  name: 'GetBillingProfileStateSyncingTaskMetadataRow',
  fields: [{
    name: 'billingProfileStateSyncingTaskRetryCount',
    index: 1,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'billingProfileStateSyncingTaskExecutionTimeMs',
    index: 2,
    primitiveType: PrimitiveType.NUMBER,
  }],
};

export async function getBillingProfileStateSyncingTaskMetadata(
  runner: Database | Transaction,
  args: {
    billingProfileStateSyncingTaskAccountIdEq: string,
    billingProfileStateSyncingTaskVersionEq: number,
  }
): Promise<Array<GetBillingProfileStateSyncingTaskMetadataRow>> {
  let [rows] = await runner.run({
    sql: "SELECT BillingProfileStateSyncingTask.retryCount, BillingProfileStateSyncingTask.executionTimeMs FROM BillingProfileStateSyncingTask WHERE (BillingProfileStateSyncingTask.accountId = @billingProfileStateSyncingTaskAccountIdEq AND BillingProfileStateSyncingTask.version = @billingProfileStateSyncingTaskVersionEq)",
    params: {
      billingProfileStateSyncingTaskAccountIdEq: args.billingProfileStateSyncingTaskAccountIdEq,
      billingProfileStateSyncingTaskVersionEq: Spanner.float(args.billingProfileStateSyncingTaskVersionEq),
    },
    types: {
      billingProfileStateSyncingTaskAccountIdEq: { type: "string" },
      billingProfileStateSyncingTaskVersionEq: { type: "float64" },
    }
  });
  let resRows = new Array<GetBillingProfileStateSyncingTaskMetadataRow>();
  for (let row of rows) {
    resRows.push({
      billingProfileStateSyncingTaskRetryCount: row.at(0).value == null ? undefined : row.at(0).value.value,
      billingProfileStateSyncingTaskExecutionTimeMs: row.at(1).value == null ? undefined : row.at(1).value.valueOf(),
    });
  }
  return resRows;
}

export function updateBillingProfileStateSyncingTaskMetadataStatement(
  args: {
    billingProfileStateSyncingTaskAccountIdEq: string,
    billingProfileStateSyncingTaskVersionEq: number,
    setRetryCount?: number,
    setExecutionTimeMs?: number,
  }
): Statement {
  return {
    sql: "UPDATE BillingProfileStateSyncingTask SET retryCount = @setRetryCount, executionTimeMs = @setExecutionTimeMs WHERE (BillingProfileStateSyncingTask.accountId = @billingProfileStateSyncingTaskAccountIdEq AND BillingProfileStateSyncingTask.version = @billingProfileStateSyncingTaskVersionEq)",
    params: {
      billingProfileStateSyncingTaskAccountIdEq: args.billingProfileStateSyncingTaskAccountIdEq,
      billingProfileStateSyncingTaskVersionEq: Spanner.float(args.billingProfileStateSyncingTaskVersionEq),
      setRetryCount: args.setRetryCount == null ? null : Spanner.float(args.setRetryCount),
      setExecutionTimeMs: args.setExecutionTimeMs == null ? null : new Date(args.setExecutionTimeMs).toISOString(),
    },
    types: {
      billingProfileStateSyncingTaskAccountIdEq: { type: "string" },
      billingProfileStateSyncingTaskVersionEq: { type: "float64" },
      setRetryCount: { type: "float64" },
      setExecutionTimeMs: { type: "timestamp" },
    }
  };
}

export function insertPayoutTaskStatement(
  args: {
    statementId: string,
    retryCount?: number,
    executionTimeMs?: number,
    createdTimeMs?: number,
  }
): Statement {
  return {
    sql: "INSERT PayoutTask (statementId, retryCount, executionTimeMs, createdTimeMs) VALUES (@statementId, @retryCount, @executionTimeMs, @createdTimeMs)",
    params: {
      statementId: args.statementId,
      retryCount: args.retryCount == null ? null : Spanner.float(args.retryCount),
      executionTimeMs: args.executionTimeMs == null ? null : new Date(args.executionTimeMs).toISOString(),
      createdTimeMs: args.createdTimeMs == null ? null : new Date(args.createdTimeMs).toISOString(),
    },
    types: {
      statementId: { type: "string" },
      retryCount: { type: "float64" },
      executionTimeMs: { type: "timestamp" },
      createdTimeMs: { type: "timestamp" },
    }
  };
}

export function deletePayoutTaskStatement(
  args: {
    payoutTaskStatementIdEq: string,
  }
): Statement {
  return {
    sql: "DELETE PayoutTask WHERE (PayoutTask.statementId = @payoutTaskStatementIdEq)",
    params: {
      payoutTaskStatementIdEq: args.payoutTaskStatementIdEq,
    },
    types: {
      payoutTaskStatementIdEq: { type: "string" },
    }
  };
}

export interface GetPayoutTaskRow {
  payoutTaskStatementId?: string,
  payoutTaskRetryCount?: number,
  payoutTaskExecutionTimeMs?: number,
  payoutTaskCreatedTimeMs?: number,
}

export let GET_PAYOUT_TASK_ROW: MessageDescriptor<GetPayoutTaskRow> = {
  name: 'GetPayoutTaskRow',
  fields: [{
    name: 'payoutTaskStatementId',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'payoutTaskRetryCount',
    index: 2,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'payoutTaskExecutionTimeMs',
    index: 3,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'payoutTaskCreatedTimeMs',
    index: 4,
    primitiveType: PrimitiveType.NUMBER,
  }],
};

export async function getPayoutTask(
  runner: Database | Transaction,
  args: {
    payoutTaskStatementIdEq: string,
  }
): Promise<Array<GetPayoutTaskRow>> {
  let [rows] = await runner.run({
    sql: "SELECT PayoutTask.statementId, PayoutTask.retryCount, PayoutTask.executionTimeMs, PayoutTask.createdTimeMs FROM PayoutTask WHERE (PayoutTask.statementId = @payoutTaskStatementIdEq)",
    params: {
      payoutTaskStatementIdEq: args.payoutTaskStatementIdEq,
    },
    types: {
      payoutTaskStatementIdEq: { type: "string" },
    }
  });
  let resRows = new Array<GetPayoutTaskRow>();
  for (let row of rows) {
    resRows.push({
      payoutTaskStatementId: row.at(0).value == null ? undefined : row.at(0).value,
      payoutTaskRetryCount: row.at(1).value == null ? undefined : row.at(1).value.value,
      payoutTaskExecutionTimeMs: row.at(2).value == null ? undefined : row.at(2).value.valueOf(),
      payoutTaskCreatedTimeMs: row.at(3).value == null ? undefined : row.at(3).value.valueOf(),
    });
  }
  return resRows;
}

export interface ListPendingPayoutTasksRow {
  payoutTaskStatementId?: string,
}

export let LIST_PENDING_PAYOUT_TASKS_ROW: MessageDescriptor<ListPendingPayoutTasksRow> = {
  name: 'ListPendingPayoutTasksRow',
  fields: [{
    name: 'payoutTaskStatementId',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }],
};

export async function listPendingPayoutTasks(
  runner: Database | Transaction,
  args: {
    payoutTaskExecutionTimeMsLe?: number,
  }
): Promise<Array<ListPendingPayoutTasksRow>> {
  let [rows] = await runner.run({
    sql: "SELECT PayoutTask.statementId FROM PayoutTask WHERE PayoutTask.executionTimeMs <= @payoutTaskExecutionTimeMsLe",
    params: {
      payoutTaskExecutionTimeMsLe: args.payoutTaskExecutionTimeMsLe == null ? null : new Date(args.payoutTaskExecutionTimeMsLe).toISOString(),
    },
    types: {
      payoutTaskExecutionTimeMsLe: { type: "timestamp" },
    }
  });
  let resRows = new Array<ListPendingPayoutTasksRow>();
  for (let row of rows) {
    resRows.push({
      payoutTaskStatementId: row.at(0).value == null ? undefined : row.at(0).value,
    });
  }
  return resRows;
}

export interface GetPayoutTaskMetadataRow {
  payoutTaskRetryCount?: number,
  payoutTaskExecutionTimeMs?: number,
}

export let GET_PAYOUT_TASK_METADATA_ROW: MessageDescriptor<GetPayoutTaskMetadataRow> = {
  name: 'GetPayoutTaskMetadataRow',
  fields: [{
    name: 'payoutTaskRetryCount',
    index: 1,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'payoutTaskExecutionTimeMs',
    index: 2,
    primitiveType: PrimitiveType.NUMBER,
  }],
};

export async function getPayoutTaskMetadata(
  runner: Database | Transaction,
  args: {
    payoutTaskStatementIdEq: string,
  }
): Promise<Array<GetPayoutTaskMetadataRow>> {
  let [rows] = await runner.run({
    sql: "SELECT PayoutTask.retryCount, PayoutTask.executionTimeMs FROM PayoutTask WHERE (PayoutTask.statementId = @payoutTaskStatementIdEq)",
    params: {
      payoutTaskStatementIdEq: args.payoutTaskStatementIdEq,
    },
    types: {
      payoutTaskStatementIdEq: { type: "string" },
    }
  });
  let resRows = new Array<GetPayoutTaskMetadataRow>();
  for (let row of rows) {
    resRows.push({
      payoutTaskRetryCount: row.at(0).value == null ? undefined : row.at(0).value.value,
      payoutTaskExecutionTimeMs: row.at(1).value == null ? undefined : row.at(1).value.valueOf(),
    });
  }
  return resRows;
}

export function updatePayoutTaskMetadataStatement(
  args: {
    payoutTaskStatementIdEq: string,
    setRetryCount?: number,
    setExecutionTimeMs?: number,
  }
): Statement {
  return {
    sql: "UPDATE PayoutTask SET retryCount = @setRetryCount, executionTimeMs = @setExecutionTimeMs WHERE (PayoutTask.statementId = @payoutTaskStatementIdEq)",
    params: {
      payoutTaskStatementIdEq: args.payoutTaskStatementIdEq,
      setRetryCount: args.setRetryCount == null ? null : Spanner.float(args.setRetryCount),
      setExecutionTimeMs: args.setExecutionTimeMs == null ? null : new Date(args.setExecutionTimeMs).toISOString(),
    },
    types: {
      payoutTaskStatementIdEq: { type: "string" },
      setRetryCount: { type: "float64" },
      setExecutionTimeMs: { type: "timestamp" },
    }
  };
}

export function updateBillingProfileStateStatement(
  args: {
    billingProfileAccountIdEq: string,
    setStateInfo?: BillingProfileStateInfo,
  }
): Statement {
  return {
    sql: "UPDATE BillingProfile SET stateInfo = @setStateInfo WHERE (BillingProfile.accountId = @billingProfileAccountIdEq)",
    params: {
      billingProfileAccountIdEq: args.billingProfileAccountIdEq,
      setStateInfo: args.setStateInfo == null ? null : Buffer.from(serializeMessage(args.setStateInfo, BILLING_PROFILE_STATE_INFO).buffer),
    },
    types: {
      billingProfileAccountIdEq: { type: "string" },
      setStateInfo: { type: "bytes" },
    }
  };
}

export function updateBillingProfilePaymentCustomerStatement(
  args: {
    billingProfileAccountIdEq: string,
    setStripePaymentCustomerId?: string,
  }
): Statement {
  return {
    sql: "UPDATE BillingProfile SET stripePaymentCustomerId = @setStripePaymentCustomerId WHERE (BillingProfile.accountId = @billingProfileAccountIdEq)",
    params: {
      billingProfileAccountIdEq: args.billingProfileAccountIdEq,
      setStripePaymentCustomerId: args.setStripePaymentCustomerId == null ? null : args.setStripePaymentCustomerId,
    },
    types: {
      billingProfileAccountIdEq: { type: "string" },
      setStripePaymentCustomerId: { type: "string" },
    }
  };
}

export function updateEarningsProfileConnectedAccountStatement(
  args: {
    earningsProfileAccountIdEq: string,
    setStripeConnectedAccountId?: string,
    setStripeConnectedAccountState?: StripeConnectedAccountState,
  }
): Statement {
  return {
    sql: "UPDATE EarningsProfile SET stripeConnectedAccountId = @setStripeConnectedAccountId, stripeConnectedAccountState = @setStripeConnectedAccountState WHERE (EarningsProfile.accountId = @earningsProfileAccountIdEq)",
    params: {
      earningsProfileAccountIdEq: args.earningsProfileAccountIdEq,
      setStripeConnectedAccountId: args.setStripeConnectedAccountId == null ? null : args.setStripeConnectedAccountId,
      setStripeConnectedAccountState: args.setStripeConnectedAccountState == null ? null : Spanner.float(args.setStripeConnectedAccountState),
    },
    types: {
      earningsProfileAccountIdEq: { type: "string" },
      setStripeConnectedAccountId: { type: "string" },
      setStripeConnectedAccountState: { type: "float64" },
    }
  };
}

export function updateEarningsProfileConnectedAccountStateStatement(
  args: {
    earningsProfileAccountIdEq: string,
    setStripeConnectedAccountState?: StripeConnectedAccountState,
  }
): Statement {
  return {
    sql: "UPDATE EarningsProfile SET stripeConnectedAccountState = @setStripeConnectedAccountState WHERE (EarningsProfile.accountId = @earningsProfileAccountIdEq)",
    params: {
      earningsProfileAccountIdEq: args.earningsProfileAccountIdEq,
      setStripeConnectedAccountState: args.setStripeConnectedAccountState == null ? null : Spanner.float(args.setStripeConnectedAccountState),
    },
    types: {
      earningsProfileAccountIdEq: { type: "string" },
      setStripeConnectedAccountState: { type: "float64" },
    }
  };
}

export function updatePaymentStateStatement(
  args: {
    paymentStatementIdEq: string,
    setState?: PaymentState,
    setUpdatedTimeMs?: number,
  }
): Statement {
  return {
    sql: "UPDATE Payment SET state = @setState, updatedTimeMs = @setUpdatedTimeMs WHERE (Payment.statementId = @paymentStatementIdEq)",
    params: {
      paymentStatementIdEq: args.paymentStatementIdEq,
      setState: args.setState == null ? null : Spanner.float(args.setState),
      setUpdatedTimeMs: args.setUpdatedTimeMs == null ? null : Spanner.float(args.setUpdatedTimeMs),
    },
    types: {
      paymentStatementIdEq: { type: "string" },
      setState: { type: "float64" },
      setUpdatedTimeMs: { type: "float64" },
    }
  };
}

export function updatePaymentStateAndStripeInvoiceStatement(
  args: {
    paymentStatementIdEq: string,
    setState?: PaymentState,
    setStripeInvoiceId?: string,
    setStripeInvoiceUrl?: string,
    setUpdatedTimeMs?: number,
  }
): Statement {
  return {
    sql: "UPDATE Payment SET state = @setState, stripeInvoiceId = @setStripeInvoiceId, stripeInvoiceUrl = @setStripeInvoiceUrl, updatedTimeMs = @setUpdatedTimeMs WHERE (Payment.statementId = @paymentStatementIdEq)",
    params: {
      paymentStatementIdEq: args.paymentStatementIdEq,
      setState: args.setState == null ? null : Spanner.float(args.setState),
      setStripeInvoiceId: args.setStripeInvoiceId == null ? null : args.setStripeInvoiceId,
      setStripeInvoiceUrl: args.setStripeInvoiceUrl == null ? null : args.setStripeInvoiceUrl,
      setUpdatedTimeMs: args.setUpdatedTimeMs == null ? null : Spanner.float(args.setUpdatedTimeMs),
    },
    types: {
      paymentStatementIdEq: { type: "string" },
      setState: { type: "float64" },
      setStripeInvoiceId: { type: "string" },
      setStripeInvoiceUrl: { type: "string" },
      setUpdatedTimeMs: { type: "float64" },
    }
  };
}

export function updatePayoutStateStatement(
  args: {
    payoutStatementIdEq: string,
    setState?: PayoutState,
    setUpdatedTimeMs?: number,
  }
): Statement {
  return {
    sql: "UPDATE Payout SET state = @setState, updatedTimeMs = @setUpdatedTimeMs WHERE (Payout.statementId = @payoutStatementIdEq)",
    params: {
      payoutStatementIdEq: args.payoutStatementIdEq,
      setState: args.setState == null ? null : Spanner.float(args.setState),
      setUpdatedTimeMs: args.setUpdatedTimeMs == null ? null : Spanner.float(args.setUpdatedTimeMs),
    },
    types: {
      payoutStatementIdEq: { type: "string" },
      setState: { type: "float64" },
      setUpdatedTimeMs: { type: "float64" },
    }
  };
}

export function updatePayoutStateAndStripeTransferStatement(
  args: {
    payoutStatementIdEq: string,
    setState?: PayoutState,
    setStripeTransferId?: string,
    setUpdatedTimeMs?: number,
  }
): Statement {
  return {
    sql: "UPDATE Payout SET state = @setState, stripeTransferId = @setStripeTransferId, updatedTimeMs = @setUpdatedTimeMs WHERE (Payout.statementId = @payoutStatementIdEq)",
    params: {
      payoutStatementIdEq: args.payoutStatementIdEq,
      setState: args.setState == null ? null : Spanner.float(args.setState),
      setStripeTransferId: args.setStripeTransferId == null ? null : args.setStripeTransferId,
      setUpdatedTimeMs: args.setUpdatedTimeMs == null ? null : Spanner.float(args.setUpdatedTimeMs),
    },
    types: {
      payoutStatementIdEq: { type: "string" },
      setState: { type: "float64" },
      setStripeTransferId: { type: "string" },
      setUpdatedTimeMs: { type: "float64" },
    }
  };
}

export interface GetBillingProfileFromStatementRow {
  billingProfileAccountId?: string,
  billingProfileStripePaymentCustomerId?: string,
  billingProfileStateInfo?: BillingProfileStateInfo,
  billingProfilePaymentAfterMs?: number,
  billingProfileCreatedTimeMs?: number,
}

export let GET_BILLING_PROFILE_FROM_STATEMENT_ROW: MessageDescriptor<GetBillingProfileFromStatementRow> = {
  name: 'GetBillingProfileFromStatementRow',
  fields: [{
    name: 'billingProfileAccountId',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'billingProfileStripePaymentCustomerId',
    index: 2,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'billingProfileStateInfo',
    index: 3,
    messageType: BILLING_PROFILE_STATE_INFO,
  }, {
    name: 'billingProfilePaymentAfterMs',
    index: 4,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'billingProfileCreatedTimeMs',
    index: 5,
    primitiveType: PrimitiveType.NUMBER,
  }],
};

export async function getBillingProfileFromStatement(
  runner: Database | Transaction,
  args: {
    transactionStatementStatementIdEq: string,
  }
): Promise<Array<GetBillingProfileFromStatementRow>> {
  let [rows] = await runner.run({
    sql: "SELECT b.accountId, b.stripePaymentCustomerId, b.stateInfo, b.paymentAfterMs, b.createdTimeMs FROM TransactionStatement AS t INNER JOIN BillingProfile AS b ON t.accountId = b.accountId WHERE (t.statementId = @transactionStatementStatementIdEq)",
    params: {
      transactionStatementStatementIdEq: args.transactionStatementStatementIdEq,
    },
    types: {
      transactionStatementStatementIdEq: { type: "string" },
    }
  });
  let resRows = new Array<GetBillingProfileFromStatementRow>();
  for (let row of rows) {
    resRows.push({
      billingProfileAccountId: row.at(0).value == null ? undefined : row.at(0).value,
      billingProfileStripePaymentCustomerId: row.at(1).value == null ? undefined : row.at(1).value,
      billingProfileStateInfo: row.at(2).value == null ? undefined : deserializeMessage(row.at(2).value, BILLING_PROFILE_STATE_INFO),
      billingProfilePaymentAfterMs: row.at(3).value == null ? undefined : row.at(3).value.value,
      billingProfileCreatedTimeMs: row.at(4).value == null ? undefined : row.at(4).value.value,
    });
  }
  return resRows;
}

export interface GetEarningsProfileFromStatementRow {
  earningsProfileAccountId?: string,
  earningsProfileStripeConnectedAccountId?: string,
  earningsProfileStripeConnectedAccountState?: StripeConnectedAccountState,
  earningsProfileCreatedTimeMs?: number,
}

export let GET_EARNINGS_PROFILE_FROM_STATEMENT_ROW: MessageDescriptor<GetEarningsProfileFromStatementRow> = {
  name: 'GetEarningsProfileFromStatementRow',
  fields: [{
    name: 'earningsProfileAccountId',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'earningsProfileStripeConnectedAccountId',
    index: 2,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'earningsProfileStripeConnectedAccountState',
    index: 3,
    enumType: STRIPE_CONNECTED_ACCOUNT_STATE,
  }, {
    name: 'earningsProfileCreatedTimeMs',
    index: 4,
    primitiveType: PrimitiveType.NUMBER,
  }],
};

export async function getEarningsProfileFromStatement(
  runner: Database | Transaction,
  args: {
    transactionStatementStatementIdEq: string,
  }
): Promise<Array<GetEarningsProfileFromStatementRow>> {
  let [rows] = await runner.run({
    sql: "SELECT e.accountId, e.stripeConnectedAccountId, e.stripeConnectedAccountState, e.createdTimeMs FROM TransactionStatement AS t INNER JOIN EarningsProfile AS e ON t.accountId = e.accountId WHERE (t.statementId = @transactionStatementStatementIdEq)",
    params: {
      transactionStatementStatementIdEq: args.transactionStatementStatementIdEq,
    },
    types: {
      transactionStatementStatementIdEq: { type: "string" },
    }
  });
  let resRows = new Array<GetEarningsProfileFromStatementRow>();
  for (let row of rows) {
    resRows.push({
      earningsProfileAccountId: row.at(0).value == null ? undefined : row.at(0).value,
      earningsProfileStripeConnectedAccountId: row.at(1).value == null ? undefined : row.at(1).value,
      earningsProfileStripeConnectedAccountState: row.at(2).value == null ? undefined : toEnumFromNumber(row.at(2).value.value, STRIPE_CONNECTED_ACCOUNT_STATE),
      earningsProfileCreatedTimeMs: row.at(3).value == null ? undefined : row.at(3).value.value,
    });
  }
  return resRows;
}

export interface GetTransactionStatementByMonthRow {
  transactionStatementStatementId?: string,
  transactionStatementAccountId?: string,
  transactionStatementMonth?: string,
  transactionStatementStatement?: TransactionStatement,
  transactionStatementCreatedTimeMs?: number,
}

export let GET_TRANSACTION_STATEMENT_BY_MONTH_ROW: MessageDescriptor<GetTransactionStatementByMonthRow> = {
  name: 'GetTransactionStatementByMonthRow',
  fields: [{
    name: 'transactionStatementStatementId',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'transactionStatementAccountId',
    index: 2,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'transactionStatementMonth',
    index: 3,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'transactionStatementStatement',
    index: 4,
    messageType: TRANSACTION_STATEMENT,
  }, {
    name: 'transactionStatementCreatedTimeMs',
    index: 5,
    primitiveType: PrimitiveType.NUMBER,
  }],
};

export async function getTransactionStatementByMonth(
  runner: Database | Transaction,
  args: {
    transactionStatementAccountIdEq?: string,
    transactionStatementMonthEq?: string,
  }
): Promise<Array<GetTransactionStatementByMonthRow>> {
  let [rows] = await runner.run({
    sql: "SELECT TransactionStatement.statementId, TransactionStatement.accountId, TransactionStatement.month, TransactionStatement.statement, TransactionStatement.createdTimeMs FROM TransactionStatement WHERE (TransactionStatement.accountId = @transactionStatementAccountIdEq AND TransactionStatement.month = @transactionStatementMonthEq)",
    params: {
      transactionStatementAccountIdEq: args.transactionStatementAccountIdEq == null ? null : args.transactionStatementAccountIdEq,
      transactionStatementMonthEq: args.transactionStatementMonthEq == null ? null : args.transactionStatementMonthEq,
    },
    types: {
      transactionStatementAccountIdEq: { type: "string" },
      transactionStatementMonthEq: { type: "string" },
    }
  });
  let resRows = new Array<GetTransactionStatementByMonthRow>();
  for (let row of rows) {
    resRows.push({
      transactionStatementStatementId: row.at(0).value == null ? undefined : row.at(0).value,
      transactionStatementAccountId: row.at(1).value == null ? undefined : row.at(1).value,
      transactionStatementMonth: row.at(2).value == null ? undefined : row.at(2).value,
      transactionStatementStatement: row.at(3).value == null ? undefined : deserializeMessage(row.at(3).value, TRANSACTION_STATEMENT),
      transactionStatementCreatedTimeMs: row.at(4).value == null ? undefined : row.at(4).value.value,
    });
  }
  return resRows;
}

export interface ListTransactionStatementsRow {
  transactionStatementStatementId?: string,
  transactionStatementAccountId?: string,
  transactionStatementMonth?: string,
  transactionStatementStatement?: TransactionStatement,
  transactionStatementCreatedTimeMs?: number,
}

export let LIST_TRANSACTION_STATEMENTS_ROW: MessageDescriptor<ListTransactionStatementsRow> = {
  name: 'ListTransactionStatementsRow',
  fields: [{
    name: 'transactionStatementStatementId',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'transactionStatementAccountId',
    index: 2,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'transactionStatementMonth',
    index: 3,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'transactionStatementStatement',
    index: 4,
    messageType: TRANSACTION_STATEMENT,
  }, {
    name: 'transactionStatementCreatedTimeMs',
    index: 5,
    primitiveType: PrimitiveType.NUMBER,
  }],
};

export async function listTransactionStatements(
  runner: Database | Transaction,
  args: {
    transactionStatementAccountIdEq?: string,
    transactionStatementMonthGe?: string,
    transactionStatementMonthLe?: string,
  }
): Promise<Array<ListTransactionStatementsRow>> {
  let [rows] = await runner.run({
    sql: "SELECT TransactionStatement.statementId, TransactionStatement.accountId, TransactionStatement.month, TransactionStatement.statement, TransactionStatement.createdTimeMs FROM TransactionStatement WHERE (TransactionStatement.accountId = @transactionStatementAccountIdEq AND TransactionStatement.month >= @transactionStatementMonthGe AND TransactionStatement.month <= @transactionStatementMonthLe) ORDER BY TransactionStatement.month DESC",
    params: {
      transactionStatementAccountIdEq: args.transactionStatementAccountIdEq == null ? null : args.transactionStatementAccountIdEq,
      transactionStatementMonthGe: args.transactionStatementMonthGe == null ? null : args.transactionStatementMonthGe,
      transactionStatementMonthLe: args.transactionStatementMonthLe == null ? null : args.transactionStatementMonthLe,
    },
    types: {
      transactionStatementAccountIdEq: { type: "string" },
      transactionStatementMonthGe: { type: "string" },
      transactionStatementMonthLe: { type: "string" },
    }
  });
  let resRows = new Array<ListTransactionStatementsRow>();
  for (let row of rows) {
    resRows.push({
      transactionStatementStatementId: row.at(0).value == null ? undefined : row.at(0).value,
      transactionStatementAccountId: row.at(1).value == null ? undefined : row.at(1).value,
      transactionStatementMonth: row.at(2).value == null ? undefined : row.at(2).value,
      transactionStatementStatement: row.at(3).value == null ? undefined : deserializeMessage(row.at(3).value, TRANSACTION_STATEMENT),
      transactionStatementCreatedTimeMs: row.at(4).value == null ? undefined : row.at(4).value.value,
    });
  }
  return resRows;
}

export interface ListPaymentsByStateRow {
  paymentStatementId?: string,
  paymentAccountId?: string,
  paymentState?: PaymentState,
  paymentStripeInvoiceId?: string,
  paymentStripeInvoiceUrl?: string,
  paymentUpdatedTimeMs?: number,
  paymentCreatedTimeMs?: number,
}

export let LIST_PAYMENTS_BY_STATE_ROW: MessageDescriptor<ListPaymentsByStateRow> = {
  name: 'ListPaymentsByStateRow',
  fields: [{
    name: 'paymentStatementId',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'paymentAccountId',
    index: 2,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'paymentState',
    index: 3,
    enumType: PAYMENT_STATE,
  }, {
    name: 'paymentStripeInvoiceId',
    index: 4,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'paymentStripeInvoiceUrl',
    index: 5,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'paymentUpdatedTimeMs',
    index: 6,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'paymentCreatedTimeMs',
    index: 7,
    primitiveType: PrimitiveType.NUMBER,
  }],
};

export async function listPaymentsByState(
  runner: Database | Transaction,
  args: {
    paymentAccountIdEq?: string,
    paymentStateEq?: PaymentState,
  }
): Promise<Array<ListPaymentsByStateRow>> {
  let [rows] = await runner.run({
    sql: "SELECT Payment.statementId, Payment.accountId, Payment.state, Payment.stripeInvoiceId, Payment.stripeInvoiceUrl, Payment.updatedTimeMs, Payment.createdTimeMs FROM Payment WHERE (Payment.accountId = @paymentAccountIdEq AND Payment.state = @paymentStateEq) ORDER BY Payment.createdTimeMs DESC",
    params: {
      paymentAccountIdEq: args.paymentAccountIdEq == null ? null : args.paymentAccountIdEq,
      paymentStateEq: args.paymentStateEq == null ? null : Spanner.float(args.paymentStateEq),
    },
    types: {
      paymentAccountIdEq: { type: "string" },
      paymentStateEq: { type: "float64" },
    }
  });
  let resRows = new Array<ListPaymentsByStateRow>();
  for (let row of rows) {
    resRows.push({
      paymentStatementId: row.at(0).value == null ? undefined : row.at(0).value,
      paymentAccountId: row.at(1).value == null ? undefined : row.at(1).value,
      paymentState: row.at(2).value == null ? undefined : toEnumFromNumber(row.at(2).value.value, PAYMENT_STATE),
      paymentStripeInvoiceId: row.at(3).value == null ? undefined : row.at(3).value,
      paymentStripeInvoiceUrl: row.at(4).value == null ? undefined : row.at(4).value,
      paymentUpdatedTimeMs: row.at(5).value == null ? undefined : row.at(5).value.value,
      paymentCreatedTimeMs: row.at(6).value == null ? undefined : row.at(6).value.value,
    });
  }
  return resRows;
}

export interface ListPaymentsWithStatementsRow {
  paymentStatementId?: string,
  paymentAccountId?: string,
  paymentState?: PaymentState,
  paymentStripeInvoiceId?: string,
  paymentStripeInvoiceUrl?: string,
  paymentUpdatedTimeMs?: number,
  paymentCreatedTimeMs?: number,
  transactionStatementStatementId?: string,
  transactionStatementAccountId?: string,
  transactionStatementMonth?: string,
  transactionStatementStatement?: TransactionStatement,
  transactionStatementCreatedTimeMs?: number,
}

export let LIST_PAYMENTS_WITH_STATEMENTS_ROW: MessageDescriptor<ListPaymentsWithStatementsRow> = {
  name: 'ListPaymentsWithStatementsRow',
  fields: [{
    name: 'paymentStatementId',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'paymentAccountId',
    index: 2,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'paymentState',
    index: 3,
    enumType: PAYMENT_STATE,
  }, {
    name: 'paymentStripeInvoiceId',
    index: 4,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'paymentStripeInvoiceUrl',
    index: 5,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'paymentUpdatedTimeMs',
    index: 6,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'paymentCreatedTimeMs',
    index: 7,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'transactionStatementStatementId',
    index: 8,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'transactionStatementAccountId',
    index: 9,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'transactionStatementMonth',
    index: 10,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'transactionStatementStatement',
    index: 11,
    messageType: TRANSACTION_STATEMENT,
  }, {
    name: 'transactionStatementCreatedTimeMs',
    index: 12,
    primitiveType: PrimitiveType.NUMBER,
  }],
};

export async function listPaymentsWithStatements(
  runner: Database | Transaction,
  args: {
    paymentAccountIdEq?: string,
    transactionStatementMonthGe?: string,
    transactionStatementMonthLe?: string,
  }
): Promise<Array<ListPaymentsWithStatementsRow>> {
  let [rows] = await runner.run({
    sql: "SELECT p.statementId, p.accountId, p.state, p.stripeInvoiceId, p.stripeInvoiceUrl, p.updatedTimeMs, p.createdTimeMs, t.statementId, t.accountId, t.month, t.statement, t.createdTimeMs FROM Payment AS p LEFT JOIN TransactionStatement AS t ON p.statementId = t.statementId WHERE (p.accountId = @paymentAccountIdEq AND t.month >= @transactionStatementMonthGe AND t.month <= @transactionStatementMonthLe) ORDER BY t.month DESC",
    params: {
      paymentAccountIdEq: args.paymentAccountIdEq == null ? null : args.paymentAccountIdEq,
      transactionStatementMonthGe: args.transactionStatementMonthGe == null ? null : args.transactionStatementMonthGe,
      transactionStatementMonthLe: args.transactionStatementMonthLe == null ? null : args.transactionStatementMonthLe,
    },
    types: {
      paymentAccountIdEq: { type: "string" },
      transactionStatementMonthGe: { type: "string" },
      transactionStatementMonthLe: { type: "string" },
    }
  });
  let resRows = new Array<ListPaymentsWithStatementsRow>();
  for (let row of rows) {
    resRows.push({
      paymentStatementId: row.at(0).value == null ? undefined : row.at(0).value,
      paymentAccountId: row.at(1).value == null ? undefined : row.at(1).value,
      paymentState: row.at(2).value == null ? undefined : toEnumFromNumber(row.at(2).value.value, PAYMENT_STATE),
      paymentStripeInvoiceId: row.at(3).value == null ? undefined : row.at(3).value,
      paymentStripeInvoiceUrl: row.at(4).value == null ? undefined : row.at(4).value,
      paymentUpdatedTimeMs: row.at(5).value == null ? undefined : row.at(5).value.value,
      paymentCreatedTimeMs: row.at(6).value == null ? undefined : row.at(6).value.value,
      transactionStatementStatementId: row.at(7).value == null ? undefined : row.at(7).value,
      transactionStatementAccountId: row.at(8).value == null ? undefined : row.at(8).value,
      transactionStatementMonth: row.at(9).value == null ? undefined : row.at(9).value,
      transactionStatementStatement: row.at(10).value == null ? undefined : deserializeMessage(row.at(10).value, TRANSACTION_STATEMENT),
      transactionStatementCreatedTimeMs: row.at(11).value == null ? undefined : row.at(11).value.value,
    });
  }
  return resRows;
}

export interface ListPayoutsByStateRow {
  payoutStatementId?: string,
  payoutAccountId?: string,
  payoutState?: PayoutState,
  payoutStripeTransferId?: string,
  payoutUpdatedTimeMs?: number,
  payoutCreatedTimeMs?: number,
}

export let LIST_PAYOUTS_BY_STATE_ROW: MessageDescriptor<ListPayoutsByStateRow> = {
  name: 'ListPayoutsByStateRow',
  fields: [{
    name: 'payoutStatementId',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'payoutAccountId',
    index: 2,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'payoutState',
    index: 3,
    enumType: PAYOUT_STATE,
  }, {
    name: 'payoutStripeTransferId',
    index: 4,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'payoutUpdatedTimeMs',
    index: 5,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'payoutCreatedTimeMs',
    index: 6,
    primitiveType: PrimitiveType.NUMBER,
  }],
};

export async function listPayoutsByState(
  runner: Database | Transaction,
  args: {
    payoutAccountIdEq?: string,
    payoutStateEq?: PayoutState,
  }
): Promise<Array<ListPayoutsByStateRow>> {
  let [rows] = await runner.run({
    sql: "SELECT Payout.statementId, Payout.accountId, Payout.state, Payout.stripeTransferId, Payout.updatedTimeMs, Payout.createdTimeMs FROM Payout WHERE (Payout.accountId = @payoutAccountIdEq AND Payout.state = @payoutStateEq) ORDER BY Payout.createdTimeMs DESC",
    params: {
      payoutAccountIdEq: args.payoutAccountIdEq == null ? null : args.payoutAccountIdEq,
      payoutStateEq: args.payoutStateEq == null ? null : Spanner.float(args.payoutStateEq),
    },
    types: {
      payoutAccountIdEq: { type: "string" },
      payoutStateEq: { type: "float64" },
    }
  });
  let resRows = new Array<ListPayoutsByStateRow>();
  for (let row of rows) {
    resRows.push({
      payoutStatementId: row.at(0).value == null ? undefined : row.at(0).value,
      payoutAccountId: row.at(1).value == null ? undefined : row.at(1).value,
      payoutState: row.at(2).value == null ? undefined : toEnumFromNumber(row.at(2).value.value, PAYOUT_STATE),
      payoutStripeTransferId: row.at(3).value == null ? undefined : row.at(3).value,
      payoutUpdatedTimeMs: row.at(4).value == null ? undefined : row.at(4).value.value,
      payoutCreatedTimeMs: row.at(5).value == null ? undefined : row.at(5).value.value,
    });
  }
  return resRows;
}

export interface ListPayoutsWithStatementsRow {
  payoutStatementId?: string,
  payoutAccountId?: string,
  payoutState?: PayoutState,
  payoutStripeTransferId?: string,
  payoutUpdatedTimeMs?: number,
  payoutCreatedTimeMs?: number,
  transactionStatementStatementId?: string,
  transactionStatementAccountId?: string,
  transactionStatementMonth?: string,
  transactionStatementStatement?: TransactionStatement,
  transactionStatementCreatedTimeMs?: number,
}

export let LIST_PAYOUTS_WITH_STATEMENTS_ROW: MessageDescriptor<ListPayoutsWithStatementsRow> = {
  name: 'ListPayoutsWithStatementsRow',
  fields: [{
    name: 'payoutStatementId',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'payoutAccountId',
    index: 2,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'payoutState',
    index: 3,
    enumType: PAYOUT_STATE,
  }, {
    name: 'payoutStripeTransferId',
    index: 4,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'payoutUpdatedTimeMs',
    index: 5,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'payoutCreatedTimeMs',
    index: 6,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'transactionStatementStatementId',
    index: 7,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'transactionStatementAccountId',
    index: 8,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'transactionStatementMonth',
    index: 9,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'transactionStatementStatement',
    index: 10,
    messageType: TRANSACTION_STATEMENT,
  }, {
    name: 'transactionStatementCreatedTimeMs',
    index: 11,
    primitiveType: PrimitiveType.NUMBER,
  }],
};

export async function listPayoutsWithStatements(
  runner: Database | Transaction,
  args: {
    payoutAccountIdEq?: string,
    transactionStatementMonthGe?: string,
    transactionStatementMonthLe?: string,
  }
): Promise<Array<ListPayoutsWithStatementsRow>> {
  let [rows] = await runner.run({
    sql: "SELECT p.statementId, p.accountId, p.state, p.stripeTransferId, p.updatedTimeMs, p.createdTimeMs, t.statementId, t.accountId, t.month, t.statement, t.createdTimeMs FROM Payout AS p LEFT JOIN TransactionStatement AS t ON p.statementId = t.statementId WHERE (p.accountId = @payoutAccountIdEq AND t.month >= @transactionStatementMonthGe AND t.month <= @transactionStatementMonthLe) ORDER BY t.month DESC",
    params: {
      payoutAccountIdEq: args.payoutAccountIdEq == null ? null : args.payoutAccountIdEq,
      transactionStatementMonthGe: args.transactionStatementMonthGe == null ? null : args.transactionStatementMonthGe,
      transactionStatementMonthLe: args.transactionStatementMonthLe == null ? null : args.transactionStatementMonthLe,
    },
    types: {
      payoutAccountIdEq: { type: "string" },
      transactionStatementMonthGe: { type: "string" },
      transactionStatementMonthLe: { type: "string" },
    }
  });
  let resRows = new Array<ListPayoutsWithStatementsRow>();
  for (let row of rows) {
    resRows.push({
      payoutStatementId: row.at(0).value == null ? undefined : row.at(0).value,
      payoutAccountId: row.at(1).value == null ? undefined : row.at(1).value,
      payoutState: row.at(2).value == null ? undefined : toEnumFromNumber(row.at(2).value.value, PAYOUT_STATE),
      payoutStripeTransferId: row.at(3).value == null ? undefined : row.at(3).value,
      payoutUpdatedTimeMs: row.at(4).value == null ? undefined : row.at(4).value.value,
      payoutCreatedTimeMs: row.at(5).value == null ? undefined : row.at(5).value.value,
      transactionStatementStatementId: row.at(6).value == null ? undefined : row.at(6).value,
      transactionStatementAccountId: row.at(7).value == null ? undefined : row.at(7).value,
      transactionStatementMonth: row.at(8).value == null ? undefined : row.at(8).value,
      transactionStatementStatement: row.at(9).value == null ? undefined : deserializeMessage(row.at(9).value, TRANSACTION_STATEMENT),
      transactionStatementCreatedTimeMs: row.at(10).value == null ? undefined : row.at(10).value.value,
    });
  }
  return resRows;
}
