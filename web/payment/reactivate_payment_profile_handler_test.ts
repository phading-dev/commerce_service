import "../../local/env";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import { PaymentProfileState, PaymentState } from "../../db/schema";
import {
  GET_PAYMENT_PROFILE_ROW,
  LIST_PENDING_PAYMENT_PROFILE_STATE_SYNCING_TASKS_ROW,
  deletePaymentProfileStateSyncingTaskStatement,
  deletePaymentProfileStatement,
  deletePaymentStatement,
  getPaymentProfile,
  insertPaymentProfileStateSyncingTaskStatement,
  insertPaymentProfileStatement,
  insertPaymentStatement,
  listPendingPaymentProfileStateSyncingTasks,
} from "../../db/sql";
import { ReactivatePaymentProfileHandler } from "./reactivate_payment_profile_handler";
import { FetchSessionAndCheckCapabilityResponse } from "@phading/user_session_service_interface/node/interface";
import { newBadRequestError } from "@selfage/http_error";
import { eqMessage } from "@selfage/message/test_matcher";
import { NodeServiceClientMock } from "@selfage/node_service_client/client_mock";
import {
  assertReject,
  assertThat,
  eqError,
  isArray,
} from "@selfage/test_matcher";
import { TEST_RUNNER } from "@selfage/test_runner";

class WithOutstandingPaymentsTestCase {
  public constructor(
    public name: string,
    private paymentState: PaymentState,
  ) {}
  public async execute() {
    // Prepare
    await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
      await transaction.batchUpdate([
        insertPaymentProfileStatement({
          accountId: "account1",
          stateInfo: {
            state: PaymentProfileState.SUSPENDED,
            version: 1,
          },
        }),
        insertPaymentStatement({
          accountId: "account1",
          statementId: "statement1",
          state: this.paymentState,
        }),
      ]);
      await transaction.commit();
    });
    let clientMock = new NodeServiceClientMock();
    clientMock.response = {
      accountId: "account1",
      capabilities: {
        canBeBilled: true,
      },
    } as FetchSessionAndCheckCapabilityResponse;
    let handler = new ReactivatePaymentProfileHandler(
      SPANNER_DATABASE,
      clientMock,
      () => 1000,
    );

    // Execute
    let error = await assertReject(handler.handle("", {}, "session1"));

    // Verify
    assertThat(
      error,
      eqError(
        newBadRequestError(
          "cannot be reactivated due to failed or processing payments",
        ),
      ),
      "error",
    );
  }
  public async tearDown() {
    await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
      await transaction.batchUpdate([
        deletePaymentProfileStatement({
          paymentProfileAccountIdEq: "account1",
        }),
        deletePaymentStatement({
          paymentStatementIdEq: "statement1",
        }),
        deletePaymentProfileStateSyncingTaskStatement({
          paymentProfileStateSyncingTaskAccountIdEq: "account1",
          paymentProfileStateSyncingTaskVersionEq: 1,
        }),
      ]);
      await transaction.commit();
    });
  }
}

TEST_RUNNER.run({
  name: "ReactivatePaymentProfileHandlerTest",
  cases: [
    {
      name: "Success",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertPaymentProfileStatement({
              accountId: "account1",
              stateInfo: {
                state: PaymentProfileState.SUSPENDED,
                version: 1,
              },
            }),
            insertPaymentProfileStateSyncingTaskStatement({
              accountId: "account1",
              version: 1,
            }),
          ]);
          await transaction.commit();
        });
        let clientMock = new NodeServiceClientMock();
        clientMock.response = {
          accountId: "account1",
          capabilities: {
            canBeBilled: true,
          },
        } as FetchSessionAndCheckCapabilityResponse;
        let handler = new ReactivatePaymentProfileHandler(
          SPANNER_DATABASE,
          clientMock,
          () => 1000,
        );

        // Execute
        await handler.handle("", {}, "session1");

        // Verify
        assertThat(
          await getPaymentProfile(SPANNER_DATABASE, {
            paymentProfileAccountIdEq: "account1",
          }),
          isArray([
            eqMessage(
              {
                paymentProfileAccountId: "account1",
                paymentProfileStateInfo: {
                  state: PaymentProfileState.HEALTHY,
                  version: 2,
                  updatedTimeMs: 1000,
                },
              },
              GET_PAYMENT_PROFILE_ROW,
            ),
          ]),
          "paymentProfile",
        );
        assertThat(
          await listPendingPaymentProfileStateSyncingTasks(SPANNER_DATABASE, {
            paymentProfileStateSyncingTaskExecutionTimeMsLe: 1000000,
          }),
          isArray([
            eqMessage(
              {
                paymentProfileStateSyncingTaskAccountId: "account1",
                paymentProfileStateSyncingTaskVersion: 2,
              },
              LIST_PENDING_PAYMENT_PROFILE_STATE_SYNCING_TASKS_ROW,
            ),
          ]),
          "pendingPaymentProfileStateSyncingTasks",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deletePaymentProfileStatement({
              paymentProfileAccountIdEq: "account1",
            }),
            deletePaymentProfileStateSyncingTaskStatement({
              paymentProfileStateSyncingTaskAccountIdEq: "account1",
              paymentProfileStateSyncingTaskVersionEq: 1,
            }),
            deletePaymentProfileStateSyncingTaskStatement({
              paymentProfileStateSyncingTaskAccountIdEq: "account1",
              paymentProfileStateSyncingTaskVersionEq: 2,
            }),
          ]);
          await transaction.commit();
        });
      },
    },
    {
      name: "PaymentProfileHealthy",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertPaymentProfileStatement({
              accountId: "account1",
              stateInfo: {
                state: PaymentProfileState.HEALTHY,
                version: 1,
              },
            }),
          ]);
          await transaction.commit();
        });
        let clientMock = new NodeServiceClientMock();
        clientMock.response = {
          accountId: "account1",
          capabilities: {
            canBeBilled: true,
          },
        } as FetchSessionAndCheckCapabilityResponse;
        let handler = new ReactivatePaymentProfileHandler(
          SPANNER_DATABASE,
          clientMock,
          () => 1000,
        );

        // Execute
        let error = await assertReject(handler.handle("", {}, "session1"));

        // Verify
        assertThat(
          error,
          eqError(
            newBadRequestError(
              "Payment profile for account account1 is not suspended.",
            ),
          ),
          "error",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            deletePaymentProfileStatement({
              paymentProfileAccountIdEq: "account1",
            }),
          ]);
          await transaction.commit();
        });
      },
    },
    new WithOutstandingPaymentsTestCase(
      "WithFailedWithoutInvoicePayments",
      PaymentState.FAILED_WITHOUT_INVOICE,
    ),
    new WithOutstandingPaymentsTestCase(
      "WithFailedWithInvoicePayments",
      PaymentState.FAILED_WITH_INVOICE,
    ),
    new WithOutstandingPaymentsTestCase(
      "WithCreatingStripeInvoicePayments",
      PaymentState.CREATING_STRIPE_INVOICE,
    ),
    new WithOutstandingPaymentsTestCase(
      "WithPayingInvoicePayments",
      PaymentState.PAYING_INVOICE,
    ),
    new WithOutstandingPaymentsTestCase(
      "WithWaitingForInvoicePayments",
      PaymentState.WAITING_FOR_INVOICE_PAYMENT,
    ),
  ],
});
