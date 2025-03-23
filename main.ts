import getStream = require("get-stream");
import http = require("http");
import { initSendgridClient } from "./common/sendgrid_client";
import { STORAGE_CLIENT } from "./common/storage_client";
import { initStripeClient } from "./common/stripe_client";
import { ENV_VARS } from "./env_vars";
import { CreateBillingProfileHandler } from "./node/create_billing_profile_handler";
import { CreateEarningsProfileHandler } from "./node/create_earnings_profile_handler";
import { GenerateTransactionStatementHandler } from "./node/generate_transaction_statement_handler";
import { ListBillingProfileStateSyncingTasksHandler } from "./node/list_billing_profile_state_syncing_tasks_handler";
import { ListBillingProfileSuspendingDueToPastDueTasksHandler } from "./node/list_billing_profile_suspending_due_to_past_due_tasks_handler";
import { ListBillingProfileSuspensionNotifyingTasksHandler } from "./node/list_billing_profile_suspension_notifying_tasks_handler";
import { ListPaymentMethodNeedsUpdateNotifyingTasksHandler } from "./node/list_payment_method_needs_update_notifying_tasks_handler";
import { ListPaymentTasksHandler } from "./node/list_payment_tasks_handler";
import { ListPayoutTasksHandler } from "./node/list_payout_tasks_handler";
import { ListStripeConnectedAccountCreatingTasksHandler } from "./node/list_stripe_connected_account_creating_tasks_handler";
import { ListStripeConnectedAccountNeedsSetupNotifyingTasksHandler } from "./node/list_stripe_connected_account_needs_setup_notifying_tasks_handler";
import { ListStripePaymentCustomerCreatingTasksHandler } from "./node/list_stripe_payment_customer_creating_tasks_handler";
import { ProcessBillingProfileStateSyncingTaskHandler } from "./node/process_billing_profile_state_syncing_task_handler";
import { ProcessBillingProfileSuspendingDueToPastDueTaskHandler } from "./node/process_billing_profile_suspending_due_to_past_due_task_handler";
import { ProcessBillingProfileSuspensionNotifyingTaskHandler } from "./node/process_billing_profile_suspension_notifying_task_handler";
import { ProcessPaymentMethodNeedsUpdateNotifyingTaskHandler } from "./node/process_payment_method_needs_update_notifying_task_handler";
import { ProcessPaymentTaskHandler } from "./node/process_payment_task_handler";
import { ProcessPayoutTaskHandler } from "./node/process_payout_task_handler";
import { ProcessStripeConnectedAccountCreatingTaskHandler } from "./node/process_stripe_connected_account_creating_task_handler";
import { ProcessStripeConnectedAccountNeedsSetupNotifyingTaskHandler } from "./node/process_stripe_connected_account_needs_setup_notifying_task_handler";
import { ProcessStripePaymentCustomerCreatingTaskHandler } from "./node/process_stripe_payment_customer_creating_task_handler";
import { CreateStripeSessionToAddPaymentMethodHandler } from "./web/billing/create_stripe_session_to_add_payment_method_handler";
import { GetPrimaryPaymentMethodHandler } from "./web/billing/get_primary_payment_method_handler";
import { ReplacePrimaryPaymentMethodHandler } from "./web/billing/replace_primary_payment_method_handler";
import { ListTransactionStatementsHandler } from "./web/documents/list_transaction_statements_handler";
import { GetConnectedAccountLinkHandler } from "./web/earnings/get_connected_account_link_handler";
import { SetConnectedAccountOnboardedHandler } from "./web/earnings/set_connected_account_onboarded_handler";
import { MarkPaymentDoneHandler } from "./web/stripe_webhook/mark_payment_done_handler";
import { MarkPaymentFailedHandler } from "./web/stripe_webhook/mark_payment_failed_handler";
import {
  COMMERCE_NODE_SERVICE,
  COMMERCE_WEB_SERVICE,
} from "@phading/commerce_service_interface/service";
import { ServiceHandler } from "@selfage/service_handler/service_handler";

async function main() {
  let [
    stripePaymentIntentSuccessSecretKey,
    stripePaymentIntentFailedSecretKey,
  ] = await Promise.all([
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
  let service = ServiceHandler.create(http.createServer())
    .addCorsAllowedPreflightHandler()
    .addHealthCheckHandler()
    .addMetricsHandler();
  service
    .addHandlerRegister(COMMERCE_NODE_SERVICE)
    .add(CreateBillingProfileHandler.create())
    .add(CreateEarningsProfileHandler.create())
    .add(GenerateTransactionStatementHandler.create())
    .add(ListBillingProfileStateSyncingTasksHandler.create())
    .add(ListBillingProfileSuspendingDueToPastDueTasksHandler.create())
    .add(ListBillingProfileSuspensionNotifyingTasksHandler.create())
    .add(ListPaymentMethodNeedsUpdateNotifyingTasksHandler.create())
    .add(ListPaymentTasksHandler.create())
    .add(ListPayoutTasksHandler.create())
    .add(ListStripeConnectedAccountCreatingTasksHandler.create())
    .add(ListStripeConnectedAccountNeedsSetupNotifyingTasksHandler.create())
    .add(ListStripePaymentCustomerCreatingTasksHandler.create())
    .add(ProcessBillingProfileStateSyncingTaskHandler.create())
    .add(ProcessBillingProfileSuspendingDueToPastDueTaskHandler.create())
    .add(ProcessBillingProfileSuspensionNotifyingTaskHandler.create())
    .add(ProcessPaymentMethodNeedsUpdateNotifyingTaskHandler.create())
    .add(ProcessPaymentTaskHandler.create())
    .add(ProcessPayoutTaskHandler.create())
    .add(ProcessStripeConnectedAccountCreatingTaskHandler.create())
    .add(ProcessStripeConnectedAccountNeedsSetupNotifyingTaskHandler.create())
    .add(ProcessStripePaymentCustomerCreatingTaskHandler.create());
  service
    .addHandlerRegister(COMMERCE_WEB_SERVICE)
    .add(CreateStripeSessionToAddPaymentMethodHandler.create())
    .add(GetPrimaryPaymentMethodHandler.create())
    .add(ReplacePrimaryPaymentMethodHandler.create())
    .add(ListTransactionStatementsHandler.create())
    .add(GetConnectedAccountLinkHandler.create())
    .add(SetConnectedAccountOnboardedHandler.create())
    .add(MarkPaymentDoneHandler.create(stripePaymentIntentSuccessSecretKey))
    .add(MarkPaymentFailedHandler.create(stripePaymentIntentFailedSecretKey));
  await service.start(ENV_VARS.port);
}

main();
