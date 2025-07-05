import getStream = require("get-stream");
import http = require("http");
import { initSendgridClient } from "./common/sendgrid_client";
import { STORAGE_CLIENT } from "./common/storage_client";
import { initStripeClient } from "./common/stripe_client";
import { ENV_VARS } from "./env_vars";
import { CreatePaymentProfileHandler } from "./node/create_payment_profile_handler";
import { CreatePayoutProfileHandler } from "./node/create_payout_profile_handler";
import { GenerateTransactionStatementHandler } from "./node/generate_transaction_statement_handler";
import { ListInitPaymentCreditGrantingTasksHandler } from "./node/list_init_payment_credit_granting_tasks_handler";
import { ListPaymentMethodNeedsUpdateNotifyingTasksHandler } from "./node/list_payment_method_needs_update_notifying_tasks_handler";
import { ListPaymentProfileStateSyncingTasksHandler } from "./node/list_payment_profile_state_syncing_tasks_handler";
import { ListPaymentProfileSuspendingDueToPastDueTasksHandler } from "./node/list_payment_profile_suspending_due_to_past_due_tasks_handler";
import { ListPaymentProfileSuspensionNotifyingTasksHandler } from "./node/list_payment_profile_suspension_notifying_tasks_handler";
import { ListPaymentTasksHandler } from "./node/list_payment_tasks_handler";
import { ListPayoutTasksHandler } from "./node/list_payout_tasks_handler";
import { ListStripeConnectedAccountCreatingTasksHandler } from "./node/list_stripe_connected_account_creating_tasks_handler";
import { ListStripeConnectedAccountNeedsSetupNotifyingTasksHandler } from "./node/list_stripe_connected_account_needs_setup_notifying_tasks_handler";
import { ListStripePaymentCustomerCreatingTasksHandler } from "./node/list_stripe_payment_customer_creating_tasks_handler";
import { ProcessInitPaymentCreditGrantingTaskHandler } from "./node/process_init_payment_credit_granting_task_handler";
import { ProcessPaymentMethodNeedsUpdateNotifyingTaskHandler } from "./node/process_payment_method_needs_update_notifying_task_handler";
import { ProcessPaymentProfileStateSyncingTaskHandler } from "./node/process_payment_profile_state_syncing_task_handler";
import { ProcessPaymentProfileSuspendingDueToPastDueTaskHandler } from "./node/process_payment_profile_suspending_due_to_past_due_task_handler";
import { ProcessPaymentProfileSuspensionNotifyingTaskHandler } from "./node/process_payment_profile_suspension_notifying_task_handler";
import { ProcessPaymentTaskHandler } from "./node/process_payment_task_handler";
import { ProcessPayoutTaskHandler } from "./node/process_payout_task_handler";
import { ProcessStripeConnectedAccountCreatingTaskHandler } from "./node/process_stripe_connected_account_creating_task_handler";
import { ProcessStripeConnectedAccountNeedsSetupNotifyingTaskHandler } from "./node/process_stripe_connected_account_needs_setup_notifying_task_handler";
import { ProcessStripePaymentCustomerCreatingTaskHandler } from "./node/process_stripe_payment_customer_creating_task_handler";
import { CreateStripeSessionToAddPaymentMethodHandler } from "./web/payment/create_stripe_session_to_add_payment_method_handler";
import { GetPaymentProfileInfoHandler } from "./web/payment/get_payment_profile_info_handler";
import { ListPaymentsHandler } from "./web/payment/list_payments_handler";
import { ReplacePrimaryPaymentMethodHandler } from "./web/payment/replace_primary_payment_method_handler";
import { RetryFailedPaymentsHandler } from "./web/payment/retry_failed_payments_handler";
import { GetPayoutProfileInfoHandler } from "./web/payout/get_payout_profile_info_handler";
import { ListPayoutsHandler } from "./web/payout/list_payouts_handler";
import { SetConnectedAccountOnboardedHandler } from "./web/payout/set_connected_account_onboarded_handler";
import { ListTransactionStatementsHandler } from "./web/statements/list_transaction_statements_handler";
import { GrantInitPaymentCreditHandler } from "./web/stripe_webhook/grant_init_payment_credit_handler";
import { MarkPaymentDoneHandler } from "./web/stripe_webhook/mark_payment_done_handler";
import { MarkPaymentFailedHandler } from "./web/stripe_webhook/mark_payment_failed_handler";
import {
  COMMERCE_NODE_SERVICE,
  COMMERCE_WEB_SERVICE,
} from "@phading/commerce_service_interface/service";
import { ServiceHandler } from "@selfage/service_handler/service_handler";

