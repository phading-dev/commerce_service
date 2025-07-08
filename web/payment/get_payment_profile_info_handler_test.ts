import "../../local/env";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import {
  InitCreditGrantingState,
  PaymentProfileState,
  PaymentState,
} from "../../db/schema";
import {
  deletePaymentProfileStatement,
  deletePaymentStatement,
  insertPaymentProfileStatement,
  insertPaymentStatement,
} from "../../db/sql";
import { GetPaymentProfileInfoHandler } from "./get_payment_profile_info_handler";
import { GET_PAYMENT_PROFILE_INFO_RESPONSE } from "@phading/commerce_service_interface/web/payment/interface";
import { CardBrand } from "@phading/commerce_service_interface/web/payment/payment_method_masked";
import { PaymentProfileState as PaymentProfileStateResponse } from "@phading/commerce_service_interface/web/payment/payment_profile";
import { FetchSessionAndCheckCapabilityResponse } from "@phading/user_session_service_interface/node/interface";
import { eqMessage } from "@selfage/message/test_matcher";
import { NodeServiceClientMock } from "@selfage/node_service_client/client_mock";
import { Ref } from "@selfage/ref";
import { assertThat, eq } from "@selfage/test_matcher";
import { TEST_RUNNER } from "@selfage/test_runner";

class HealthyButWithPaymentsTestCase {
  public constructor(
    public name: string,
    public paymentState: PaymentState,
    public expectedProfileState: PaymentProfileStateResponse,
  ) {}
  public async execute() {
    // Prepare
    await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
      await transaction.batchUpdate([
        insertPaymentProfileStatement({
          accountId: "account1",
          stateInfo: {
            state: PaymentProfileState.HEALTHY,
          },
          stripePaymentCustomerId: "stripeCustomer1",
          initCreditGrantingState: InitCreditGrantingState.GRANTED,
        }),
        insertPaymentStatement({
          accountId: "account1",
          statementId: "statement1",
          state: this.paymentState,
        }),
      ]);
      await transaction.commit();
    });
    let stripeClientMock: any = {
      customers: {
        retrieve: () => {
          return {
            invoice_settings: {},
            invoice_credit_balance: {},
          };
        },
      },
    };
    let clientMock = new NodeServiceClientMock();
    clientMock.response = {
      accountId: "account1",
      capabilities: {
        canBeBilled: true,
      },
    } as FetchSessionAndCheckCapabilityResponse;
    let handler = new GetPaymentProfileInfoHandler(
      SPANNER_DATABASE,
      new Ref(stripeClientMock),
      clientMock,
    );

    // Execute
    let response = await handler.handle("", {}, "session1");

    // Verify
    assertThat(
      response,
      eqMessage(
        {
          paymentProfile: {
            state: this.expectedProfileState,
            creditBalanceAmount: 0,
            creditBalanceCurrency: "USD",
            canClaimInitCredit: false,
          },
        },
        GET_PAYMENT_PROFILE_INFO_RESPONSE,
      ),
      "response",
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
      ]);
      await transaction.commit();
    });
  }
}

