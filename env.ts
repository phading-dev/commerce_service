import { CLUSTER_ENV_VARS, ClusterEnvVars } from "@phading/cluster/env";

export interface EnvVars extends ClusterEnvVars {
  spannerInstanceId?: string;
  spannerDatabaseId?: string;
  stripeSecretKeyFile?: string;
  stripePaymentIntentSuccessSecretKeyFile?: string;
  stripePaymentIntentFailedSecretKeyFile?: string;
  sendgridApiKeyFile?: string;
  fromEmailAddress?: string;
  accountSuspensionContactEmailAddress?: string;
  updatePaymentMethodEnEmailTemplateId?: string;
  accountSuspensionEnEmailTemplateId?: string;
  setupStripeConnectedAccountEnEmailTemplateId?: string;
  releaseServiceName?: string;
  port?: number;
  builderAccount?: string;
  serviceAccount?: string;
}

export let ENV_VARS: EnvVars = CLUSTER_ENV_VARS;
