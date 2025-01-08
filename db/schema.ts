import { EnumDescriptor, PrimitiveType, MessageDescriptor } from '@selfage/message/descriptor';

export enum ProductType {
  STORAGE = 1,
  UPLAOD = 2,
  NETWORK = 3,
  SHOW = 4,
  SHOW_PLATFORM_CUT = 5,
}

export let PRODUCT_TYPE: EnumDescriptor<ProductType> = {
  name: 'ProductType',
  values: [{
    name: 'STORAGE',
    value: 1,
  }, {
    name: 'UPLAOD',
    value: 2,
  }, {
    name: 'NETWORK',
    value: 3,
  }, {
    name: 'SHOW',
    value: 4,
  }, {
    name: 'SHOW_PLATFORM_CUT',
    value: 5,
  }]
}

export enum PaymentProcessor {
  STRIPE = 1,
}

export let PAYMENT_PROCESSOR: EnumDescriptor<PaymentProcessor> = {
  name: 'PaymentProcessor',
  values: [{
    name: 'STRIPE',
    value: 1,
  }]
}

export interface TransactionItem {
  productType?: ProductType,
  quantity?: number,
}

export let TRANSACTION_ITEM: MessageDescriptor<TransactionItem> = {
  name: 'TransactionItem',
  fields: [{
    name: 'productType',
    index: 1,
    enumType: PRODUCT_TYPE,
  }, {
    name: 'quantity',
    index: 2,
    primitiveType: PrimitiveType.NUMBER,
  }],
};

export enum TransactionState {
  COLLECTING = 1,
  READY_DEBIT = 2,
  READY_CREDIT = 3,
  PROCESSING = 4,
  DEBIT_FAILED_OTHER_REASON = 5,
  DEBIT_FAILED_PAYMENT_METHOD_MISSING = 6,
  DEBIT_FAILED_PAYMENT_METHOD_DECLINED = 7,
  CREDIT_FAILED_OTHER_REASON = 8,
  CREDIT_FAILED_INSUFFICIENT_FUND = 9,
  DISUPTED = 10,
  REFUNDED = 11,
}

export let TRANSACTION_STATE: EnumDescriptor<TransactionState> = {
  name: 'TransactionState',
  values: [{
    name: 'COLLECTING',
    value: 1,
  }, {
    name: 'READY_DEBIT',
    value: 2,
  }, {
    name: 'READY_CREDIT',
    value: 3,
  }, {
    name: 'PROCESSING',
    value: 4,
  }, {
    name: 'DEBIT_FAILED_OTHER_REASON',
    value: 5,
  }, {
    name: 'DEBIT_FAILED_PAYMENT_METHOD_MISSING',
    value: 6,
  }, {
    name: 'DEBIT_FAILED_PAYMENT_METHOD_DECLINED',
    value: 7,
  }, {
    name: 'CREDIT_FAILED_OTHER_REASON',
    value: 8,
  }, {
    name: 'CREDIT_FAILED_INSUFFICIENT_FUND',
    value: 9,
  }, {
    name: 'DISUPTED',
    value: 10,
  }, {
    name: 'REFUNDED',
    value: 11,
  }]
}

export enum StripeCustomerState {
  HEALTHY = 1,
  PAST_DUE = 2,
  SUSPENDED_DELINQUENT = 3,
  SUSPENDED_SCAM_DISPUTED = 4,
}

export let STRIPE_CUSTOMER_STATE: EnumDescriptor<StripeCustomerState> = {
  name: 'StripeCustomerState',
  values: [{
    name: 'HEALTHY',
    value: 1,
  }, {
    name: 'PAST_DUE',
    value: 2,
  }, {
    name: 'SUSPENDED_DELINQUENT',
    value: 3,
  }, {
    name: 'SUSPENDED_SCAM_DISPUTED',
    value: 4,
  }]
}
