import { CLUSTER_ENV_VARS, ClusterEnvVars } from "@phading/cluster/env_vars";

export interface EnvVars extends ClusterEnvVars {
  spannerInstanceId?: string;
  spannerDatabaseId?: string;
  stripeSecretKeyFile?: string;
  stripeCustomerUpdatedSecretKeyFile?: string;
  stripePaymentIntentSuccessSecretKeyFile?: string;
  stripePaymentIntentFailedSecretKeyFile?: string;
  stripeInitCreditAmount?: number;
  sendgridApiKeyFile?: string;
  updatePaymentMethodEnEmailTemplateId?: string;
  accountSuspensionEnEmailTemplateId?: string;
  setupStripeConnectedAccountEnEmailTemplateId?: string;
  releaseServiceName?: string;
  port?: number;
  builderAccount?: string;
  serviceAccount?: string;
  replicas?: number;
  cpu?: string;
  memory?: string;
}

export let ENV_VARS: EnvVars = CLUSTER_ENV_VARS;
