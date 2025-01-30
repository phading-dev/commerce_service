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
  executionTimeMs: number,
  createdTimeMs: number,
): Statement {
  return {
    sql: "INSERT StripeCustomerCreatingTask (accountId, executionTimeMs, createdTimeMs) VALUES (@accountId, @executionTimeMs, @createdTimeMs)",
    params: {
      accountId: accountId,
      executionTimeMs: new Date(executionTimeMs).toISOString(),
      createdTimeMs: new Date(createdTimeMs).toISOString(),
    },
    types: {
      accountId: { type: "string" },
      executionTimeMs: { type: "timestamp" },
      createdTimeMs: { type: "timestamp" },
    }
  };
}

export function insertPaymentTaskStatement(
  billingId: string,
  executionTimeMs: number,
  createdTimeMs: number,
): Statement {
  return {
    sql: "INSERT PaymentTask (billingId, executionTimeMs, createdTimeMs) VALUES (@billingId, @executionTimeMs, @createdTimeMs)",
    params: {
      billingId: billingId,
      executionTimeMs: new Date(executionTimeMs).toISOString(),
      createdTimeMs: new Date(createdTimeMs).toISOString(),
    },
    types: {
      billingId: { type: "string" },
      executionTimeMs: { type: "timestamp" },
      createdTimeMs: { type: "timestamp" },
    }
  };
}

export function insertUpdatePaymentMethodNotifyingTaskStatement(
  billingId: string,
  executionTimeMs: number,
  createdTimeMs: number,
): Statement {
  return {
    sql: "INSERT UpdatePaymentMethodNotifyingTask (billingId, executionTimeMs, createdTimeMs) VALUES (@billingId, @executionTimeMs, @createdTimeMs)",
    params: {
      billingId: billingId,
      executionTimeMs: new Date(executionTimeMs).toISOString(),
      createdTimeMs: new Date(createdTimeMs).toISOString(),
    },
    types: {
      billingId: { type: "string" },
      executionTimeMs: { type: "timestamp" },
      createdTimeMs: { type: "timestamp" },
    }
  };
}

export function insertBillingAccountSuspendingDueToPastDueTaskStatement(
  billingId: string,
  executionTimeMs: number,
  createdTimeMs: number,
): Statement {
  return {
    sql: "INSERT BillingAccountSuspendingDueToPastDueTask (billingId, executionTimeMs, createdTimeMs) VALUES (@billingId, @executionTimeMs, @createdTimeMs)",
    params: {
      billingId: billingId,
      executionTimeMs: new Date(executionTimeMs).toISOString(),
      createdTimeMs: new Date(createdTimeMs).toISOString(),
    },
    types: {
      billingId: { type: "string" },
      executionTimeMs: { type: "timestamp" },
      createdTimeMs: { type: "timestamp" },
    }
  };
}

export function insertBillingAccountSuspensionNotifyingTaskStatement(
  accountId: string,
  version: number,
  executionTimeMs: number,
  createdTimeMs: number,
): Statement {
  return {
    sql: "INSERT BillingAccountSuspensionNotifyingTask (accountId, version, executionTimeMs, createdTimeMs) VALUES (@accountId, @version, @executionTimeMs, @createdTimeMs)",
    params: {
      accountId: accountId,
      version: Spanner.float(version),
      executionTimeMs: new Date(executionTimeMs).toISOString(),
      createdTimeMs: new Date(createdTimeMs).toISOString(),
    },
    types: {
      accountId: { type: "string" },
      version: { type: "float64" },
      executionTimeMs: { type: "timestamp" },
      createdTimeMs: { type: "timestamp" },
    }
  };
}

export function insertBillingAccountStateSyncingTaskStatement(
  accountId: string,
  version: number,
  executionTimeMs: number,
  createdTimeMs: number,
): Statement {
  return {
    sql: "INSERT BillingAccountStateSyncingTask (accountId, version, executionTimeMs, createdTimeMs) VALUES (@accountId, @version, @executionTimeMs, @createdTimeMs)",
    params: {
      accountId: accountId,
      version: Spanner.float(version),
      executionTimeMs: new Date(executionTimeMs).toISOString(),
      createdTimeMs: new Date(createdTimeMs).toISOString(),
    },
    types: {
      accountId: { type: "string" },
      version: { type: "float64" },
      executionTimeMs: { type: "timestamp" },
      createdTimeMs: { type: "timestamp" },
    }
  };
}

export function insertStripeConnectedAccountCreatingTaskStatement(
  accountId: string,
  executionTimeMs: number,
  createdTimeMs: number,
): Statement {
  return {
    sql: "INSERT StripeConnectedAccountCreatingTask (accountId, executionTimeMs, createdTimeMs) VALUES (@accountId, @executionTimeMs, @createdTimeMs)",
    params: {
      accountId: accountId,
      executionTimeMs: new Date(executionTimeMs).toISOString(),
      createdTimeMs: new Date(createdTimeMs).toISOString(),
    },
    types: {
      accountId: { type: "string" },
      executionTimeMs: { type: "timestamp" },
      createdTimeMs: { type: "timestamp" },
    }
  };
}