TEST_RUNNER.run({
  name: "GetPaymentProfileInfosHandlerTest",
  cases: [
    {
      name: "WithPrimaryPaymentMethodAndHealthyAndNoFailedPaymentAndCreditBalanceAndCreditNotGranted",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertPaymentProfileStatement({
              accountId: "account1",
              stateInfo: {
                state: PaymentProfileState.HEALTHY,
              },
              stripePaymentCustomerId: "stripeCustomer1",
              initCreditGrantingState: InitCreditGrantingState.NOT_GRANTED,
            }),
          ]);
          await transaction.commit();
        });
        let stripeCustomerIdCaptured: string;
        let paymentMethodStripeCustomerIdCaptured: string;
        let paymentMethodIdCaptured: string;
        let stripeClientMock: any = {
          customers: {
            retrieve: (stripeCustomerId: string) => {
              stripeCustomerIdCaptured = stripeCustomerId;
              return {
                invoice_settings: {
                  default_payment_method: "paymentMethod1",
                },
                invoice_credit_balance: {
                  usd: 2200,
                },
              };
            },
            retrievePaymentMethod: (
              paymentMethodStripeCustomerId: string,
              paymentMethodId: string,
            ) => {
              paymentMethodStripeCustomerIdCaptured =
                paymentMethodStripeCustomerId;
              paymentMethodIdCaptured = paymentMethodId;
              return {
                id: "paymentMethod1",
                card: {
                  brand: "visa",
                  last4: "1234",
                  exp_month: 12,
                  exp_year: 2023,
                },
              };
            },
          },
        };
        let clientMock = new NodeServiceClientMock();
        clientMock.response = {
          accountId: "account1",
          capabilities: {
            canBeBilled: true,
          },
        } as FetchSessionAndCheckCapabilityResponse;
        let handler = new GetPaymentProfileInfoHandler(
          SPANNER_DATABASE,
          new Ref(stripeClientMock),
          clientMock,
        );

        // Execute
        let response = await handler.handle("", {}, "session1");

        // Verify
        assertThat(
          stripeCustomerIdCaptured,
          eq("stripeCustomer1"),
          "stripeCustomerId",
        );
        assertThat(
          paymentMethodStripeCustomerIdCaptured,
          eq("stripeCustomer1"),
          "paymentMethodStripeCustomerId",
        );
        assertThat(
          paymentMethodIdCaptured,
          eq("paymentMethod1"),
          "paymentMethodId",
        );
        assertThat(
          response,
          eqMessage(
            {
              paymentProfile: {
                primaryPaymentMethod: {
                  card: {
                    brand: CardBrand.VISA,
                    lastFourDigits: "1234",
                    expMonth: 12,
                    expYear: 2023,
                  },
                },
                state: PaymentProfileStateResponse.HEALTHY,
                creditBalanceAmount: 2200,
                creditBalanceCurrency: "USD",
                canClaimInitCredit: true,
              },
            },
            GET_PAYMENT_PROFILE_INFO_RESPONSE,
          ),
          "response",
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
    new HealthyButWithPaymentsTestCase(
      "FailedWithoutInvoiceAndHealthyButWithFailedPayments",
      PaymentState.FAILED_WITHOUT_INVOICE,
      PaymentProfileStateResponse.WITH_FAILED_PAYMENTS,
    ),
    new HealthyButWithPaymentsTestCase(
      "FailedWithInvoiceAndHealthyButWithFailedPayments",
      PaymentState.FAILED_WITH_INVOICE,
      PaymentProfileStateResponse.WITH_FAILED_PAYMENTS,
    ),
    new HealthyButWithPaymentsTestCase(
      "CreatingStripeInvoiceAndHealthyButWithProcessingPayments",
      PaymentState.CREATING_STRIPE_INVOICE,
      PaymentProfileStateResponse.WITH_PROCESSING_PAYMENTS,
    ),
    new HealthyButWithPaymentsTestCase(
      "PayingInvoiceAndHealthyButWithChargingViaStripeInvoice",
      PaymentState.PAYING_INVOICE,
      PaymentProfileStateResponse.WITH_PROCESSING_PAYMENTS,
    ),
    new HealthyButWithPaymentsTestCase(
      "WaitingForInvoiceAndHealthyButWithProcessingPayments",
      PaymentState.WAITING_FOR_INVOICE_PAYMENT,
      PaymentProfileStateResponse.WITH_PROCESSING_PAYMENTS,
    ),
    {
      name: "NoPaymentMethodAndCreditGrantingAndSuspsended",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertPaymentProfileStatement({
              accountId: "account1",
              stateInfo: {
                state: PaymentProfileState.SUSPENDED,
              },
              stripePaymentCustomerId: "stripeCustomer1",
              initCreditGrantingState: InitCreditGrantingState.GRANTING,
            }),
          ]);
          await transaction.commit();
        });
        let stripeClientMock: any = {
          customers: {
            retrieve: () => {
              return {
                invoice_settings: {},
                invoice_credit_balance: {},
              };
            },
          },
        };
        let clientMock = new NodeServiceClientMock();
        clientMock.response = {
          accountId: "account1",
          capabilities: {
            canBeBilled: true,
          },
        } as FetchSessionAndCheckCapabilityResponse;
        let handler = new GetPaymentProfileInfoHandler(
          SPANNER_DATABASE,
          new Ref(stripeClientMock),
          clientMock,
        );

        // Execute
        let response = await handler.handle("", {}, "session1");

        // Verify
        assertThat(
          response,
          eqMessage(
            {
              paymentProfile: {
                state: PaymentProfileStateResponse.SUSPENDED,
                creditBalanceAmount: 0,
                creditBalanceCurrency: "USD",
                canClaimInitCredit: false,
              },
            },
            GET_PAYMENT_PROFILE_INFO_RESPONSE,
          ),
          "response",
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
    {
      name: "NoStripePaymentCustomerId",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertPaymentProfileStatement({
              accountId: "account1",
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
        let handler = new GetPaymentProfileInfoHandler(
          SPANNER_DATABASE,
          new Ref(),
          clientMock,
        );

        // Execute
        let response = await handler.handle("", {}, "session1");

        // Verify
        assertThat(
          response,
          eqMessage(
            {
              notAvailable: true,
            },
            GET_PAYMENT_PROFILE_INFO_RESPONSE,
          ),
          "response",
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
    {
      name: "NoPaymentProfile",
      execute: async () => {
        // Prepare
        let clientMock = new NodeServiceClientMock();
        clientMock.response = {
          accountId: "account1",
          capabilities: {
            canBeBilled: true,
          },
        } as FetchSessionAndCheckCapabilityResponse;
        let handler = new GetPaymentProfileInfoHandler(
          SPANNER_DATABASE,
          new Ref(),
          clientMock,
        );

        // Execute
        let response = await handler.handle("", {}, "session1");

        // Verify
        assertThat(
          response,
          eqMessage(
            {
              notAvailable: true,
            },
            GET_PAYMENT_PROFILE_INFO_RESPONSE,
          ),
          "response",
        );
      },
    },
  ],
});
