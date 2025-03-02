import "../../local/env";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import { PaymentState } from "../../db/schema";
import {
  GET_BILLING_ROW,
  deleteBillingStatement,
  getBilling,
  insertBillingStatement,
} from "../../db/sql";
import { MarkPaymentDoneHandler } from "./mark_payment_done_handler";
import { eqMessage } from "@selfage/message/test_matcher";
import { Ref } from "@selfage/ref";
import { assertThat, eq, isArray } from "@selfage/test_matcher";
import { TEST_RUNNER } from "@selfage/test_runner";
import { Readable } from "stream";

TEST_RUNNER.run({
  name: "MarkPaymentDoneHandlerTest",
  cases: [
    {
      name: "Success",
      execute: async () => {
        // Prepare
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([
            insertBillingStatement({
              accountId: "account1",
              billingId: "billing1",
              state: PaymentState.CHARGING,
              month: "2024-10",
            }),
          ]);
          await transaction.commit();
        });
        let payloadCaptured: string;
        let sigCaptured: string;
        let secretCaptured: string;
        let invoiceIdCaptured: string;
        let stripeClientMock: any = {
          webhooks: {
            constructEvent: (payload: string, sig: string, secret: string) => {
              payloadCaptured = payload;
              sigCaptured = sig;
              secretCaptured = secret;
              return {
                type: "payment_intent.succeeded",
                data: {
                  object: {
                    invoice: "invoice1",
                  },
                },
              };
            },
          },
          invoices: {
            retrieve: async (invoiceId: string) => {
              invoiceIdCaptured = invoiceId;
              return {
                metadata: {
                  billingId: "billing1",
                },
              };
            },
          },
        };
        let handler = new MarkPaymentDoneHandler(
          SPANNER_DATABASE,
          new Ref(stripeClientMock),
          "secret1",
        );

        // Execute
        await handler.handle("", Readable.from("event_input"), "sig1");

        // Verify
        assertThat(payloadCaptured, eq("event_input"), "payload");
        assertThat(sigCaptured, eq("sig1"), "sig");
        assertThat(secretCaptured, eq("secret1"), "secret");
        assertThat(invoiceIdCaptured, eq("invoice1"), "invoiceId");
        assertThat(
          await getBilling(SPANNER_DATABASE, "billing1"),
          isArray([
            eqMessage(
              {
                billingData: {
                  accountId: "account1",
                  billingId: "billing1",
                  state: PaymentState.PAID,
                  month: "2024-10",
                },
              },
              GET_BILLING_ROW,
            ),
          ]),
          "billing",
        );
      },
      tearDown: async () => {
        await SPANNER_DATABASE.runTransactionAsync(async (transaction) => {
          await transaction.batchUpdate([deleteBillingStatement("billing1")]);
          await transaction.commit();
        });
      },
    },
  ],
});
