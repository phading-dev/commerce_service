import "../env_const";
import "@phading/cluster/dev/env";
import { ENV_VARS } from "../env_vars";

ENV_VARS.spannerInstanceId = ENV_VARS.balancedSpannerInstanceId;
ENV_VARS.setupStripeConnectedAccountEnEmailTemplateId =
  "d-355d950b920a4557a5c0ee35a40f1020";
ENV_VARS.updatePaymentMethodEnEmailTemplateId =
  "d-ff7a366080984aa5a00231e211214943";
ENV_VARS.profileSuspensionEnEmailTemplateId =
  "d-a52bef48f029473498cc69c5a29c4b23";
ENV_VARS.payoutDisabledEnEmailTemplateId = 
  "d-e6d04c0bdf1341b288dab65e082bcfb1";
ENV_VARS.payoutSuccessEnEmailTemplateId =
  "d-a77aa1de771343a1a442f9da7b74ecb6";
ENV_VARS.replicas = 1;
ENV_VARS.cpu = "400m";
ENV_VARS.memory = "512Mi";
