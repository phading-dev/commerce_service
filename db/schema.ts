import { EnumDescriptor, PrimitiveType, MessageDescriptor } from '@selfage/message/descriptor';
import { ProductType, PRODUCT_TYPE } from '@phading/price/price';

export enum BillingAccountState {
  HEALTHY = 1,
  SUSPENDED = 2,
}

export let BILLING_ACCOUNT_STATE: EnumDescriptor<BillingAccountState> = {
  name: 'BillingAccountState',
  values: [{
    name: 'HEALTHY',
    value: 1,
  }, {
    name: 'SUSPENDED',
    value: 2,
  }]
}

export interface BillingAccountStateInfo {
  version?: number,
  state?: BillingAccountState,
  updatedTimeMs?: number,
}

export let BILLING_ACCOUNT_STATE_INFO: MessageDescriptor<BillingAccountStateInfo> = {
  name: 'BillingAccountStateInfo',
  fields: [{
    name: 'version',
    index: 1,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'state',
    index: 2,
    enumType: BILLING_ACCOUNT_STATE,
  }, {
    name: 'updatedTimeMs',
    index: 3,
    primitiveType: PrimitiveType.NUMBER,
  }],
};

export interface BillingAccount {
  accountId?: string,
  stripeCustomerId?: string,
  stateInfo?: BillingAccountStateInfo,
  paymentAfterMs?: number,
}

export let BILLING_ACCOUNT: MessageDescriptor<BillingAccount> = {
  name: 'BillingAccount',
  fields: [{
    name: 'accountId',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'stripeCustomerId',
    index: 2,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'stateInfo',
    index: 3,
    messageType: BILLING_ACCOUNT_STATE_INFO,
  }, {
    name: 'paymentAfterMs',
    index: 4,
    primitiveType: PrimitiveType.NUMBER,
  }],
};

export enum PaymentState {
  PROCESSING = 1,
  CHARGING = 2,
  PAID = 3,
  FAILED = 4,
}

export let PAYMENT_STATE: EnumDescriptor<PaymentState> = {
  name: 'PaymentState',
  values: [{
    name: 'PROCESSING',
    value: 1,
  }, {
    name: 'CHARGING',
    value: 2,
  }, {
    name: 'PAID',
    value: 3,
  }, {
    name: 'FAILED',
    value: 4,
  }]
}

export interface LineItem {
  productType?: ProductType,
  quantity?: number,
  amount?: number,
}

export let LINE_ITEM: MessageDescriptor<LineItem> = {
  name: 'LineItem',
  fields: [{
    name: 'productType',
    index: 1,
    enumType: PRODUCT_TYPE,
  }, {
    name: 'quantity',
    index: 2,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'amount',
    index: 3,
    primitiveType: PrimitiveType.NUMBER,
  }],
};

export interface Billing {
  accountId?: string,
  billingId?: string,
  createdTimeMs?: number,
  state?: PaymentState,
  month?: string,
  currency?: string,
  totalAmount?: number,
  items?: Array<LineItem>,
  stripeInvoiceId?: string,
  stripeInvoiceUrl?: string,
}

export let BILLING: MessageDescriptor<Billing> = {
  name: 'Billing',
  fields: [{
    name: 'accountId',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'billingId',
    index: 2,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'createdTimeMs',
    index: 3,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'state',
    index: 4,
    enumType: PAYMENT_STATE,
  }, {
    name: 'month',
    index: 5,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'currency',
    index: 6,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'totalAmount',
    index: 7,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'items',
    index: 8,
    messageType: LINE_ITEM,
    isArray: true,
  }, {
    name: 'stripeInvoiceId',
    index: 9,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'stripeInvoiceUrl',
    index: 10,
    primitiveType: PrimitiveType.STRING,
  }],
};

export enum StripeConnectedAccountState {
  ONBOARDING = 1,
  ONBOARDED = 2,
}

export let STRIPE_CONNECTED_ACCOUNT_STATE: EnumDescriptor<StripeConnectedAccountState> = {
  name: 'StripeConnectedAccountState',
  values: [{
    name: 'ONBOARDING',
    value: 1,
  }, {
    name: 'ONBOARDED',
    value: 2,
  }]
}

export interface EarningsAccount {
  accountId?: string,
  stripeConnectedAccountId?: string,
  stripeConnectedAccountState?: StripeConnectedAccountState,
}

export let EARNINGS_ACCOUNT: MessageDescriptor<EarningsAccount> = {
  name: 'EarningsAccount',
  fields: [{
    name: 'accountId',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'stripeConnectedAccountId',
    index: 2,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'stripeConnectedAccountState',
    index: 3,
    enumType: STRIPE_CONNECTED_ACCOUNT_STATE,
  }],
};

export enum PayoutState {
  PROCESSING = 1,
  PAID = 2,
  FAILED = 3,
}

export let PAYOUT_STATE: EnumDescriptor<PayoutState> = {
  name: 'PayoutState',
  values: [{
    name: 'PROCESSING',
    value: 1,
  }, {
    name: 'PAID',
    value: 2,
  }, {
    name: 'FAILED',
    value: 3,
  }]
}

export interface Earnings {
  accountId?: string,
  earningsId?: string,
  createdTimeMs?: number,
  state?: PayoutState,
  month?: string,
  currency?: string,
  totalAmount?: number,
  items?: Array<LineItem>,
  stripeTransferId?: string,
}

export let EARNINGS: MessageDescriptor<Earnings> = {
  name: 'Earnings',
  fields: [{
    name: 'accountId',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'earningsId',
    index: 2,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'createdTimeMs',
    index: 3,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'state',
    index: 4,
    enumType: PAYOUT_STATE,
  }, {
    name: 'month',
    index: 5,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'currency',
    index: 6,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'totalAmount',
    index: 7,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'items',
    index: 8,
    messageType: LINE_ITEM,
    isArray: true,
  }, {
    name: 'stripeTransferId',
    index: 9,
    primitiveType: PrimitiveType.STRING,
  }],
};
