import { ENV_VARS } from "../../env_vars";

export default class EN {
  get locale() {
    return "en";
  }
  get total() {
    return "Total";
  }
  get invoiceForMonth() {
    return "For the month of ";
  }
  get setupStripeConnectedAccountEmailTemplateId() {
    return ENV_VARS.setupStripeConnectedAccountEnEmailTemplateId;
  }
  get updatePaymentMethodEmailTemplateId() {
    return ENV_VARS.updatePaymentMethodEnEmailTemplateId;
  }
  get profileSuspensionEmailTemplateId() {
    return ENV_VARS.profileSuspensionEnEmailTemplateId;
  }
  get payoutDisabledEmailTemplateId() {
    return ENV_VARS.payoutDisabledEnEmailTemplateId;
  }
  get payoutSuccessEmailTemplateId() {
    return ENV_VARS.payoutSuccessEnEmailTemplateId;
  }
}
