import getStream from "get-stream";
import Stripe from "stripe";
import { CUSTOMER_METADATA_ACCOUNT_ID_KEY } from "../../common/constants";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import { STRIPE_CLIENT } from "../../common/stripe_client";
import { InitCreditGrantingState } from "../../db/schema";
import {
  getPaymentCardGrantedInitCredit,
  getPaymentProfile,
  insertInitPaymentCreditGrantingTaskStatement,
  insertPaymentCardGrantedInitCreditStatement,
  updatePaymentProfileInitCreditGrantingStateStatement,
} from "../../db/sql";
import { Database } from "@google-cloud/spanner";
import { GrantInitPaymentCreditHandlerInterface } from "@phading/commerce_service_interface/web/stripe_webhook/handler";
import { Empty } from "@phading/commerce_service_interface/web/stripe_webhook/interface";
import {
  newBadRequestError,
  newInternalServerErrorError,
} from "@selfage/http_error";
import { Ref } from "@selfage/ref";
import { Readable } from "stream";

export class GrantInitPaymentCreditHandler extends GrantInitPaymentCreditHandlerInterface {
  public static create(
    stripePaymentIntentFailedSecretKey: string,
  ): GrantInitPaymentCreditHandler {
    return new GrantInitPaymentCreditHandler(
      SPANNER_DATABASE,
      STRIPE_CLIENT,
      () => Date.now(),
      stripePaymentIntentFailedSecretKey,
    );
  }

  public constructor(
    private database: Database,
    private stripeClient: Ref<Stripe>,
    private getNow: () => number,
    private stripeSecretKey: string,
  ) {
    super();
  }

  public async handle(
    loggingPrefix: string,
    body: Readable,
    sessionStr: string,
  ): Promise<Empty> {
    let event = this.stripeClient.val.webhooks.constructEvent(
      await getStream(body),
      sessionStr,
      this.stripeSecretKey,
    );
    if (event.type !== "customer.updated") {
      throw newBadRequestError(
        `Expecting customer.updated event, but got ${event.type}.`,
      );
    }
    if (
      event.data.previous_attributes.invoice_settings
        ?.default_payment_method ===
      event.data.object.invoice_settings?.default_payment_method
    ) {
      // Not updating default payment method.
      return {};
    }

    let accountId =
      event.data.object.metadata[CUSTOMER_METADATA_ACCOUNT_ID_KEY];
    let paymentMethodId = event.data.object.invoice_settings
      .default_payment_method as string;
    let paymentMethod =
      await this.stripeClient.val.paymentMethods.retrieve(paymentMethodId);
    // Assumes only card payment methods are used.
    let cardFingerprint = paymentMethod.card.fingerprint;
    await this.database.runTransactionAsync(async (transaction) => {
      let [profileRows, cardRows] = await Promise.all([
        getPaymentProfile(transaction, {
          paymentProfileAccountIdEq: accountId,
        }),
        getPaymentCardGrantedInitCredit(transaction, {
          paymentCardGrantedInitCreditFingerprintEq: cardFingerprint,
        }),
      ]);
      if (profileRows.length === 0) {
        throw newInternalServerErrorError(
          `Payment profile for account ${accountId} is not found.`,
        );
      }
      if (cardRows.length > 0) {
        console.log(
          `${loggingPrefix} Payment profile for account ${accountId} not being granted credit due to payment card with fingerprint ${cardFingerprint} already exists.`,
        );
        return;
      }
      let profile = profileRows[0];
      if (
        profile.paymentProfileInitCreditGrantingState !==
        InitCreditGrantingState.NOT_GRANTED
      ) {
        console.log(
          `${loggingPrefix} Payment profile for account ${accountId} already has credit granted.`,
        );
        return;
      }

      let now = this.getNow();
      await transaction.batchUpdate([
        updatePaymentProfileInitCreditGrantingStateStatement({
          paymentProfileAccountIdEq: accountId,
          setInitCreditGrantingState: InitCreditGrantingState.GRANTING,
        }),
        insertInitPaymentCreditGrantingTaskStatement({
          accountId,
          retryCount: 0,
          executionTimeMs: now,
          createdTimeMs: now,
        }),
        insertPaymentCardGrantedInitCreditStatement({
          fingerprint: cardFingerprint,
          createdTimeMs: now,
        }),
      ]);
      await transaction.commit();
    });
    return {};
  }
}
