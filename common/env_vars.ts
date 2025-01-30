import { getEnvVar } from "@selfage/env_var_getter";

export let PROJECT_ID = getEnvVar("PROJECT_ID").required().asString();
export let INSTANCE_ID = getEnvVar("INSTANCE_ID").required().asString();
export let DATABASE_ID = getEnvVar("DATABASE_ID").required().asString();
export let STRIPE_SECRET_KEY = getEnvVar("STRIPE_SECRET_KEY")
  .required()
  .asString();
export let STRIPE_PAYMENT_INTENT_SUCCESS_SECRET_KEY = getEnvVar(
  "STRIPE_PAYMENT_INTENT_SUCCESS_SECRET_KEY",
)
  .required()
  .asString();
export let STRIPE_PAYMENT_INTENT_FAILED_SECRET_KEY = getEnvVar(
  "STRIPE_PAYMENT_INTENT_FAILED_SECRET_KEY",
)
  .required()
  .asString();
export let SENDGRID_API_KEY = getEnvVar("SENDGRID_API_KEY")
  .required()
  .asString();
export let FROM_EMAIL_ADDRESS = getEnvVar("FROM_EMAIL_ADDRESS")
  .required()
  .asString();
export let ACCOUNT_SUSPENSION_CONTACT_EMAIL_ADDRESS = getEnvVar(
  "ACCOUNT_SUSPENSION_CONTACT_EMAIL_ADDRESS",
)
  .required()
  .asString();
export let UPDATE_PAYMENT_METHOD_EN_EMAIL_TEMPLATE_ID = getEnvVar(
  "UPDATE_PAYMENT_METHOD_EN_EMAIL_TEMPLATE_ID",
)
  .required()
  .asString();
export let ACCOUNT_SUSPENSION_EN_EMAIL_TEMPLATE_ID = getEnvVar(
  "ACCOUNT_SUSPENSION_EN_EMAIL_TEMPLATE_ID",
)
  .required()
  .asString();
export let SETUP_STRIPE_CONNECTED_ACCOUNT_EN_EMAIL_TEMPLATE_ID = getEnvVar(
  "SETUP_STRIPE_CONNECTED_ACCOUNT_EN_EMAIL_TEMPLATE_ID",
)
  .required()
  .asString();
