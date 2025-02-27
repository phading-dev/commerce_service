import { Statement } from '@google-cloud/spanner/build/src/transaction';
import { BillingAccount, BILLING_ACCOUNT, PaymentState, Billing, BILLING, EarningsAccount, EARNINGS_ACCOUNT, PayoutState, Earnings, EARNINGS } from './schema';
import { serializeMessage, deserializeMessage } from '@selfage/message/serializer';
import { Database, Transaction, Spanner } from '@google-cloud/spanner';
import { MessageDescriptor, PrimitiveType } from '@selfage/message/descriptor';

export function insertBillingAccountStatement(
  data: BillingAccount,
): Statement {
  return insertBillingAccountInternalStatement(
    data.accountId,
    data
  );
}

export function insertBillingAccountInternalStatement(
  accountId: string,
  data: BillingAccount,
): Statement {
  return {
    sql: "INSERT BillingAccount (accountId, data) VALUES (@accountId, @data)",
    params: {
      accountId: accountId,
      data: Buffer.from(serializeMessage(data, BILLING_ACCOUNT).buffer),
    },
    types: {
      accountId: { type: "string" },
      data: { type: "bytes" },
    }
  };
}

export function deleteBillingAccountStatement(
  billingAccountAccountIdEq: string,
): Statement {
  return {
    sql: "DELETE BillingAccount WHERE (BillingAccount.accountId = @billingAccountAccountIdEq)",
    params: {
      billingAccountAccountIdEq: billingAccountAccountIdEq,
    },
    types: {
      billingAccountAccountIdEq: { type: "string" },
    }
  };
}

export interface GetBillingAccountRow {
  billingAccountData: BillingAccount,
}

export let GET_BILLING_ACCOUNT_ROW: MessageDescriptor<GetBillingAccountRow> = {
  name: 'GetBillingAccountRow',
  fields: [{
    name: 'billingAccountData',
    index: 1,
    messageType: BILLING_ACCOUNT,
  }],
};

export async function getBillingAccount(
  runner: Database | Transaction,
  billingAccountAccountIdEq: string,
): Promise<Array<GetBillingAccountRow>> {
  let [rows] = await runner.run({
    sql: "SELECT BillingAccount.data FROM BillingAccount WHERE (BillingAccount.accountId = @billingAccountAccountIdEq)",
    params: {
      billingAccountAccountIdEq: billingAccountAccountIdEq,
    },
    types: {
      billingAccountAccountIdEq: { type: "string" },
    }
  });
  let resRows = new Array<GetBillingAccountRow>();
  for (let row of rows) {
    resRows.push({
      billingAccountData: deserializeMessage(row.at(0).value, BILLING_ACCOUNT),
    });
  }
  return resRows;
}

export function updateBillingAccountStatement(
  data: BillingAccount,
): Statement {
  return updateBillingAccountInternalStatement(
    data.accountId,
    data
  );
}

export function updateBillingAccountInternalStatement(
  billingAccountAccountIdEq: string,
  setData: BillingAccount,
): Statement {
  return {
    sql: "UPDATE BillingAccount SET data = @setData WHERE (BillingAccount.accountId = @billingAccountAccountIdEq)",
    params: {
      billingAccountAccountIdEq: billingAccountAccountIdEq,
      setData: Buffer.from(serializeMessage(setData, BILLING_ACCOUNT).buffer),
    },
    types: {
      billingAccountAccountIdEq: { type: "string" },
      setData: { type: "bytes" },
    }
  };
}

export function insertBillingStatement(
  data: Billing,
): Statement {
  return insertBillingInternalStatement(
    data.billingId,
    data.accountId,
    data.state,
    data.month,
    data
  );
}

export function insertBillingInternalStatement(
  billingId: string,
  accountId: string,
  state: PaymentState,
  month: string,
  data: Billing,
): Statement {
  return {
    sql: "INSERT Billing (billingId, accountId, state, month, data) VALUES (@billingId, @accountId, @state, @month, @data)",
    params: {
      billingId: billingId,
      accountId: accountId,
      state: Spanner.float(state),
      month: month,
      data: Buffer.from(serializeMessage(data, BILLING).buffer),
    },
    types: {
      billingId: { type: "string" },
      accountId: { type: "string" },
      state: { type: "float64" },
      month: { type: "string" },
      data: { type: "bytes" },
    }
  };
}

export function deleteBillingStatement(
  billingBillingIdEq: string,
): Statement {
  return {
    sql: "DELETE Billing WHERE (Billing.billingId = @billingBillingIdEq)",
    params: {
      billingBillingIdEq: billingBillingIdEq,
    },
    types: {
      billingBillingIdEq: { type: "string" },
    }
  };
}

export interface GetBillingRow {
  billingData: Billing,
}

export let GET_BILLING_ROW: MessageDescriptor<GetBillingRow> = {
  name: 'GetBillingRow',
  fields: [{
    name: 'billingData',
    index: 1,
    messageType: BILLING,
  }],
};

export async function getBilling(
  runner: Database | Transaction,
  billingBillingIdEq: string,
): Promise<Array<GetBillingRow>> {
  let [rows] = await runner.run({
    sql: "SELECT Billing.data FROM Billing WHERE (Billing.billingId = @billingBillingIdEq)",
    params: {
      billingBillingIdEq: billingBillingIdEq,
    },
    types: {
      billingBillingIdEq: { type: "string" },
    }
  });
  let resRows = new Array<GetBillingRow>();
  for (let row of rows) {
    resRows.push({
      billingData: deserializeMessage(row.at(0).value, BILLING),
    });
  }
  return resRows;
}

export function updateBillingStatement(
  data: Billing,
): Statement {
  return updateBillingInternalStatement(
    data.billingId,
    data.accountId,
    data.state,
    data.month,
    data
  );
}

export function updateBillingInternalStatement(
  billingBillingIdEq: string,
  setAccountId: string,
  setState: PaymentState,
  setMonth: string,
  setData: Billing,
): Statement {
  return {
    sql: "UPDATE Billing SET accountId = @setAccountId, state = @setState, month = @setMonth, data = @setData WHERE (Billing.billingId = @billingBillingIdEq)",
    params: {
      billingBillingIdEq: billingBillingIdEq,
      setAccountId: setAccountId,
      setState: Spanner.float(setState),
      setMonth: setMonth,
      setData: Buffer.from(serializeMessage(setData, BILLING).buffer),
    },
    types: {
      billingBillingIdEq: { type: "string" },
      setAccountId: { type: "string" },
      setState: { type: "float64" },
      setMonth: { type: "string" },
      setData: { type: "bytes" },
    }
  };
}

export function insertEarningsAccountStatement(
  data: EarningsAccount,
): Statement {
  return insertEarningsAccountInternalStatement(
    data.accountId,
    data
  );
}

export function insertEarningsAccountInternalStatement(
  accountId: string,
  data: EarningsAccount,
): Statement {
  return {
    sql: "INSERT EarningsAccount (accountId, data) VALUES (@accountId, @data)",
    params: {
      accountId: accountId,
      data: Buffer.from(serializeMessage(data, EARNINGS_ACCOUNT).buffer),
    },
    types: {
      accountId: { type: "string" },
      data: { type: "bytes" },
    }
  };
}

export function deleteEarningsAccountStatement(
  earningsAccountAccountIdEq: string,
): Statement {
  return {
    sql: "DELETE EarningsAccount WHERE (EarningsAccount.accountId = @earningsAccountAccountIdEq)",
    params: {
      earningsAccountAccountIdEq: earningsAccountAccountIdEq,
    },
    types: {
      earningsAccountAccountIdEq: { type: "string" },
    }
  };
}

export interface GetEarningsAccountRow {
  earningsAccountData: EarningsAccount,
}

export let GET_EARNINGS_ACCOUNT_ROW: MessageDescriptor<GetEarningsAccountRow> = {
  name: 'GetEarningsAccountRow',
  fields: [{
    name: 'earningsAccountData',
    index: 1,
    messageType: EARNINGS_ACCOUNT,
  }],
};

export async function getEarningsAccount(
  runner: Database | Transaction,
  earningsAccountAccountIdEq: string,
): Promise<Array<GetEarningsAccountRow>> {
  let [rows] = await runner.run({
    sql: "SELECT EarningsAccount.data FROM EarningsAccount WHERE (EarningsAccount.accountId = @earningsAccountAccountIdEq)",
    params: {
      earningsAccountAccountIdEq: earningsAccountAccountIdEq,
    },
    types: {
      earningsAccountAccountIdEq: { type: "string" },
    }
  });
  let resRows = new Array<GetEarningsAccountRow>();
  for (let row of rows) {
    resRows.push({
      earningsAccountData: deserializeMessage(row.at(0).value, EARNINGS_ACCOUNT),
    });
  }
  return resRows;
}

export function updateEarningsAccountStatement(
  data: EarningsAccount,
): Statement {
  return updateEarningsAccountInternalStatement(
    data.accountId,
    data
  );
}

export function updateEarningsAccountInternalStatement(
  earningsAccountAccountIdEq: string,
  setData: EarningsAccount,
): Statement {
  return {
    sql: "UPDATE EarningsAccount SET data = @setData WHERE (EarningsAccount.accountId = @earningsAccountAccountIdEq)",
    params: {
      earningsAccountAccountIdEq: earningsAccountAccountIdEq,
      setData: Buffer.from(serializeMessage(setData, EARNINGS_ACCOUNT).buffer),
    },
    types: {
      earningsAccountAccountIdEq: { type: "string" },
      setData: { type: "bytes" },
    }
  };
}

export function insertEarningsStatement(
  data: Earnings,
): Statement {
  return insertEarningsInternalStatement(
    data.earningsId,
    data.accountId,
    data.state,
    data.month,
    data
  );
}

export function insertEarningsInternalStatement(
  earningsId: string,
  accountId: string,
  state: PayoutState,
  month: string,
  data: Earnings,
): Statement {
  return {
    sql: "INSERT Earnings (earningsId, accountId, state, month, data) VALUES (@earningsId, @accountId, @state, @month, @data)",
    params: {
      earningsId: earningsId,
      accountId: accountId,
      state: Spanner.float(state),
      month: month,
      data: Buffer.from(serializeMessage(data, EARNINGS).buffer),
    },
    types: {
      earningsId: { type: "string" },
      accountId: { type: "string" },
      state: { type: "float64" },
      month: { type: "string" },
      data: { type: "bytes" },
    }
  };
}

export function deleteEarningsStatement(
  earningsEarningsIdEq: string,
): Statement {
  return {
    sql: "DELETE Earnings WHERE (Earnings.earningsId = @earningsEarningsIdEq)",
    params: {
      earningsEarningsIdEq: earningsEarningsIdEq,
    },
    types: {
      earningsEarningsIdEq: { type: "string" },
    }
  };
}

export interface GetEarningsRow {
  earningsData: Earnings,
}

export let GET_EARNINGS_ROW: MessageDescriptor<GetEarningsRow> = {
  name: 'GetEarningsRow',
  fields: [{
    name: 'earningsData',
    index: 1,
    messageType: EARNINGS,
  }],
};

export async function getEarnings(
  runner: Database | Transaction,
  earningsEarningsIdEq: string,
): Promise<Array<GetEarningsRow>> {
  let [rows] = await runner.run({
    sql: "SELECT Earnings.data FROM Earnings WHERE (Earnings.earningsId = @earningsEarningsIdEq)",
    params: {
      earningsEarningsIdEq: earningsEarningsIdEq,
    },
    types: {
      earningsEarningsIdEq: { type: "string" },
    }
  });
  let resRows = new Array<GetEarningsRow>();
  for (let row of rows) {
    resRows.push({
      earningsData: deserializeMessage(row.at(0).value, EARNINGS),
    });
  }
  return resRows;
}

export function updateEarningsStatement(
  data: Earnings,
): Statement {
  return updateEarningsInternalStatement(
    data.earningsId,
    data.accountId,
    data.state,
    data.month,
    data
  );
}