export function insertSetupStripeConnectedAccountNotifyingTaskStatement(
  accountId: string,
  executionTimeMs: number,
  createdTimeMs: number,
): Statement {
  return {
    sql: "INSERT SetupStripeConnectedAccountNotifyingTask (accountId, executionTimeMs, createdTimeMs) VALUES (@accountId, @executionTimeMs, @createdTimeMs)",
    params: {
      accountId: accountId,
      executionTimeMs: new Date(executionTimeMs).toISOString(),
      createdTimeMs: new Date(createdTimeMs).toISOString(),
    },
    types: {
      accountId: { type: "string" },
      executionTimeMs: { type: "timestamp" },
      createdTimeMs: { type: "timestamp" },
    }
  };
}

export function insertPayoutTaskStatement(
  earningsId: string,
  executionTimeMs: number,
  createdTimeMs: number,
): Statement {
  return {
    sql: "INSERT PayoutTask (earningsId, executionTimeMs, createdTimeMs) VALUES (@earningsId, @executionTimeMs, @createdTimeMs)",
    params: {
      earningsId: earningsId,
      executionTimeMs: new Date(executionTimeMs).toISOString(),
      createdTimeMs: new Date(createdTimeMs).toISOString(),
    },
    types: {
      earningsId: { type: "string" },
      executionTimeMs: { type: "timestamp" },
      createdTimeMs: { type: "timestamp" },
    }
  };
}

export function updateStripeCustomerCreatingTaskStatement(
  stripeCustomerCreatingTaskAccountIdEq: string,
  setExecutionTimeMs: number,
): Statement {
  return {
    sql: "UPDATE StripeCustomerCreatingTask SET executionTimeMs = @setExecutionTimeMs WHERE StripeCustomerCreatingTask.accountId = @stripeCustomerCreatingTaskAccountIdEq",
    params: {
      stripeCustomerCreatingTaskAccountIdEq: stripeCustomerCreatingTaskAccountIdEq,
      setExecutionTimeMs: new Date(setExecutionTimeMs).toISOString(),
    },
    types: {
      stripeCustomerCreatingTaskAccountIdEq: { type: "string" },
      setExecutionTimeMs: { type: "timestamp" },
    }
  };
}

export function updatePaymentTaskStatement(
  paymentTaskBillingIdEq: string,
  setExecutionTimeMs: number,
): Statement {
  return {
    sql: "UPDATE PaymentTask SET executionTimeMs = @setExecutionTimeMs WHERE PaymentTask.billingId = @paymentTaskBillingIdEq",
    params: {
      paymentTaskBillingIdEq: paymentTaskBillingIdEq,
      setExecutionTimeMs: new Date(setExecutionTimeMs).toISOString(),
    },
    types: {
      paymentTaskBillingIdEq: { type: "string" },
      setExecutionTimeMs: { type: "timestamp" },
    }
  };
}

export function updateUpdatePaymentMethodNotifyingTaskStatement(
  updatePaymentMethodNotifyingTaskBillingIdEq: string,
  setExecutionTimeMs: number,
): Statement {
  return {
    sql: "UPDATE UpdatePaymentMethodNotifyingTask SET executionTimeMs = @setExecutionTimeMs WHERE UpdatePaymentMethodNotifyingTask.billingId = @updatePaymentMethodNotifyingTaskBillingIdEq",
    params: {
      updatePaymentMethodNotifyingTaskBillingIdEq: updatePaymentMethodNotifyingTaskBillingIdEq,
      setExecutionTimeMs: new Date(setExecutionTimeMs).toISOString(),
    },
    types: {
      updatePaymentMethodNotifyingTaskBillingIdEq: { type: "string" },
      setExecutionTimeMs: { type: "timestamp" },
    }
  };
}

export function updateBillingAccountSuspendingDueToPastDueTaskStatement(
  billingAccountSuspendingDueToPastDueTaskBillingIdEq: string,
  setExecutionTimeMs: number,
): Statement {
  return {
    sql: "UPDATE BillingAccountSuspendingDueToPastDueTask SET executionTimeMs = @setExecutionTimeMs WHERE BillingAccountSuspendingDueToPastDueTask.billingId = @billingAccountSuspendingDueToPastDueTaskBillingIdEq",
    params: {
      billingAccountSuspendingDueToPastDueTaskBillingIdEq: billingAccountSuspendingDueToPastDueTaskBillingIdEq,
      setExecutionTimeMs: new Date(setExecutionTimeMs).toISOString(),
    },
    types: {
      billingAccountSuspendingDueToPastDueTaskBillingIdEq: { type: "string" },
      setExecutionTimeMs: { type: "timestamp" },
    }
  };
}

