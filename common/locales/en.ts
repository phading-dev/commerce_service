import {
  ACCOUNT_SUSPENSION_EN_EMAIL_TEMPLATE_ID,
  SETUP_STRIPE_CONNECTED_ACCOUNT_EN_EMAIL_TEMPLATE_ID,
  UPDATE_PAYMENT_METHOD_EN_EMAIL_TEMPLATE_ID,
} from "../env_vars";

export default class EN {
  get locale() {
    return "en";
  }
  get totalUsage() {
    return "Total usage";
  }
  get updatePaymentMethodEmailTemplateId() {
    return UPDATE_PAYMENT_METHOD_EN_EMAIL_TEMPLATE_ID;
  }
  get accountSuspensionEmailTemplateId() {
    return ACCOUNT_SUSPENSION_EN_EMAIL_TEMPLATE_ID;
  }
  get setupStripeConnectedAccountEmailTemplateId() {
    return SETUP_STRIPE_CONNECTED_ACCOUNT_EN_EMAIL_TEMPLATE_ID;
  }
}
