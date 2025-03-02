import { ENV_VARS } from "../../env_vars";

export default class EN {
  get locale() {
    return "en";
  }
  get totalUsage() {
    return "Total usage";
  }
  get updatePaymentMethodEmailTemplateId() {
    return ENV_VARS.updatePaymentMethodEnEmailTemplateId;
  }
  get accountSuspensionEmailTemplateId() {
    return ENV_VARS.accountSuspensionEnEmailTemplateId;
  }
  get setupStripeConnectedAccountEmailTemplateId() {
    return ENV_VARS.setupStripeConnectedAccountEnEmailTemplateId;
  }
}
