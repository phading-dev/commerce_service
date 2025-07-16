import { CLUSTER_ENV_VARS, ClusterEnvVars } from "@phading/cluster/env_vars";

export interface EnvVars extends ClusterEnvVars {
  spannerInstanceId?: string;
  spannerDatabaseId?: string;
  stripeSecretKeyFile?: string;
  stripeGrantInitPaymentCreditSecretKeyFile?: string;
  stripeMarkPaymentDoneSecretKeyFile?: string;
  stripeMarkPaymentFailedSecretKeyFile?: string;
  stripeMarkPayoutEnabledSecretKeyFile?: string;
  sendgridApiKeyFile?: string;
  setupStripeConnectedAccountEnEmailTemplateId?: string;
  updatePaymentMethodEnEmailTemplateId?: string;
  profileSuspensionEnEmailTemplateId?: string;
  payoutDisabledEnEmailTemplateId?: string;
  payoutSuccessEnEmailTemplateId?: string;
  releaseServiceName?: string;
  port?: number;
  builderAccount?: string;
  serviceAccount?: string;
  replicas?: number;
  cpu?: string;
  memory?: string;
}

export let ENV_VARS: EnvVars = CLUSTER_ENV_VARS;