export function updateEarningsInternalStatement(
  earningsEarningsIdEq: string,
  setAccountId: string,
  setState: PayoutState,
  setMonth: string,
  setData: Earnings,
): Statement {
  return {
    sql: "UPDATE Earnings SET accountId = @setAccountId, state = @setState, month = @setMonth, data = @setData WHERE (Earnings.earningsId = @earningsEarningsIdEq)",
    params: {
      earningsEarningsIdEq: earningsEarningsIdEq,
      setAccountId: setAccountId,
      setState: Spanner.float(setState),
      setMonth: setMonth,
      setData: Buffer.from(serializeMessage(setData, EARNINGS).buffer),
    },
    types: {
      earningsEarningsIdEq: { type: "string" },
      setAccountId: { type: "string" },
      setState: { type: "float64" },
      setMonth: { type: "string" },
      setData: { type: "bytes" },
    }
  };
}

export function insertStripeCustomerCreatingTaskStatement(
  accountId: string,
  retryCount: number,
  executionTimeMs: number,
  createdTimeMs: number,
): Statement {
  return {
    sql: "INSERT StripeCustomerCreatingTask (accountId, retryCount, executionTimeMs, createdTimeMs) VALUES (@accountId, @retryCount, @executionTimeMs, @createdTimeMs)",
    params: {
      accountId: accountId,
      retryCount: Spanner.float(retryCount),
      executionTimeMs: new Date(executionTimeMs).toISOString(),
      createdTimeMs: new Date(createdTimeMs).toISOString(),
    },
    types: {
      accountId: { type: "string" },
      retryCount: { type: "float64" },
      executionTimeMs: { type: "timestamp" },
      createdTimeMs: { type: "timestamp" },
    }
  };
}

export function deleteStripeCustomerCreatingTaskStatement(
  stripeCustomerCreatingTaskAccountIdEq: string,
): Statement {
  return {
    sql: "DELETE StripeCustomerCreatingTask WHERE (StripeCustomerCreatingTask.accountId = @stripeCustomerCreatingTaskAccountIdEq)",
    params: {
      stripeCustomerCreatingTaskAccountIdEq: stripeCustomerCreatingTaskAccountIdEq,
    },
    types: {
      stripeCustomerCreatingTaskAccountIdEq: { type: "string" },
    }
  };
}

export interface GetStripeCustomerCreatingTaskRow {
  stripeCustomerCreatingTaskAccountId: string,
  stripeCustomerCreatingTaskRetryCount: number,
  stripeCustomerCreatingTaskExecutionTimeMs: number,
  stripeCustomerCreatingTaskCreatedTimeMs: number,
}

export let GET_STRIPE_CUSTOMER_CREATING_TASK_ROW: MessageDescriptor<GetStripeCustomerCreatingTaskRow> = {
  name: 'GetStripeCustomerCreatingTaskRow',
  fields: [{
    name: 'stripeCustomerCreatingTaskAccountId',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'stripeCustomerCreatingTaskRetryCount',
    index: 2,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'stripeCustomerCreatingTaskExecutionTimeMs',
    index: 3,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'stripeCustomerCreatingTaskCreatedTimeMs',
    index: 4,
    primitiveType: PrimitiveType.NUMBER,
  }],
};

export async function getStripeCustomerCreatingTask(
  runner: Database | Transaction,
  stripeCustomerCreatingTaskAccountIdEq: string,
): Promise<Array<GetStripeCustomerCreatingTaskRow>> {
  let [rows] = await runner.run({
    sql: "SELECT StripeCustomerCreatingTask.accountId, StripeCustomerCreatingTask.retryCount, StripeCustomerCreatingTask.executionTimeMs, StripeCustomerCreatingTask.createdTimeMs FROM StripeCustomerCreatingTask WHERE (StripeCustomerCreatingTask.accountId = @stripeCustomerCreatingTaskAccountIdEq)",
    params: {
      stripeCustomerCreatingTaskAccountIdEq: stripeCustomerCreatingTaskAccountIdEq,
    },
    types: {
      stripeCustomerCreatingTaskAccountIdEq: { type: "string" },
    }
  });
  let resRows = new Array<GetStripeCustomerCreatingTaskRow>();
  for (let row of rows) {
    resRows.push({
      stripeCustomerCreatingTaskAccountId: row.at(0).value,
      stripeCustomerCreatingTaskRetryCount: row.at(1).value.value,
      stripeCustomerCreatingTaskExecutionTimeMs: row.at(2).value.valueOf(),
      stripeCustomerCreatingTaskCreatedTimeMs: row.at(3).value.valueOf(),
    });
  }
  return resRows;
}

export interface ListPendingStripeCustomerCreatingTasksRow {
  stripeCustomerCreatingTaskAccountId: string,
}

export let LIST_PENDING_STRIPE_CUSTOMER_CREATING_TASKS_ROW: MessageDescriptor<ListPendingStripeCustomerCreatingTasksRow> = {
  name: 'ListPendingStripeCustomerCreatingTasksRow',
  fields: [{
    name: 'stripeCustomerCreatingTaskAccountId',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }],
};

export async function listPendingStripeCustomerCreatingTasks(
  runner: Database | Transaction,
  stripeCustomerCreatingTaskExecutionTimeMsLe: number,
): Promise<Array<ListPendingStripeCustomerCreatingTasksRow>> {
  let [rows] = await runner.run({
    sql: "SELECT StripeCustomerCreatingTask.accountId FROM StripeCustomerCreatingTask WHERE StripeCustomerCreatingTask.executionTimeMs <= @stripeCustomerCreatingTaskExecutionTimeMsLe",
    params: {
      stripeCustomerCreatingTaskExecutionTimeMsLe: new Date(stripeCustomerCreatingTaskExecutionTimeMsLe).toISOString(),
    },
    types: {
      stripeCustomerCreatingTaskExecutionTimeMsLe: { type: "timestamp" },
    }
  });
  let resRows = new Array<ListPendingStripeCustomerCreatingTasksRow>();
  for (let row of rows) {
    resRows.push({
      stripeCustomerCreatingTaskAccountId: row.at(0).value,
    });
  }
  return resRows;
}

export interface GetStripeCustomerCreatingTaskMetadataRow {
  stripeCustomerCreatingTaskRetryCount: number,
  stripeCustomerCreatingTaskExecutionTimeMs: number,
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
  stripeCustomerCreatingTaskAccountIdEq: string,
): Promise<Array<GetStripeCustomerCreatingTaskMetadataRow>> {
  let [rows] = await runner.run({
    sql: "SELECT StripeCustomerCreatingTask.retryCount, StripeCustomerCreatingTask.executionTimeMs FROM StripeCustomerCreatingTask WHERE (StripeCustomerCreatingTask.accountId = @stripeCustomerCreatingTaskAccountIdEq)",
    params: {
      stripeCustomerCreatingTaskAccountIdEq: stripeCustomerCreatingTaskAccountIdEq,
    },
    types: {
      stripeCustomerCreatingTaskAccountIdEq: { type: "string" },
    }
  });
  let resRows = new Array<GetStripeCustomerCreatingTaskMetadataRow>();
  for (let row of rows) {
    resRows.push({
      stripeCustomerCreatingTaskRetryCount: row.at(0).value.value,
      stripeCustomerCreatingTaskExecutionTimeMs: row.at(1).value.valueOf(),
    });
  }
  return resRows;
}

export function updateStripeCustomerCreatingTaskMetadataStatement(
  stripeCustomerCreatingTaskAccountIdEq: string,
  setRetryCount: number,
  setExecutionTimeMs: number,
): Statement {
  return {
    sql: "UPDATE StripeCustomerCreatingTask SET retryCount = @setRetryCount, executionTimeMs = @setExecutionTimeMs WHERE (StripeCustomerCreatingTask.accountId = @stripeCustomerCreatingTaskAccountIdEq)",
    params: {
      stripeCustomerCreatingTaskAccountIdEq: stripeCustomerCreatingTaskAccountIdEq,
      setRetryCount: Spanner.float(setRetryCount),
      setExecutionTimeMs: new Date(setExecutionTimeMs).toISOString(),
    },
    types: {
      stripeCustomerCreatingTaskAccountIdEq: { type: "string" },
      setRetryCount: { type: "float64" },
      setExecutionTimeMs: { type: "timestamp" },
    }
  };
}

export function insertPaymentTaskStatement(
  billingId: string,
  retryCount: number,
  executionTimeMs: number,
  createdTimeMs: number,
): Statement {
  return {
    sql: "INSERT PaymentTask (billingId, retryCount, executionTimeMs, createdTimeMs) VALUES (@billingId, @retryCount, @executionTimeMs, @createdTimeMs)",
    params: {
      billingId: billingId,
      retryCount: Spanner.float(retryCount),
      executionTimeMs: new Date(executionTimeMs).toISOString(),
      createdTimeMs: new Date(createdTimeMs).toISOString(),
    },
    types: {
      billingId: { type: "string" },
      retryCount: { type: "float64" },
      executionTimeMs: { type: "timestamp" },
      createdTimeMs: { type: "timestamp" },
    }
  };
}

export function deletePaymentTaskStatement(
  paymentTaskBillingIdEq: string,
): Statement {
  return {
    sql: "DELETE PaymentTask WHERE (PaymentTask.billingId = @paymentTaskBillingIdEq)",
    params: {
      paymentTaskBillingIdEq: paymentTaskBillingIdEq,
    },
    types: {
      paymentTaskBillingIdEq: { type: "string" },
    }
  };
}

export interface GetPaymentTaskRow {
  paymentTaskBillingId: string,
  paymentTaskRetryCount: number,
  paymentTaskExecutionTimeMs: number,
  paymentTaskCreatedTimeMs: number,
}