async function main() {
  let [
    stripeCustomerUpdatedSecretKey,
    stripePaymentIntentSuccessSecretKey,
    stripePaymentIntentFailedSecretKey,
  ] = await Promise.all([
    getStream(
      STORAGE_CLIENT.bucket(ENV_VARS.gcsSecretBucketName)
        .file(ENV_VARS.stripeCustomerUpdatedSecretKeyFile)
        .createReadStream(),
    ),
    getStream(
      STORAGE_CLIENT.bucket(ENV_VARS.gcsSecretBucketName)
        .file(ENV_VARS.stripePaymentIntentSuccessSecretKeyFile)
        .createReadStream(),
    ),
    getStream(
      STORAGE_CLIENT.bucket(ENV_VARS.gcsSecretBucketName)
        .file(ENV_VARS.stripePaymentIntentFailedSecretKeyFile)
        .createReadStream(),
    ),
    initStripeClient(),
    initSendgridClient(),
  ]);
  let service = ServiceHandler.create(
    http.createServer(),
    ENV_VARS.externalOrigin,
  )
    .addCorsAllowedPreflightHandler()
    .addHealthCheckHandler()
    .addReadinessHandler()
    .addMetricsHandler();
  service
    .addHandlerRegister(COMMERCE_NODE_SERVICE)
    .add(CreatePaymentProfileHandler.create())
    .add(CreatePayoutProfileHandler.create())
    .add(GenerateTransactionStatementHandler.create())
    .add(ListInitPaymentCreditGrantingTasksHandler.create())
    .add(ListPaymentMethodNeedsUpdateNotifyingTasksHandler.create())
    .add(ListPaymentProfileStateSyncingTasksHandler.create())
    .add(ListPaymentProfileSuspendingDueToPastDueTasksHandler.create())
    .add(ListPaymentProfileSuspensionNotifyingTasksHandler.create())
    .add(ListPaymentTasksHandler.create())
    .add(ListPayoutTasksHandler.create())
    .add(ListStripeConnectedAccountCreatingTasksHandler.create())
    .add(ListStripeConnectedAccountNeedsSetupNotifyingTasksHandler.create())
    .add(ListStripePaymentCustomerCreatingTasksHandler.create())
    .add(ProcessInitPaymentCreditGrantingTaskHandler.create())
    .add(ProcessPaymentMethodNeedsUpdateNotifyingTaskHandler.create())
    .add(ProcessPaymentProfileStateSyncingTaskHandler.create())
    .add(ProcessPaymentProfileSuspendingDueToPastDueTaskHandler.create())
    .add(ProcessPaymentProfileSuspensionNotifyingTaskHandler.create())
    .add(ProcessPaymentTaskHandler.create())
    .add(ProcessPayoutTaskHandler.create())
    .add(ProcessStripeConnectedAccountCreatingTaskHandler.create())
    .add(ProcessStripeConnectedAccountNeedsSetupNotifyingTaskHandler.create())
    .add(ProcessStripePaymentCustomerCreatingTaskHandler.create());
  service
    .addHandlerRegister(COMMERCE_WEB_SERVICE)
    .add(CreateStripeSessionToAddPaymentMethodHandler.create())
    .add(GetPaymentProfileInfoHandler.create())
    .add(ListPaymentsHandler.create())
    .add(ReplacePrimaryPaymentMethodHandler.create())
    .add(RetryFailedPaymentsHandler.create())
    .add(GetPayoutProfileInfoHandler.create())
    .add(ListPayoutsHandler.create())
    .add(SetConnectedAccountOnboardedHandler.create())
    .add(ListTransactionStatementsHandler.create())
    .add(GrantInitPaymentCreditHandler.create(stripeCustomerUpdatedSecretKey))
    .add(MarkPaymentDoneHandler.create(stripePaymentIntentSuccessSecretKey))
    .add(MarkPaymentFailedHandler.create(stripePaymentIntentFailedSecretKey));
  await service.start(ENV_VARS.port);
}

main();
