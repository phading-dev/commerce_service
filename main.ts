import getStream = require("get-stream");
import http = require("http");
import { initSendgridClient } from "./common/sendgrid_client";
import { STORAGE_CLIENT } from "./common/storage_client";
import { initStripeClient } from "./common/stripe_client";
import { ENV_VARS } from "./env";
import { CreateBillingAccountHandler } from "./node/create_billing_account_handler";
import { CreateEarningsAccountHandler } from "./node/create_earnings_account_handler";
import { ListBillingAccountStateSyncingTasksHandler } from "./node/list_billing_account_state_syncing_tasks_handler";
import { ListBillingAccountSuspendingDueToPastDueTasksHandler } from "./node/list_billing_account_suspending_due_to_past_due_tasks_handler";
import { ListBillingAccountSuspensionNotifyingTasksHandler } from "./node/list_billing_account_suspension_notifying_tasks_handler";
import { ListPaymentTasksHandler } from "./node/list_payment_tasks_handler";
import { ListPayoutTasksHandler } from "./node/list_payout_tasks_handler";
import { ListSetupStripeConnectedAccountNotifyingTasksHandler } from "./node/list_setup_stripe_connected_account_notifying_tasks_handler";
import { ListStripeConnectedAccountCreatingTasksHandler } from "./node/list_stripe_connected_account_creating_tasks_handler";
import { ListStripeCustomerCreatingTasksHandler } from "./node/list_stripe_customer_creating_tasks_handler";
import { ListUpdatePaymentMethodNotifyingTasksHandler } from "./node/list_update_payment_method_notifying_tasks_handler";
import { ProcessBillingAccountStateSyncingTaskHandler } from "./node/process_billing_account_state_syncing_task_handler";
import { ProcessBillingAccountSuspendingDueToPastDueTaskHandler } from "./node/process_billing_account_suspending_due_to_past_due_task_handler";
import { ProcessBillingAccountSuspensionNotifyingTaskHandler } from "./node/process_billing_account_suspension_notifying_task_handler";
import { ProcessPaymentTaskHandler } from "./node/process_payment_task_handler";
import { ProcessPayoutTaskHandler } from "./node/process_payout_task_handler";
import { ProcessSetupStripeConnectedAccountNotifyingTaskHandler } from "./node/process_setup_stripe_connected_account_notifying_task_handler";
import { ProcessStripeConnectedAccountCreatingTaskHandler } from "./node/process_stripe_connected_account_creating_task_handler";
import { ProcessStripeCustomerCreatingTaskHandler } from "./node/process_stripe_customer_creating_task_handler";
import { ProcessUpdatePaymentMethodNotifyingTaskHandler } from "./node/process_update_payment_method_notifying_task_handler";
import { ReportBillingHandler } from "./node/report_billing_handler";
import { ReportEarningsHandler } from "./node/report_earnings_handler";
import { CreateStripeSessionToAddPaymentMethodHandler } from "./web/billing/create_stripe_session_to_add_payment_method_handler";
import { GetPrimaryPaymentMethodHandler } from "./web/billing/get_primary_payment_methods_handler";
import { ListBillingsHandler } from "./web/billing/list_billings_handler";
import { ReplacePrimaryPaymentMethodHandler } from "./web/billing/replace_primary_payment_method_handler";
import { GetConnectedAccountLinkHandler } from "./web/earnings/get_connected_account_link_handler";
import { ListEarningsHandler } from "./web/earnings/list_earnings_handler";
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
    .add(CreateBillingAccountHandler.create())
    .add(CreateEarningsAccountHandler.create())
    .add(ListBillingAccountStateSyncingTasksHandler.create())
    .add(ListBillingAccountSuspendingDueToPastDueTasksHandler.create())
    .add(ListBillingAccountSuspensionNotifyingTasksHandler.create())
    .add(ListPaymentTasksHandler.create())
    .add(ListPayoutTasksHandler.create())
    .add(ListSetupStripeConnectedAccountNotifyingTasksHandler.create())
    .add(ListStripeConnectedAccountCreatingTasksHandler.create())
    .add(ListStripeCustomerCreatingTasksHandler.create())
    .add(ListUpdatePaymentMethodNotifyingTasksHandler.create())
    .add(ProcessBillingAccountStateSyncingTaskHandler.create())
    .add(ProcessBillingAccountSuspendingDueToPastDueTaskHandler.create())
    .add(ProcessBillingAccountSuspensionNotifyingTaskHandler.create())
    .add(ProcessPaymentTaskHandler.create())
    .add(ProcessPayoutTaskHandler.create())
    .add(ProcessSetupStripeConnectedAccountNotifyingTaskHandler.create())
    .add(ProcessStripeConnectedAccountCreatingTaskHandler.create())
    .add(ProcessStripeCustomerCreatingTaskHandler.create())
    .add(ProcessUpdatePaymentMethodNotifyingTaskHandler.create())
    .add(ReportBillingHandler.create())
    .add(ReportEarningsHandler.create());
  service
    .addHandlerRegister(COMMERCE_WEB_SERVICE)
    .add(CreateStripeSessionToAddPaymentMethodHandler.create())
    .add(GetPrimaryPaymentMethodHandler.create())
    .add(ListBillingsHandler.create())
    .add(ReplacePrimaryPaymentMethodHandler.create())
    .add(GetConnectedAccountLinkHandler.create())
    .add(ListEarningsHandler.create())
    .add(SetConnectedAccountOnboardedHandler.create())
    .add(MarkPaymentDoneHandler.create(stripePaymentIntentSuccessSecretKey))
    .add(MarkPaymentFailedHandler.create(stripePaymentIntentFailedSecretKey));
  await service.start(ENV_VARS.port);
}

main();
