import { PaymentProfileStateInfo, PAYMENT_PROFILE_STATE_INFO, InitCreditGrantingState, INIT_CREDIT_GRANTING_STATE, StripeConnectedAccountState, STRIPE_CONNECTED_ACCOUNT_STATE, TransactionStatement, TRANSACTION_STATEMENT, PaymentState, PAYMENT_STATE, PayoutState, PAYOUT_STATE } from './schema';
import { serializeMessage, deserializeMessage, toEnumFromNumber } from '@selfage/message/serializer';
import { Spanner, Database, Transaction } from '@google-cloud/spanner';
import { Statement } from '@google-cloud/spanner/build/src/transaction';
import { PrimitiveType, MessageDescriptor } from '@selfage/message/descriptor';

export function insertPaymentProfileStatement(
  args: {
    accountId: string,
    stripePaymentCustomerId?: string,
    stateInfo?: PaymentProfileStateInfo,
    initCreditGrantingState?: InitCreditGrantingState,
    createdTimeMs?: number,
  }
): Statement {
  return {
    sql: "INSERT PaymentProfile (accountId, stripePaymentCustomerId, stateInfo, initCreditGrantingState, createdTimeMs) VALUES (@accountId, @stripePaymentCustomerId, @stateInfo, @initCreditGrantingState, @createdTimeMs)",
    params: {
      accountId: args.accountId,
      stripePaymentCustomerId: args.stripePaymentCustomerId == null ? null : args.stripePaymentCustomerId,
      stateInfo: args.stateInfo == null ? null : Buffer.from(serializeMessage(args.stateInfo, PAYMENT_PROFILE_STATE_INFO).buffer),
      initCreditGrantingState: args.initCreditGrantingState == null ? null : Spanner.float(args.initCreditGrantingState),
      createdTimeMs: args.createdTimeMs == null ? null : Spanner.float(args.createdTimeMs),
    },
    types: {
      accountId: { type: "string" },
      stripePaymentCustomerId: { type: "string" },
      stateInfo: { type: "bytes" },
      initCreditGrantingState: { type: "float64" },
      createdTimeMs: { type: "float64" },
    }
  };
}

export function deletePaymentProfileStatement(
  args: {
    paymentProfileAccountIdEq: string,
  }
): Statement {
  return {
    sql: "DELETE PaymentProfile WHERE (PaymentProfile.accountId = @paymentProfileAccountIdEq)",
    params: {
      paymentProfileAccountIdEq: args.paymentProfileAccountIdEq,
    },
    types: {
      paymentProfileAccountIdEq: { type: "string" },
    }
  };
}

export interface GetPaymentProfileRow {
  paymentProfileAccountId?: string,
  paymentProfileStripePaymentCustomerId?: string,
  paymentProfileStateInfo?: PaymentProfileStateInfo,
  paymentProfileInitCreditGrantingState?: InitCreditGrantingState,
  paymentProfileCreatedTimeMs?: number,
}

export let GET_PAYMENT_PROFILE_ROW: MessageDescriptor<GetPaymentProfileRow> = {
  name: 'GetPaymentProfileRow',
  fields: [{
    name: 'paymentProfileAccountId',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'paymentProfileStripePaymentCustomerId',
    index: 2,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'paymentProfileStateInfo',
    index: 3,
    messageType: PAYMENT_PROFILE_STATE_INFO,
  }, {
    name: 'paymentProfileInitCreditGrantingState',
    index: 4,
    enumType: INIT_CREDIT_GRANTING_STATE,
  }, {
    name: 'paymentProfileCreatedTimeMs',
    index: 5,
    primitiveType: PrimitiveType.NUMBER,
  }],
};

export async function getPaymentProfile(
  runner: Database | Transaction,
  args: {
    paymentProfileAccountIdEq: string,
  }
): Promise<Array<GetPaymentProfileRow>> {
  let [rows] = await runner.run({
    sql: "SELECT PaymentProfile.accountId, PaymentProfile.stripePaymentCustomerId, PaymentProfile.stateInfo, PaymentProfile.initCreditGrantingState, PaymentProfile.createdTimeMs FROM PaymentProfile WHERE (PaymentProfile.accountId = @paymentProfileAccountIdEq)",
    params: {
      paymentProfileAccountIdEq: args.paymentProfileAccountIdEq,
    },
    types: {
      paymentProfileAccountIdEq: { type: "string" },
    }
  });
  let resRows = new Array<GetPaymentProfileRow>();
  for (let row of rows) {
    resRows.push({
      paymentProfileAccountId: row.at(0).value == null ? undefined : row.at(0).value,
      paymentProfileStripePaymentCustomerId: row.at(1).value == null ? undefined : row.at(1).value,
      paymentProfileStateInfo: row.at(2).value == null ? undefined : deserializeMessage(row.at(2).value, PAYMENT_PROFILE_STATE_INFO),
      paymentProfileInitCreditGrantingState: row.at(3).value == null ? undefined : toEnumFromNumber(row.at(3).value.value, INIT_CREDIT_GRANTING_STATE),
      paymentProfileCreatedTimeMs: row.at(4).value == null ? undefined : row.at(4).value.value,
    });
  }
  return resRows;
}

export function insertPaymentCardGrantedInitCreditStatement(
  args: {
    fingerprint: string,
    createdTimeMs?: number,
  }
): Statement {
  return {
    sql: "INSERT PaymentCardGrantedInitCredit (fingerprint, createdTimeMs) VALUES (@fingerprint, @createdTimeMs)",
    params: {
      fingerprint: args.fingerprint,
      createdTimeMs: args.createdTimeMs == null ? null : Spanner.float(args.createdTimeMs),
    },
    types: {
      fingerprint: { type: "string" },
      createdTimeMs: { type: "float64" },
    }
  };
}

export function deletePaymentCardGrantedInitCreditStatement(
  args: {
    paymentCardGrantedInitCreditFingerprintEq: string,
  }
): Statement {
  return {
    sql: "DELETE PaymentCardGrantedInitCredit WHERE (PaymentCardGrantedInitCredit.fingerprint = @paymentCardGrantedInitCreditFingerprintEq)",
    params: {
      paymentCardGrantedInitCreditFingerprintEq: args.paymentCardGrantedInitCreditFingerprintEq,
    },
    types: {
      paymentCardGrantedInitCreditFingerprintEq: { type: "string" },
    }
  };
}

export interface GetPaymentCardGrantedInitCreditRow {
  paymentCardGrantedInitCreditFingerprint?: string,
  paymentCardGrantedInitCreditCreatedTimeMs?: number,
}

export let GET_PAYMENT_CARD_GRANTED_INIT_CREDIT_ROW: MessageDescriptor<GetPaymentCardGrantedInitCreditRow> = {
  name: 'GetPaymentCardGrantedInitCreditRow',
  fields: [{
    name: 'paymentCardGrantedInitCreditFingerprint',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'paymentCardGrantedInitCreditCreatedTimeMs',
    index: 2,
    primitiveType: PrimitiveType.NUMBER,
  }],
};

export async function getPaymentCardGrantedInitCredit(
  runner: Database | Transaction,
  args: {
    paymentCardGrantedInitCreditFingerprintEq: string,
  }
): Promise<Array<GetPaymentCardGrantedInitCreditRow>> {
  let [rows] = await runner.run({
    sql: "SELECT PaymentCardGrantedInitCredit.fingerprint, PaymentCardGrantedInitCredit.createdTimeMs FROM PaymentCardGrantedInitCredit WHERE (PaymentCardGrantedInitCredit.fingerprint = @paymentCardGrantedInitCreditFingerprintEq)",
    params: {
      paymentCardGrantedInitCreditFingerprintEq: args.paymentCardGrantedInitCreditFingerprintEq,
    },
    types: {
      paymentCardGrantedInitCreditFingerprintEq: { type: "string" },
    }
  });
  let resRows = new Array<GetPaymentCardGrantedInitCreditRow>();
  for (let row of rows) {
    resRows.push({
      paymentCardGrantedInitCreditFingerprint: row.at(0).value == null ? undefined : row.at(0).value,
      paymentCardGrantedInitCreditCreatedTimeMs: row.at(1).value == null ? undefined : row.at(1).value.value,
    });
  }
  return resRows;
}