export let GET_PAYMENT_TASK_ROW: MessageDescriptor<GetPaymentTaskRow> = {
  name: 'GetPaymentTaskRow',
  fields: [{
    name: 'paymentTaskBillingId',
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
  paymentTaskBillingIdEq: string,
): Promise<Array<GetPaymentTaskRow>> {
  let [rows] = await runner.run({
    sql: "SELECT PaymentTask.billingId, PaymentTask.retryCount, PaymentTask.executionTimeMs, PaymentTask.createdTimeMs FROM PaymentTask WHERE (PaymentTask.billingId = @paymentTaskBillingIdEq)",
    params: {
      paymentTaskBillingIdEq: paymentTaskBillingIdEq,
    },
    types: {
      paymentTaskBillingIdEq: { type: "string" },
    }
  });
  let resRows = new Array<GetPaymentTaskRow>();
  for (let row of rows) {
    resRows.push({
      paymentTaskBillingId: row.at(0).value,
      paymentTaskRetryCount: row.at(1).value.value,
      paymentTaskExecutionTimeMs: row.at(2).value.valueOf(),
      paymentTaskCreatedTimeMs: row.at(3).value.valueOf(),
    });
  }
  return resRows;
}

export interface ListPendingPaymentTasksRow {
  paymentTaskBillingId: string,
}

export let LIST_PENDING_PAYMENT_TASKS_ROW: MessageDescriptor<ListPendingPaymentTasksRow> = {
  name: 'ListPendingPaymentTasksRow',
  fields: [{
    name: 'paymentTaskBillingId',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }],
};

export async function listPendingPaymentTasks(
  runner: Database | Transaction,
  paymentTaskExecutionTimeMsLe: number,
): Promise<Array<ListPendingPaymentTasksRow>> {
  let [rows] = await runner.run({
    sql: "SELECT PaymentTask.billingId FROM PaymentTask WHERE PaymentTask.executionTimeMs <= @paymentTaskExecutionTimeMsLe",
    params: {
      paymentTaskExecutionTimeMsLe: new Date(paymentTaskExecutionTimeMsLe).toISOString(),
    },
    types: {
      paymentTaskExecutionTimeMsLe: { type: "timestamp" },
    }
  });
  let resRows = new Array<ListPendingPaymentTasksRow>();
  for (let row of rows) {
    resRows.push({
      paymentTaskBillingId: row.at(0).value,
    });
  }
  return resRows;
}

export interface GetPaymentTaskMetadataRow {
  paymentTaskRetryCount: number,
  paymentTaskExecutionTimeMs: number,
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
  paymentTaskBillingIdEq: string,
): Promise<Array<GetPaymentTaskMetadataRow>> {
  let [rows] = await runner.run({
    sql: "SELECT PaymentTask.retryCount, PaymentTask.executionTimeMs FROM PaymentTask WHERE (PaymentTask.billingId = @paymentTaskBillingIdEq)",
    params: {
      paymentTaskBillingIdEq: paymentTaskBillingIdEq,
    },
    types: {
      paymentTaskBillingIdEq: { type: "string" },
    }
  });
  let resRows = new Array<GetPaymentTaskMetadataRow>();
  for (let row of rows) {
    resRows.push({
      paymentTaskRetryCount: row.at(0).value.value,
      paymentTaskExecutionTimeMs: row.at(1).value.valueOf(),
    });
  }
  return resRows;
}

export function updatePaymentTaskMetadataStatement(
  paymentTaskBillingIdEq: string,
  setRetryCount: number,
  setExecutionTimeMs: number,
): Statement {
  return {
    sql: "UPDATE PaymentTask SET retryCount = @setRetryCount, executionTimeMs = @setExecutionTimeMs WHERE (PaymentTask.billingId = @paymentTaskBillingIdEq)",
    params: {
      paymentTaskBillingIdEq: paymentTaskBillingIdEq,
      setRetryCount: Spanner.float(setRetryCount),
      setExecutionTimeMs: new Date(setExecutionTimeMs).toISOString(),
    },
    types: {
      paymentTaskBillingIdEq: { type: "string" },
      setRetryCount: { type: "float64" },
      setExecutionTimeMs: { type: "timestamp" },
    }
  };
}

export function insertUpdatePaymentMethodNotifyingTaskStatement(
  billingId: string,
  retryCount: number,
  executionTimeMs: number,
  createdTimeMs: number,
): Statement {
  return {
    sql: "INSERT UpdatePaymentMethodNotifyingTask (billingId, retryCount, executionTimeMs, createdTimeMs) VALUES (@billingId, @retryCount, @executionTimeMs, @createdTimeMs)",
    params: {
      billingId: billingId,
      retryCount: Spanner.float(retryCount),
      executionTimeMs: new Date(executionTimeMs).toISOString(),
      createdTimeMs: new Date(createdTimeMs).toISOString(),
    },
    types: {
      billingId: { type: "string" },
      retryCount: { type: "float64" },
      executionTimeMs: { type: "timestamp" },
      createdTimeMs: { type: "timestamp" },
    }
  };
}

export function deleteUpdatePaymentMethodNotifyingTaskStatement(
  updatePaymentMethodNotifyingTaskBillingIdEq: string,
): Statement {
  return {
    sql: "DELETE UpdatePaymentMethodNotifyingTask WHERE (UpdatePaymentMethodNotifyingTask.billingId = @updatePaymentMethodNotifyingTaskBillingIdEq)",
    params: {
      updatePaymentMethodNotifyingTaskBillingIdEq: updatePaymentMethodNotifyingTaskBillingIdEq,
    },
    types: {
      updatePaymentMethodNotifyingTaskBillingIdEq: { type: "string" },
    }
  };
}

export interface GetUpdatePaymentMethodNotifyingTaskRow {
  updatePaymentMethodNotifyingTaskBillingId: string,
  updatePaymentMethodNotifyingTaskRetryCount: number,
  updatePaymentMethodNotifyingTaskExecutionTimeMs: number,
  updatePaymentMethodNotifyingTaskCreatedTimeMs: number,
}

export let GET_UPDATE_PAYMENT_METHOD_NOTIFYING_TASK_ROW: MessageDescriptor<GetUpdatePaymentMethodNotifyingTaskRow> = {
  name: 'GetUpdatePaymentMethodNotifyingTaskRow',
  fields: [{
    name: 'updatePaymentMethodNotifyingTaskBillingId',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'updatePaymentMethodNotifyingTaskRetryCount',
    index: 2,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'updatePaymentMethodNotifyingTaskExecutionTimeMs',
    index: 3,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'updatePaymentMethodNotifyingTaskCreatedTimeMs',
    index: 4,
    primitiveType: PrimitiveType.NUMBER,
  }],
};

export async function getUpdatePaymentMethodNotifyingTask(
  runner: Database | Transaction,
  updatePaymentMethodNotifyingTaskBillingIdEq: string,
): Promise<Array<GetUpdatePaymentMethodNotifyingTaskRow>> {
  let [rows] = await runner.run({
    sql: "SELECT UpdatePaymentMethodNotifyingTask.billingId, UpdatePaymentMethodNotifyingTask.retryCount, UpdatePaymentMethodNotifyingTask.executionTimeMs, UpdatePaymentMethodNotifyingTask.createdTimeMs FROM UpdatePaymentMethodNotifyingTask WHERE (UpdatePaymentMethodNotifyingTask.billingId = @updatePaymentMethodNotifyingTaskBillingIdEq)",
    params: {
      updatePaymentMethodNotifyingTaskBillingIdEq: updatePaymentMethodNotifyingTaskBillingIdEq,
    },
    types: {
      updatePaymentMethodNotifyingTaskBillingIdEq: { type: "string" },
    }
  });
  let resRows = new Array<GetUpdatePaymentMethodNotifyingTaskRow>();
  for (let row of rows) {
    resRows.push({
      updatePaymentMethodNotifyingTaskBillingId: row.at(0).value,
      updatePaymentMethodNotifyingTaskRetryCount: row.at(1).value.value,
      updatePaymentMethodNotifyingTaskExecutionTimeMs: row.at(2).value.valueOf(),
      updatePaymentMethodNotifyingTaskCreatedTimeMs: row.at(3).value.valueOf(),
    });
  }
  return resRows;
}

export interface ListPendingUpdatePaymentMethodNotifyingTasksRow {
  updatePaymentMethodNotifyingTaskBillingId: string,
}

export let LIST_PENDING_UPDATE_PAYMENT_METHOD_NOTIFYING_TASKS_ROW: MessageDescriptor<ListPendingUpdatePaymentMethodNotifyingTasksRow> = {
  name: 'ListPendingUpdatePaymentMethodNotifyingTasksRow',
  fields: [{
    name: 'updatePaymentMethodNotifyingTaskBillingId',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }],
};

export async function listPendingUpdatePaymentMethodNotifyingTasks(
  runner: Database | Transaction,
  updatePaymentMethodNotifyingTaskExecutionTimeMsLe: number,
): Promise<Array<ListPendingUpdatePaymentMethodNotifyingTasksRow>> {
  let [rows] = await runner.run({
    sql: "SELECT UpdatePaymentMethodNotifyingTask.billingId FROM UpdatePaymentMethodNotifyingTask WHERE UpdatePaymentMethodNotifyingTask.executionTimeMs <= @updatePaymentMethodNotifyingTaskExecutionTimeMsLe",
    params: {
      updatePaymentMethodNotifyingTaskExecutionTimeMsLe: new Date(updatePaymentMethodNotifyingTaskExecutionTimeMsLe).toISOString(),
    },
    types: {
      updatePaymentMethodNotifyingTaskExecutionTimeMsLe: { type: "timestamp" },
    }
  });
  let resRows = new Array<ListPendingUpdatePaymentMethodNotifyingTasksRow>();
  for (let row of rows) {
    resRows.push({
      updatePaymentMethodNotifyingTaskBillingId: row.at(0).value,
    });
  }
  return resRows;
}

export interface GetUpdatePaymentMethodNotifyingTaskMetadataRow {
  updatePaymentMethodNotifyingTaskRetryCount: number,
  updatePaymentMethodNotifyingTaskExecutionTimeMs: number,
}

export let GET_UPDATE_PAYMENT_METHOD_NOTIFYING_TASK_METADATA_ROW: MessageDescriptor<GetUpdatePaymentMethodNotifyingTaskMetadataRow> = {
  name: 'GetUpdatePaymentMethodNotifyingTaskMetadataRow',
  fields: [{
    name: 'updatePaymentMethodNotifyingTaskRetryCount',
    index: 1,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'updatePaymentMethodNotifyingTaskExecutionTimeMs',
    index: 2,
    primitiveType: PrimitiveType.NUMBER,
  }],
};

export async function getUpdatePaymentMethodNotifyingTaskMetadata(
  runner: Database | Transaction,
  updatePaymentMethodNotifyingTaskBillingIdEq: string,
): Promise<Array<GetUpdatePaymentMethodNotifyingTaskMetadataRow>> {
  let [rows] = await runner.run({
    sql: "SELECT UpdatePaymentMethodNotifyingTask.retryCount, UpdatePaymentMethodNotifyingTask.executionTimeMs FROM UpdatePaymentMethodNotifyingTask WHERE (UpdatePaymentMethodNotifyingTask.billingId = @updatePaymentMethodNotifyingTaskBillingIdEq)",
    params: {
      updatePaymentMethodNotifyingTaskBillingIdEq: updatePaymentMethodNotifyingTaskBillingIdEq,
    },
    types: {
      updatePaymentMethodNotifyingTaskBillingIdEq: { type: "string" },
    }
  });
  let resRows = new Array<GetUpdatePaymentMethodNotifyingTaskMetadataRow>();
  for (let row of rows) {
    resRows.push({
      updatePaymentMethodNotifyingTaskRetryCount: row.at(0).value.value,
      updatePaymentMethodNotifyingTaskExecutionTimeMs: row.at(1).value.valueOf(),
    });
  }
  return resRows;
}

export function updateUpdatePaymentMethodNotifyingTaskMetadataStatement(
  updatePaymentMethodNotifyingTaskBillingIdEq: string,
  setRetryCount: number,
  setExecutionTimeMs: number,
): Statement {
  return {
    sql: "UPDATE UpdatePaymentMethodNotifyingTask SET retryCount = @setRetryCount, executionTimeMs = @setExecutionTimeMs WHERE (UpdatePaymentMethodNotifyingTask.billingId = @updatePaymentMethodNotifyingTaskBillingIdEq)",
    params: {
      updatePaymentMethodNotifyingTaskBillingIdEq: updatePaymentMethodNotifyingTaskBillingIdEq,
      setRetryCount: Spanner.float(setRetryCount),
      setExecutionTimeMs: new Date(setExecutionTimeMs).toISOString(),
    },
    types: {
      updatePaymentMethodNotifyingTaskBillingIdEq: { type: "string" },
      setRetryCount: { type: "float64" },
      setExecutionTimeMs: { type: "timestamp" },
    }
  };
}

export function insertBillingAccountSuspendingDueToPastDueTaskStatement(
  billingId: string,
  retryCount: number,
  executionTimeMs: number,
  createdTimeMs: number,
): Statement {
  return {
    sql: "INSERT BillingAccountSuspendingDueToPastDueTask (billingId, retryCount, executionTimeMs, createdTimeMs) VALUES (@billingId, @retryCount, @executionTimeMs, @createdTimeMs)",
    params: {
      billingId: billingId,
      retryCount: Spanner.float(retryCount),
      executionTimeMs: new Date(executionTimeMs).toISOString(),
      createdTimeMs: new Date(createdTimeMs).toISOString(),
    },
    types: {
      billingId: { type: "string" },
      retryCount: { type: "float64" },
      executionTimeMs: { type: "timestamp" },
      createdTimeMs: { type: "timestamp" },
    }
  };
}

export function deleteBillingAccountSuspendingDueToPastDueTaskStatement(
  billingAccountSuspendingDueToPastDueTaskBillingIdEq: string,
): Statement {
  return {
    sql: "DELETE BillingAccountSuspendingDueToPastDueTask WHERE (BillingAccountSuspendingDueToPastDueTask.billingId = @billingAccountSuspendingDueToPastDueTaskBillingIdEq)",
    params: {
      billingAccountSuspendingDueToPastDueTaskBillingIdEq: billingAccountSuspendingDueToPastDueTaskBillingIdEq,
    },
    types: {
      billingAccountSuspendingDueToPastDueTaskBillingIdEq: { type: "string" },
    }
  };
}

export interface GetBillingAccountSuspendingDueToPastDueTaskRow {
  billingAccountSuspendingDueToPastDueTaskBillingId: string,
  billingAccountSuspendingDueToPastDueTaskRetryCount: number,
  billingAccountSuspendingDueToPastDueTaskExecutionTimeMs: number,
  billingAccountSuspendingDueToPastDueTaskCreatedTimeMs: number,
}

export let GET_BILLING_ACCOUNT_SUSPENDING_DUE_TO_PAST_DUE_TASK_ROW: MessageDescriptor<GetBillingAccountSuspendingDueToPastDueTaskRow> = {
  name: 'GetBillingAccountSuspendingDueToPastDueTaskRow',
  fields: [{
    name: 'billingAccountSuspendingDueToPastDueTaskBillingId',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'billingAccountSuspendingDueToPastDueTaskRetryCount',
    index: 2,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'billingAccountSuspendingDueToPastDueTaskExecutionTimeMs',
    index: 3,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'billingAccountSuspendingDueToPastDueTaskCreatedTimeMs',
    index: 4,
    primitiveType: PrimitiveType.NUMBER,
  }],
};

export async function getBillingAccountSuspendingDueToPastDueTask(
  runner: Database | Transaction,
  billingAccountSuspendingDueToPastDueTaskBillingIdEq: string,
): Promise<Array<GetBillingAccountSuspendingDueToPastDueTaskRow>> {
  let [rows] = await runner.run({
    sql: "SELECT BillingAccountSuspendingDueToPastDueTask.billingId, BillingAccountSuspendingDueToPastDueTask.retryCount, BillingAccountSuspendingDueToPastDueTask.executionTimeMs, BillingAccountSuspendingDueToPastDueTask.createdTimeMs FROM BillingAccountSuspendingDueToPastDueTask WHERE (BillingAccountSuspendingDueToPastDueTask.billingId = @billingAccountSuspendingDueToPastDueTaskBillingIdEq)",
    params: {
      billingAccountSuspendingDueToPastDueTaskBillingIdEq: billingAccountSuspendingDueToPastDueTaskBillingIdEq,
    },
    types: {
      billingAccountSuspendingDueToPastDueTaskBillingIdEq: { type: "string" },
    }
  });
  let resRows = new Array<GetBillingAccountSuspendingDueToPastDueTaskRow>();
  for (let row of rows) {
    resRows.push({
      billingAccountSuspendingDueToPastDueTaskBillingId: row.at(0).value,
      billingAccountSuspendingDueToPastDueTaskRetryCount: row.at(1).value.value,
      billingAccountSuspendingDueToPastDueTaskExecutionTimeMs: row.at(2).value.valueOf(),
      billingAccountSuspendingDueToPastDueTaskCreatedTimeMs: row.at(3).value.valueOf(),
    });
  }
  return resRows;
}

export interface ListPendingBillingAccountSuspendingDueToPastDueTasksRow {
  billingAccountSuspendingDueToPastDueTaskBillingId: string,
}

export let LIST_PENDING_BILLING_ACCOUNT_SUSPENDING_DUE_TO_PAST_DUE_TASKS_ROW: MessageDescriptor<ListPendingBillingAccountSuspendingDueToPastDueTasksRow> = {
  name: 'ListPendingBillingAccountSuspendingDueToPastDueTasksRow',
  fields: [{
    name: 'billingAccountSuspendingDueToPastDueTaskBillingId',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }],
};

export async function listPendingBillingAccountSuspendingDueToPastDueTasks(
  runner: Database | Transaction,
  billingAccountSuspendingDueToPastDueTaskExecutionTimeMsLe: number,
): Promise<Array<ListPendingBillingAccountSuspendingDueToPastDueTasksRow>> {
  let [rows] = await runner.run({
    sql: "SELECT BillingAccountSuspendingDueToPastDueTask.billingId FROM BillingAccountSuspendingDueToPastDueTask WHERE BillingAccountSuspendingDueToPastDueTask.executionTimeMs <= @billingAccountSuspendingDueToPastDueTaskExecutionTimeMsLe",
    params: {
      billingAccountSuspendingDueToPastDueTaskExecutionTimeMsLe: new Date(billingAccountSuspendingDueToPastDueTaskExecutionTimeMsLe).toISOString(),
    },
    types: {
      billingAccountSuspendingDueToPastDueTaskExecutionTimeMsLe: { type: "timestamp" },
    }
  });
  let resRows = new Array<ListPendingBillingAccountSuspendingDueToPastDueTasksRow>();
  for (let row of rows) {
    resRows.push({
      billingAccountSuspendingDueToPastDueTaskBillingId: row.at(0).value,
    });
  }
  return resRows;
}

export interface GetBillingAccountSuspendingDueToPastDueTaskMetadataRow {
  billingAccountSuspendingDueToPastDueTaskRetryCount: number,
  billingAccountSuspendingDueToPastDueTaskExecutionTimeMs: number,
}

export let GET_BILLING_ACCOUNT_SUSPENDING_DUE_TO_PAST_DUE_TASK_METADATA_ROW: MessageDescriptor<GetBillingAccountSuspendingDueToPastDueTaskMetadataRow> = {
  name: 'GetBillingAccountSuspendingDueToPastDueTaskMetadataRow',
  fields: [{
    name: 'billingAccountSuspendingDueToPastDueTaskRetryCount',
    index: 1,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'billingAccountSuspendingDueToPastDueTaskExecutionTimeMs',
    index: 2,
    primitiveType: PrimitiveType.NUMBER,
  }],
};

export async function getBillingAccountSuspendingDueToPastDueTaskMetadata(
  runner: Database | Transaction,
  billingAccountSuspendingDueToPastDueTaskBillingIdEq: string,
): Promise<Array<GetBillingAccountSuspendingDueToPastDueTaskMetadataRow>> {
  let [rows] = await runner.run({
    sql: "SELECT BillingAccountSuspendingDueToPastDueTask.retryCount, BillingAccountSuspendingDueToPastDueTask.executionTimeMs FROM BillingAccountSuspendingDueToPastDueTask WHERE (BillingAccountSuspendingDueToPastDueTask.billingId = @billingAccountSuspendingDueToPastDueTaskBillingIdEq)",
    params: {
      billingAccountSuspendingDueToPastDueTaskBillingIdEq: billingAccountSuspendingDueToPastDueTaskBillingIdEq,
    },
    types: {
      billingAccountSuspendingDueToPastDueTaskBillingIdEq: { type: "string" },
    }
  });
  let resRows = new Array<GetBillingAccountSuspendingDueToPastDueTaskMetadataRow>();
  for (let row of rows) {
    resRows.push({
      billingAccountSuspendingDueToPastDueTaskRetryCount: row.at(0).value.value,
      billingAccountSuspendingDueToPastDueTaskExecutionTimeMs: row.at(1).value.valueOf(),
    });
  }
  return resRows;
}

export function updateBillingAccountSuspendingDueToPastDueTaskMetadataStatement(
  billingAccountSuspendingDueToPastDueTaskBillingIdEq: string,
  setRetryCount: number,
  setExecutionTimeMs: number,
): Statement {
  return {
    sql: "UPDATE BillingAccountSuspendingDueToPastDueTask SET retryCount = @setRetryCount, executionTimeMs = @setExecutionTimeMs WHERE (BillingAccountSuspendingDueToPastDueTask.billingId = @billingAccountSuspendingDueToPastDueTaskBillingIdEq)",
    params: {
      billingAccountSuspendingDueToPastDueTaskBillingIdEq: billingAccountSuspendingDueToPastDueTaskBillingIdEq,
      setRetryCount: Spanner.float(setRetryCount),
      setExecutionTimeMs: new Date(setExecutionTimeMs).toISOString(),
    },
    types: {
      billingAccountSuspendingDueToPastDueTaskBillingIdEq: { type: "string" },
      setRetryCount: { type: "float64" },
      setExecutionTimeMs: { type: "timestamp" },
    }
  };
}

export function insertBillingAccountSuspensionNotifyingTaskStatement(
  accountId: string,
  version: number,
  retryCount: number,
  executionTimeMs: number,
  createdTimeMs: number,
): Statement {
  return {
    sql: "INSERT BillingAccountSuspensionNotifyingTask (accountId, version, retryCount, executionTimeMs, createdTimeMs) VALUES (@accountId, @version, @retryCount, @executionTimeMs, @createdTimeMs)",
    params: {
      accountId: accountId,
      version: Spanner.float(version),
      retryCount: Spanner.float(retryCount),
      executionTimeMs: new Date(executionTimeMs).toISOString(),
      createdTimeMs: new Date(createdTimeMs).toISOString(),
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

export function deleteBillingAccountSuspensionNotifyingTaskStatement(
  billingAccountSuspensionNotifyingTaskAccountIdEq: string,
  billingAccountSuspensionNotifyingTaskVersionEq: number,
): Statement {
  return {
    sql: "DELETE BillingAccountSuspensionNotifyingTask WHERE (BillingAccountSuspensionNotifyingTask.accountId = @billingAccountSuspensionNotifyingTaskAccountIdEq AND BillingAccountSuspensionNotifyingTask.version = @billingAccountSuspensionNotifyingTaskVersionEq)",
    params: {
      billingAccountSuspensionNotifyingTaskAccountIdEq: billingAccountSuspensionNotifyingTaskAccountIdEq,
      billingAccountSuspensionNotifyingTaskVersionEq: Spanner.float(billingAccountSuspensionNotifyingTaskVersionEq),
    },
    types: {
      billingAccountSuspensionNotifyingTaskAccountIdEq: { type: "string" },
      billingAccountSuspensionNotifyingTaskVersionEq: { type: "float64" },
    }
  };
}

export interface GetBillingAccountSuspensionNotifyingTaskRow {
  billingAccountSuspensionNotifyingTaskAccountId: string,
  billingAccountSuspensionNotifyingTaskVersion: number,
  billingAccountSuspensionNotifyingTaskRetryCount: number,
  billingAccountSuspensionNotifyingTaskExecutionTimeMs: number,
  billingAccountSuspensionNotifyingTaskCreatedTimeMs: number,
}

export let GET_BILLING_ACCOUNT_SUSPENSION_NOTIFYING_TASK_ROW: MessageDescriptor<GetBillingAccountSuspensionNotifyingTaskRow> = {
  name: 'GetBillingAccountSuspensionNotifyingTaskRow',
  fields: [{
    name: 'billingAccountSuspensionNotifyingTaskAccountId',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'billingAccountSuspensionNotifyingTaskVersion',
    index: 2,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'billingAccountSuspensionNotifyingTaskRetryCount',
    index: 3,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'billingAccountSuspensionNotifyingTaskExecutionTimeMs',
    index: 4,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'billingAccountSuspensionNotifyingTaskCreatedTimeMs',
    index: 5,
    primitiveType: PrimitiveType.NUMBER,
  }],
};

export async function getBillingAccountSuspensionNotifyingTask(
  runner: Database | Transaction,
  billingAccountSuspensionNotifyingTaskAccountIdEq: string,
  billingAccountSuspensionNotifyingTaskVersionEq: number,
): Promise<Array<GetBillingAccountSuspensionNotifyingTaskRow>> {
  let [rows] = await runner.run({
    sql: "SELECT BillingAccountSuspensionNotifyingTask.accountId, BillingAccountSuspensionNotifyingTask.version, BillingAccountSuspensionNotifyingTask.retryCount, BillingAccountSuspensionNotifyingTask.executionTimeMs, BillingAccountSuspensionNotifyingTask.createdTimeMs FROM BillingAccountSuspensionNotifyingTask WHERE (BillingAccountSuspensionNotifyingTask.accountId = @billingAccountSuspensionNotifyingTaskAccountIdEq AND BillingAccountSuspensionNotifyingTask.version = @billingAccountSuspensionNotifyingTaskVersionEq)",
    params: {
      billingAccountSuspensionNotifyingTaskAccountIdEq: billingAccountSuspensionNotifyingTaskAccountIdEq,
      billingAccountSuspensionNotifyingTaskVersionEq: Spanner.float(billingAccountSuspensionNotifyingTaskVersionEq),
    },
    types: {
      billingAccountSuspensionNotifyingTaskAccountIdEq: { type: "string" },
      billingAccountSuspensionNotifyingTaskVersionEq: { type: "float64" },
    }
  });
  let resRows = new Array<GetBillingAccountSuspensionNotifyingTaskRow>();
  for (let row of rows) {
    resRows.push({
      billingAccountSuspensionNotifyingTaskAccountId: row.at(0).value,
      billingAccountSuspensionNotifyingTaskVersion: row.at(1).value.value,
      billingAccountSuspensionNotifyingTaskRetryCount: row.at(2).value.value,
      billingAccountSuspensionNotifyingTaskExecutionTimeMs: row.at(3).value.valueOf(),
      billingAccountSuspensionNotifyingTaskCreatedTimeMs: row.at(4).value.valueOf(),
    });
  }
  return resRows;
}

export interface ListPendingBillingAccountSuspensionNotifyingTasksRow {
  billingAccountSuspensionNotifyingTaskAccountId: string,
  billingAccountSuspensionNotifyingTaskVersion: number,
}

export let LIST_PENDING_BILLING_ACCOUNT_SUSPENSION_NOTIFYING_TASKS_ROW: MessageDescriptor<ListPendingBillingAccountSuspensionNotifyingTasksRow> = {
  name: 'ListPendingBillingAccountSuspensionNotifyingTasksRow',
  fields: [{
    name: 'billingAccountSuspensionNotifyingTaskAccountId',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'billingAccountSuspensionNotifyingTaskVersion',
    index: 2,
    primitiveType: PrimitiveType.NUMBER,
  }],
};

export async function listPendingBillingAccountSuspensionNotifyingTasks(
  runner: Database | Transaction,
  billingAccountSuspensionNotifyingTaskExecutionTimeMsLe: number,
): Promise<Array<ListPendingBillingAccountSuspensionNotifyingTasksRow>> {
  let [rows] = await runner.run({
    sql: "SELECT BillingAccountSuspensionNotifyingTask.accountId, BillingAccountSuspensionNotifyingTask.version FROM BillingAccountSuspensionNotifyingTask WHERE BillingAccountSuspensionNotifyingTask.executionTimeMs <= @billingAccountSuspensionNotifyingTaskExecutionTimeMsLe",
    params: {
      billingAccountSuspensionNotifyingTaskExecutionTimeMsLe: new Date(billingAccountSuspensionNotifyingTaskExecutionTimeMsLe).toISOString(),
    },
    types: {
      billingAccountSuspensionNotifyingTaskExecutionTimeMsLe: { type: "timestamp" },
    }
  });
  let resRows = new Array<ListPendingBillingAccountSuspensionNotifyingTasksRow>();
  for (let row of rows) {
    resRows.push({
      billingAccountSuspensionNotifyingTaskAccountId: row.at(0).value,
      billingAccountSuspensionNotifyingTaskVersion: row.at(1).value.value,
    });
  }
  return resRows;
}

export interface GetBillingAccountSuspensionNotifyingTaskMetadataRow {
  billingAccountSuspensionNotifyingTaskRetryCount: number,
  billingAccountSuspensionNotifyingTaskExecutionTimeMs: number,
}

export let GET_BILLING_ACCOUNT_SUSPENSION_NOTIFYING_TASK_METADATA_ROW: MessageDescriptor<GetBillingAccountSuspensionNotifyingTaskMetadataRow> = {
  name: 'GetBillingAccountSuspensionNotifyingTaskMetadataRow',
  fields: [{
    name: 'billingAccountSuspensionNotifyingTaskRetryCount',
    index: 1,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'billingAccountSuspensionNotifyingTaskExecutionTimeMs',
    index: 2,
    primitiveType: PrimitiveType.NUMBER,
  }],
};

export async function getBillingAccountSuspensionNotifyingTaskMetadata(
  runner: Database | Transaction,
  billingAccountSuspensionNotifyingTaskAccountIdEq: string,
  billingAccountSuspensionNotifyingTaskVersionEq: number,
): Promise<Array<GetBillingAccountSuspensionNotifyingTaskMetadataRow>> {
  let [rows] = await runner.run({
    sql: "SELECT BillingAccountSuspensionNotifyingTask.retryCount, BillingAccountSuspensionNotifyingTask.executionTimeMs FROM BillingAccountSuspensionNotifyingTask WHERE (BillingAccountSuspensionNotifyingTask.accountId = @billingAccountSuspensionNotifyingTaskAccountIdEq AND BillingAccountSuspensionNotifyingTask.version = @billingAccountSuspensionNotifyingTaskVersionEq)",
    params: {
      billingAccountSuspensionNotifyingTaskAccountIdEq: billingAccountSuspensionNotifyingTaskAccountIdEq,
      billingAccountSuspensionNotifyingTaskVersionEq: Spanner.float(billingAccountSuspensionNotifyingTaskVersionEq),
    },
    types: {
      billingAccountSuspensionNotifyingTaskAccountIdEq: { type: "string" },
      billingAccountSuspensionNotifyingTaskVersionEq: { type: "float64" },
    }
  });
  let resRows = new Array<GetBillingAccountSuspensionNotifyingTaskMetadataRow>();
  for (let row of rows) {
    resRows.push({
      billingAccountSuspensionNotifyingTaskRetryCount: row.at(0).value.value,
      billingAccountSuspensionNotifyingTaskExecutionTimeMs: row.at(1).value.valueOf(),
    });
  }
  return resRows;
}

export function updateBillingAccountSuspensionNotifyingTaskMetadataStatement(
  billingAccountSuspensionNotifyingTaskAccountIdEq: string,
  billingAccountSuspensionNotifyingTaskVersionEq: number,
  setRetryCount: number,
  setExecutionTimeMs: number,
): Statement {
  return {
    sql: "UPDATE BillingAccountSuspensionNotifyingTask SET retryCount = @setRetryCount, executionTimeMs = @setExecutionTimeMs WHERE (BillingAccountSuspensionNotifyingTask.accountId = @billingAccountSuspensionNotifyingTaskAccountIdEq AND BillingAccountSuspensionNotifyingTask.version = @billingAccountSuspensionNotifyingTaskVersionEq)",
    params: {
      billingAccountSuspensionNotifyingTaskAccountIdEq: billingAccountSuspensionNotifyingTaskAccountIdEq,
      billingAccountSuspensionNotifyingTaskVersionEq: Spanner.float(billingAccountSuspensionNotifyingTaskVersionEq),
      setRetryCount: Spanner.float(setRetryCount),
      setExecutionTimeMs: new Date(setExecutionTimeMs).toISOString(),
    },
    types: {
      billingAccountSuspensionNotifyingTaskAccountIdEq: { type: "string" },
      billingAccountSuspensionNotifyingTaskVersionEq: { type: "float64" },
      setRetryCount: { type: "float64" },
      setExecutionTimeMs: { type: "timestamp" },
    }
  };
}

export function insertBillingAccountStateSyncingTaskStatement(
  accountId: string,
  version: number,
  retryCount: number,
  executionTimeMs: number,
  createdTimeMs: number,
): Statement {
  return {
    sql: "INSERT BillingAccountStateSyncingTask (accountId, version, retryCount, executionTimeMs, createdTimeMs) VALUES (@accountId, @version, @retryCount, @executionTimeMs, @createdTimeMs)",
    params: {
      accountId: accountId,
      version: Spanner.float(version),
      retryCount: Spanner.float(retryCount),
      executionTimeMs: new Date(executionTimeMs).toISOString(),
      createdTimeMs: new Date(createdTimeMs).toISOString(),
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

export function deleteBillingAccountStateSyncingTaskStatement(
  billingAccountStateSyncingTaskAccountIdEq: string,
  billingAccountStateSyncingTaskVersionEq: number,
): Statement {
  return {
    sql: "DELETE BillingAccountStateSyncingTask WHERE (BillingAccountStateSyncingTask.accountId = @billingAccountStateSyncingTaskAccountIdEq AND BillingAccountStateSyncingTask.version = @billingAccountStateSyncingTaskVersionEq)",
    params: {
      billingAccountStateSyncingTaskAccountIdEq: billingAccountStateSyncingTaskAccountIdEq,
      billingAccountStateSyncingTaskVersionEq: Spanner.float(billingAccountStateSyncingTaskVersionEq),
    },
    types: {
      billingAccountStateSyncingTaskAccountIdEq: { type: "string" },
      billingAccountStateSyncingTaskVersionEq: { type: "float64" },
    }
  };
}

export interface GetBillingAccountStateSyncingTaskRow {
  billingAccountStateSyncingTaskAccountId: string,
  billingAccountStateSyncingTaskVersion: number,
  billingAccountStateSyncingTaskRetryCount: number,
  billingAccountStateSyncingTaskExecutionTimeMs: number,
  billingAccountStateSyncingTaskCreatedTimeMs: number,
}

export let GET_BILLING_ACCOUNT_STATE_SYNCING_TASK_ROW: MessageDescriptor<GetBillingAccountStateSyncingTaskRow> = {
  name: 'GetBillingAccountStateSyncingTaskRow',
  fields: [{
    name: 'billingAccountStateSyncingTaskAccountId',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'billingAccountStateSyncingTaskVersion',
    index: 2,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'billingAccountStateSyncingTaskRetryCount',
    index: 3,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'billingAccountStateSyncingTaskExecutionTimeMs',
    index: 4,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'billingAccountStateSyncingTaskCreatedTimeMs',
    index: 5,
    primitiveType: PrimitiveType.NUMBER,
  }],
};

export async function getBillingAccountStateSyncingTask(
  runner: Database | Transaction,
  billingAccountStateSyncingTaskAccountIdEq: string,
  billingAccountStateSyncingTaskVersionEq: number,
): Promise<Array<GetBillingAccountStateSyncingTaskRow>> {
  let [rows] = await runner.run({
    sql: "SELECT BillingAccountStateSyncingTask.accountId, BillingAccountStateSyncingTask.version, BillingAccountStateSyncingTask.retryCount, BillingAccountStateSyncingTask.executionTimeMs, BillingAccountStateSyncingTask.createdTimeMs FROM BillingAccountStateSyncingTask WHERE (BillingAccountStateSyncingTask.accountId = @billingAccountStateSyncingTaskAccountIdEq AND BillingAccountStateSyncingTask.version = @billingAccountStateSyncingTaskVersionEq)",
    params: {
      billingAccountStateSyncingTaskAccountIdEq: billingAccountStateSyncingTaskAccountIdEq,
      billingAccountStateSyncingTaskVersionEq: Spanner.float(billingAccountStateSyncingTaskVersionEq),
    },
    types: {
      billingAccountStateSyncingTaskAccountIdEq: { type: "string" },
      billingAccountStateSyncingTaskVersionEq: { type: "float64" },
    }
  });
  let resRows = new Array<GetBillingAccountStateSyncingTaskRow>();
  for (let row of rows) {
    resRows.push({
      billingAccountStateSyncingTaskAccountId: row.at(0).value,
      billingAccountStateSyncingTaskVersion: row.at(1).value.value,
      billingAccountStateSyncingTaskRetryCount: row.at(2).value.value,
      billingAccountStateSyncingTaskExecutionTimeMs: row.at(3).value.valueOf(),
      billingAccountStateSyncingTaskCreatedTimeMs: row.at(4).value.valueOf(),
    });
  }
  return resRows;
}

export interface ListPendingBillingAccountStateSyncingTasksRow {
  billingAccountStateSyncingTaskAccountId: string,
  billingAccountStateSyncingTaskVersion: number,
}

export let LIST_PENDING_BILLING_ACCOUNT_STATE_SYNCING_TASKS_ROW: MessageDescriptor<ListPendingBillingAccountStateSyncingTasksRow> = {
  name: 'ListPendingBillingAccountStateSyncingTasksRow',
  fields: [{
    name: 'billingAccountStateSyncingTaskAccountId',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'billingAccountStateSyncingTaskVersion',
    index: 2,
    primitiveType: PrimitiveType.NUMBER,
  }],
};

export async function listPendingBillingAccountStateSyncingTasks(
  runner: Database | Transaction,
  billingAccountStateSyncingTaskExecutionTimeMsLe: number,
): Promise<Array<ListPendingBillingAccountStateSyncingTasksRow>> {
  let [rows] = await runner.run({
    sql: "SELECT BillingAccountStateSyncingTask.accountId, BillingAccountStateSyncingTask.version FROM BillingAccountStateSyncingTask WHERE BillingAccountStateSyncingTask.executionTimeMs <= @billingAccountStateSyncingTaskExecutionTimeMsLe",
    params: {
      billingAccountStateSyncingTaskExecutionTimeMsLe: new Date(billingAccountStateSyncingTaskExecutionTimeMsLe).toISOString(),
    },
    types: {
      billingAccountStateSyncingTaskExecutionTimeMsLe: { type: "timestamp" },
    }
  });
  let resRows = new Array<ListPendingBillingAccountStateSyncingTasksRow>();
  for (let row of rows) {
    resRows.push({
      billingAccountStateSyncingTaskAccountId: row.at(0).value,
      billingAccountStateSyncingTaskVersion: row.at(1).value.value,
    });
  }
  return resRows;
}

export interface GetBillingAccountStateSyncingTaskMetadataRow {
  billingAccountStateSyncingTaskRetryCount: number,
  billingAccountStateSyncingTaskExecutionTimeMs: number,
}

export let GET_BILLING_ACCOUNT_STATE_SYNCING_TASK_METADATA_ROW: MessageDescriptor<GetBillingAccountStateSyncingTaskMetadataRow> = {
  name: 'GetBillingAccountStateSyncingTaskMetadataRow',
  fields: [{
    name: 'billingAccountStateSyncingTaskRetryCount',
    index: 1,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'billingAccountStateSyncingTaskExecutionTimeMs',
    index: 2,
    primitiveType: PrimitiveType.NUMBER,
  }],
};

export async function getBillingAccountStateSyncingTaskMetadata(
  runner: Database | Transaction,
  billingAccountStateSyncingTaskAccountIdEq: string,
  billingAccountStateSyncingTaskVersionEq: number,
): Promise<Array<GetBillingAccountStateSyncingTaskMetadataRow>> {
  let [rows] = await runner.run({
    sql: "SELECT BillingAccountStateSyncingTask.retryCount, BillingAccountStateSyncingTask.executionTimeMs FROM BillingAccountStateSyncingTask WHERE (BillingAccountStateSyncingTask.accountId = @billingAccountStateSyncingTaskAccountIdEq AND BillingAccountStateSyncingTask.version = @billingAccountStateSyncingTaskVersionEq)",
    params: {
      billingAccountStateSyncingTaskAccountIdEq: billingAccountStateSyncingTaskAccountIdEq,
      billingAccountStateSyncingTaskVersionEq: Spanner.float(billingAccountStateSyncingTaskVersionEq),
    },
    types: {
      billingAccountStateSyncingTaskAccountIdEq: { type: "string" },
      billingAccountStateSyncingTaskVersionEq: { type: "float64" },
    }
  });
  let resRows = new Array<GetBillingAccountStateSyncingTaskMetadataRow>();
  for (let row of rows) {
    resRows.push({
      billingAccountStateSyncingTaskRetryCount: row.at(0).value.value,
      billingAccountStateSyncingTaskExecutionTimeMs: row.at(1).value.valueOf(),
    });
  }
  return resRows;
}

export function updateBillingAccountStateSyncingTaskMetadataStatement(
  billingAccountStateSyncingTaskAccountIdEq: string,
  billingAccountStateSyncingTaskVersionEq: number,
  setRetryCount: number,
  setExecutionTimeMs: number,
): Statement {
  return {
    sql: "UPDATE BillingAccountStateSyncingTask SET retryCount = @setRetryCount, executionTimeMs = @setExecutionTimeMs WHERE (BillingAccountStateSyncingTask.accountId = @billingAccountStateSyncingTaskAccountIdEq AND BillingAccountStateSyncingTask.version = @billingAccountStateSyncingTaskVersionEq)",
    params: {
      billingAccountStateSyncingTaskAccountIdEq: billingAccountStateSyncingTaskAccountIdEq,
      billingAccountStateSyncingTaskVersionEq: Spanner.float(billingAccountStateSyncingTaskVersionEq),
      setRetryCount: Spanner.float(setRetryCount),
      setExecutionTimeMs: new Date(setExecutionTimeMs).toISOString(),
    },
    types: {
      billingAccountStateSyncingTaskAccountIdEq: { type: "string" },
      billingAccountStateSyncingTaskVersionEq: { type: "float64" },
      setRetryCount: { type: "float64" },
      setExecutionTimeMs: { type: "timestamp" },
    }
  };
}

export function insertStripeConnectedAccountCreatingTaskStatement(
  accountId: string,
  retryCount: number,
  executionTimeMs: number,
  createdTimeMs: number,
): Statement {
  return {
    sql: "INSERT StripeConnectedAccountCreatingTask (accountId, retryCount, executionTimeMs, createdTimeMs) VALUES (@accountId, @retryCount, @executionTimeMs, @createdTimeMs)",
    params: {
      accountId: accountId,
      retryCount: Spanner.float(retryCount),
      executionTimeMs: new Date(executionTimeMs).toISOString(),
      createdTimeMs: new Date(createdTimeMs).toISOString(),
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
  stripeConnectedAccountCreatingTaskAccountIdEq: string,
): Statement {
  return {
    sql: "DELETE StripeConnectedAccountCreatingTask WHERE (StripeConnectedAccountCreatingTask.accountId = @stripeConnectedAccountCreatingTaskAccountIdEq)",
    params: {
      stripeConnectedAccountCreatingTaskAccountIdEq: stripeConnectedAccountCreatingTaskAccountIdEq,
    },
    types: {
      stripeConnectedAccountCreatingTaskAccountIdEq: { type: "string" },
    }
  };
}

export interface GetStripeConnectedAccountCreatingTaskRow {
  stripeConnectedAccountCreatingTaskAccountId: string,
  stripeConnectedAccountCreatingTaskRetryCount: number,
  stripeConnectedAccountCreatingTaskExecutionTimeMs: number,
  stripeConnectedAccountCreatingTaskCreatedTimeMs: number,
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
  stripeConnectedAccountCreatingTaskAccountIdEq: string,
): Promise<Array<GetStripeConnectedAccountCreatingTaskRow>> {
  let [rows] = await runner.run({
    sql: "SELECT StripeConnectedAccountCreatingTask.accountId, StripeConnectedAccountCreatingTask.retryCount, StripeConnectedAccountCreatingTask.executionTimeMs, StripeConnectedAccountCreatingTask.createdTimeMs FROM StripeConnectedAccountCreatingTask WHERE (StripeConnectedAccountCreatingTask.accountId = @stripeConnectedAccountCreatingTaskAccountIdEq)",
    params: {
      stripeConnectedAccountCreatingTaskAccountIdEq: stripeConnectedAccountCreatingTaskAccountIdEq,
    },
    types: {
      stripeConnectedAccountCreatingTaskAccountIdEq: { type: "string" },
    }
  });
  let resRows = new Array<GetStripeConnectedAccountCreatingTaskRow>();
  for (let row of rows) {
    resRows.push({
      stripeConnectedAccountCreatingTaskAccountId: row.at(0).value,
      stripeConnectedAccountCreatingTaskRetryCount: row.at(1).value.value,
      stripeConnectedAccountCreatingTaskExecutionTimeMs: row.at(2).value.valueOf(),
      stripeConnectedAccountCreatingTaskCreatedTimeMs: row.at(3).value.valueOf(),
    });
  }
  return resRows;
}

export interface ListPendingStripeConnectedAccountCreatingTasksRow {
  stripeConnectedAccountCreatingTaskAccountId: string,
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
  stripeConnectedAccountCreatingTaskExecutionTimeMsLe: number,
): Promise<Array<ListPendingStripeConnectedAccountCreatingTasksRow>> {
  let [rows] = await runner.run({
    sql: "SELECT StripeConnectedAccountCreatingTask.accountId FROM StripeConnectedAccountCreatingTask WHERE StripeConnectedAccountCreatingTask.executionTimeMs <= @stripeConnectedAccountCreatingTaskExecutionTimeMsLe",
    params: {
      stripeConnectedAccountCreatingTaskExecutionTimeMsLe: new Date(stripeConnectedAccountCreatingTaskExecutionTimeMsLe).toISOString(),
    },
    types: {
      stripeConnectedAccountCreatingTaskExecutionTimeMsLe: { type: "timestamp" },
    }
  });
  let resRows = new Array<ListPendingStripeConnectedAccountCreatingTasksRow>();
  for (let row of rows) {
    resRows.push({
      stripeConnectedAccountCreatingTaskAccountId: row.at(0).value,
    });
  }
  return resRows;
}

export interface GetStripeConnectedAccountCreatingTaskMetadataRow {
  stripeConnectedAccountCreatingTaskRetryCount: number,
  stripeConnectedAccountCreatingTaskExecutionTimeMs: number,
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
  stripeConnectedAccountCreatingTaskAccountIdEq: string,
): Promise<Array<GetStripeConnectedAccountCreatingTaskMetadataRow>> {
  let [rows] = await runner.run({
    sql: "SELECT StripeConnectedAccountCreatingTask.retryCount, StripeConnectedAccountCreatingTask.executionTimeMs FROM StripeConnectedAccountCreatingTask WHERE (StripeConnectedAccountCreatingTask.accountId = @stripeConnectedAccountCreatingTaskAccountIdEq)",
    params: {
      stripeConnectedAccountCreatingTaskAccountIdEq: stripeConnectedAccountCreatingTaskAccountIdEq,
    },
    types: {
      stripeConnectedAccountCreatingTaskAccountIdEq: { type: "string" },
    }
  });
  let resRows = new Array<GetStripeConnectedAccountCreatingTaskMetadataRow>();
  for (let row of rows) {
    resRows.push({
      stripeConnectedAccountCreatingTaskRetryCount: row.at(0).value.value,
      stripeConnectedAccountCreatingTaskExecutionTimeMs: row.at(1).value.valueOf(),
    });
  }
  return resRows;
}

export function updateStripeConnectedAccountCreatingTaskMetadataStatement(
  stripeConnectedAccountCreatingTaskAccountIdEq: string,
  setRetryCount: number,
  setExecutionTimeMs: number,
): Statement {
  return {
    sql: "UPDATE StripeConnectedAccountCreatingTask SET retryCount = @setRetryCount, executionTimeMs = @setExecutionTimeMs WHERE (StripeConnectedAccountCreatingTask.accountId = @stripeConnectedAccountCreatingTaskAccountIdEq)",
    params: {
      stripeConnectedAccountCreatingTaskAccountIdEq: stripeConnectedAccountCreatingTaskAccountIdEq,
      setRetryCount: Spanner.float(setRetryCount),
      setExecutionTimeMs: new Date(setExecutionTimeMs).toISOString(),
    },
    types: {
      stripeConnectedAccountCreatingTaskAccountIdEq: { type: "string" },
      setRetryCount: { type: "float64" },
      setExecutionTimeMs: { type: "timestamp" },
    }
  };
}

export function insertSetupStripeConnectedAccountNotifyingTaskStatement(
  accountId: string,
  retryCount: number,
  executionTimeMs: number,
  createdTimeMs: number,
): Statement {
  return {
    sql: "INSERT SetupStripeConnectedAccountNotifyingTask (accountId, retryCount, executionTimeMs, createdTimeMs) VALUES (@accountId, @retryCount, @executionTimeMs, @createdTimeMs)",
    params: {
      accountId: accountId,
      retryCount: Spanner.float(retryCount),
      executionTimeMs: new Date(executionTimeMs).toISOString(),
      createdTimeMs: new Date(createdTimeMs).toISOString(),
    },
    types: {
      accountId: { type: "string" },
      retryCount: { type: "float64" },
      executionTimeMs: { type: "timestamp" },
      createdTimeMs: { type: "timestamp" },
    }
  };
}

export function deleteSetupStripeConnectedAccountNotifyingTaskStatement(
  setupStripeConnectedAccountNotifyingTaskAccountIdEq: string,
): Statement {
  return {
    sql: "DELETE SetupStripeConnectedAccountNotifyingTask WHERE (SetupStripeConnectedAccountNotifyingTask.accountId = @setupStripeConnectedAccountNotifyingTaskAccountIdEq)",
    params: {
      setupStripeConnectedAccountNotifyingTaskAccountIdEq: setupStripeConnectedAccountNotifyingTaskAccountIdEq,
    },
    types: {
      setupStripeConnectedAccountNotifyingTaskAccountIdEq: { type: "string" },
    }
  };
}

export interface GetSetupStripeConnectedAccountNotifyingTaskRow {
  setupStripeConnectedAccountNotifyingTaskAccountId: string,
  setupStripeConnectedAccountNotifyingTaskRetryCount: number,
  setupStripeConnectedAccountNotifyingTaskExecutionTimeMs: number,
  setupStripeConnectedAccountNotifyingTaskCreatedTimeMs: number,
}

export let GET_SETUP_STRIPE_CONNECTED_ACCOUNT_NOTIFYING_TASK_ROW: MessageDescriptor<GetSetupStripeConnectedAccountNotifyingTaskRow> = {
  name: 'GetSetupStripeConnectedAccountNotifyingTaskRow',
  fields: [{
    name: 'setupStripeConnectedAccountNotifyingTaskAccountId',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'setupStripeConnectedAccountNotifyingTaskRetryCount',
    index: 2,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'setupStripeConnectedAccountNotifyingTaskExecutionTimeMs',
    index: 3,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'setupStripeConnectedAccountNotifyingTaskCreatedTimeMs',
    index: 4,
    primitiveType: PrimitiveType.NUMBER,
  }],
};

export async function getSetupStripeConnectedAccountNotifyingTask(
  runner: Database | Transaction,
  setupStripeConnectedAccountNotifyingTaskAccountIdEq: string,
): Promise<Array<GetSetupStripeConnectedAccountNotifyingTaskRow>> {
  let [rows] = await runner.run({
    sql: "SELECT SetupStripeConnectedAccountNotifyingTask.accountId, SetupStripeConnectedAccountNotifyingTask.retryCount, SetupStripeConnectedAccountNotifyingTask.executionTimeMs, SetupStripeConnectedAccountNotifyingTask.createdTimeMs FROM SetupStripeConnectedAccountNotifyingTask WHERE (SetupStripeConnectedAccountNotifyingTask.accountId = @setupStripeConnectedAccountNotifyingTaskAccountIdEq)",
    params: {
      setupStripeConnectedAccountNotifyingTaskAccountIdEq: setupStripeConnectedAccountNotifyingTaskAccountIdEq,
    },
    types: {
      setupStripeConnectedAccountNotifyingTaskAccountIdEq: { type: "string" },
    }
  });
  let resRows = new Array<GetSetupStripeConnectedAccountNotifyingTaskRow>();
  for (let row of rows) {
    resRows.push({
      setupStripeConnectedAccountNotifyingTaskAccountId: row.at(0).value,
      setupStripeConnectedAccountNotifyingTaskRetryCount: row.at(1).value.value,
      setupStripeConnectedAccountNotifyingTaskExecutionTimeMs: row.at(2).value.valueOf(),
      setupStripeConnectedAccountNotifyingTaskCreatedTimeMs: row.at(3).value.valueOf(),
    });
  }
  return resRows;
}

export interface ListPendingSetupStripeConnectedAccountNotifyingTasksRow {
  setupStripeConnectedAccountNotifyingTaskAccountId: string,
}

export let LIST_PENDING_SETUP_STRIPE_CONNECTED_ACCOUNT_NOTIFYING_TASKS_ROW: MessageDescriptor<ListPendingSetupStripeConnectedAccountNotifyingTasksRow> = {
  name: 'ListPendingSetupStripeConnectedAccountNotifyingTasksRow',
  fields: [{
    name: 'setupStripeConnectedAccountNotifyingTaskAccountId',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }],
};

export async function listPendingSetupStripeConnectedAccountNotifyingTasks(
  runner: Database | Transaction,
  setupStripeConnectedAccountNotifyingTaskExecutionTimeMsLe: number,
): Promise<Array<ListPendingSetupStripeConnectedAccountNotifyingTasksRow>> {
  let [rows] = await runner.run({
    sql: "SELECT SetupStripeConnectedAccountNotifyingTask.accountId FROM SetupStripeConnectedAccountNotifyingTask WHERE SetupStripeConnectedAccountNotifyingTask.executionTimeMs <= @setupStripeConnectedAccountNotifyingTaskExecutionTimeMsLe",
    params: {
      setupStripeConnectedAccountNotifyingTaskExecutionTimeMsLe: new Date(setupStripeConnectedAccountNotifyingTaskExecutionTimeMsLe).toISOString(),
    },
    types: {
      setupStripeConnectedAccountNotifyingTaskExecutionTimeMsLe: { type: "timestamp" },
    }
  });
  let resRows = new Array<ListPendingSetupStripeConnectedAccountNotifyingTasksRow>();
  for (let row of rows) {
    resRows.push({
      setupStripeConnectedAccountNotifyingTaskAccountId: row.at(0).value,
    });
  }
  return resRows;
}

export interface GetSetupStripeConnectedAccountNotifyingTaskMetadataRow {
  setupStripeConnectedAccountNotifyingTaskRetryCount: number,
  setupStripeConnectedAccountNotifyingTaskExecutionTimeMs: number,
}

export let GET_SETUP_STRIPE_CONNECTED_ACCOUNT_NOTIFYING_TASK_METADATA_ROW: MessageDescriptor<GetSetupStripeConnectedAccountNotifyingTaskMetadataRow> = {
  name: 'GetSetupStripeConnectedAccountNotifyingTaskMetadataRow',
  fields: [{
    name: 'setupStripeConnectedAccountNotifyingTaskRetryCount',
    index: 1,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'setupStripeConnectedAccountNotifyingTaskExecutionTimeMs',
    index: 2,
    primitiveType: PrimitiveType.NUMBER,
  }],
};

export async function getSetupStripeConnectedAccountNotifyingTaskMetadata(
  runner: Database | Transaction,
  setupStripeConnectedAccountNotifyingTaskAccountIdEq: string,
): Promise<Array<GetSetupStripeConnectedAccountNotifyingTaskMetadataRow>> {
  let [rows] = await runner.run({
    sql: "SELECT SetupStripeConnectedAccountNotifyingTask.retryCount, SetupStripeConnectedAccountNotifyingTask.executionTimeMs FROM SetupStripeConnectedAccountNotifyingTask WHERE (SetupStripeConnectedAccountNotifyingTask.accountId = @setupStripeConnectedAccountNotifyingTaskAccountIdEq)",
    params: {
      setupStripeConnectedAccountNotifyingTaskAccountIdEq: setupStripeConnectedAccountNotifyingTaskAccountIdEq,
    },
    types: {
      setupStripeConnectedAccountNotifyingTaskAccountIdEq: { type: "string" },
    }
  });
  let resRows = new Array<GetSetupStripeConnectedAccountNotifyingTaskMetadataRow>();
  for (let row of rows) {
    resRows.push({
      setupStripeConnectedAccountNotifyingTaskRetryCount: row.at(0).value.value,
      setupStripeConnectedAccountNotifyingTaskExecutionTimeMs: row.at(1).value.valueOf(),
    });
  }
  return resRows;
}

export function updateSetupStripeConnectedAccountNotifyingTaskMetadataStatement(
  setupStripeConnectedAccountNotifyingTaskAccountIdEq: string,
  setRetryCount: number,
  setExecutionTimeMs: number,
): Statement {
  return {
    sql: "UPDATE SetupStripeConnectedAccountNotifyingTask SET retryCount = @setRetryCount, executionTimeMs = @setExecutionTimeMs WHERE (SetupStripeConnectedAccountNotifyingTask.accountId = @setupStripeConnectedAccountNotifyingTaskAccountIdEq)",
    params: {
      setupStripeConnectedAccountNotifyingTaskAccountIdEq: setupStripeConnectedAccountNotifyingTaskAccountIdEq,
      setRetryCount: Spanner.float(setRetryCount),
      setExecutionTimeMs: new Date(setExecutionTimeMs).toISOString(),
    },
    types: {
      setupStripeConnectedAccountNotifyingTaskAccountIdEq: { type: "string" },
      setRetryCount: { type: "float64" },
      setExecutionTimeMs: { type: "timestamp" },
    }
  };
}

export function insertPayoutTaskStatement(
  earningsId: string,
  retryCount: number,
  executionTimeMs: number,
  createdTimeMs: number,
): Statement {
  return {
    sql: "INSERT PayoutTask (earningsId, retryCount, executionTimeMs, createdTimeMs) VALUES (@earningsId, @retryCount, @executionTimeMs, @createdTimeMs)",
    params: {
      earningsId: earningsId,
      retryCount: Spanner.float(retryCount),
      executionTimeMs: new Date(executionTimeMs).toISOString(),
      createdTimeMs: new Date(createdTimeMs).toISOString(),
    },
    types: {
      earningsId: { type: "string" },
      retryCount: { type: "float64" },
      executionTimeMs: { type: "timestamp" },
      createdTimeMs: { type: "timestamp" },
    }
  };
}

export function deletePayoutTaskStatement(
  payoutTaskEarningsIdEq: string,
): Statement {
  return {
    sql: "DELETE PayoutTask WHERE (PayoutTask.earningsId = @payoutTaskEarningsIdEq)",
    params: {
      payoutTaskEarningsIdEq: payoutTaskEarningsIdEq,
    },
    types: {
      payoutTaskEarningsIdEq: { type: "string" },
    }
  };
}

export interface GetPayoutTaskRow {
  payoutTaskEarningsId: string,
  payoutTaskRetryCount: number,
  payoutTaskExecutionTimeMs: number,
  payoutTaskCreatedTimeMs: number,
}

export let GET_PAYOUT_TASK_ROW: MessageDescriptor<GetPayoutTaskRow> = {
  name: 'GetPayoutTaskRow',
  fields: [{
    name: 'payoutTaskEarningsId',
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
  payoutTaskEarningsIdEq: string,
): Promise<Array<GetPayoutTaskRow>> {
  let [rows] = await runner.run({
    sql: "SELECT PayoutTask.earningsId, PayoutTask.retryCount, PayoutTask.executionTimeMs, PayoutTask.createdTimeMs FROM PayoutTask WHERE (PayoutTask.earningsId = @payoutTaskEarningsIdEq)",
    params: {
      payoutTaskEarningsIdEq: payoutTaskEarningsIdEq,
    },
    types: {
      payoutTaskEarningsIdEq: { type: "string" },
    }
  });
  let resRows = new Array<GetPayoutTaskRow>();
  for (let row of rows) {
    resRows.push({
      payoutTaskEarningsId: row.at(0).value,
      payoutTaskRetryCount: row.at(1).value.value,
      payoutTaskExecutionTimeMs: row.at(2).value.valueOf(),
      payoutTaskCreatedTimeMs: row.at(3).value.valueOf(),
    });
  }
  return resRows;
}

export interface ListPendingPayoutTasksRow {
  payoutTaskEarningsId: string,
}

export let LIST_PENDING_PAYOUT_TASKS_ROW: MessageDescriptor<ListPendingPayoutTasksRow> = {
  name: 'ListPendingPayoutTasksRow',
  fields: [{
    name: 'payoutTaskEarningsId',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }],
};

export async function listPendingPayoutTasks(
  runner: Database | Transaction,
  payoutTaskExecutionTimeMsLe: number,
): Promise<Array<ListPendingPayoutTasksRow>> {
  let [rows] = await runner.run({
    sql: "SELECT PayoutTask.earningsId FROM PayoutTask WHERE PayoutTask.executionTimeMs <= @payoutTaskExecutionTimeMsLe",
    params: {
      payoutTaskExecutionTimeMsLe: new Date(payoutTaskExecutionTimeMsLe).toISOString(),
    },
    types: {
      payoutTaskExecutionTimeMsLe: { type: "timestamp" },
    }
  });
  let resRows = new Array<ListPendingPayoutTasksRow>();
  for (let row of rows) {
    resRows.push({
      payoutTaskEarningsId: row.at(0).value,
    });
  }
  return resRows;
}

export interface GetPayoutTaskMetadataRow {
  payoutTaskRetryCount: number,
  payoutTaskExecutionTimeMs: number,
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
  payoutTaskEarningsIdEq: string,
): Promise<Array<GetPayoutTaskMetadataRow>> {
  let [rows] = await runner.run({
    sql: "SELECT PayoutTask.retryCount, PayoutTask.executionTimeMs FROM PayoutTask WHERE (PayoutTask.earningsId = @payoutTaskEarningsIdEq)",
    params: {
      payoutTaskEarningsIdEq: payoutTaskEarningsIdEq,
    },
    types: {
      payoutTaskEarningsIdEq: { type: "string" },
    }
  });
  let resRows = new Array<GetPayoutTaskMetadataRow>();
  for (let row of rows) {
    resRows.push({
      payoutTaskRetryCount: row.at(0).value.value,
      payoutTaskExecutionTimeMs: row.at(1).value.valueOf(),
    });
  }
  return resRows;
}

export function updatePayoutTaskMetadataStatement(
  payoutTaskEarningsIdEq: string,
  setRetryCount: number,
  setExecutionTimeMs: number,
): Statement {
  return {
    sql: "UPDATE PayoutTask SET retryCount = @setRetryCount, executionTimeMs = @setExecutionTimeMs WHERE (PayoutTask.earningsId = @payoutTaskEarningsIdEq)",
    params: {
      payoutTaskEarningsIdEq: payoutTaskEarningsIdEq,
      setRetryCount: Spanner.float(setRetryCount),
      setExecutionTimeMs: new Date(setExecutionTimeMs).toISOString(),
    },
    types: {
      payoutTaskEarningsIdEq: { type: "string" },
      setRetryCount: { type: "float64" },
      setExecutionTimeMs: { type: "timestamp" },
    }
  };
}

export interface GetBillingAccountFromBillingRow {
  aData: BillingAccount,
}

export let GET_BILLING_ACCOUNT_FROM_BILLING_ROW: MessageDescriptor<GetBillingAccountFromBillingRow> = {
  name: 'GetBillingAccountFromBillingRow',
  fields: [{
    name: 'aData',
    index: 1,
    messageType: BILLING_ACCOUNT,
  }],
};

export async function getBillingAccountFromBilling(
  runner: Database | Transaction,
  bBillingIdEq: string,
): Promise<Array<GetBillingAccountFromBillingRow>> {
  let [rows] = await runner.run({
    sql: "SELECT a.data FROM Billing AS b INNER JOIN BillingAccount AS a ON b.accountId = a.accountId WHERE b.billingId = @bBillingIdEq",
    params: {
      bBillingIdEq: bBillingIdEq,
    },
    types: {
      bBillingIdEq: { type: "string" },
    }
  });
  let resRows = new Array<GetBillingAccountFromBillingRow>();
  for (let row of rows) {
    resRows.push({
      aData: deserializeMessage(row.at(0).value, BILLING_ACCOUNT),
    });
  }
  return resRows;
}

export interface GetBillingByMonthRow {
  billingData: Billing,
}

export let GET_BILLING_BY_MONTH_ROW: MessageDescriptor<GetBillingByMonthRow> = {
  name: 'GetBillingByMonthRow',
  fields: [{
    name: 'billingData',
    index: 1,
    messageType: BILLING,
  }],
};

export async function getBillingByMonth(
  runner: Database | Transaction,
  billingAccountIdEq: string,
  billingMonthEq: string,
): Promise<Array<GetBillingByMonthRow>> {
  let [rows] = await runner.run({
    sql: "SELECT Billing.data FROM Billing WHERE (Billing.accountId = @billingAccountIdEq AND Billing.month = @billingMonthEq)",
    params: {
      billingAccountIdEq: billingAccountIdEq,
      billingMonthEq: billingMonthEq,
    },
    types: {
      billingAccountIdEq: { type: "string" },
      billingMonthEq: { type: "string" },
    }
  });
  let resRows = new Array<GetBillingByMonthRow>();
  for (let row of rows) {
    resRows.push({
      billingData: deserializeMessage(row.at(0).value, BILLING),
    });
  }
  return resRows;
}

export interface ListBillingsRow {
  billingData: Billing,
}

export let LIST_BILLINGS_ROW: MessageDescriptor<ListBillingsRow> = {
  name: 'ListBillingsRow',
  fields: [{
    name: 'billingData',
    index: 1,
    messageType: BILLING,
  }],
};

export async function listBillings(
  runner: Database | Transaction,
  billingAccountIdEq: string,
  billingMonthGe: string,
  billingMonthLe: string,
): Promise<Array<ListBillingsRow>> {
  let [rows] = await runner.run({
    sql: "SELECT Billing.data FROM Billing WHERE (Billing.accountId = @billingAccountIdEq AND Billing.month >= @billingMonthGe AND Billing.month <= @billingMonthLe) ORDER BY Billing.month DESC",
    params: {
      billingAccountIdEq: billingAccountIdEq,
      billingMonthGe: billingMonthGe,
      billingMonthLe: billingMonthLe,
    },
    types: {
      billingAccountIdEq: { type: "string" },
      billingMonthGe: { type: "string" },
      billingMonthLe: { type: "string" },
    }
  });
  let resRows = new Array<ListBillingsRow>();
  for (let row of rows) {
    resRows.push({
      billingData: deserializeMessage(row.at(0).value, BILLING),
    });
  }
  return resRows;
}

export interface ListBillingsByStateRow {
  billingData: Billing,
}

export let LIST_BILLINGS_BY_STATE_ROW: MessageDescriptor<ListBillingsByStateRow> = {
  name: 'ListBillingsByStateRow',
  fields: [{
    name: 'billingData',
    index: 1,
    messageType: BILLING,
  }],
};

export async function listBillingsByState(
  runner: Database | Transaction,
  billingAccountIdEq: string,
  billingStateEq: PaymentState,
): Promise<Array<ListBillingsByStateRow>> {
  let [rows] = await runner.run({
    sql: "SELECT Billing.data FROM Billing WHERE (Billing.accountId = @billingAccountIdEq AND Billing.state = @billingStateEq)",
    params: {
      billingAccountIdEq: billingAccountIdEq,
      billingStateEq: Spanner.float(billingStateEq),
    },
    types: {
      billingAccountIdEq: { type: "string" },
      billingStateEq: { type: "float64" },
    }
  });
  let resRows = new Array<ListBillingsByStateRow>();
  for (let row of rows) {
    resRows.push({
      billingData: deserializeMessage(row.at(0).value, BILLING),
    });
  }
  return resRows;
}

export interface GetEarningsAccountFromEarningsRow {
  aData: EarningsAccount,
}

export let GET_EARNINGS_ACCOUNT_FROM_EARNINGS_ROW: MessageDescriptor<GetEarningsAccountFromEarningsRow> = {
  name: 'GetEarningsAccountFromEarningsRow',
  fields: [{
    name: 'aData',
    index: 1,
    messageType: EARNINGS_ACCOUNT,
  }],
};

export async function getEarningsAccountFromEarnings(
  runner: Database | Transaction,
  eEarningsIdEq: string,
): Promise<Array<GetEarningsAccountFromEarningsRow>> {
  let [rows] = await runner.run({
    sql: "SELECT a.data FROM Earnings AS e INNER JOIN EarningsAccount AS a ON e.accountId = a.accountId WHERE e.earningsId = @eEarningsIdEq",
    params: {
      eEarningsIdEq: eEarningsIdEq,
    },
    types: {
      eEarningsIdEq: { type: "string" },
    }
  });
  let resRows = new Array<GetEarningsAccountFromEarningsRow>();
  for (let row of rows) {
    resRows.push({
      aData: deserializeMessage(row.at(0).value, EARNINGS_ACCOUNT),
    });
  }
  return resRows;
}

export interface GetEarningsByMonthRow {
  earningsData: Earnings,
}

export let GET_EARNINGS_BY_MONTH_ROW: MessageDescriptor<GetEarningsByMonthRow> = {
  name: 'GetEarningsByMonthRow',
  fields: [{
    name: 'earningsData',
    index: 1,
    messageType: EARNINGS,
  }],
};

export async function getEarningsByMonth(
  runner: Database | Transaction,
  earningsAccountIdEq: string,
  earningsMonthEq: string,
): Promise<Array<GetEarningsByMonthRow>> {
  let [rows] = await runner.run({
    sql: "SELECT Earnings.data FROM Earnings WHERE (Earnings.accountId = @earningsAccountIdEq AND Earnings.month = @earningsMonthEq)",
    params: {
      earningsAccountIdEq: earningsAccountIdEq,
      earningsMonthEq: earningsMonthEq,
    },
    types: {
      earningsAccountIdEq: { type: "string" },
      earningsMonthEq: { type: "string" },
    }
  });
  let resRows = new Array<GetEarningsByMonthRow>();
  for (let row of rows) {
    resRows.push({
      earningsData: deserializeMessage(row.at(0).value, EARNINGS),
    });
  }
  return resRows;
}

export interface ListEarningsRow {
  earningsData: Earnings,
}

export let LIST_EARNINGS_ROW: MessageDescriptor<ListEarningsRow> = {
  name: 'ListEarningsRow',
  fields: [{
    name: 'earningsData',
    index: 1,
    messageType: EARNINGS,
  }],
};

export async function listEarnings(
  runner: Database | Transaction,
  earningsAccountIdEq: string,
  earningsMonthGe: string,
  earningsMonthLe: string,
): Promise<Array<ListEarningsRow>> {
  let [rows] = await runner.run({
    sql: "SELECT Earnings.data FROM Earnings WHERE (Earnings.accountId = @earningsAccountIdEq AND Earnings.month >= @earningsMonthGe AND Earnings.month <= @earningsMonthLe) ORDER BY Earnings.month DESC",
    params: {
      earningsAccountIdEq: earningsAccountIdEq,
      earningsMonthGe: earningsMonthGe,
      earningsMonthLe: earningsMonthLe,
    },
    types: {
      earningsAccountIdEq: { type: "string" },
      earningsMonthGe: { type: "string" },
      earningsMonthLe: { type: "string" },
    }
  });
  let resRows = new Array<ListEarningsRow>();
  for (let row of rows) {
    resRows.push({
      earningsData: deserializeMessage(row.at(0).value, EARNINGS),
    });
  }
  return resRows;
}

export interface ListEarningsByStateRow {
  earningsData: Earnings,
}

export let LIST_EARNINGS_BY_STATE_ROW: MessageDescriptor<ListEarningsByStateRow> = {
  name: 'ListEarningsByStateRow',
  fields: [{
    name: 'earningsData',
    index: 1,
    messageType: EARNINGS,
  }],
};

export async function listEarningsByState(
  runner: Database | Transaction,
  earningsAccountIdEq: string,
  earningsStateEq: PayoutState,
): Promise<Array<ListEarningsByStateRow>> {
  let [rows] = await runner.run({
    sql: "SELECT Earnings.data FROM Earnings WHERE (Earnings.accountId = @earningsAccountIdEq AND Earnings.state = @earningsStateEq)",
    params: {
      earningsAccountIdEq: earningsAccountIdEq,
      earningsStateEq: Spanner.float(earningsStateEq),
    },
    types: {
      earningsAccountIdEq: { type: "string" },
      earningsStateEq: { type: "float64" },
    }
  });
  let resRows = new Array<ListEarningsByStateRow>();
  for (let row of rows) {
    resRows.push({
      earningsData: deserializeMessage(row.at(0).value, EARNINGS),
    });
  }
  return resRows;
}
