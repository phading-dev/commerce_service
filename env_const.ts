import { ENV_VARS } from "./env_vars";

ENV_VARS.spannerDatabaseId = "commerce-db";
ENV_VARS.stripeSecretKeyFile = "stripe_secret_key";
ENV_VARS.stripePaymentIntentSuccessSecretKeyFile =
  "stripe_payment_intent_success_secret_key";
ENV_VARS.stripePaymentIntentFailedSecretKeyFile =
  "stripe_payment_intent_failed_secret_key";
ENV_VARS.sendgridApiKeyFile = "send_grid_api_key";
ENV_VARS.fromEmailAddress = "contact-test@ykuyo.com";
ENV_VARS.accountSuspensionContactEmailAddress = "contact-test@ykuyo.com";
ENV_VARS.updatePaymentMethodEnEmailTemplateId =
  "d-ff7a366080984aa5a00231e211214943";
ENV_VARS.accountSuspensionEnEmailTemplateId =
  "d-a52bef48f029473498cc69c5a29c4b23";
ENV_VARS.setupStripeConnectedAccountEnEmailTemplateId =
  "d-355d950b920a4557a5c0ee35a40f1020";
ENV_VARS.releaseServiceName = "commerce-service";
ENV_VARS.port = 8080;
ENV_VARS.builderAccount = "commerce-service-builder";
ENV_VARS.serviceAccount = "commerce-service-account";