export function updateBillingAccountSuspensionNotifyingTaskStatement(
  billingAccountSuspensionNotifyingTaskAccountIdEq: string,
  billingAccountSuspensionNotifyingTaskVersionEq: number,
  setExecutionTimeMs: number,
): Statement {
  return {
    sql: "UPDATE BillingAccountSuspensionNotifyingTask SET executionTimeMs = @setExecutionTimeMs WHERE (BillingAccountSuspensionNotifyingTask.accountId = @billingAccountSuspensionNotifyingTaskAccountIdEq AND BillingAccountSuspensionNotifyingTask.version = @billingAccountSuspensionNotifyingTaskVersionEq)",
    params: {
      billingAccountSuspensionNotifyingTaskAccountIdEq: billingAccountSuspensionNotifyingTaskAccountIdEq,
      billingAccountSuspensionNotifyingTaskVersionEq: Spanner.float(billingAccountSuspensionNotifyingTaskVersionEq),
      setExecutionTimeMs: new Date(setExecutionTimeMs).toISOString(),
    },
    types: {
      billingAccountSuspensionNotifyingTaskAccountIdEq: { type: "string" },
      billingAccountSuspensionNotifyingTaskVersionEq: { type: "float64" },
      setExecutionTimeMs: { type: "timestamp" },
    }
  };
}

export function updateBillingAccountStateSyncingTaskStatement(
  billingAccountStateSyncingTaskAccountIdEq: string,
  billingAccountStateSyncingTaskVersionEq: number,
  setExecutionTimeMs: number,
): Statement {
  return {
    sql: "UPDATE BillingAccountStateSyncingTask SET executionTimeMs = @setExecutionTimeMs WHERE (BillingAccountStateSyncingTask.accountId = @billingAccountStateSyncingTaskAccountIdEq AND BillingAccountStateSyncingTask.version = @billingAccountStateSyncingTaskVersionEq)",
    params: {
      billingAccountStateSyncingTaskAccountIdEq: billingAccountStateSyncingTaskAccountIdEq,
      billingAccountStateSyncingTaskVersionEq: Spanner.float(billingAccountStateSyncingTaskVersionEq),
      setExecutionTimeMs: new Date(setExecutionTimeMs).toISOString(),
    },
    types: {
      billingAccountStateSyncingTaskAccountIdEq: { type: "string" },
      billingAccountStateSyncingTaskVersionEq: { type: "float64" },
      setExecutionTimeMs: { type: "timestamp" },
    }
  };
}

export function updateStripeConnectedAccountCreatingTaskStatement(
  stripeConnectedAccountCreatingTaskAccountIdEq: string,
  setExecutionTimeMs: number,
): Statement {
  return {
    sql: "UPDATE StripeConnectedAccountCreatingTask SET executionTimeMs = @setExecutionTimeMs WHERE StripeConnectedAccountCreatingTask.accountId = @stripeConnectedAccountCreatingTaskAccountIdEq",
    params: {
      stripeConnectedAccountCreatingTaskAccountIdEq: stripeConnectedAccountCreatingTaskAccountIdEq,
      setExecutionTimeMs: new Date(setExecutionTimeMs).toISOString(),
    },
    types: {
      stripeConnectedAccountCreatingTaskAccountIdEq: { type: "string" },
      setExecutionTimeMs: { type: "timestamp" },
    }
  };
}

export function updateSetupStripeConnectedAccountNotifyingTaskStatement(
  setupStripeConnectedAccountNotifyingTaskAccountIdEq: string,
  setExecutionTimeMs: number,
): Statement {
  return {
    sql: "UPDATE SetupStripeConnectedAccountNotifyingTask SET executionTimeMs = @setExecutionTimeMs WHERE SetupStripeConnectedAccountNotifyingTask.accountId = @setupStripeConnectedAccountNotifyingTaskAccountIdEq",
    params: {
      setupStripeConnectedAccountNotifyingTaskAccountIdEq: setupStripeConnectedAccountNotifyingTaskAccountIdEq,
      setExecutionTimeMs: new Date(setExecutionTimeMs).toISOString(),
    },
    types: {
      setupStripeConnectedAccountNotifyingTaskAccountIdEq: { type: "string" },
      setExecutionTimeMs: { type: "timestamp" },
    }
  };
}

export function updatePayoutTaskStatement(
  payoutTaskEarningsIdEq: string,
  setExecutionTimeMs: number,
): Statement {
  return {
    sql: "UPDATE PayoutTask SET executionTimeMs = @setExecutionTimeMs WHERE PayoutTask.earningsId = @payoutTaskEarningsIdEq",
    params: {
      payoutTaskEarningsIdEq: payoutTaskEarningsIdEq,
      setExecutionTimeMs: new Date(setExecutionTimeMs).toISOString(),
    },
    types: {
      payoutTaskEarningsIdEq: { type: "string" },
      setExecutionTimeMs: { type: "timestamp" },
    }
  };
}

