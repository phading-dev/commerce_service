import { ENV_VARS } from "./env_vars";

ENV_VARS.spannerDatabaseId = "commerce-db";
ENV_VARS.stripeSecretKeyFile = "stripe_secret_key";
ENV_VARS.stripePaymentIntentSuccessSecretKeyFile =
  "stripe_payment_intent_success_secret_key";
ENV_VARS.stripePaymentIntentFailedSecretKeyFile =
  "stripe_payment_intent_failed_secret_key";
ENV_VARS.sendgridApiKeyFile = "send_grid_api_key";
ENV_VARS.releaseServiceName = "commerce-service";
ENV_VARS.port = 8080;
ENV_VARS.builderAccount = "commerce-service-builder";
ENV_VARS.serviceAccount = "commerce-service-account";
