import { EnumDescriptor, PrimitiveType, MessageDescriptor } from '@selfage/message/descriptor';
import { ProductID, PRODUCT_I_D } from '@phading/price/price';
import { AmountType, AMOUNT_TYPE } from '@phading/price/amount_type';

export enum PaymentProfileState {
  HEALTHY = 1,
  SUSPENDED = 2,
}

export let PAYMENT_PROFILE_STATE: EnumDescriptor<PaymentProfileState> = {
  name: 'PaymentProfileState',
  values: [{
    name: 'HEALTHY',
    value: 1,
  }, {
    name: 'SUSPENDED',
    value: 2,
  }]
}

export interface PaymentProfileStateInfo {
  version?: number,
  state?: PaymentProfileState,
  updatedTimeMs?: number,
}

export let PAYMENT_PROFILE_STATE_INFO: MessageDescriptor<PaymentProfileStateInfo> = {
  name: 'PaymentProfileStateInfo',
  fields: [{
    name: 'version',
    index: 1,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'state',
    index: 2,
    enumType: PAYMENT_PROFILE_STATE,
  }, {
    name: 'updatedTimeMs',
    index: 3,
    primitiveType: PrimitiveType.NUMBER,
  }],
};

export enum InitCreditGrantingState {
  NOT_GRANTED = 1,
  GRANTING = 2,
  GRANTED = 3,
}

export let INIT_CREDIT_GRANTING_STATE: EnumDescriptor<InitCreditGrantingState> = {
  name: 'InitCreditGrantingState',
  values: [{
    name: 'NOT_GRANTED',
    value: 1,
  }, {
    name: 'GRANTING',
    value: 2,
  }, {
    name: 'GRANTED',
    value: 3,
  }]
}

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

export interface LineItem {
  productID?: ProductID,
  unit?: string,
  amountType?: AmountType,
  quantity?: number,
  amount?: number,
}

export let LINE_ITEM: MessageDescriptor<LineItem> = {
  name: 'LineItem',
  fields: [{
    name: 'productID',
    index: 1,
    enumType: PRODUCT_I_D,
  }, {
    name: 'unit',
    index: 2,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'amountType',
    index: 3,
    enumType: AMOUNT_TYPE,
  }, {
    name: 'quantity',
    index: 4,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'amount',
    index: 5,
    primitiveType: PrimitiveType.NUMBER,
  }],
};

export interface TransactionStatement {
  currency?: string,
  totalAmount?: number,
  totalAmountType?: AmountType,
  items?: Array<LineItem>,
}

export let TRANSACTION_STATEMENT: MessageDescriptor<TransactionStatement> = {
  name: 'TransactionStatement',
  fields: [{
    name: 'currency',
    index: 1,
    primitiveType: PrimitiveType.STRING,
  }, {
    name: 'totalAmount',
    index: 2,
    primitiveType: PrimitiveType.NUMBER,
  }, {
    name: 'totalAmountType',
    index: 3,
    enumType: AMOUNT_TYPE,
  }, {
    name: 'items',
    index: 4,
    messageType: LINE_ITEM,
    isArray: true,
  }],
};

export enum PaymentState {
  CREATING_STRIPE_INVOICE = 1,
  WAITING_FOR_INVOICE_PAYMENT = 2,
  PAID = 3,
  FAILED_WITHOUT_INVOICE = 4,
  FAILED_WITH_INVOICE = 5,
  PAYING_INVOICE = 6,
}

export let PAYMENT_STATE: EnumDescriptor<PaymentState> = {
  name: 'PaymentState',
  values: [{
    name: 'CREATING_STRIPE_INVOICE',
    value: 1,
  }, {
    name: 'WAITING_FOR_INVOICE_PAYMENT',
    value: 2,
  }, {
    name: 'PAID',
    value: 3,
  }, {
    name: 'FAILED_WITHOUT_INVOICE',
    value: 4,
  }, {
    name: 'FAILED_WITH_INVOICE',
    value: 5,
  }, {
    name: 'PAYING_INVOICE',
    value: 6,
  }]
}

export enum PayoutState {
  PROCESSING = 1,
  PAID = 2,
  DISABLED = 3,
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
    name: 'DISABLED',
    value: 3,
  }]
}