export function deleteStripeCustomerCreatingTaskStatement(
  stripeCustomerCreatingTaskAccountIdEq: string,
): Statement {
  return {
    sql: "DELETE StripeCustomerCreatingTask WHERE StripeCustomerCreatingTask.accountId = @stripeCustomerCreatingTaskAccountIdEq",
    params: {
      stripeCustomerCreatingTaskAccountIdEq: stripeCustomerCreatingTaskAccountIdEq,
    },
    types: {
      stripeCustomerCreatingTaskAccountIdEq: { type: "string" },
    }
  };
}

export function deletePaymentTaskStatement(
  paymentTaskBillingIdEq: string,
): Statement {
  return {
    sql: "DELETE PaymentTask WHERE PaymentTask.billingId = @paymentTaskBillingIdEq",
    params: {
      paymentTaskBillingIdEq: paymentTaskBillingIdEq,
    },
    types: {
      paymentTaskBillingIdEq: { type: "string" },
    }
  };
}

export function deleteUpdatePaymentMethodNotifyingTaskStatement(
  updatePaymentMethodNotifyingTaskBillingIdEq: string,
): Statement {
  return {
    sql: "DELETE UpdatePaymentMethodNotifyingTask WHERE UpdatePaymentMethodNotifyingTask.billingId = @updatePaymentMethodNotifyingTaskBillingIdEq",
    params: {
      updatePaymentMethodNotifyingTaskBillingIdEq: updatePaymentMethodNotifyingTaskBillingIdEq,
    },
    types: {
      updatePaymentMethodNotifyingTaskBillingIdEq: { type: "string" },
    }
  };
}

