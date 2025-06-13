import "../env_const";
import "@phading/cluster/dev/env";
import { ENV_VARS } from "../env_vars";

ENV_VARS.spannerInstanceId = ENV_VARS.balancedSpannerInstanceId;
ENV_VARS.updatePaymentMethodEnEmailTemplateId =
  "d-ff7a366080984aa5a00231e211214943";
ENV_VARS.accountSuspensionEnEmailTemplateId =
  "d-a52bef48f029473498cc69c5a29c4b23";
ENV_VARS.setupStripeConnectedAccountEnEmailTemplateId =
  "d-355d950b920a4557a5c0ee35a40f1020";
