import { ENV_VARS } from "./env_vars";

ENV_VARS.spannerDatabaseId = "commerce-db";
ENV_VARS.stripeSecretKeyFile = "stripe_secret_key";
ENV_VARS.stripeGrantInitPaymentCreditSecretKeyFile =
  "stripe_grant_init_payment_credit_secret_key";
ENV_VARS.stripeMarkPaymentDoneSecretKeyFile =
  "stripe_mark_payment_done_secret_key";
ENV_VARS.stripeMarkPaymentFailedSecretKeyFile =
  "stripe_mark_payment_failed_secret_key";
ENV_VARS.stripeMarkPayoutEnabledSecretKeyFile =
  "stripe_mark_payout_enabled_secret_key";
ENV_VARS.sendgridApiKeyFile = "send_grid_api_key";
ENV_VARS.releaseServiceName = "commerce-service";
ENV_VARS.port = 8080;
ENV_VARS.builderAccount = "commerce-service-builder";
ENV_VARS.serviceAccount = "commerce-service-account";