export function deleteBillingAccountSuspendingDueToPastDueTaskStatement(
  billingAccountSuspendingDueToPastDueTaskBillingIdEq: string,
): Statement {
  return {
    sql: "DELETE BillingAccountSuspendingDueToPastDueTask WHERE BillingAccountSuspendingDueToPastDueTask.billingId = @billingAccountSuspendingDueToPastDueTaskBillingIdEq",
    params: {
      billingAccountSuspendingDueToPastDueTaskBillingIdEq: billingAccountSuspendingDueToPastDueTaskBillingIdEq,
    },
    types: {
      billingAccountSuspendingDueToPastDueTaskBillingIdEq: { type: "string" },
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

export function deleteStripeConnectedAccountCreatingTaskStatement(
  stripeConnectedAccountCreatingTaskAccountIdEq: string,
): Statement {
  return {
    sql: "DELETE StripeConnectedAccountCreatingTask WHERE StripeConnectedAccountCreatingTask.accountId = @stripeConnectedAccountCreatingTaskAccountIdEq",
    params: {
      stripeConnectedAccountCreatingTaskAccountIdEq: stripeConnectedAccountCreatingTaskAccountIdEq,
    },
    types: {
      stripeConnectedAccountCreatingTaskAccountIdEq: { type: "string" },
    }
  };
}

export function deleteSetupStripeConnectedAccountNotifyingTaskStatement(
  setupStripeConnectedAccountNotifyingTaskAccountIdEq: string,
): Statement {
  return {
    sql: "DELETE SetupStripeConnectedAccountNotifyingTask WHERE SetupStripeConnectedAccountNotifyingTask.accountId = @setupStripeConnectedAccountNotifyingTaskAccountIdEq",
    params: {
      setupStripeConnectedAccountNotifyingTaskAccountIdEq: setupStripeConnectedAccountNotifyingTaskAccountIdEq,
    },
    types: {
      setupStripeConnectedAccountNotifyingTaskAccountIdEq: { type: "string" },
    }
  };
}

export function deletePayoutTaskStatement(
  payoutTaskEarningsIdEq: string,
): Statement {
  return {
    sql: "DELETE PayoutTask WHERE PayoutTask.earningsId = @payoutTaskEarningsIdEq",
    params: {
      payoutTaskEarningsIdEq: payoutTaskEarningsIdEq,
    },
    types: {
      payoutTaskEarningsIdEq: { type: "string" },
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

export interface ListStripeCustomerCreatingTasksRow {
  stripeCustomerCreatingTaskAccountId: string,
  stripeCustomerCreatingTaskExecutionTimeMs: number,
}

export let LIST_STRIPE_CUSTOMER_CREATING_TASKS_ROW: MessageDescriptor<ListStripeCustomerCreatingTasksRow> = {
  name: 'ListStripeCustomerCreatingTasksRow',
  fields: [{
    name: 'stripeCustomerCreatingTaskAccountId',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'stripeCustomerCreatingTaskExecutionTimeMs',
    index: 2,
    primitiveType: PrimitiveType.NUMBER,
  }],
};

export async function listStripeCustomerCreatingTasks(
  runner: Database | Transaction,
  stripeCustomerCreatingTaskExecutionTimeMsLe: number,
): Promise<Array<ListStripeCustomerCreatingTasksRow>> {
  let [rows] = await runner.run({
    sql: "SELECT StripeCustomerCreatingTask.accountId, StripeCustomerCreatingTask.executionTimeMs FROM StripeCustomerCreatingTask WHERE StripeCustomerCreatingTask.executionTimeMs <= @stripeCustomerCreatingTaskExecutionTimeMsLe ORDER BY StripeCustomerCreatingTask.executionTimeMs",
    params: {
      stripeCustomerCreatingTaskExecutionTimeMsLe: new Date(stripeCustomerCreatingTaskExecutionTimeMsLe).toISOString(),
    },
    types: {
      stripeCustomerCreatingTaskExecutionTimeMsLe: { type: "timestamp" },
    }
  });
  let resRows = new Array<ListStripeCustomerCreatingTasksRow>();
  for (let row of rows) {
    resRows.push({
      stripeCustomerCreatingTaskAccountId: row.at(0).value,
      stripeCustomerCreatingTaskExecutionTimeMs: row.at(1).value.valueOf(),
    });
  }
  return resRows;
}

export interface ListPaymentTasksRow {
  paymentTaskBillingId: string,
  paymentTaskExecutionTimeMs: number,
}

export let LIST_PAYMENT_TASKS_ROW: MessageDescriptor<ListPaymentTasksRow> = {
  name: 'ListPaymentTasksRow',
  fields: [{
    name: 'paymentTaskBillingId',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'paymentTaskExecutionTimeMs',
    index: 2,
    primitiveType: PrimitiveType.NUMBER,
  }],
};

export async function listPaymentTasks(
  runner: Database | Transaction,
  paymentTaskExecutionTimeMsLe: number,
): Promise<Array<ListPaymentTasksRow>> {
  let [rows] = await runner.run({
    sql: "SELECT PaymentTask.billingId, PaymentTask.executionTimeMs FROM PaymentTask WHERE PaymentTask.executionTimeMs <= @paymentTaskExecutionTimeMsLe ORDER BY PaymentTask.executionTimeMs",
    params: {
      paymentTaskExecutionTimeMsLe: new Date(paymentTaskExecutionTimeMsLe).toISOString(),
    },
    types: {
      paymentTaskExecutionTimeMsLe: { type: "timestamp" },
    }
  });
  let resRows = new Array<ListPaymentTasksRow>();
  for (let row of rows) {
    resRows.push({
      paymentTaskBillingId: row.at(0).value,
      paymentTaskExecutionTimeMs: row.at(1).value.valueOf(),
    });
  }
  return resRows;
}

export interface ListUpdatePaymentMethodNotifyingTasksRow {
  updatePaymentMethodNotifyingTaskBillingId: string,
  updatePaymentMethodNotifyingTaskExecutionTimeMs: number,
}

export let LIST_UPDATE_PAYMENT_METHOD_NOTIFYING_TASKS_ROW: MessageDescriptor<ListUpdatePaymentMethodNotifyingTasksRow> = {
  name: 'ListUpdatePaymentMethodNotifyingTasksRow',
  fields: [{
    name: 'updatePaymentMethodNotifyingTaskBillingId',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'updatePaymentMethodNotifyingTaskExecutionTimeMs',
    index: 2,
    primitiveType: PrimitiveType.NUMBER,
  }],
};

export async function listUpdatePaymentMethodNotifyingTasks(
  runner: Database | Transaction,
  updatePaymentMethodNotifyingTaskExecutionTimeMsLe: number,
): Promise<Array<ListUpdatePaymentMethodNotifyingTasksRow>> {
  let [rows] = await runner.run({
    sql: "SELECT UpdatePaymentMethodNotifyingTask.billingId, UpdatePaymentMethodNotifyingTask.executionTimeMs FROM UpdatePaymentMethodNotifyingTask WHERE UpdatePaymentMethodNotifyingTask.executionTimeMs <= @updatePaymentMethodNotifyingTaskExecutionTimeMsLe ORDER BY UpdatePaymentMethodNotifyingTask.executionTimeMs",
    params: {
      updatePaymentMethodNotifyingTaskExecutionTimeMsLe: new Date(updatePaymentMethodNotifyingTaskExecutionTimeMsLe).toISOString(),
    },
    types: {
      updatePaymentMethodNotifyingTaskExecutionTimeMsLe: { type: "timestamp" },
    }
  });
  let resRows = new Array<ListUpdatePaymentMethodNotifyingTasksRow>();
  for (let row of rows) {
    resRows.push({
      updatePaymentMethodNotifyingTaskBillingId: row.at(0).value,
      updatePaymentMethodNotifyingTaskExecutionTimeMs: row.at(1).value.valueOf(),
    });
  }
  return resRows;
}

export interface CheckUpdatePaymentMethodNotifyingTaskRow {
  updatePaymentMethodNotifyingTaskExecutionTimeMs: number,
}

export let CHECK_UPDATE_PAYMENT_METHOD_NOTIFYING_TASK_ROW: MessageDescriptor<CheckUpdatePaymentMethodNotifyingTaskRow> = {
  name: 'CheckUpdatePaymentMethodNotifyingTaskRow',
  fields: [{
    name: 'updatePaymentMethodNotifyingTaskExecutionTimeMs',
    index: 1,
    primitiveType: PrimitiveType.NUMBER,
  }],
};

export async function checkUpdatePaymentMethodNotifyingTask(
  runner: Database | Transaction,
  updatePaymentMethodNotifyingTaskBillingIdEq: string,
): Promise<Array<CheckUpdatePaymentMethodNotifyingTaskRow>> {
  let [rows] = await runner.run({
    sql: "SELECT UpdatePaymentMethodNotifyingTask.executionTimeMs FROM UpdatePaymentMethodNotifyingTask WHERE UpdatePaymentMethodNotifyingTask.billingId = @updatePaymentMethodNotifyingTaskBillingIdEq",
    params: {
      updatePaymentMethodNotifyingTaskBillingIdEq: updatePaymentMethodNotifyingTaskBillingIdEq,
    },
    types: {
      updatePaymentMethodNotifyingTaskBillingIdEq: { type: "string" },
    }
  });
  let resRows = new Array<CheckUpdatePaymentMethodNotifyingTaskRow>();
  for (let row of rows) {
    resRows.push({
      updatePaymentMethodNotifyingTaskExecutionTimeMs: row.at(0).value.valueOf(),
    });
  }
  return resRows;
}

export interface ListBillingAccountSuspendingDueToPastDueTasksRow {
  billingAccountSuspendingDueToPastDueTaskBillingId: string,
  billingAccountSuspendingDueToPastDueTaskExecutionTimeMs: number,
}

export let LIST_BILLING_ACCOUNT_SUSPENDING_DUE_TO_PAST_DUE_TASKS_ROW: MessageDescriptor<ListBillingAccountSuspendingDueToPastDueTasksRow> = {
  name: 'ListBillingAccountSuspendingDueToPastDueTasksRow',
  fields: [{
    name: 'billingAccountSuspendingDueToPastDueTaskBillingId',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'billingAccountSuspendingDueToPastDueTaskExecutionTimeMs',
    index: 2,
    primitiveType: PrimitiveType.NUMBER,
  }],
};

export async function listBillingAccountSuspendingDueToPastDueTasks(
  runner: Database | Transaction,
  billingAccountSuspendingDueToPastDueTaskExecutionTimeMsLe: number,
): Promise<Array<ListBillingAccountSuspendingDueToPastDueTasksRow>> {
  let [rows] = await runner.run({
    sql: "SELECT BillingAccountSuspendingDueToPastDueTask.billingId, BillingAccountSuspendingDueToPastDueTask.executionTimeMs FROM BillingAccountSuspendingDueToPastDueTask WHERE BillingAccountSuspendingDueToPastDueTask.executionTimeMs <= @billingAccountSuspendingDueToPastDueTaskExecutionTimeMsLe ORDER BY BillingAccountSuspendingDueToPastDueTask.executionTimeMs",
    params: {
      billingAccountSuspendingDueToPastDueTaskExecutionTimeMsLe: new Date(billingAccountSuspendingDueToPastDueTaskExecutionTimeMsLe).toISOString(),
    },
    types: {
      billingAccountSuspendingDueToPastDueTaskExecutionTimeMsLe: { type: "timestamp" },
    }
  });
  let resRows = new Array<ListBillingAccountSuspendingDueToPastDueTasksRow>();
  for (let row of rows) {
    resRows.push({
      billingAccountSuspendingDueToPastDueTaskBillingId: row.at(0).value,
      billingAccountSuspendingDueToPastDueTaskExecutionTimeMs: row.at(1).value.valueOf(),
    });
  }
  return resRows;
}

export interface ListBillingAccountSuspensionNotifyingTasksRow {
  billingAccountSuspensionNotifyingTaskAccountId: string,
  billingAccountSuspensionNotifyingTaskVersion: number,
  billingAccountSuspensionNotifyingTaskExecutionTimeMs: number,
}

export let LIST_BILLING_ACCOUNT_SUSPENSION_NOTIFYING_TASKS_ROW: MessageDescriptor<ListBillingAccountSuspensionNotifyingTasksRow> = {
  name: 'ListBillingAccountSuspensionNotifyingTasksRow',
  fields: [{
    name: 'billingAccountSuspensionNotifyingTaskAccountId',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'billingAccountSuspensionNotifyingTaskVersion',
    index: 2,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'billingAccountSuspensionNotifyingTaskExecutionTimeMs',
    index: 3,
    primitiveType: PrimitiveType.NUMBER,
  }],
};

export async function listBillingAccountSuspensionNotifyingTasks(
  runner: Database | Transaction,
  billingAccountSuspensionNotifyingTaskExecutionTimeMsLe: number,
): Promise<Array<ListBillingAccountSuspensionNotifyingTasksRow>> {
  let [rows] = await runner.run({
    sql: "SELECT BillingAccountSuspensionNotifyingTask.accountId, BillingAccountSuspensionNotifyingTask.version, BillingAccountSuspensionNotifyingTask.executionTimeMs FROM BillingAccountSuspensionNotifyingTask WHERE BillingAccountSuspensionNotifyingTask.executionTimeMs <= @billingAccountSuspensionNotifyingTaskExecutionTimeMsLe ORDER BY BillingAccountSuspensionNotifyingTask.executionTimeMs",
    params: {
      billingAccountSuspensionNotifyingTaskExecutionTimeMsLe: new Date(billingAccountSuspensionNotifyingTaskExecutionTimeMsLe).toISOString(),
    },
    types: {
      billingAccountSuspensionNotifyingTaskExecutionTimeMsLe: { type: "timestamp" },
    }
  });
  let resRows = new Array<ListBillingAccountSuspensionNotifyingTasksRow>();
  for (let row of rows) {
    resRows.push({
      billingAccountSuspensionNotifyingTaskAccountId: row.at(0).value,
      billingAccountSuspensionNotifyingTaskVersion: row.at(1).value.value,
      billingAccountSuspensionNotifyingTaskExecutionTimeMs: row.at(2).value.valueOf(),
    });
  }
  return resRows;
}

export interface ListBillingAccountStateSyncingTasksRow {
  billingAccountStateSyncingTaskAccountId: string,
  billingAccountStateSyncingTaskVersion: number,
  billingAccountStateSyncingTaskExecutionTimeMs: number,
}

export let LIST_BILLING_ACCOUNT_STATE_SYNCING_TASKS_ROW: MessageDescriptor<ListBillingAccountStateSyncingTasksRow> = {
  name: 'ListBillingAccountStateSyncingTasksRow',
  fields: [{
    name: 'billingAccountStateSyncingTaskAccountId',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'billingAccountStateSyncingTaskVersion',
    index: 2,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'billingAccountStateSyncingTaskExecutionTimeMs',
    index: 3,
    primitiveType: PrimitiveType.NUMBER,
  }],
};

export async function listBillingAccountStateSyncingTasks(
  runner: Database | Transaction,
  billingAccountStateSyncingTaskExecutionTimeMsLe: number,
): Promise<Array<ListBillingAccountStateSyncingTasksRow>> {
  let [rows] = await runner.run({
    sql: "SELECT BillingAccountStateSyncingTask.accountId, BillingAccountStateSyncingTask.version, BillingAccountStateSyncingTask.executionTimeMs FROM BillingAccountStateSyncingTask WHERE BillingAccountStateSyncingTask.executionTimeMs <= @billingAccountStateSyncingTaskExecutionTimeMsLe ORDER BY BillingAccountStateSyncingTask.executionTimeMs",
    params: {
      billingAccountStateSyncingTaskExecutionTimeMsLe: new Date(billingAccountStateSyncingTaskExecutionTimeMsLe).toISOString(),
    },
    types: {
      billingAccountStateSyncingTaskExecutionTimeMsLe: { type: "timestamp" },
    }
  });
  let resRows = new Array<ListBillingAccountStateSyncingTasksRow>();
  for (let row of rows) {
    resRows.push({
      billingAccountStateSyncingTaskAccountId: row.at(0).value,
      billingAccountStateSyncingTaskVersion: row.at(1).value.value,
      billingAccountStateSyncingTaskExecutionTimeMs: row.at(2).value.valueOf(),
    });
  }
  return resRows;
}

export interface ListStripeConnectedAccountCreatingTasksRow {
  stripeConnectedAccountCreatingTaskAccountId: string,
  stripeConnectedAccountCreatingTaskExecutionTimeMs: number,
}

export let LIST_STRIPE_CONNECTED_ACCOUNT_CREATING_TASKS_ROW: MessageDescriptor<ListStripeConnectedAccountCreatingTasksRow> = {
  name: 'ListStripeConnectedAccountCreatingTasksRow',
  fields: [{
    name: 'stripeConnectedAccountCreatingTaskAccountId',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'stripeConnectedAccountCreatingTaskExecutionTimeMs',
    index: 2,
    primitiveType: PrimitiveType.NUMBER,
  }],
};

export async function listStripeConnectedAccountCreatingTasks(
  runner: Database | Transaction,
  stripeConnectedAccountCreatingTaskExecutionTimeMsLe: number,
): Promise<Array<ListStripeConnectedAccountCreatingTasksRow>> {
  let [rows] = await runner.run({
    sql: "SELECT StripeConnectedAccountCreatingTask.accountId, StripeConnectedAccountCreatingTask.executionTimeMs FROM StripeConnectedAccountCreatingTask WHERE StripeConnectedAccountCreatingTask.executionTimeMs <= @stripeConnectedAccountCreatingTaskExecutionTimeMsLe ORDER BY StripeConnectedAccountCreatingTask.executionTimeMs",
    params: {
      stripeConnectedAccountCreatingTaskExecutionTimeMsLe: new Date(stripeConnectedAccountCreatingTaskExecutionTimeMsLe).toISOString(),
    },
    types: {
      stripeConnectedAccountCreatingTaskExecutionTimeMsLe: { type: "timestamp" },
    }
  });
  let resRows = new Array<ListStripeConnectedAccountCreatingTasksRow>();
  for (let row of rows) {
    resRows.push({
      stripeConnectedAccountCreatingTaskAccountId: row.at(0).value,
      stripeConnectedAccountCreatingTaskExecutionTimeMs: row.at(1).value.valueOf(),
    });
  }
  return resRows;
}

export interface ListSetupStripeConnectedAccountNotifyingTasksRow {
  setupStripeConnectedAccountNotifyingTaskAccountId: string,
  setupStripeConnectedAccountNotifyingTaskExecutionTimeMs: number,
}

export let LIST_SETUP_STRIPE_CONNECTED_ACCOUNT_NOTIFYING_TASKS_ROW: MessageDescriptor<ListSetupStripeConnectedAccountNotifyingTasksRow> = {
  name: 'ListSetupStripeConnectedAccountNotifyingTasksRow',
  fields: [{
    name: 'setupStripeConnectedAccountNotifyingTaskAccountId',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'setupStripeConnectedAccountNotifyingTaskExecutionTimeMs',
    index: 2,
    primitiveType: PrimitiveType.NUMBER,
  }],
};

export async function listSetupStripeConnectedAccountNotifyingTasks(
  runner: Database | Transaction,
  setupStripeConnectedAccountNotifyingTaskExecutionTimeMsLe: number,
): Promise<Array<ListSetupStripeConnectedAccountNotifyingTasksRow>> {
  let [rows] = await runner.run({
    sql: "SELECT SetupStripeConnectedAccountNotifyingTask.accountId, SetupStripeConnectedAccountNotifyingTask.executionTimeMs FROM SetupStripeConnectedAccountNotifyingTask WHERE SetupStripeConnectedAccountNotifyingTask.executionTimeMs <= @setupStripeConnectedAccountNotifyingTaskExecutionTimeMsLe ORDER BY SetupStripeConnectedAccountNotifyingTask.executionTimeMs",
    params: {
      setupStripeConnectedAccountNotifyingTaskExecutionTimeMsLe: new Date(setupStripeConnectedAccountNotifyingTaskExecutionTimeMsLe).toISOString(),
    },
    types: {
      setupStripeConnectedAccountNotifyingTaskExecutionTimeMsLe: { type: "timestamp" },
    }
  });
  let resRows = new Array<ListSetupStripeConnectedAccountNotifyingTasksRow>();
  for (let row of rows) {
    resRows.push({
      setupStripeConnectedAccountNotifyingTaskAccountId: row.at(0).value,
      setupStripeConnectedAccountNotifyingTaskExecutionTimeMs: row.at(1).value.valueOf(),
    });
  }
  return resRows;
}

export interface ListPayoutTasksRow {
  payoutTaskEarningsId: string,
  payoutTaskExecutionTimeMs: number,
}

export let LIST_PAYOUT_TASKS_ROW: MessageDescriptor<ListPayoutTasksRow> = {
  name: 'ListPayoutTasksRow',
  fields: [{
    name: 'payoutTaskEarningsId',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'payoutTaskExecutionTimeMs',
    index: 2,
    primitiveType: PrimitiveType.NUMBER,
  }],
};

export async function listPayoutTasks(
  runner: Database | Transaction,
  payoutTaskExecutionTimeMsLe: number,
): Promise<Array<ListPayoutTasksRow>> {
  let [rows] = await runner.run({
    sql: "SELECT PayoutTask.earningsId, PayoutTask.executionTimeMs FROM PayoutTask WHERE PayoutTask.executionTimeMs <= @payoutTaskExecutionTimeMsLe ORDER BY PayoutTask.executionTimeMs",
    params: {
      payoutTaskExecutionTimeMsLe: new Date(payoutTaskExecutionTimeMsLe).toISOString(),
    },
    types: {
      payoutTaskExecutionTimeMsLe: { type: "timestamp" },
    }
  });
  let resRows = new Array<ListPayoutTasksRow>();
  for (let row of rows) {
    resRows.push({
      payoutTaskEarningsId: row.at(0).value,
      payoutTaskExecutionTimeMs: row.at(1).value.valueOf(),
    });
  }
  return resRows;
}