export function insertPayoutProfileStatement(
  args: {
    accountId: string,
    stripeConnectedAccountId?: string,
    stripeConnectedAccountState?: StripeConnectedAccountState,
    createdTimeMs?: number,
  }
): Statement {
  return {
    sql: "INSERT PayoutProfile (accountId, stripeConnectedAccountId, stripeConnectedAccountState, createdTimeMs) VALUES (@accountId, @stripeConnectedAccountId, @stripeConnectedAccountState, @createdTimeMs)",
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

export function deletePayoutProfileStatement(
  args: {
    payoutProfileAccountIdEq: string,
  }
): Statement {
  return {
    sql: "DELETE PayoutProfile WHERE (PayoutProfile.accountId = @payoutProfileAccountIdEq)",
    params: {
      payoutProfileAccountIdEq: args.payoutProfileAccountIdEq,
    },
    types: {
      payoutProfileAccountIdEq: { type: "string" },
    }
  };
}

export interface GetPayoutProfileRow {
  payoutProfileAccountId?: string,
  payoutProfileStripeConnectedAccountId?: string,
  payoutProfileStripeConnectedAccountState?: StripeConnectedAccountState,
  payoutProfileCreatedTimeMs?: number,
}

export let GET_PAYOUT_PROFILE_ROW: MessageDescriptor<GetPayoutProfileRow> = {
  name: 'GetPayoutProfileRow',
  fields: [{
    name: 'payoutProfileAccountId',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'payoutProfileStripeConnectedAccountId',
    index: 2,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'payoutProfileStripeConnectedAccountState',
    index: 3,
    enumType: STRIPE_CONNECTED_ACCOUNT_STATE,
  }, {
    name: 'payoutProfileCreatedTimeMs',
    index: 4,
    primitiveType: PrimitiveType.NUMBER,
  }],
};

export async function getPayoutProfile(
  runner: Database | Transaction,
  args: {
    payoutProfileAccountIdEq: string,
  }
): Promise<Array<GetPayoutProfileRow>> {
  let [rows] = await runner.run({
    sql: "SELECT PayoutProfile.accountId, PayoutProfile.stripeConnectedAccountId, PayoutProfile.stripeConnectedAccountState, PayoutProfile.createdTimeMs FROM PayoutProfile WHERE (PayoutProfile.accountId = @payoutProfileAccountIdEq)",
    params: {
      payoutProfileAccountIdEq: args.payoutProfileAccountIdEq,
    },
    types: {
      payoutProfileAccountIdEq: { type: "string" },
    }
  });
  let resRows = new Array<GetPayoutProfileRow>();
  for (let row of rows) {
    resRows.push({
      payoutProfileAccountId: row.at(0).value == null ? undefined : row.at(0).value,
      payoutProfileStripeConnectedAccountId: row.at(1).value == null ? undefined : row.at(1).value,
      payoutProfileStripeConnectedAccountState: row.at(2).value == null ? undefined : toEnumFromNumber(row.at(2).value.value, STRIPE_CONNECTED_ACCOUNT_STATE),
      payoutProfileCreatedTimeMs: row.at(3).value == null ? undefined : row.at(3).value.value,
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
    updatedTimeMs?: number,
    createdTimeMs?: number,
  }
): Statement {
  return {
    sql: "INSERT Payment (statementId, accountId, state, stripeInvoiceId, updatedTimeMs, createdTimeMs) VALUES (@statementId, @accountId, @state, @stripeInvoiceId, @updatedTimeMs, @createdTimeMs)",
    params: {
      statementId: args.statementId,
      accountId: args.accountId == null ? null : args.accountId,
      state: args.state == null ? null : Spanner.float(args.state),
      stripeInvoiceId: args.stripeInvoiceId == null ? null : args.stripeInvoiceId,
      updatedTimeMs: args.updatedTimeMs == null ? null : Spanner.float(args.updatedTimeMs),
      createdTimeMs: args.createdTimeMs == null ? null : Spanner.float(args.createdTimeMs),
    },
    types: {
      statementId: { type: "string" },
      accountId: { type: "string" },
      state: { type: "float64" },
      stripeInvoiceId: { type: "string" },
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
    name: 'paymentUpdatedTimeMs',
    index: 5,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'paymentCreatedTimeMs',
    index: 6,
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
    sql: "SELECT Payment.statementId, Payment.accountId, Payment.state, Payment.stripeInvoiceId, Payment.updatedTimeMs, Payment.createdTimeMs FROM Payment WHERE (Payment.statementId = @paymentStatementIdEq)",
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
      paymentUpdatedTimeMs: row.at(4).value == null ? undefined : row.at(4).value.value,
      paymentCreatedTimeMs: row.at(5).value == null ? undefined : row.at(5).value.value,
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

export function insertStripeCustomerCreatingTaskStatement(
  args: {
    taskId: string,
    accountId: string,
    retryCount?: number,
    executionTimeMs?: number,
    createdTimeMs?: number,
  }
): Statement {
  return {
    sql: "INSERT StripeCustomerCreatingTask (taskId, accountId, retryCount, executionTimeMs, createdTimeMs) VALUES (@taskId, @accountId, @retryCount, @executionTimeMs, @createdTimeMs)",
    params: {
      taskId: args.taskId,
      accountId: args.accountId,
      retryCount: args.retryCount == null ? null : Spanner.float(args.retryCount),
      executionTimeMs: args.executionTimeMs == null ? null : new Date(args.executionTimeMs).toISOString(),
      createdTimeMs: args.createdTimeMs == null ? null : new Date(args.createdTimeMs).toISOString(),
    },
    types: {
      taskId: { type: "string" },
      accountId: { type: "string" },
      retryCount: { type: "float64" },
      executionTimeMs: { type: "timestamp" },
      createdTimeMs: { type: "timestamp" },
    }
  };
}

export function deleteStripeCustomerCreatingTaskStatement(
  args: {
    stripeCustomerCreatingTaskTaskIdEq: string,
  }
): Statement {
  return {
    sql: "DELETE StripeCustomerCreatingTask WHERE (StripeCustomerCreatingTask.taskId = @stripeCustomerCreatingTaskTaskIdEq)",
    params: {
      stripeCustomerCreatingTaskTaskIdEq: args.stripeCustomerCreatingTaskTaskIdEq,
    },
    types: {
      stripeCustomerCreatingTaskTaskIdEq: { type: "string" },
    }
  };
}

export interface GetStripeCustomerCreatingTaskRow {
  stripeCustomerCreatingTaskTaskId?: string,
  stripeCustomerCreatingTaskAccountId?: string,
  stripeCustomerCreatingTaskRetryCount?: number,
  stripeCustomerCreatingTaskExecutionTimeMs?: number,
  stripeCustomerCreatingTaskCreatedTimeMs?: number,
}

export let GET_STRIPE_CUSTOMER_CREATING_TASK_ROW: MessageDescriptor<GetStripeCustomerCreatingTaskRow> = {
  name: 'GetStripeCustomerCreatingTaskRow',
  fields: [{
    name: 'stripeCustomerCreatingTaskTaskId',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'stripeCustomerCreatingTaskAccountId',
    index: 2,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'stripeCustomerCreatingTaskRetryCount',
    index: 3,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'stripeCustomerCreatingTaskExecutionTimeMs',
    index: 4,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'stripeCustomerCreatingTaskCreatedTimeMs',
    index: 5,
    primitiveType: PrimitiveType.NUMBER,
  }],
};

export async function getStripeCustomerCreatingTask(
  runner: Database | Transaction,
  args: {
    stripeCustomerCreatingTaskTaskIdEq: string,
  }
): Promise<Array<GetStripeCustomerCreatingTaskRow>> {
  let [rows] = await runner.run({
    sql: "SELECT StripeCustomerCreatingTask.taskId, StripeCustomerCreatingTask.accountId, StripeCustomerCreatingTask.retryCount, StripeCustomerCreatingTask.executionTimeMs, StripeCustomerCreatingTask.createdTimeMs FROM StripeCustomerCreatingTask WHERE (StripeCustomerCreatingTask.taskId = @stripeCustomerCreatingTaskTaskIdEq)",
    params: {
      stripeCustomerCreatingTaskTaskIdEq: args.stripeCustomerCreatingTaskTaskIdEq,
    },
    types: {
      stripeCustomerCreatingTaskTaskIdEq: { type: "string" },
    }
  });
  let resRows = new Array<GetStripeCustomerCreatingTaskRow>();
  for (let row of rows) {
    resRows.push({
      stripeCustomerCreatingTaskTaskId: row.at(0).value == null ? undefined : row.at(0).value,
      stripeCustomerCreatingTaskAccountId: row.at(1).value == null ? undefined : row.at(1).value,
      stripeCustomerCreatingTaskRetryCount: row.at(2).value == null ? undefined : row.at(2).value.value,
      stripeCustomerCreatingTaskExecutionTimeMs: row.at(3).value == null ? undefined : row.at(3).value.valueOf(),
      stripeCustomerCreatingTaskCreatedTimeMs: row.at(4).value == null ? undefined : row.at(4).value.valueOf(),
    });
  }
  return resRows;
}

export interface ListPendingStripeCustomerCreatingTasksRow {
  stripeCustomerCreatingTaskTaskId?: string,
  stripeCustomerCreatingTaskAccountId?: string,
}

export let LIST_PENDING_STRIPE_CUSTOMER_CREATING_TASKS_ROW: MessageDescriptor<ListPendingStripeCustomerCreatingTasksRow> = {
  name: 'ListPendingStripeCustomerCreatingTasksRow',
  fields: [{
    name: 'stripeCustomerCreatingTaskTaskId',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'stripeCustomerCreatingTaskAccountId',
    index: 2,
    primitiveType: PrimitiveType.STRING,
  }],
};

export async function listPendingStripeCustomerCreatingTasks(
  runner: Database | Transaction,
  args: {
    stripeCustomerCreatingTaskExecutionTimeMsLe?: number,
  }
): Promise<Array<ListPendingStripeCustomerCreatingTasksRow>> {
  let [rows] = await runner.run({
    sql: "SELECT StripeCustomerCreatingTask.taskId, StripeCustomerCreatingTask.accountId FROM StripeCustomerCreatingTask WHERE StripeCustomerCreatingTask.executionTimeMs <= @stripeCustomerCreatingTaskExecutionTimeMsLe",
    params: {
      stripeCustomerCreatingTaskExecutionTimeMsLe: args.stripeCustomerCreatingTaskExecutionTimeMsLe == null ? null : new Date(args.stripeCustomerCreatingTaskExecutionTimeMsLe).toISOString(),
    },
    types: {
      stripeCustomerCreatingTaskExecutionTimeMsLe: { type: "timestamp" },
    }
  });
  let resRows = new Array<ListPendingStripeCustomerCreatingTasksRow>();
  for (let row of rows) {
    resRows.push({
      stripeCustomerCreatingTaskTaskId: row.at(0).value == null ? undefined : row.at(0).value,
      stripeCustomerCreatingTaskAccountId: row.at(1).value == null ? undefined : row.at(1).value,
    });
  }
  return resRows;
}

export interface GetStripeCustomerCreatingTaskMetadataRow {
  stripeCustomerCreatingTaskRetryCount?: number,
  stripeCustomerCreatingTaskExecutionTimeMs?: number,
}

export let GET_STRIPE_CUSTOMER_CREATING_TASK_METADATA_ROW: MessageDescriptor<GetStripeCustomerCreatingTaskMetadataRow> = {
  name: 'GetStripeCustomerCreatingTaskMetadataRow',
  fields: [{
    name: 'stripeCustomerCreatingTaskRetryCount',
    index: 1,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'stripeCustomerCreatingTaskExecutionTimeMs',
    index: 2,
    primitiveType: PrimitiveType.NUMBER,
  }],
};

export async function getStripeCustomerCreatingTaskMetadata(
  runner: Database | Transaction,
  args: {
    stripeCustomerCreatingTaskTaskIdEq: string,
  }
): Promise<Array<GetStripeCustomerCreatingTaskMetadataRow>> {
  let [rows] = await runner.run({
    sql: "SELECT StripeCustomerCreatingTask.retryCount, StripeCustomerCreatingTask.executionTimeMs FROM StripeCustomerCreatingTask WHERE (StripeCustomerCreatingTask.taskId = @stripeCustomerCreatingTaskTaskIdEq)",
    params: {
      stripeCustomerCreatingTaskTaskIdEq: args.stripeCustomerCreatingTaskTaskIdEq,
    },
    types: {
      stripeCustomerCreatingTaskTaskIdEq: { type: "string" },
    }
  });
  let resRows = new Array<GetStripeCustomerCreatingTaskMetadataRow>();
  for (let row of rows) {
    resRows.push({
      stripeCustomerCreatingTaskRetryCount: row.at(0).value == null ? undefined : row.at(0).value.value,
      stripeCustomerCreatingTaskExecutionTimeMs: row.at(1).value == null ? undefined : row.at(1).value.valueOf(),
    });
  }
  return resRows;
}

export function updateStripeCustomerCreatingTaskMetadataStatement(
  args: {
    stripeCustomerCreatingTaskTaskIdEq: string,
    setRetryCount?: number,
    setExecutionTimeMs?: number,
  }
): Statement {
  return {
    sql: "UPDATE StripeCustomerCreatingTask SET retryCount = @setRetryCount, executionTimeMs = @setExecutionTimeMs WHERE (StripeCustomerCreatingTask.taskId = @stripeCustomerCreatingTaskTaskIdEq)",
    params: {
      stripeCustomerCreatingTaskTaskIdEq: args.stripeCustomerCreatingTaskTaskIdEq,
      setRetryCount: args.setRetryCount == null ? null : Spanner.float(args.setRetryCount),
      setExecutionTimeMs: args.setExecutionTimeMs == null ? null : new Date(args.setExecutionTimeMs).toISOString(),
    },
    types: {
      stripeCustomerCreatingTaskTaskIdEq: { type: "string" },
      setRetryCount: { type: "float64" },
      setExecutionTimeMs: { type: "timestamp" },
    }
  };
}

export function insertInitCreditGrantingTaskStatement(
  args: {
    taskId: string,
    accountId: string,
    retryCount?: number,
    executionTimeMs?: number,
    createdTimeMs?: number,
  }
): Statement {
  return {
    sql: "INSERT InitCreditGrantingTask (taskId, accountId, retryCount, executionTimeMs, createdTimeMs) VALUES (@taskId, @accountId, @retryCount, @executionTimeMs, @createdTimeMs)",
    params: {
      taskId: args.taskId,
      accountId: args.accountId,
      retryCount: args.retryCount == null ? null : Spanner.float(args.retryCount),
      executionTimeMs: args.executionTimeMs == null ? null : new Date(args.executionTimeMs).toISOString(),
      createdTimeMs: args.createdTimeMs == null ? null : new Date(args.createdTimeMs).toISOString(),
    },
    types: {
      taskId: { type: "string" },
      accountId: { type: "string" },
      retryCount: { type: "float64" },
      executionTimeMs: { type: "timestamp" },
      createdTimeMs: { type: "timestamp" },
    }
  };
}

export function deleteInitCreditGrantingTaskStatement(
  args: {
    initCreditGrantingTaskTaskIdEq: string,
  }
): Statement {
  return {
    sql: "DELETE InitCreditGrantingTask WHERE (InitCreditGrantingTask.taskId = @initCreditGrantingTaskTaskIdEq)",
    params: {
      initCreditGrantingTaskTaskIdEq: args.initCreditGrantingTaskTaskIdEq,
    },
    types: {
      initCreditGrantingTaskTaskIdEq: { type: "string" },
    }
  };
}

export interface GetInitCreditGrantingTaskRow {
  initCreditGrantingTaskTaskId?: string,
  initCreditGrantingTaskAccountId?: string,
  initCreditGrantingTaskRetryCount?: number,
  initCreditGrantingTaskExecutionTimeMs?: number,
  initCreditGrantingTaskCreatedTimeMs?: number,
}

export let GET_INIT_CREDIT_GRANTING_TASK_ROW: MessageDescriptor<GetInitCreditGrantingTaskRow> = {
  name: 'GetInitCreditGrantingTaskRow',
  fields: [{
    name: 'initCreditGrantingTaskTaskId',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'initCreditGrantingTaskAccountId',
    index: 2,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'initCreditGrantingTaskRetryCount',
    index: 3,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'initCreditGrantingTaskExecutionTimeMs',
    index: 4,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'initCreditGrantingTaskCreatedTimeMs',
    index: 5,
    primitiveType: PrimitiveType.NUMBER,
  }],
};

export async function getInitCreditGrantingTask(
  runner: Database | Transaction,
  args: {
    initCreditGrantingTaskTaskIdEq: string,
  }
): Promise<Array<GetInitCreditGrantingTaskRow>> {
  let [rows] = await runner.run({
    sql: "SELECT InitCreditGrantingTask.taskId, InitCreditGrantingTask.accountId, InitCreditGrantingTask.retryCount, InitCreditGrantingTask.executionTimeMs, InitCreditGrantingTask.createdTimeMs FROM InitCreditGrantingTask WHERE (InitCreditGrantingTask.taskId = @initCreditGrantingTaskTaskIdEq)",
    params: {
      initCreditGrantingTaskTaskIdEq: args.initCreditGrantingTaskTaskIdEq,
    },
    types: {
      initCreditGrantingTaskTaskIdEq: { type: "string" },
    }
  });
  let resRows = new Array<GetInitCreditGrantingTaskRow>();
  for (let row of rows) {
    resRows.push({
      initCreditGrantingTaskTaskId: row.at(0).value == null ? undefined : row.at(0).value,
      initCreditGrantingTaskAccountId: row.at(1).value == null ? undefined : row.at(1).value,
      initCreditGrantingTaskRetryCount: row.at(2).value == null ? undefined : row.at(2).value.value,
      initCreditGrantingTaskExecutionTimeMs: row.at(3).value == null ? undefined : row.at(3).value.valueOf(),
      initCreditGrantingTaskCreatedTimeMs: row.at(4).value == null ? undefined : row.at(4).value.valueOf(),
    });
  }
  return resRows;
}

export interface ListPendingInitCreditGrantingTasksRow {
  initCreditGrantingTaskTaskId?: string,
  initCreditGrantingTaskAccountId?: string,
}

export let LIST_PENDING_INIT_CREDIT_GRANTING_TASKS_ROW: MessageDescriptor<ListPendingInitCreditGrantingTasksRow> = {
  name: 'ListPendingInitCreditGrantingTasksRow',
  fields: [{
    name: 'initCreditGrantingTaskTaskId',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'initCreditGrantingTaskAccountId',
    index: 2,
    primitiveType: PrimitiveType.STRING,
  }],
};

export async function listPendingInitCreditGrantingTasks(
  runner: Database | Transaction,
  args: {
    initCreditGrantingTaskExecutionTimeMsLe?: number,
  }
): Promise<Array<ListPendingInitCreditGrantingTasksRow>> {
  let [rows] = await runner.run({
    sql: "SELECT InitCreditGrantingTask.taskId, InitCreditGrantingTask.accountId FROM InitCreditGrantingTask WHERE InitCreditGrantingTask.executionTimeMs <= @initCreditGrantingTaskExecutionTimeMsLe",
    params: {
      initCreditGrantingTaskExecutionTimeMsLe: args.initCreditGrantingTaskExecutionTimeMsLe == null ? null : new Date(args.initCreditGrantingTaskExecutionTimeMsLe).toISOString(),
    },
    types: {
      initCreditGrantingTaskExecutionTimeMsLe: { type: "timestamp" },
    }
  });
  let resRows = new Array<ListPendingInitCreditGrantingTasksRow>();
  for (let row of rows) {
    resRows.push({
      initCreditGrantingTaskTaskId: row.at(0).value == null ? undefined : row.at(0).value,
      initCreditGrantingTaskAccountId: row.at(1).value == null ? undefined : row.at(1).value,
    });
  }
  return resRows;
}

export interface GetInitCreditGrantingTaskMetadataRow {
  initCreditGrantingTaskRetryCount?: number,
  initCreditGrantingTaskExecutionTimeMs?: number,
}

export let GET_INIT_CREDIT_GRANTING_TASK_METADATA_ROW: MessageDescriptor<GetInitCreditGrantingTaskMetadataRow> = {
  name: 'GetInitCreditGrantingTaskMetadataRow',
  fields: [{
    name: 'initCreditGrantingTaskRetryCount',
    index: 1,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'initCreditGrantingTaskExecutionTimeMs',
    index: 2,
    primitiveType: PrimitiveType.NUMBER,
  }],
};

export async function getInitCreditGrantingTaskMetadata(
  runner: Database | Transaction,
  args: {
    initCreditGrantingTaskTaskIdEq: string,
  }
): Promise<Array<GetInitCreditGrantingTaskMetadataRow>> {
  let [rows] = await runner.run({
    sql: "SELECT InitCreditGrantingTask.retryCount, InitCreditGrantingTask.executionTimeMs FROM InitCreditGrantingTask WHERE (InitCreditGrantingTask.taskId = @initCreditGrantingTaskTaskIdEq)",
    params: {
      initCreditGrantingTaskTaskIdEq: args.initCreditGrantingTaskTaskIdEq,
    },
    types: {
      initCreditGrantingTaskTaskIdEq: { type: "string" },
    }
  });
  let resRows = new Array<GetInitCreditGrantingTaskMetadataRow>();
  for (let row of rows) {
    resRows.push({
      initCreditGrantingTaskRetryCount: row.at(0).value == null ? undefined : row.at(0).value.value,
      initCreditGrantingTaskExecutionTimeMs: row.at(1).value == null ? undefined : row.at(1).value.valueOf(),
    });
  }
  return resRows;
}

export function updateInitCreditGrantingTaskMetadataStatement(
  args: {
    initCreditGrantingTaskTaskIdEq: string,
    setRetryCount?: number,
    setExecutionTimeMs?: number,
  }
): Statement {
  return {
    sql: "UPDATE InitCreditGrantingTask SET retryCount = @setRetryCount, executionTimeMs = @setExecutionTimeMs WHERE (InitCreditGrantingTask.taskId = @initCreditGrantingTaskTaskIdEq)",
    params: {
      initCreditGrantingTaskTaskIdEq: args.initCreditGrantingTaskTaskIdEq,
      setRetryCount: args.setRetryCount == null ? null : Spanner.float(args.setRetryCount),
      setExecutionTimeMs: args.setExecutionTimeMs == null ? null : new Date(args.setExecutionTimeMs).toISOString(),
    },
    types: {
      initCreditGrantingTaskTaskIdEq: { type: "string" },
      setRetryCount: { type: "float64" },
      setExecutionTimeMs: { type: "timestamp" },
    }
  };
}

export function insertStripeConnectedAccountForPayoutCreatingTaskStatement(
  args: {
    taskId: string,
    accountId: string,
    retryCount?: number,
    executionTimeMs?: number,
    createdTimeMs?: number,
  }
): Statement {
  return {
    sql: "INSERT StripeConnectedAccountForPayoutCreatingTask (taskId, accountId, retryCount, executionTimeMs, createdTimeMs) VALUES (@taskId, @accountId, @retryCount, @executionTimeMs, @createdTimeMs)",
    params: {
      taskId: args.taskId,
      accountId: args.accountId,
      retryCount: args.retryCount == null ? null : Spanner.float(args.retryCount),
      executionTimeMs: args.executionTimeMs == null ? null : new Date(args.executionTimeMs).toISOString(),
      createdTimeMs: args.createdTimeMs == null ? null : new Date(args.createdTimeMs).toISOString(),
    },
    types: {
      taskId: { type: "string" },
      accountId: { type: "string" },
      retryCount: { type: "float64" },
      executionTimeMs: { type: "timestamp" },
      createdTimeMs: { type: "timestamp" },
    }
  };
}

export function deleteStripeConnectedAccountForPayoutCreatingTaskStatement(
  args: {
    stripeConnectedAccountForPayoutCreatingTaskTaskIdEq: string,
  }
): Statement {
  return {
    sql: "DELETE StripeConnectedAccountForPayoutCreatingTask WHERE (StripeConnectedAccountForPayoutCreatingTask.taskId = @stripeConnectedAccountForPayoutCreatingTaskTaskIdEq)",
    params: {
      stripeConnectedAccountForPayoutCreatingTaskTaskIdEq: args.stripeConnectedAccountForPayoutCreatingTaskTaskIdEq,
    },
    types: {
      stripeConnectedAccountForPayoutCreatingTaskTaskIdEq: { type: "string" },
    }
  };
}

export interface GetStripeConnectedAccountForPayoutCreatingTaskRow {
  stripeConnectedAccountForPayoutCreatingTaskTaskId?: string,
  stripeConnectedAccountForPayoutCreatingTaskAccountId?: string,
  stripeConnectedAccountForPayoutCreatingTaskRetryCount?: number,
  stripeConnectedAccountForPayoutCreatingTaskExecutionTimeMs?: number,
  stripeConnectedAccountForPayoutCreatingTaskCreatedTimeMs?: number,
}

export let GET_STRIPE_CONNECTED_ACCOUNT_FOR_PAYOUT_CREATING_TASK_ROW: MessageDescriptor<GetStripeConnectedAccountForPayoutCreatingTaskRow> = {
  name: 'GetStripeConnectedAccountForPayoutCreatingTaskRow',
  fields: [{
    name: 'stripeConnectedAccountForPayoutCreatingTaskTaskId',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'stripeConnectedAccountForPayoutCreatingTaskAccountId',
    index: 2,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'stripeConnectedAccountForPayoutCreatingTaskRetryCount',
    index: 3,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'stripeConnectedAccountForPayoutCreatingTaskExecutionTimeMs',
    index: 4,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'stripeConnectedAccountForPayoutCreatingTaskCreatedTimeMs',
    index: 5,
    primitiveType: PrimitiveType.NUMBER,
  }],
};

export async function getStripeConnectedAccountForPayoutCreatingTask(
  runner: Database | Transaction,
  args: {
    stripeConnectedAccountForPayoutCreatingTaskTaskIdEq: string,
  }
): Promise<Array<GetStripeConnectedAccountForPayoutCreatingTaskRow>> {
  let [rows] = await runner.run({
    sql: "SELECT StripeConnectedAccountForPayoutCreatingTask.taskId, StripeConnectedAccountForPayoutCreatingTask.accountId, StripeConnectedAccountForPayoutCreatingTask.retryCount, StripeConnectedAccountForPayoutCreatingTask.executionTimeMs, StripeConnectedAccountForPayoutCreatingTask.createdTimeMs FROM StripeConnectedAccountForPayoutCreatingTask WHERE (StripeConnectedAccountForPayoutCreatingTask.taskId = @stripeConnectedAccountForPayoutCreatingTaskTaskIdEq)",
    params: {
      stripeConnectedAccountForPayoutCreatingTaskTaskIdEq: args.stripeConnectedAccountForPayoutCreatingTaskTaskIdEq,
    },
    types: {
      stripeConnectedAccountForPayoutCreatingTaskTaskIdEq: { type: "string" },
    }
  });
  let resRows = new Array<GetStripeConnectedAccountForPayoutCreatingTaskRow>();
  for (let row of rows) {
    resRows.push({
      stripeConnectedAccountForPayoutCreatingTaskTaskId: row.at(0).value == null ? undefined : row.at(0).value,
      stripeConnectedAccountForPayoutCreatingTaskAccountId: row.at(1).value == null ? undefined : row.at(1).value,
      stripeConnectedAccountForPayoutCreatingTaskRetryCount: row.at(2).value == null ? undefined : row.at(2).value.value,
      stripeConnectedAccountForPayoutCreatingTaskExecutionTimeMs: row.at(3).value == null ? undefined : row.at(3).value.valueOf(),
      stripeConnectedAccountForPayoutCreatingTaskCreatedTimeMs: row.at(4).value == null ? undefined : row.at(4).value.valueOf(),
    });
  }
  return resRows;
}

export interface ListPendingStripeConnectedAccountForPayoutCreatingTasksRow {
  stripeConnectedAccountForPayoutCreatingTaskTaskId?: string,
  stripeConnectedAccountForPayoutCreatingTaskAccountId?: string,
}

export let LIST_PENDING_STRIPE_CONNECTED_ACCOUNT_FOR_PAYOUT_CREATING_TASKS_ROW: MessageDescriptor<ListPendingStripeConnectedAccountForPayoutCreatingTasksRow> = {
  name: 'ListPendingStripeConnectedAccountForPayoutCreatingTasksRow',
  fields: [{
    name: 'stripeConnectedAccountForPayoutCreatingTaskTaskId',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'stripeConnectedAccountForPayoutCreatingTaskAccountId',
    index: 2,
    primitiveType: PrimitiveType.STRING,
  }],
};

export async function listPendingStripeConnectedAccountForPayoutCreatingTasks(
  runner: Database | Transaction,
  args: {
    stripeConnectedAccountForPayoutCreatingTaskExecutionTimeMsLe?: number,
  }
): Promise<Array<ListPendingStripeConnectedAccountForPayoutCreatingTasksRow>> {
  let [rows] = await runner.run({
    sql: "SELECT StripeConnectedAccountForPayoutCreatingTask.taskId, StripeConnectedAccountForPayoutCreatingTask.accountId FROM StripeConnectedAccountForPayoutCreatingTask WHERE StripeConnectedAccountForPayoutCreatingTask.executionTimeMs <= @stripeConnectedAccountForPayoutCreatingTaskExecutionTimeMsLe",
    params: {
      stripeConnectedAccountForPayoutCreatingTaskExecutionTimeMsLe: args.stripeConnectedAccountForPayoutCreatingTaskExecutionTimeMsLe == null ? null : new Date(args.stripeConnectedAccountForPayoutCreatingTaskExecutionTimeMsLe).toISOString(),
    },
    types: {
      stripeConnectedAccountForPayoutCreatingTaskExecutionTimeMsLe: { type: "timestamp" },
    }
  });
  let resRows = new Array<ListPendingStripeConnectedAccountForPayoutCreatingTasksRow>();
  for (let row of rows) {
    resRows.push({
      stripeConnectedAccountForPayoutCreatingTaskTaskId: row.at(0).value == null ? undefined : row.at(0).value,
      stripeConnectedAccountForPayoutCreatingTaskAccountId: row.at(1).value == null ? undefined : row.at(1).value,
    });
  }
  return resRows;
}

export interface GetStripeConnectedAccountForPayoutCreatingTaskMetadataRow {
  stripeConnectedAccountForPayoutCreatingTaskRetryCount?: number,
  stripeConnectedAccountForPayoutCreatingTaskExecutionTimeMs?: number,
}

export let GET_STRIPE_CONNECTED_ACCOUNT_FOR_PAYOUT_CREATING_TASK_METADATA_ROW: MessageDescriptor<GetStripeConnectedAccountForPayoutCreatingTaskMetadataRow> = {
  name: 'GetStripeConnectedAccountForPayoutCreatingTaskMetadataRow',
  fields: [{
    name: 'stripeConnectedAccountForPayoutCreatingTaskRetryCount',
    index: 1,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'stripeConnectedAccountForPayoutCreatingTaskExecutionTimeMs',
    index: 2,
    primitiveType: PrimitiveType.NUMBER,
  }],
};

export async function getStripeConnectedAccountForPayoutCreatingTaskMetadata(
  runner: Database | Transaction,
  args: {
    stripeConnectedAccountForPayoutCreatingTaskTaskIdEq: string,
  }
): Promise<Array<GetStripeConnectedAccountForPayoutCreatingTaskMetadataRow>> {
  let [rows] = await runner.run({
    sql: "SELECT StripeConnectedAccountForPayoutCreatingTask.retryCount, StripeConnectedAccountForPayoutCreatingTask.executionTimeMs FROM StripeConnectedAccountForPayoutCreatingTask WHERE (StripeConnectedAccountForPayoutCreatingTask.taskId = @stripeConnectedAccountForPayoutCreatingTaskTaskIdEq)",
    params: {
      stripeConnectedAccountForPayoutCreatingTaskTaskIdEq: args.stripeConnectedAccountForPayoutCreatingTaskTaskIdEq,
    },
    types: {
      stripeConnectedAccountForPayoutCreatingTaskTaskIdEq: { type: "string" },
    }
  });
  let resRows = new Array<GetStripeConnectedAccountForPayoutCreatingTaskMetadataRow>();
  for (let row of rows) {
    resRows.push({
      stripeConnectedAccountForPayoutCreatingTaskRetryCount: row.at(0).value == null ? undefined : row.at(0).value.value,
      stripeConnectedAccountForPayoutCreatingTaskExecutionTimeMs: row.at(1).value == null ? undefined : row.at(1).value.valueOf(),
    });
  }
  return resRows;
}

export function updateStripeConnectedAccountForPayoutCreatingTaskMetadataStatement(
  args: {
    stripeConnectedAccountForPayoutCreatingTaskTaskIdEq: string,
    setRetryCount?: number,
    setExecutionTimeMs?: number,
  }
): Statement {
  return {
    sql: "UPDATE StripeConnectedAccountForPayoutCreatingTask SET retryCount = @setRetryCount, executionTimeMs = @setExecutionTimeMs WHERE (StripeConnectedAccountForPayoutCreatingTask.taskId = @stripeConnectedAccountForPayoutCreatingTaskTaskIdEq)",
    params: {
      stripeConnectedAccountForPayoutCreatingTaskTaskIdEq: args.stripeConnectedAccountForPayoutCreatingTaskTaskIdEq,
      setRetryCount: args.setRetryCount == null ? null : Spanner.float(args.setRetryCount),
      setExecutionTimeMs: args.setExecutionTimeMs == null ? null : new Date(args.setExecutionTimeMs).toISOString(),
    },
    types: {
      stripeConnectedAccountForPayoutCreatingTaskTaskIdEq: { type: "string" },
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

export function insertPaymentStripeInvoiceCreatingTaskStatement(
  args: {
    taskId: string,
    statementId: string,
    retryCount?: number,
    executionTimeMs?: number,
    createdTimeMs?: number,
  }
): Statement {
  return {
    sql: "INSERT PaymentStripeInvoiceCreatingTask (taskId, statementId, retryCount, executionTimeMs, createdTimeMs) VALUES (@taskId, @statementId, @retryCount, @executionTimeMs, @createdTimeMs)",
    params: {
      taskId: args.taskId,
      statementId: args.statementId,
      retryCount: args.retryCount == null ? null : Spanner.float(args.retryCount),
      executionTimeMs: args.executionTimeMs == null ? null : new Date(args.executionTimeMs).toISOString(),
      createdTimeMs: args.createdTimeMs == null ? null : new Date(args.createdTimeMs).toISOString(),
    },
    types: {
      taskId: { type: "string" },
      statementId: { type: "string" },
      retryCount: { type: "float64" },
      executionTimeMs: { type: "timestamp" },
      createdTimeMs: { type: "timestamp" },
    }
  };
}

export function deletePaymentStripeInvoiceCreatingTaskStatement(
  args: {
    paymentStripeInvoiceCreatingTaskTaskIdEq: string,
  }
): Statement {
  return {
    sql: "DELETE PaymentStripeInvoiceCreatingTask WHERE (PaymentStripeInvoiceCreatingTask.taskId = @paymentStripeInvoiceCreatingTaskTaskIdEq)",
    params: {
      paymentStripeInvoiceCreatingTaskTaskIdEq: args.paymentStripeInvoiceCreatingTaskTaskIdEq,
    },
    types: {
      paymentStripeInvoiceCreatingTaskTaskIdEq: { type: "string" },
    }
  };
}

export interface GetPaymentStripeInvoiceCreatingTaskRow {
  paymentStripeInvoiceCreatingTaskTaskId?: string,
  paymentStripeInvoiceCreatingTaskStatementId?: string,
  paymentStripeInvoiceCreatingTaskRetryCount?: number,
  paymentStripeInvoiceCreatingTaskExecutionTimeMs?: number,
  paymentStripeInvoiceCreatingTaskCreatedTimeMs?: number,
}

export let GET_PAYMENT_STRIPE_INVOICE_CREATING_TASK_ROW: MessageDescriptor<GetPaymentStripeInvoiceCreatingTaskRow> = {
  name: 'GetPaymentStripeInvoiceCreatingTaskRow',
  fields: [{
    name: 'paymentStripeInvoiceCreatingTaskTaskId',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'paymentStripeInvoiceCreatingTaskStatementId',
    index: 2,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'paymentStripeInvoiceCreatingTaskRetryCount',
    index: 3,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'paymentStripeInvoiceCreatingTaskExecutionTimeMs',
    index: 4,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'paymentStripeInvoiceCreatingTaskCreatedTimeMs',
    index: 5,
    primitiveType: PrimitiveType.NUMBER,
  }],
};

export async function getPaymentStripeInvoiceCreatingTask(
  runner: Database | Transaction,
  args: {
    paymentStripeInvoiceCreatingTaskTaskIdEq: string,
  }
): Promise<Array<GetPaymentStripeInvoiceCreatingTaskRow>> {
  let [rows] = await runner.run({
    sql: "SELECT PaymentStripeInvoiceCreatingTask.taskId, PaymentStripeInvoiceCreatingTask.statementId, PaymentStripeInvoiceCreatingTask.retryCount, PaymentStripeInvoiceCreatingTask.executionTimeMs, PaymentStripeInvoiceCreatingTask.createdTimeMs FROM PaymentStripeInvoiceCreatingTask WHERE (PaymentStripeInvoiceCreatingTask.taskId = @paymentStripeInvoiceCreatingTaskTaskIdEq)",
    params: {
      paymentStripeInvoiceCreatingTaskTaskIdEq: args.paymentStripeInvoiceCreatingTaskTaskIdEq,
    },
    types: {
      paymentStripeInvoiceCreatingTaskTaskIdEq: { type: "string" },
    }
  });
  let resRows = new Array<GetPaymentStripeInvoiceCreatingTaskRow>();
  for (let row of rows) {
    resRows.push({
      paymentStripeInvoiceCreatingTaskTaskId: row.at(0).value == null ? undefined : row.at(0).value,
      paymentStripeInvoiceCreatingTaskStatementId: row.at(1).value == null ? undefined : row.at(1).value,
      paymentStripeInvoiceCreatingTaskRetryCount: row.at(2).value == null ? undefined : row.at(2).value.value,
      paymentStripeInvoiceCreatingTaskExecutionTimeMs: row.at(3).value == null ? undefined : row.at(3).value.valueOf(),
      paymentStripeInvoiceCreatingTaskCreatedTimeMs: row.at(4).value == null ? undefined : row.at(4).value.valueOf(),
    });
  }
  return resRows;
}

export interface ListPendingPaymentStripeInvoiceCreatingTasksRow {
  paymentStripeInvoiceCreatingTaskTaskId?: string,
  paymentStripeInvoiceCreatingTaskStatementId?: string,
}

export let LIST_PENDING_PAYMENT_STRIPE_INVOICE_CREATING_TASKS_ROW: MessageDescriptor<ListPendingPaymentStripeInvoiceCreatingTasksRow> = {
  name: 'ListPendingPaymentStripeInvoiceCreatingTasksRow',
  fields: [{
    name: 'paymentStripeInvoiceCreatingTaskTaskId',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'paymentStripeInvoiceCreatingTaskStatementId',
    index: 2,
    primitiveType: PrimitiveType.STRING,
  }],
};

export async function listPendingPaymentStripeInvoiceCreatingTasks(
  runner: Database | Transaction,
  args: {
    paymentStripeInvoiceCreatingTaskExecutionTimeMsLe?: number,
  }
): Promise<Array<ListPendingPaymentStripeInvoiceCreatingTasksRow>> {
  let [rows] = await runner.run({
    sql: "SELECT PaymentStripeInvoiceCreatingTask.taskId, PaymentStripeInvoiceCreatingTask.statementId FROM PaymentStripeInvoiceCreatingTask WHERE PaymentStripeInvoiceCreatingTask.executionTimeMs <= @paymentStripeInvoiceCreatingTaskExecutionTimeMsLe",
    params: {
      paymentStripeInvoiceCreatingTaskExecutionTimeMsLe: args.paymentStripeInvoiceCreatingTaskExecutionTimeMsLe == null ? null : new Date(args.paymentStripeInvoiceCreatingTaskExecutionTimeMsLe).toISOString(),
    },
    types: {
      paymentStripeInvoiceCreatingTaskExecutionTimeMsLe: { type: "timestamp" },
    }
  });
  let resRows = new Array<ListPendingPaymentStripeInvoiceCreatingTasksRow>();
  for (let row of rows) {
    resRows.push({
      paymentStripeInvoiceCreatingTaskTaskId: row.at(0).value == null ? undefined : row.at(0).value,
      paymentStripeInvoiceCreatingTaskStatementId: row.at(1).value == null ? undefined : row.at(1).value,
    });
  }
  return resRows;
}

export interface GetPaymentStripeInvoiceCreatingTaskMetadataRow {
  paymentStripeInvoiceCreatingTaskRetryCount?: number,
  paymentStripeInvoiceCreatingTaskExecutionTimeMs?: number,
}

export let GET_PAYMENT_STRIPE_INVOICE_CREATING_TASK_METADATA_ROW: MessageDescriptor<GetPaymentStripeInvoiceCreatingTaskMetadataRow> = {
  name: 'GetPaymentStripeInvoiceCreatingTaskMetadataRow',
  fields: [{
    name: 'paymentStripeInvoiceCreatingTaskRetryCount',
    index: 1,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'paymentStripeInvoiceCreatingTaskExecutionTimeMs',
    index: 2,
    primitiveType: PrimitiveType.NUMBER,
  }],
};

export async function getPaymentStripeInvoiceCreatingTaskMetadata(
  runner: Database | Transaction,
  args: {
    paymentStripeInvoiceCreatingTaskTaskIdEq: string,
  }
): Promise<Array<GetPaymentStripeInvoiceCreatingTaskMetadataRow>> {
  let [rows] = await runner.run({
    sql: "SELECT PaymentStripeInvoiceCreatingTask.retryCount, PaymentStripeInvoiceCreatingTask.executionTimeMs FROM PaymentStripeInvoiceCreatingTask WHERE (PaymentStripeInvoiceCreatingTask.taskId = @paymentStripeInvoiceCreatingTaskTaskIdEq)",
    params: {
      paymentStripeInvoiceCreatingTaskTaskIdEq: args.paymentStripeInvoiceCreatingTaskTaskIdEq,
    },
    types: {
      paymentStripeInvoiceCreatingTaskTaskIdEq: { type: "string" },
    }
  });
  let resRows = new Array<GetPaymentStripeInvoiceCreatingTaskMetadataRow>();
  for (let row of rows) {
    resRows.push({
      paymentStripeInvoiceCreatingTaskRetryCount: row.at(0).value == null ? undefined : row.at(0).value.value,
      paymentStripeInvoiceCreatingTaskExecutionTimeMs: row.at(1).value == null ? undefined : row.at(1).value.valueOf(),
    });
  }
  return resRows;
}

export function updatePaymentStripeInvoiceCreatingTaskMetadataStatement(
  args: {
    paymentStripeInvoiceCreatingTaskTaskIdEq: string,
    setRetryCount?: number,
    setExecutionTimeMs?: number,
  }
): Statement {
  return {
    sql: "UPDATE PaymentStripeInvoiceCreatingTask SET retryCount = @setRetryCount, executionTimeMs = @setExecutionTimeMs WHERE (PaymentStripeInvoiceCreatingTask.taskId = @paymentStripeInvoiceCreatingTaskTaskIdEq)",
    params: {
      paymentStripeInvoiceCreatingTaskTaskIdEq: args.paymentStripeInvoiceCreatingTaskTaskIdEq,
      setRetryCount: args.setRetryCount == null ? null : Spanner.float(args.setRetryCount),
      setExecutionTimeMs: args.setExecutionTimeMs == null ? null : new Date(args.setExecutionTimeMs).toISOString(),
    },
    types: {
      paymentStripeInvoiceCreatingTaskTaskIdEq: { type: "string" },
      setRetryCount: { type: "float64" },
      setExecutionTimeMs: { type: "timestamp" },
    }
  };
}

export function insertPaymentStripeInvoicePayingTaskStatement(
  args: {
    taskId: string,
    statementId: string,
    retryCount?: number,
    executionTimeMs?: number,
    createdTimeMs?: number,
  }
): Statement {
  return {
    sql: "INSERT PaymentStripeInvoicePayingTask (taskId, statementId, retryCount, executionTimeMs, createdTimeMs) VALUES (@taskId, @statementId, @retryCount, @executionTimeMs, @createdTimeMs)",
    params: {
      taskId: args.taskId,
      statementId: args.statementId,
      retryCount: args.retryCount == null ? null : Spanner.float(args.retryCount),
      executionTimeMs: args.executionTimeMs == null ? null : new Date(args.executionTimeMs).toISOString(),
      createdTimeMs: args.createdTimeMs == null ? null : new Date(args.createdTimeMs).toISOString(),
    },
    types: {
      taskId: { type: "string" },
      statementId: { type: "string" },
      retryCount: { type: "float64" },
      executionTimeMs: { type: "timestamp" },
      createdTimeMs: { type: "timestamp" },
    }
  };
}

export function deletePaymentStripeInvoicePayingTaskStatement(
  args: {
    paymentStripeInvoicePayingTaskTaskIdEq: string,
  }
): Statement {
  return {
    sql: "DELETE PaymentStripeInvoicePayingTask WHERE (PaymentStripeInvoicePayingTask.taskId = @paymentStripeInvoicePayingTaskTaskIdEq)",
    params: {
      paymentStripeInvoicePayingTaskTaskIdEq: args.paymentStripeInvoicePayingTaskTaskIdEq,
    },
    types: {
      paymentStripeInvoicePayingTaskTaskIdEq: { type: "string" },
    }
  };
}

export interface GetPaymentStripeInvoicePayingTaskRow {
  paymentStripeInvoicePayingTaskTaskId?: string,
  paymentStripeInvoicePayingTaskStatementId?: string,
  paymentStripeInvoicePayingTaskRetryCount?: number,
  paymentStripeInvoicePayingTaskExecutionTimeMs?: number,
  paymentStripeInvoicePayingTaskCreatedTimeMs?: number,
}

export let GET_PAYMENT_STRIPE_INVOICE_PAYING_TASK_ROW: MessageDescriptor<GetPaymentStripeInvoicePayingTaskRow> = {
  name: 'GetPaymentStripeInvoicePayingTaskRow',
  fields: [{
    name: 'paymentStripeInvoicePayingTaskTaskId',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'paymentStripeInvoicePayingTaskStatementId',
    index: 2,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'paymentStripeInvoicePayingTaskRetryCount',
    index: 3,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'paymentStripeInvoicePayingTaskExecutionTimeMs',
    index: 4,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'paymentStripeInvoicePayingTaskCreatedTimeMs',
    index: 5,
    primitiveType: PrimitiveType.NUMBER,
  }],
};

export async function getPaymentStripeInvoicePayingTask(
  runner: Database | Transaction,
  args: {
    paymentStripeInvoicePayingTaskTaskIdEq: string,
  }
): Promise<Array<GetPaymentStripeInvoicePayingTaskRow>> {
  let [rows] = await runner.run({
    sql: "SELECT PaymentStripeInvoicePayingTask.taskId, PaymentStripeInvoicePayingTask.statementId, PaymentStripeInvoicePayingTask.retryCount, PaymentStripeInvoicePayingTask.executionTimeMs, PaymentStripeInvoicePayingTask.createdTimeMs FROM PaymentStripeInvoicePayingTask WHERE (PaymentStripeInvoicePayingTask.taskId = @paymentStripeInvoicePayingTaskTaskIdEq)",
    params: {
      paymentStripeInvoicePayingTaskTaskIdEq: args.paymentStripeInvoicePayingTaskTaskIdEq,
    },
    types: {
      paymentStripeInvoicePayingTaskTaskIdEq: { type: "string" },
    }
  });
  let resRows = new Array<GetPaymentStripeInvoicePayingTaskRow>();
  for (let row of rows) {
    resRows.push({
      paymentStripeInvoicePayingTaskTaskId: row.at(0).value == null ? undefined : row.at(0).value,
      paymentStripeInvoicePayingTaskStatementId: row.at(1).value == null ? undefined : row.at(1).value,
      paymentStripeInvoicePayingTaskRetryCount: row.at(2).value == null ? undefined : row.at(2).value.value,
      paymentStripeInvoicePayingTaskExecutionTimeMs: row.at(3).value == null ? undefined : row.at(3).value.valueOf(),
      paymentStripeInvoicePayingTaskCreatedTimeMs: row.at(4).value == null ? undefined : row.at(4).value.valueOf(),
    });
  }
  return resRows;
}

export interface ListPendingPaymentStripeInvoicePayingTasksRow {
  paymentStripeInvoicePayingTaskTaskId?: string,
  paymentStripeInvoicePayingTaskStatementId?: string,
}

export let LIST_PENDING_PAYMENT_STRIPE_INVOICE_PAYING_TASKS_ROW: MessageDescriptor<ListPendingPaymentStripeInvoicePayingTasksRow> = {
  name: 'ListPendingPaymentStripeInvoicePayingTasksRow',
  fields: [{
    name: 'paymentStripeInvoicePayingTaskTaskId',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'paymentStripeInvoicePayingTaskStatementId',
    index: 2,
    primitiveType: PrimitiveType.STRING,
  }],
};

export async function listPendingPaymentStripeInvoicePayingTasks(
  runner: Database | Transaction,
  args: {
    paymentStripeInvoicePayingTaskExecutionTimeMsLe?: number,
  }
): Promise<Array<ListPendingPaymentStripeInvoicePayingTasksRow>> {
  let [rows] = await runner.run({
    sql: "SELECT PaymentStripeInvoicePayingTask.taskId, PaymentStripeInvoicePayingTask.statementId FROM PaymentStripeInvoicePayingTask WHERE PaymentStripeInvoicePayingTask.executionTimeMs <= @paymentStripeInvoicePayingTaskExecutionTimeMsLe",
    params: {
      paymentStripeInvoicePayingTaskExecutionTimeMsLe: args.paymentStripeInvoicePayingTaskExecutionTimeMsLe == null ? null : new Date(args.paymentStripeInvoicePayingTaskExecutionTimeMsLe).toISOString(),
    },
    types: {
      paymentStripeInvoicePayingTaskExecutionTimeMsLe: { type: "timestamp" },
    }
  });
  let resRows = new Array<ListPendingPaymentStripeInvoicePayingTasksRow>();
  for (let row of rows) {
    resRows.push({
      paymentStripeInvoicePayingTaskTaskId: row.at(0).value == null ? undefined : row.at(0).value,
      paymentStripeInvoicePayingTaskStatementId: row.at(1).value == null ? undefined : row.at(1).value,
    });
  }
  return resRows;
}

export interface GetPaymentStripeInvoicePayingTaskMetadataRow {
  paymentStripeInvoicePayingTaskRetryCount?: number,
  paymentStripeInvoicePayingTaskExecutionTimeMs?: number,
}

export let GET_PAYMENT_STRIPE_INVOICE_PAYING_TASK_METADATA_ROW: MessageDescriptor<GetPaymentStripeInvoicePayingTaskMetadataRow> = {
  name: 'GetPaymentStripeInvoicePayingTaskMetadataRow',
  fields: [{
    name: 'paymentStripeInvoicePayingTaskRetryCount',
    index: 1,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'paymentStripeInvoicePayingTaskExecutionTimeMs',
    index: 2,
    primitiveType: PrimitiveType.NUMBER,
  }],
};

export async function getPaymentStripeInvoicePayingTaskMetadata(
  runner: Database | Transaction,
  args: {
    paymentStripeInvoicePayingTaskTaskIdEq: string,
  }
): Promise<Array<GetPaymentStripeInvoicePayingTaskMetadataRow>> {
  let [rows] = await runner.run({
    sql: "SELECT PaymentStripeInvoicePayingTask.retryCount, PaymentStripeInvoicePayingTask.executionTimeMs FROM PaymentStripeInvoicePayingTask WHERE (PaymentStripeInvoicePayingTask.taskId = @paymentStripeInvoicePayingTaskTaskIdEq)",
    params: {
      paymentStripeInvoicePayingTaskTaskIdEq: args.paymentStripeInvoicePayingTaskTaskIdEq,
    },
    types: {
      paymentStripeInvoicePayingTaskTaskIdEq: { type: "string" },
    }
  });
  let resRows = new Array<GetPaymentStripeInvoicePayingTaskMetadataRow>();
  for (let row of rows) {
    resRows.push({
      paymentStripeInvoicePayingTaskRetryCount: row.at(0).value == null ? undefined : row.at(0).value.value,
      paymentStripeInvoicePayingTaskExecutionTimeMs: row.at(1).value == null ? undefined : row.at(1).value.valueOf(),
    });
  }
  return resRows;
}

export function updatePaymentStripeInvoicePayingTaskMetadataStatement(
  args: {
    paymentStripeInvoicePayingTaskTaskIdEq: string,
    setRetryCount?: number,
    setExecutionTimeMs?: number,
  }
): Statement {
  return {
    sql: "UPDATE PaymentStripeInvoicePayingTask SET retryCount = @setRetryCount, executionTimeMs = @setExecutionTimeMs WHERE (PaymentStripeInvoicePayingTask.taskId = @paymentStripeInvoicePayingTaskTaskIdEq)",
    params: {
      paymentStripeInvoicePayingTaskTaskIdEq: args.paymentStripeInvoicePayingTaskTaskIdEq,
      setRetryCount: args.setRetryCount == null ? null : Spanner.float(args.setRetryCount),
      setExecutionTimeMs: args.setExecutionTimeMs == null ? null : new Date(args.setExecutionTimeMs).toISOString(),
    },
    types: {
      paymentStripeInvoicePayingTaskTaskIdEq: { type: "string" },
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

export function insertPaymentProfileSuspendingDueToPastDueTaskStatement(
  args: {
    statementId: string,
    retryCount?: number,
    executionTimeMs?: number,
    createdTimeMs?: number,
  }
): Statement {
  return {
    sql: "INSERT PaymentProfileSuspendingDueToPastDueTask (statementId, retryCount, executionTimeMs, createdTimeMs) VALUES (@statementId, @retryCount, @executionTimeMs, @createdTimeMs)",
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

export function deletePaymentProfileSuspendingDueToPastDueTaskStatement(
  args: {
    paymentProfileSuspendingDueToPastDueTaskStatementIdEq: string,
  }
): Statement {
  return {
    sql: "DELETE PaymentProfileSuspendingDueToPastDueTask WHERE (PaymentProfileSuspendingDueToPastDueTask.statementId = @paymentProfileSuspendingDueToPastDueTaskStatementIdEq)",
    params: {
      paymentProfileSuspendingDueToPastDueTaskStatementIdEq: args.paymentProfileSuspendingDueToPastDueTaskStatementIdEq,
    },
    types: {
      paymentProfileSuspendingDueToPastDueTaskStatementIdEq: { type: "string" },
    }
  };
}

export interface GetPaymentProfileSuspendingDueToPastDueTaskRow {
  paymentProfileSuspendingDueToPastDueTaskStatementId?: string,
  paymentProfileSuspendingDueToPastDueTaskRetryCount?: number,
  paymentProfileSuspendingDueToPastDueTaskExecutionTimeMs?: number,
  paymentProfileSuspendingDueToPastDueTaskCreatedTimeMs?: number,
}

export let GET_PAYMENT_PROFILE_SUSPENDING_DUE_TO_PAST_DUE_TASK_ROW: MessageDescriptor<GetPaymentProfileSuspendingDueToPastDueTaskRow> = {
  name: 'GetPaymentProfileSuspendingDueToPastDueTaskRow',
  fields: [{
    name: 'paymentProfileSuspendingDueToPastDueTaskStatementId',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'paymentProfileSuspendingDueToPastDueTaskRetryCount',
    index: 2,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'paymentProfileSuspendingDueToPastDueTaskExecutionTimeMs',
    index: 3,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'paymentProfileSuspendingDueToPastDueTaskCreatedTimeMs',
    index: 4,
    primitiveType: PrimitiveType.NUMBER,
  }],
};

export async function getPaymentProfileSuspendingDueToPastDueTask(
  runner: Database | Transaction,
  args: {
    paymentProfileSuspendingDueToPastDueTaskStatementIdEq: string,
  }
): Promise<Array<GetPaymentProfileSuspendingDueToPastDueTaskRow>> {
  let [rows] = await runner.run({
    sql: "SELECT PaymentProfileSuspendingDueToPastDueTask.statementId, PaymentProfileSuspendingDueToPastDueTask.retryCount, PaymentProfileSuspendingDueToPastDueTask.executionTimeMs, PaymentProfileSuspendingDueToPastDueTask.createdTimeMs FROM PaymentProfileSuspendingDueToPastDueTask WHERE (PaymentProfileSuspendingDueToPastDueTask.statementId = @paymentProfileSuspendingDueToPastDueTaskStatementIdEq)",
    params: {
      paymentProfileSuspendingDueToPastDueTaskStatementIdEq: args.paymentProfileSuspendingDueToPastDueTaskStatementIdEq,
    },
    types: {
      paymentProfileSuspendingDueToPastDueTaskStatementIdEq: { type: "string" },
    }
  });
  let resRows = new Array<GetPaymentProfileSuspendingDueToPastDueTaskRow>();
  for (let row of rows) {
    resRows.push({
      paymentProfileSuspendingDueToPastDueTaskStatementId: row.at(0).value == null ? undefined : row.at(0).value,
      paymentProfileSuspendingDueToPastDueTaskRetryCount: row.at(1).value == null ? undefined : row.at(1).value.value,
      paymentProfileSuspendingDueToPastDueTaskExecutionTimeMs: row.at(2).value == null ? undefined : row.at(2).value.valueOf(),
      paymentProfileSuspendingDueToPastDueTaskCreatedTimeMs: row.at(3).value == null ? undefined : row.at(3).value.valueOf(),
    });
  }
  return resRows;
}

export interface ListPendingPaymentProfileSuspendingDueToPastDueTasksRow {
  paymentProfileSuspendingDueToPastDueTaskStatementId?: string,
}

export let LIST_PENDING_PAYMENT_PROFILE_SUSPENDING_DUE_TO_PAST_DUE_TASKS_ROW: MessageDescriptor<ListPendingPaymentProfileSuspendingDueToPastDueTasksRow> = {
  name: 'ListPendingPaymentProfileSuspendingDueToPastDueTasksRow',
  fields: [{
    name: 'paymentProfileSuspendingDueToPastDueTaskStatementId',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }],
};

export async function listPendingPaymentProfileSuspendingDueToPastDueTasks(
  runner: Database | Transaction,
  args: {
    paymentProfileSuspendingDueToPastDueTaskExecutionTimeMsLe?: number,
  }
): Promise<Array<ListPendingPaymentProfileSuspendingDueToPastDueTasksRow>> {
  let [rows] = await runner.run({
    sql: "SELECT PaymentProfileSuspendingDueToPastDueTask.statementId FROM PaymentProfileSuspendingDueToPastDueTask WHERE PaymentProfileSuspendingDueToPastDueTask.executionTimeMs <= @paymentProfileSuspendingDueToPastDueTaskExecutionTimeMsLe",
    params: {
      paymentProfileSuspendingDueToPastDueTaskExecutionTimeMsLe: args.paymentProfileSuspendingDueToPastDueTaskExecutionTimeMsLe == null ? null : new Date(args.paymentProfileSuspendingDueToPastDueTaskExecutionTimeMsLe).toISOString(),
    },
    types: {
      paymentProfileSuspendingDueToPastDueTaskExecutionTimeMsLe: { type: "timestamp" },
    }
  });
  let resRows = new Array<ListPendingPaymentProfileSuspendingDueToPastDueTasksRow>();
  for (let row of rows) {
    resRows.push({
      paymentProfileSuspendingDueToPastDueTaskStatementId: row.at(0).value == null ? undefined : row.at(0).value,
    });
  }
  return resRows;
}

export interface GetPaymentProfileSuspendingDueToPastDueTaskMetadataRow {
  paymentProfileSuspendingDueToPastDueTaskRetryCount?: number,
  paymentProfileSuspendingDueToPastDueTaskExecutionTimeMs?: number,
}

export let GET_PAYMENT_PROFILE_SUSPENDING_DUE_TO_PAST_DUE_TASK_METADATA_ROW: MessageDescriptor<GetPaymentProfileSuspendingDueToPastDueTaskMetadataRow> = {
  name: 'GetPaymentProfileSuspendingDueToPastDueTaskMetadataRow',
  fields: [{
    name: 'paymentProfileSuspendingDueToPastDueTaskRetryCount',
    index: 1,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'paymentProfileSuspendingDueToPastDueTaskExecutionTimeMs',
    index: 2,
    primitiveType: PrimitiveType.NUMBER,
  }],
};

export async function getPaymentProfileSuspendingDueToPastDueTaskMetadata(
  runner: Database | Transaction,
  args: {
    paymentProfileSuspendingDueToPastDueTaskStatementIdEq: string,
  }
): Promise<Array<GetPaymentProfileSuspendingDueToPastDueTaskMetadataRow>> {
  let [rows] = await runner.run({
    sql: "SELECT PaymentProfileSuspendingDueToPastDueTask.retryCount, PaymentProfileSuspendingDueToPastDueTask.executionTimeMs FROM PaymentProfileSuspendingDueToPastDueTask WHERE (PaymentProfileSuspendingDueToPastDueTask.statementId = @paymentProfileSuspendingDueToPastDueTaskStatementIdEq)",
    params: {
      paymentProfileSuspendingDueToPastDueTaskStatementIdEq: args.paymentProfileSuspendingDueToPastDueTaskStatementIdEq,
    },
    types: {
      paymentProfileSuspendingDueToPastDueTaskStatementIdEq: { type: "string" },
    }
  });
  let resRows = new Array<GetPaymentProfileSuspendingDueToPastDueTaskMetadataRow>();
  for (let row of rows) {
    resRows.push({
      paymentProfileSuspendingDueToPastDueTaskRetryCount: row.at(0).value == null ? undefined : row.at(0).value.value,
      paymentProfileSuspendingDueToPastDueTaskExecutionTimeMs: row.at(1).value == null ? undefined : row.at(1).value.valueOf(),
    });
  }
  return resRows;
}

export function updatePaymentProfileSuspendingDueToPastDueTaskMetadataStatement(
  args: {
    paymentProfileSuspendingDueToPastDueTaskStatementIdEq: string,
    setRetryCount?: number,
    setExecutionTimeMs?: number,
  }
): Statement {
  return {
    sql: "UPDATE PaymentProfileSuspendingDueToPastDueTask SET retryCount = @setRetryCount, executionTimeMs = @setExecutionTimeMs WHERE (PaymentProfileSuspendingDueToPastDueTask.statementId = @paymentProfileSuspendingDueToPastDueTaskStatementIdEq)",
    params: {
      paymentProfileSuspendingDueToPastDueTaskStatementIdEq: args.paymentProfileSuspendingDueToPastDueTaskStatementIdEq,
      setRetryCount: args.setRetryCount == null ? null : Spanner.float(args.setRetryCount),
      setExecutionTimeMs: args.setExecutionTimeMs == null ? null : new Date(args.setExecutionTimeMs).toISOString(),
    },
    types: {
      paymentProfileSuspendingDueToPastDueTaskStatementIdEq: { type: "string" },
      setRetryCount: { type: "float64" },
      setExecutionTimeMs: { type: "timestamp" },
    }
  };
}

export function insertPaymentProfileSuspensionNotifyingTaskStatement(
  args: {
    accountId: string,
    version: number,
    retryCount?: number,
    executionTimeMs?: number,
    createdTimeMs?: number,
  }
): Statement {
  return {
    sql: "INSERT PaymentProfileSuspensionNotifyingTask (accountId, version, retryCount, executionTimeMs, createdTimeMs) VALUES (@accountId, @version, @retryCount, @executionTimeMs, @createdTimeMs)",
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

export function deletePaymentProfileSuspensionNotifyingTaskStatement(
  args: {
    paymentProfileSuspensionNotifyingTaskAccountIdEq: string,
    paymentProfileSuspensionNotifyingTaskVersionEq: number,
  }
): Statement {
  return {
    sql: "DELETE PaymentProfileSuspensionNotifyingTask WHERE (PaymentProfileSuspensionNotifyingTask.accountId = @paymentProfileSuspensionNotifyingTaskAccountIdEq AND PaymentProfileSuspensionNotifyingTask.version = @paymentProfileSuspensionNotifyingTaskVersionEq)",
    params: {
      paymentProfileSuspensionNotifyingTaskAccountIdEq: args.paymentProfileSuspensionNotifyingTaskAccountIdEq,
      paymentProfileSuspensionNotifyingTaskVersionEq: Spanner.float(args.paymentProfileSuspensionNotifyingTaskVersionEq),
    },
    types: {
      paymentProfileSuspensionNotifyingTaskAccountIdEq: { type: "string" },
      paymentProfileSuspensionNotifyingTaskVersionEq: { type: "float64" },
    }
  };
}

export interface GetPaymentProfileSuspensionNotifyingTaskRow {
  paymentProfileSuspensionNotifyingTaskAccountId?: string,
  paymentProfileSuspensionNotifyingTaskVersion?: number,
  paymentProfileSuspensionNotifyingTaskRetryCount?: number,
  paymentProfileSuspensionNotifyingTaskExecutionTimeMs?: number,
  paymentProfileSuspensionNotifyingTaskCreatedTimeMs?: number,
}

export let GET_PAYMENT_PROFILE_SUSPENSION_NOTIFYING_TASK_ROW: MessageDescriptor<GetPaymentProfileSuspensionNotifyingTaskRow> = {
  name: 'GetPaymentProfileSuspensionNotifyingTaskRow',
  fields: [{
    name: 'paymentProfileSuspensionNotifyingTaskAccountId',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'paymentProfileSuspensionNotifyingTaskVersion',
    index: 2,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'paymentProfileSuspensionNotifyingTaskRetryCount',
    index: 3,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'paymentProfileSuspensionNotifyingTaskExecutionTimeMs',
    index: 4,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'paymentProfileSuspensionNotifyingTaskCreatedTimeMs',
    index: 5,
    primitiveType: PrimitiveType.NUMBER,
  }],
};

export async function getPaymentProfileSuspensionNotifyingTask(
  runner: Database | Transaction,
  args: {
    paymentProfileSuspensionNotifyingTaskAccountIdEq: string,
    paymentProfileSuspensionNotifyingTaskVersionEq: number,
  }
): Promise<Array<GetPaymentProfileSuspensionNotifyingTaskRow>> {
  let [rows] = await runner.run({
    sql: "SELECT PaymentProfileSuspensionNotifyingTask.accountId, PaymentProfileSuspensionNotifyingTask.version, PaymentProfileSuspensionNotifyingTask.retryCount, PaymentProfileSuspensionNotifyingTask.executionTimeMs, PaymentProfileSuspensionNotifyingTask.createdTimeMs FROM PaymentProfileSuspensionNotifyingTask WHERE (PaymentProfileSuspensionNotifyingTask.accountId = @paymentProfileSuspensionNotifyingTaskAccountIdEq AND PaymentProfileSuspensionNotifyingTask.version = @paymentProfileSuspensionNotifyingTaskVersionEq)",
    params: {
      paymentProfileSuspensionNotifyingTaskAccountIdEq: args.paymentProfileSuspensionNotifyingTaskAccountIdEq,
      paymentProfileSuspensionNotifyingTaskVersionEq: Spanner.float(args.paymentProfileSuspensionNotifyingTaskVersionEq),
    },
    types: {
      paymentProfileSuspensionNotifyingTaskAccountIdEq: { type: "string" },
      paymentProfileSuspensionNotifyingTaskVersionEq: { type: "float64" },
    }
  });
  let resRows = new Array<GetPaymentProfileSuspensionNotifyingTaskRow>();
  for (let row of rows) {
    resRows.push({
      paymentProfileSuspensionNotifyingTaskAccountId: row.at(0).value == null ? undefined : row.at(0).value,
      paymentProfileSuspensionNotifyingTaskVersion: row.at(1).value == null ? undefined : row.at(1).value.value,
      paymentProfileSuspensionNotifyingTaskRetryCount: row.at(2).value == null ? undefined : row.at(2).value.value,
      paymentProfileSuspensionNotifyingTaskExecutionTimeMs: row.at(3).value == null ? undefined : row.at(3).value.valueOf(),
      paymentProfileSuspensionNotifyingTaskCreatedTimeMs: row.at(4).value == null ? undefined : row.at(4).value.valueOf(),
    });
  }
  return resRows;
}

export interface ListPendingPaymentProfileSuspensionNotifyingTasksRow {
  paymentProfileSuspensionNotifyingTaskAccountId?: string,
  paymentProfileSuspensionNotifyingTaskVersion?: number,
}

export let LIST_PENDING_PAYMENT_PROFILE_SUSPENSION_NOTIFYING_TASKS_ROW: MessageDescriptor<ListPendingPaymentProfileSuspensionNotifyingTasksRow> = {
  name: 'ListPendingPaymentProfileSuspensionNotifyingTasksRow',
  fields: [{
    name: 'paymentProfileSuspensionNotifyingTaskAccountId',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'paymentProfileSuspensionNotifyingTaskVersion',
    index: 2,
    primitiveType: PrimitiveType.NUMBER,
  }],
};

export async function listPendingPaymentProfileSuspensionNotifyingTasks(
  runner: Database | Transaction,
  args: {
    paymentProfileSuspensionNotifyingTaskExecutionTimeMsLe?: number,
  }
): Promise<Array<ListPendingPaymentProfileSuspensionNotifyingTasksRow>> {
  let [rows] = await runner.run({
    sql: "SELECT PaymentProfileSuspensionNotifyingTask.accountId, PaymentProfileSuspensionNotifyingTask.version FROM PaymentProfileSuspensionNotifyingTask WHERE PaymentProfileSuspensionNotifyingTask.executionTimeMs <= @paymentProfileSuspensionNotifyingTaskExecutionTimeMsLe",
    params: {
      paymentProfileSuspensionNotifyingTaskExecutionTimeMsLe: args.paymentProfileSuspensionNotifyingTaskExecutionTimeMsLe == null ? null : new Date(args.paymentProfileSuspensionNotifyingTaskExecutionTimeMsLe).toISOString(),
    },
    types: {
      paymentProfileSuspensionNotifyingTaskExecutionTimeMsLe: { type: "timestamp" },
    }
  });
  let resRows = new Array<ListPendingPaymentProfileSuspensionNotifyingTasksRow>();
  for (let row of rows) {
    resRows.push({
      paymentProfileSuspensionNotifyingTaskAccountId: row.at(0).value == null ? undefined : row.at(0).value,
      paymentProfileSuspensionNotifyingTaskVersion: row.at(1).value == null ? undefined : row.at(1).value.value,
    });
  }
  return resRows;
}

export interface GetPaymentProfileSuspensionNotifyingTaskMetadataRow {
  paymentProfileSuspensionNotifyingTaskRetryCount?: number,
  paymentProfileSuspensionNotifyingTaskExecutionTimeMs?: number,
}

export let GET_PAYMENT_PROFILE_SUSPENSION_NOTIFYING_TASK_METADATA_ROW: MessageDescriptor<GetPaymentProfileSuspensionNotifyingTaskMetadataRow> = {
  name: 'GetPaymentProfileSuspensionNotifyingTaskMetadataRow',
  fields: [{
    name: 'paymentProfileSuspensionNotifyingTaskRetryCount',
    index: 1,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'paymentProfileSuspensionNotifyingTaskExecutionTimeMs',
    index: 2,
    primitiveType: PrimitiveType.NUMBER,
  }],
};

export async function getPaymentProfileSuspensionNotifyingTaskMetadata(
  runner: Database | Transaction,
  args: {
    paymentProfileSuspensionNotifyingTaskAccountIdEq: string,
    paymentProfileSuspensionNotifyingTaskVersionEq: number,
  }
): Promise<Array<GetPaymentProfileSuspensionNotifyingTaskMetadataRow>> {
  let [rows] = await runner.run({
    sql: "SELECT PaymentProfileSuspensionNotifyingTask.retryCount, PaymentProfileSuspensionNotifyingTask.executionTimeMs FROM PaymentProfileSuspensionNotifyingTask WHERE (PaymentProfileSuspensionNotifyingTask.accountId = @paymentProfileSuspensionNotifyingTaskAccountIdEq AND PaymentProfileSuspensionNotifyingTask.version = @paymentProfileSuspensionNotifyingTaskVersionEq)",
    params: {
      paymentProfileSuspensionNotifyingTaskAccountIdEq: args.paymentProfileSuspensionNotifyingTaskAccountIdEq,
      paymentProfileSuspensionNotifyingTaskVersionEq: Spanner.float(args.paymentProfileSuspensionNotifyingTaskVersionEq),
    },
    types: {
      paymentProfileSuspensionNotifyingTaskAccountIdEq: { type: "string" },
      paymentProfileSuspensionNotifyingTaskVersionEq: { type: "float64" },
    }
  });
  let resRows = new Array<GetPaymentProfileSuspensionNotifyingTaskMetadataRow>();
  for (let row of rows) {
    resRows.push({
      paymentProfileSuspensionNotifyingTaskRetryCount: row.at(0).value == null ? undefined : row.at(0).value.value,
      paymentProfileSuspensionNotifyingTaskExecutionTimeMs: row.at(1).value == null ? undefined : row.at(1).value.valueOf(),
    });
  }
  return resRows;
}

export function updatePaymentProfileSuspensionNotifyingTaskMetadataStatement(
  args: {
    paymentProfileSuspensionNotifyingTaskAccountIdEq: string,
    paymentProfileSuspensionNotifyingTaskVersionEq: number,
    setRetryCount?: number,
    setExecutionTimeMs?: number,
  }
): Statement {
  return {
    sql: "UPDATE PaymentProfileSuspensionNotifyingTask SET retryCount = @setRetryCount, executionTimeMs = @setExecutionTimeMs WHERE (PaymentProfileSuspensionNotifyingTask.accountId = @paymentProfileSuspensionNotifyingTaskAccountIdEq AND PaymentProfileSuspensionNotifyingTask.version = @paymentProfileSuspensionNotifyingTaskVersionEq)",
    params: {
      paymentProfileSuspensionNotifyingTaskAccountIdEq: args.paymentProfileSuspensionNotifyingTaskAccountIdEq,
      paymentProfileSuspensionNotifyingTaskVersionEq: Spanner.float(args.paymentProfileSuspensionNotifyingTaskVersionEq),
      setRetryCount: args.setRetryCount == null ? null : Spanner.float(args.setRetryCount),
      setExecutionTimeMs: args.setExecutionTimeMs == null ? null : new Date(args.setExecutionTimeMs).toISOString(),
    },
    types: {
      paymentProfileSuspensionNotifyingTaskAccountIdEq: { type: "string" },
      paymentProfileSuspensionNotifyingTaskVersionEq: { type: "float64" },
      setRetryCount: { type: "float64" },
      setExecutionTimeMs: { type: "timestamp" },
    }
  };
}

export function insertPaymentProfileStateSyncingTaskStatement(
  args: {
    accountId: string,
    version: number,
    retryCount?: number,
    executionTimeMs?: number,
    createdTimeMs?: number,
  }
): Statement {
  return {
    sql: "INSERT PaymentProfileStateSyncingTask (accountId, version, retryCount, executionTimeMs, createdTimeMs) VALUES (@accountId, @version, @retryCount, @executionTimeMs, @createdTimeMs)",
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

export function deletePaymentProfileStateSyncingTaskStatement(
  args: {
    paymentProfileStateSyncingTaskAccountIdEq: string,
    paymentProfileStateSyncingTaskVersionEq: number,
  }
): Statement {
  return {
    sql: "DELETE PaymentProfileStateSyncingTask WHERE (PaymentProfileStateSyncingTask.accountId = @paymentProfileStateSyncingTaskAccountIdEq AND PaymentProfileStateSyncingTask.version = @paymentProfileStateSyncingTaskVersionEq)",
    params: {
      paymentProfileStateSyncingTaskAccountIdEq: args.paymentProfileStateSyncingTaskAccountIdEq,
      paymentProfileStateSyncingTaskVersionEq: Spanner.float(args.paymentProfileStateSyncingTaskVersionEq),
    },
    types: {
      paymentProfileStateSyncingTaskAccountIdEq: { type: "string" },
      paymentProfileStateSyncingTaskVersionEq: { type: "float64" },
    }
  };
}

export interface GetPaymentProfileStateSyncingTaskRow {
  paymentProfileStateSyncingTaskAccountId?: string,
  paymentProfileStateSyncingTaskVersion?: number,
  paymentProfileStateSyncingTaskRetryCount?: number,
  paymentProfileStateSyncingTaskExecutionTimeMs?: number,
  paymentProfileStateSyncingTaskCreatedTimeMs?: number,
}

export let GET_PAYMENT_PROFILE_STATE_SYNCING_TASK_ROW: MessageDescriptor<GetPaymentProfileStateSyncingTaskRow> = {
  name: 'GetPaymentProfileStateSyncingTaskRow',
  fields: [{
    name: 'paymentProfileStateSyncingTaskAccountId',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'paymentProfileStateSyncingTaskVersion',
    index: 2,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'paymentProfileStateSyncingTaskRetryCount',
    index: 3,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'paymentProfileStateSyncingTaskExecutionTimeMs',
    index: 4,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'paymentProfileStateSyncingTaskCreatedTimeMs',
    index: 5,
    primitiveType: PrimitiveType.NUMBER,
  }],
};

export async function getPaymentProfileStateSyncingTask(
  runner: Database | Transaction,
  args: {
    paymentProfileStateSyncingTaskAccountIdEq: string,
    paymentProfileStateSyncingTaskVersionEq: number,
  }
): Promise<Array<GetPaymentProfileStateSyncingTaskRow>> {
  let [rows] = await runner.run({
    sql: "SELECT PaymentProfileStateSyncingTask.accountId, PaymentProfileStateSyncingTask.version, PaymentProfileStateSyncingTask.retryCount, PaymentProfileStateSyncingTask.executionTimeMs, PaymentProfileStateSyncingTask.createdTimeMs FROM PaymentProfileStateSyncingTask WHERE (PaymentProfileStateSyncingTask.accountId = @paymentProfileStateSyncingTaskAccountIdEq AND PaymentProfileStateSyncingTask.version = @paymentProfileStateSyncingTaskVersionEq)",
    params: {
      paymentProfileStateSyncingTaskAccountIdEq: args.paymentProfileStateSyncingTaskAccountIdEq,
      paymentProfileStateSyncingTaskVersionEq: Spanner.float(args.paymentProfileStateSyncingTaskVersionEq),
    },
    types: {
      paymentProfileStateSyncingTaskAccountIdEq: { type: "string" },
      paymentProfileStateSyncingTaskVersionEq: { type: "float64" },
    }
  });
  let resRows = new Array<GetPaymentProfileStateSyncingTaskRow>();
  for (let row of rows) {
    resRows.push({
      paymentProfileStateSyncingTaskAccountId: row.at(0).value == null ? undefined : row.at(0).value,
      paymentProfileStateSyncingTaskVersion: row.at(1).value == null ? undefined : row.at(1).value.value,
      paymentProfileStateSyncingTaskRetryCount: row.at(2).value == null ? undefined : row.at(2).value.value,
      paymentProfileStateSyncingTaskExecutionTimeMs: row.at(3).value == null ? undefined : row.at(3).value.valueOf(),
      paymentProfileStateSyncingTaskCreatedTimeMs: row.at(4).value == null ? undefined : row.at(4).value.valueOf(),
    });
  }
  return resRows;
}

export interface ListPendingPaymentProfileStateSyncingTasksRow {
  paymentProfileStateSyncingTaskAccountId?: string,
  paymentProfileStateSyncingTaskVersion?: number,
}

export let LIST_PENDING_PAYMENT_PROFILE_STATE_SYNCING_TASKS_ROW: MessageDescriptor<ListPendingPaymentProfileStateSyncingTasksRow> = {
  name: 'ListPendingPaymentProfileStateSyncingTasksRow',
  fields: [{
    name: 'paymentProfileStateSyncingTaskAccountId',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'paymentProfileStateSyncingTaskVersion',
    index: 2,
    primitiveType: PrimitiveType.NUMBER,
  }],
};

export async function listPendingPaymentProfileStateSyncingTasks(
  runner: Database | Transaction,
  args: {
    paymentProfileStateSyncingTaskExecutionTimeMsLe?: number,
  }
): Promise<Array<ListPendingPaymentProfileStateSyncingTasksRow>> {
  let [rows] = await runner.run({
    sql: "SELECT PaymentProfileStateSyncingTask.accountId, PaymentProfileStateSyncingTask.version FROM PaymentProfileStateSyncingTask WHERE PaymentProfileStateSyncingTask.executionTimeMs <= @paymentProfileStateSyncingTaskExecutionTimeMsLe",
    params: {
      paymentProfileStateSyncingTaskExecutionTimeMsLe: args.paymentProfileStateSyncingTaskExecutionTimeMsLe == null ? null : new Date(args.paymentProfileStateSyncingTaskExecutionTimeMsLe).toISOString(),
    },
    types: {
      paymentProfileStateSyncingTaskExecutionTimeMsLe: { type: "timestamp" },
    }
  });
  let resRows = new Array<ListPendingPaymentProfileStateSyncingTasksRow>();
  for (let row of rows) {
    resRows.push({
      paymentProfileStateSyncingTaskAccountId: row.at(0).value == null ? undefined : row.at(0).value,
      paymentProfileStateSyncingTaskVersion: row.at(1).value == null ? undefined : row.at(1).value.value,
    });
  }
  return resRows;
}

export interface GetPaymentProfileStateSyncingTaskMetadataRow {
  paymentProfileStateSyncingTaskRetryCount?: number,
  paymentProfileStateSyncingTaskExecutionTimeMs?: number,
}

export let GET_PAYMENT_PROFILE_STATE_SYNCING_TASK_METADATA_ROW: MessageDescriptor<GetPaymentProfileStateSyncingTaskMetadataRow> = {
  name: 'GetPaymentProfileStateSyncingTaskMetadataRow',
  fields: [{
    name: 'paymentProfileStateSyncingTaskRetryCount',
    index: 1,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'paymentProfileStateSyncingTaskExecutionTimeMs',
    index: 2,
    primitiveType: PrimitiveType.NUMBER,
  }],
};

export async function getPaymentProfileStateSyncingTaskMetadata(
  runner: Database | Transaction,
  args: {
    paymentProfileStateSyncingTaskAccountIdEq: string,
    paymentProfileStateSyncingTaskVersionEq: number,
  }
): Promise<Array<GetPaymentProfileStateSyncingTaskMetadataRow>> {
  let [rows] = await runner.run({
    sql: "SELECT PaymentProfileStateSyncingTask.retryCount, PaymentProfileStateSyncingTask.executionTimeMs FROM PaymentProfileStateSyncingTask WHERE (PaymentProfileStateSyncingTask.accountId = @paymentProfileStateSyncingTaskAccountIdEq AND PaymentProfileStateSyncingTask.version = @paymentProfileStateSyncingTaskVersionEq)",
    params: {
      paymentProfileStateSyncingTaskAccountIdEq: args.paymentProfileStateSyncingTaskAccountIdEq,
      paymentProfileStateSyncingTaskVersionEq: Spanner.float(args.paymentProfileStateSyncingTaskVersionEq),
    },
    types: {
      paymentProfileStateSyncingTaskAccountIdEq: { type: "string" },
      paymentProfileStateSyncingTaskVersionEq: { type: "float64" },
    }
  });
  let resRows = new Array<GetPaymentProfileStateSyncingTaskMetadataRow>();
  for (let row of rows) {
    resRows.push({
      paymentProfileStateSyncingTaskRetryCount: row.at(0).value == null ? undefined : row.at(0).value.value,
      paymentProfileStateSyncingTaskExecutionTimeMs: row.at(1).value == null ? undefined : row.at(1).value.valueOf(),
    });
  }
  return resRows;
}

export function updatePaymentProfileStateSyncingTaskMetadataStatement(
  args: {
    paymentProfileStateSyncingTaskAccountIdEq: string,
    paymentProfileStateSyncingTaskVersionEq: number,
    setRetryCount?: number,
    setExecutionTimeMs?: number,
  }
): Statement {
  return {
    sql: "UPDATE PaymentProfileStateSyncingTask SET retryCount = @setRetryCount, executionTimeMs = @setExecutionTimeMs WHERE (PaymentProfileStateSyncingTask.accountId = @paymentProfileStateSyncingTaskAccountIdEq AND PaymentProfileStateSyncingTask.version = @paymentProfileStateSyncingTaskVersionEq)",
    params: {
      paymentProfileStateSyncingTaskAccountIdEq: args.paymentProfileStateSyncingTaskAccountIdEq,
      paymentProfileStateSyncingTaskVersionEq: Spanner.float(args.paymentProfileStateSyncingTaskVersionEq),
      setRetryCount: args.setRetryCount == null ? null : Spanner.float(args.setRetryCount),
      setExecutionTimeMs: args.setExecutionTimeMs == null ? null : new Date(args.setExecutionTimeMs).toISOString(),
    },
    types: {
      paymentProfileStateSyncingTaskAccountIdEq: { type: "string" },
      paymentProfileStateSyncingTaskVersionEq: { type: "float64" },
      setRetryCount: { type: "float64" },
      setExecutionTimeMs: { type: "timestamp" },
    }
  };
}

export function insertPayoutStripeTransferCreatingTaskStatement(
  args: {
    taskId: string,
    statementId: string,
    retryCount?: number,
    executionTimeMs?: number,
    createdTimeMs?: number,
  }
): Statement {
  return {
    sql: "INSERT PayoutStripeTransferCreatingTask (taskId, statementId, retryCount, executionTimeMs, createdTimeMs) VALUES (@taskId, @statementId, @retryCount, @executionTimeMs, @createdTimeMs)",
    params: {
      taskId: args.taskId,
      statementId: args.statementId,
      retryCount: args.retryCount == null ? null : Spanner.float(args.retryCount),
      executionTimeMs: args.executionTimeMs == null ? null : new Date(args.executionTimeMs).toISOString(),
      createdTimeMs: args.createdTimeMs == null ? null : new Date(args.createdTimeMs).toISOString(),
    },
    types: {
      taskId: { type: "string" },
      statementId: { type: "string" },
      retryCount: { type: "float64" },
      executionTimeMs: { type: "timestamp" },
      createdTimeMs: { type: "timestamp" },
    }
  };
}

export function deletePayoutStripeTransferCreatingTaskStatement(
  args: {
    payoutStripeTransferCreatingTaskTaskIdEq: string,
  }
): Statement {
  return {
    sql: "DELETE PayoutStripeTransferCreatingTask WHERE (PayoutStripeTransferCreatingTask.taskId = @payoutStripeTransferCreatingTaskTaskIdEq)",
    params: {
      payoutStripeTransferCreatingTaskTaskIdEq: args.payoutStripeTransferCreatingTaskTaskIdEq,
    },
    types: {
      payoutStripeTransferCreatingTaskTaskIdEq: { type: "string" },
    }
  };
}

export interface GetPayoutStripeTransferCreatingTaskRow {
  payoutStripeTransferCreatingTaskTaskId?: string,
  payoutStripeTransferCreatingTaskStatementId?: string,
  payoutStripeTransferCreatingTaskRetryCount?: number,
  payoutStripeTransferCreatingTaskExecutionTimeMs?: number,
  payoutStripeTransferCreatingTaskCreatedTimeMs?: number,
}

export let GET_PAYOUT_STRIPE_TRANSFER_CREATING_TASK_ROW: MessageDescriptor<GetPayoutStripeTransferCreatingTaskRow> = {
  name: 'GetPayoutStripeTransferCreatingTaskRow',
  fields: [{
    name: 'payoutStripeTransferCreatingTaskTaskId',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'payoutStripeTransferCreatingTaskStatementId',
    index: 2,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'payoutStripeTransferCreatingTaskRetryCount',
    index: 3,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'payoutStripeTransferCreatingTaskExecutionTimeMs',
    index: 4,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'payoutStripeTransferCreatingTaskCreatedTimeMs',
    index: 5,
    primitiveType: PrimitiveType.NUMBER,
  }],
};

export async function getPayoutStripeTransferCreatingTask(
  runner: Database | Transaction,
  args: {
    payoutStripeTransferCreatingTaskTaskIdEq: string,
  }
): Promise<Array<GetPayoutStripeTransferCreatingTaskRow>> {
  let [rows] = await runner.run({
    sql: "SELECT PayoutStripeTransferCreatingTask.taskId, PayoutStripeTransferCreatingTask.statementId, PayoutStripeTransferCreatingTask.retryCount, PayoutStripeTransferCreatingTask.executionTimeMs, PayoutStripeTransferCreatingTask.createdTimeMs FROM PayoutStripeTransferCreatingTask WHERE (PayoutStripeTransferCreatingTask.taskId = @payoutStripeTransferCreatingTaskTaskIdEq)",
    params: {
      payoutStripeTransferCreatingTaskTaskIdEq: args.payoutStripeTransferCreatingTaskTaskIdEq,
    },
    types: {
      payoutStripeTransferCreatingTaskTaskIdEq: { type: "string" },
    }
  });
  let resRows = new Array<GetPayoutStripeTransferCreatingTaskRow>();
  for (let row of rows) {
    resRows.push({
      payoutStripeTransferCreatingTaskTaskId: row.at(0).value == null ? undefined : row.at(0).value,
      payoutStripeTransferCreatingTaskStatementId: row.at(1).value == null ? undefined : row.at(1).value,
      payoutStripeTransferCreatingTaskRetryCount: row.at(2).value == null ? undefined : row.at(2).value.value,
      payoutStripeTransferCreatingTaskExecutionTimeMs: row.at(3).value == null ? undefined : row.at(3).value.valueOf(),
      payoutStripeTransferCreatingTaskCreatedTimeMs: row.at(4).value == null ? undefined : row.at(4).value.valueOf(),
    });
  }
  return resRows;
}

export interface ListPendingPayoutStripeTransferCreatingTasksRow {
  payoutStripeTransferCreatingTaskTaskId?: string,
  payoutStripeTransferCreatingTaskStatementId?: string,
}

export let LIST_PENDING_PAYOUT_STRIPE_TRANSFER_CREATING_TASKS_ROW: MessageDescriptor<ListPendingPayoutStripeTransferCreatingTasksRow> = {
  name: 'ListPendingPayoutStripeTransferCreatingTasksRow',
  fields: [{
    name: 'payoutStripeTransferCreatingTaskTaskId',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'payoutStripeTransferCreatingTaskStatementId',
    index: 2,
    primitiveType: PrimitiveType.STRING,
  }],
};

export async function listPendingPayoutStripeTransferCreatingTasks(
  runner: Database | Transaction,
  args: {
    payoutStripeTransferCreatingTaskExecutionTimeMsLe?: number,
  }
): Promise<Array<ListPendingPayoutStripeTransferCreatingTasksRow>> {
  let [rows] = await runner.run({
    sql: "SELECT PayoutStripeTransferCreatingTask.taskId, PayoutStripeTransferCreatingTask.statementId FROM PayoutStripeTransferCreatingTask WHERE PayoutStripeTransferCreatingTask.executionTimeMs <= @payoutStripeTransferCreatingTaskExecutionTimeMsLe",
    params: {
      payoutStripeTransferCreatingTaskExecutionTimeMsLe: args.payoutStripeTransferCreatingTaskExecutionTimeMsLe == null ? null : new Date(args.payoutStripeTransferCreatingTaskExecutionTimeMsLe).toISOString(),
    },
    types: {
      payoutStripeTransferCreatingTaskExecutionTimeMsLe: { type: "timestamp" },
    }
  });
  let resRows = new Array<ListPendingPayoutStripeTransferCreatingTasksRow>();
  for (let row of rows) {
    resRows.push({
      payoutStripeTransferCreatingTaskTaskId: row.at(0).value == null ? undefined : row.at(0).value,
      payoutStripeTransferCreatingTaskStatementId: row.at(1).value == null ? undefined : row.at(1).value,
    });
  }
  return resRows;
}

export interface GetPayoutStripeTransferCreatingTaskMetadataRow {
  payoutStripeTransferCreatingTaskRetryCount?: number,
  payoutStripeTransferCreatingTaskExecutionTimeMs?: number,
}

export let GET_PAYOUT_STRIPE_TRANSFER_CREATING_TASK_METADATA_ROW: MessageDescriptor<GetPayoutStripeTransferCreatingTaskMetadataRow> = {
  name: 'GetPayoutStripeTransferCreatingTaskMetadataRow',
  fields: [{
    name: 'payoutStripeTransferCreatingTaskRetryCount',
    index: 1,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'payoutStripeTransferCreatingTaskExecutionTimeMs',
    index: 2,
    primitiveType: PrimitiveType.NUMBER,
  }],
};

export async function getPayoutStripeTransferCreatingTaskMetadata(
  runner: Database | Transaction,
  args: {
    payoutStripeTransferCreatingTaskTaskIdEq: string,
  }
): Promise<Array<GetPayoutStripeTransferCreatingTaskMetadataRow>> {
  let [rows] = await runner.run({
    sql: "SELECT PayoutStripeTransferCreatingTask.retryCount, PayoutStripeTransferCreatingTask.executionTimeMs FROM PayoutStripeTransferCreatingTask WHERE (PayoutStripeTransferCreatingTask.taskId = @payoutStripeTransferCreatingTaskTaskIdEq)",
    params: {
      payoutStripeTransferCreatingTaskTaskIdEq: args.payoutStripeTransferCreatingTaskTaskIdEq,
    },
    types: {
      payoutStripeTransferCreatingTaskTaskIdEq: { type: "string" },
    }
  });
  let resRows = new Array<GetPayoutStripeTransferCreatingTaskMetadataRow>();
  for (let row of rows) {
    resRows.push({
      payoutStripeTransferCreatingTaskRetryCount: row.at(0).value == null ? undefined : row.at(0).value.value,
      payoutStripeTransferCreatingTaskExecutionTimeMs: row.at(1).value == null ? undefined : row.at(1).value.valueOf(),
    });
  }
  return resRows;
}

export function updatePayoutStripeTransferCreatingTaskMetadataStatement(
  args: {
    payoutStripeTransferCreatingTaskTaskIdEq: string,
    setRetryCount?: number,
    setExecutionTimeMs?: number,
  }
): Statement {
  return {
    sql: "UPDATE PayoutStripeTransferCreatingTask SET retryCount = @setRetryCount, executionTimeMs = @setExecutionTimeMs WHERE (PayoutStripeTransferCreatingTask.taskId = @payoutStripeTransferCreatingTaskTaskIdEq)",
    params: {
      payoutStripeTransferCreatingTaskTaskIdEq: args.payoutStripeTransferCreatingTaskTaskIdEq,
      setRetryCount: args.setRetryCount == null ? null : Spanner.float(args.setRetryCount),
      setExecutionTimeMs: args.setExecutionTimeMs == null ? null : new Date(args.setExecutionTimeMs).toISOString(),
    },
    types: {
      payoutStripeTransferCreatingTaskTaskIdEq: { type: "string" },
      setRetryCount: { type: "float64" },
      setExecutionTimeMs: { type: "timestamp" },
    }
  };
}

export function updatePaymentProfileStateStatement(
  args: {
    paymentProfileAccountIdEq: string,
    setStateInfo?: PaymentProfileStateInfo,
  }
): Statement {
  return {
    sql: "UPDATE PaymentProfile SET stateInfo = @setStateInfo WHERE PaymentProfile.accountId = @paymentProfileAccountIdEq",
    params: {
      paymentProfileAccountIdEq: args.paymentProfileAccountIdEq,
      setStateInfo: args.setStateInfo == null ? null : Buffer.from(serializeMessage(args.setStateInfo, PAYMENT_PROFILE_STATE_INFO).buffer),
    },
    types: {
      paymentProfileAccountIdEq: { type: "string" },
      setStateInfo: { type: "bytes" },
    }
  };
}

export function updatePaymentProfilePaymentCustomerStatement(
  args: {
    paymentProfileAccountIdEq: string,
    setStripePaymentCustomerId?: string,
  }
): Statement {
  return {
    sql: "UPDATE PaymentProfile SET stripePaymentCustomerId = @setStripePaymentCustomerId WHERE PaymentProfile.accountId = @paymentProfileAccountIdEq",
    params: {
      paymentProfileAccountIdEq: args.paymentProfileAccountIdEq,
      setStripePaymentCustomerId: args.setStripePaymentCustomerId == null ? null : args.setStripePaymentCustomerId,
    },
    types: {
      paymentProfileAccountIdEq: { type: "string" },
      setStripePaymentCustomerId: { type: "string" },
    }
  };
}

export function updatePaymentProfileInitCreditGrantingStateStatement(
  args: {
    paymentProfileAccountIdEq: string,
    setInitCreditGrantingState?: InitCreditGrantingState,
  }
): Statement {
  return {
    sql: "UPDATE PaymentProfile SET initCreditGrantingState = @setInitCreditGrantingState WHERE PaymentProfile.accountId = @paymentProfileAccountIdEq",
    params: {
      paymentProfileAccountIdEq: args.paymentProfileAccountIdEq,
      setInitCreditGrantingState: args.setInitCreditGrantingState == null ? null : Spanner.float(args.setInitCreditGrantingState),
    },
    types: {
      paymentProfileAccountIdEq: { type: "string" },
      setInitCreditGrantingState: { type: "float64" },
    }
  };
}

export function updatePayoutProfileConnectedAccountStatement(
  args: {
    payoutProfileAccountIdEq: string,
    setStripeConnectedAccountId?: string,
    setStripeConnectedAccountState?: StripeConnectedAccountState,
  }
): Statement {
  return {
    sql: "UPDATE PayoutProfile SET stripeConnectedAccountId = @setStripeConnectedAccountId, stripeConnectedAccountState = @setStripeConnectedAccountState WHERE PayoutProfile.accountId = @payoutProfileAccountIdEq",
    params: {
      payoutProfileAccountIdEq: args.payoutProfileAccountIdEq,
      setStripeConnectedAccountId: args.setStripeConnectedAccountId == null ? null : args.setStripeConnectedAccountId,
      setStripeConnectedAccountState: args.setStripeConnectedAccountState == null ? null : Spanner.float(args.setStripeConnectedAccountState),
    },
    types: {
      payoutProfileAccountIdEq: { type: "string" },
      setStripeConnectedAccountId: { type: "string" },
      setStripeConnectedAccountState: { type: "float64" },
    }
  };
}

export function updatePayoutProfileConnectedAccountStateStatement(
  args: {
    payoutProfileAccountIdEq: string,
    setStripeConnectedAccountState?: StripeConnectedAccountState,
  }
): Statement {
  return {
    sql: "UPDATE PayoutProfile SET stripeConnectedAccountState = @setStripeConnectedAccountState WHERE PayoutProfile.accountId = @payoutProfileAccountIdEq",
    params: {
      payoutProfileAccountIdEq: args.payoutProfileAccountIdEq,
      setStripeConnectedAccountState: args.setStripeConnectedAccountState == null ? null : Spanner.float(args.setStripeConnectedAccountState),
    },
    types: {
      payoutProfileAccountIdEq: { type: "string" },
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
    sql: "UPDATE Payment SET state = @setState, updatedTimeMs = @setUpdatedTimeMs WHERE Payment.statementId = @paymentStatementIdEq",
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
    setUpdatedTimeMs?: number,
  }
): Statement {
  return {
    sql: "UPDATE Payment SET state = @setState, stripeInvoiceId = @setStripeInvoiceId, updatedTimeMs = @setUpdatedTimeMs WHERE Payment.statementId = @paymentStatementIdEq",
    params: {
      paymentStatementIdEq: args.paymentStatementIdEq,
      setState: args.setState == null ? null : Spanner.float(args.setState),
      setStripeInvoiceId: args.setStripeInvoiceId == null ? null : args.setStripeInvoiceId,
      setUpdatedTimeMs: args.setUpdatedTimeMs == null ? null : Spanner.float(args.setUpdatedTimeMs),
    },
    types: {
      paymentStatementIdEq: { type: "string" },
      setState: { type: "float64" },
      setStripeInvoiceId: { type: "string" },
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
    sql: "UPDATE Payout SET state = @setState, updatedTimeMs = @setUpdatedTimeMs WHERE Payout.statementId = @payoutStatementIdEq",
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
    sql: "UPDATE Payout SET state = @setState, stripeTransferId = @setStripeTransferId, updatedTimeMs = @setUpdatedTimeMs WHERE Payout.statementId = @payoutStatementIdEq",
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

export function deletePaymentStripeInvoiceCreatingTaskByStatementStatement(
  args: {
    paymentStripeInvoiceCreatingTaskStatementIdEq: string,
  }
): Statement {
  return {
    sql: "DELETE PaymentStripeInvoiceCreatingTask WHERE PaymentStripeInvoiceCreatingTask.statementId = @paymentStripeInvoiceCreatingTaskStatementIdEq",
    params: {
      paymentStripeInvoiceCreatingTaskStatementIdEq: args.paymentStripeInvoiceCreatingTaskStatementIdEq,
    },
    types: {
      paymentStripeInvoiceCreatingTaskStatementIdEq: { type: "string" },
    }
  };
}

export function deletePaymentStripeInvoicePayingTaskByStatementStatement(
  args: {
    paymentStripeInvoicePayingTaskStatementIdEq: string,
  }
): Statement {
  return {
    sql: "DELETE PaymentStripeInvoicePayingTask WHERE PaymentStripeInvoicePayingTask.statementId = @paymentStripeInvoicePayingTaskStatementIdEq",
    params: {
      paymentStripeInvoicePayingTaskStatementIdEq: args.paymentStripeInvoicePayingTaskStatementIdEq,
    },
    types: {
      paymentStripeInvoicePayingTaskStatementIdEq: { type: "string" },
    }
  };
}

export interface GetPaymentProfileFromStatementRow {
  paymentProfileAccountId?: string,
  paymentProfileStripePaymentCustomerId?: string,
  paymentProfileStateInfo?: PaymentProfileStateInfo,
  paymentProfileInitCreditGrantingState?: InitCreditGrantingState,
  paymentProfileCreatedTimeMs?: number,
}

export let GET_PAYMENT_PROFILE_FROM_STATEMENT_ROW: MessageDescriptor<GetPaymentProfileFromStatementRow> = {
  name: 'GetPaymentProfileFromStatementRow',
  fields: [{
    name: 'paymentProfileAccountId',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'paymentProfileStripePaymentCustomerId',
    index: 2,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'paymentProfileStateInfo',
    index: 3,
    messageType: PAYMENT_PROFILE_STATE_INFO,
  }, {
    name: 'paymentProfileInitCreditGrantingState',
    index: 4,
    enumType: INIT_CREDIT_GRANTING_STATE,
  }, {
    name: 'paymentProfileCreatedTimeMs',
    index: 5,
    primitiveType: PrimitiveType.NUMBER,
  }],
};

export async function getPaymentProfileFromStatement(
  runner: Database | Transaction,
  args: {
    transactionStatementStatementIdEq: string,
  }
): Promise<Array<GetPaymentProfileFromStatementRow>> {
  let [rows] = await runner.run({
    sql: "SELECT b.accountId, b.stripePaymentCustomerId, b.stateInfo, b.initCreditGrantingState, b.createdTimeMs FROM TransactionStatement AS t INNER JOIN PaymentProfile AS b ON t.accountId = b.accountId WHERE (t.statementId = @transactionStatementStatementIdEq)",
    params: {
      transactionStatementStatementIdEq: args.transactionStatementStatementIdEq,
    },
    types: {
      transactionStatementStatementIdEq: { type: "string" },
    }
  });
  let resRows = new Array<GetPaymentProfileFromStatementRow>();
  for (let row of rows) {
    resRows.push({
      paymentProfileAccountId: row.at(0).value == null ? undefined : row.at(0).value,
      paymentProfileStripePaymentCustomerId: row.at(1).value == null ? undefined : row.at(1).value,
      paymentProfileStateInfo: row.at(2).value == null ? undefined : deserializeMessage(row.at(2).value, PAYMENT_PROFILE_STATE_INFO),
      paymentProfileInitCreditGrantingState: row.at(3).value == null ? undefined : toEnumFromNumber(row.at(3).value.value, INIT_CREDIT_GRANTING_STATE),
      paymentProfileCreatedTimeMs: row.at(4).value == null ? undefined : row.at(4).value.value,
    });
  }
  return resRows;
}

export interface GetPayoutProfileFromStatementRow {
  payoutProfileAccountId?: string,
  payoutProfileStripeConnectedAccountId?: string,
  payoutProfileStripeConnectedAccountState?: StripeConnectedAccountState,
  payoutProfileCreatedTimeMs?: number,
}

export let GET_PAYOUT_PROFILE_FROM_STATEMENT_ROW: MessageDescriptor<GetPayoutProfileFromStatementRow> = {
  name: 'GetPayoutProfileFromStatementRow',
  fields: [{
    name: 'payoutProfileAccountId',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'payoutProfileStripeConnectedAccountId',
    index: 2,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'payoutProfileStripeConnectedAccountState',
    index: 3,
    enumType: STRIPE_CONNECTED_ACCOUNT_STATE,
  }, {
    name: 'payoutProfileCreatedTimeMs',
    index: 4,
    primitiveType: PrimitiveType.NUMBER,
  }],
};

export async function getPayoutProfileFromStatement(
  runner: Database | Transaction,
  args: {
    transactionStatementStatementIdEq: string,
  }
): Promise<Array<GetPayoutProfileFromStatementRow>> {
  let [rows] = await runner.run({
    sql: "SELECT e.accountId, e.stripeConnectedAccountId, e.stripeConnectedAccountState, e.createdTimeMs FROM TransactionStatement AS t INNER JOIN PayoutProfile AS e ON t.accountId = e.accountId WHERE (t.statementId = @transactionStatementStatementIdEq)",
    params: {
      transactionStatementStatementIdEq: args.transactionStatementStatementIdEq,
    },
    types: {
      transactionStatementStatementIdEq: { type: "string" },
    }
  });
  let resRows = new Array<GetPayoutProfileFromStatementRow>();
  for (let row of rows) {
    resRows.push({
      payoutProfileAccountId: row.at(0).value == null ? undefined : row.at(0).value,
      payoutProfileStripeConnectedAccountId: row.at(1).value == null ? undefined : row.at(1).value,
      payoutProfileStripeConnectedAccountState: row.at(2).value == null ? undefined : toEnumFromNumber(row.at(2).value.value, STRIPE_CONNECTED_ACCOUNT_STATE),
      payoutProfileCreatedTimeMs: row.at(3).value == null ? undefined : row.at(3).value.value,
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
    name: 'paymentUpdatedTimeMs',
    index: 5,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'paymentCreatedTimeMs',
    index: 6,
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
    sql: "SELECT Payment.statementId, Payment.accountId, Payment.state, Payment.stripeInvoiceId, Payment.updatedTimeMs, Payment.createdTimeMs FROM Payment WHERE (Payment.accountId = @paymentAccountIdEq AND Payment.state = @paymentStateEq) ORDER BY Payment.createdTimeMs DESC",
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
      paymentUpdatedTimeMs: row.at(4).value == null ? undefined : row.at(4).value.value,
      paymentCreatedTimeMs: row.at(5).value == null ? undefined : row.at(5).value.value,
    });
  }
  return resRows;
}

export interface ListPaymentsWithStatementsRow {
  paymentStatementId?: string,
  paymentAccountId?: string,
  paymentState?: PaymentState,
  paymentStripeInvoiceId?: string,
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
    name: 'paymentUpdatedTimeMs',
    index: 5,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'paymentCreatedTimeMs',
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

export async function listPaymentsWithStatements(
  runner: Database | Transaction,
  args: {
    paymentAccountIdEq?: string,
    transactionStatementMonthGe?: string,
    transactionStatementMonthLe?: string,
  }
): Promise<Array<ListPaymentsWithStatementsRow>> {
  let [rows] = await runner.run({
    sql: "SELECT p.statementId, p.accountId, p.state, p.stripeInvoiceId, p.updatedTimeMs, p.createdTimeMs, t.statementId, t.accountId, t.month, t.statement, t.createdTimeMs FROM Payment AS p LEFT JOIN TransactionStatement AS t ON p.statementId = t.statementId WHERE (p.accountId = @paymentAccountIdEq AND t.month >= @transactionStatementMonthGe AND t.month <= @transactionStatementMonthLe) ORDER BY t.month DESC",
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
      paymentUpdatedTimeMs: row.at(4).value == null ? undefined : row.at(4).value.value,
      paymentCreatedTimeMs: row.at(5).value == null ? undefined : row.at(5).value.value,
      transactionStatementStatementId: row.at(6).value == null ? undefined : row.at(6).value,
      transactionStatementAccountId: row.at(7).value == null ? undefined : row.at(7).value,
      transactionStatementMonth: row.at(8).value == null ? undefined : row.at(8).value,
      transactionStatementStatement: row.at(9).value == null ? undefined : deserializeMessage(row.at(9).value, TRANSACTION_STATEMENT),
      transactionStatementCreatedTimeMs: row.at(10).value == null ? undefined : row.at(10).value.value,
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
