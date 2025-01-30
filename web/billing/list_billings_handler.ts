import { SERVICE_CLIENT } from "../../common/service_client";
import { SPANNER_DATABASE } from "../../common/spanner_database";
import { PaymentState } from "../../db/schema";
import { listBillings } from "../../db/sql";
import { getMonthDifference } from "../common/date_helper";
import { Database } from "@google-cloud/spanner";
import { ListBillingsHandlerInterface } from "@phading/commerce_service_interface/web/billing/handler";
import {
  ListBillingsRequestBody,
  ListBillingsResponse,
} from "@phading/commerce_service_interface/web/billing/interface";
import { PaymentState as PaymentStateResponse } from "@phading/commerce_service_interface/web/billing/statement";
import { MAX_MONTH_RANGE } from "@phading/constants/commerce";
import { exchangeSessionAndCheckCapability } from "@phading/user_session_service_interface/node/client";
import {
  newBadRequestError,
  newInternalServerErrorError,
  newUnauthorizedError,
} from "@selfage/http_error";
import { NodeServiceClient } from "@selfage/node_service_client";

export class ListBillingsHandler extends ListBillingsHandlerInterface {
  public static create(): ListBillingsHandler {
    return new ListBillingsHandler(SPANNER_DATABASE, SERVICE_CLIENT);
  }

  public constructor(
    private database: Database,
    private serviceClient: NodeServiceClient,
  ) {
    super();
  }

  public async handle(
    loggingPrefix: string,
    body: ListBillingsRequestBody,
    sessionStr: string,
  ): Promise<ListBillingsResponse> {
    if (!body.startMonth) {
      throw newBadRequestError(`"startMonth" is required`);
    }
    if (!body.endMonth) {
      throw newBadRequestError(`"endMonth" is required`);
    }
    if (body.startMonth > body.endMonth) {
      throw newBadRequestError(`"startMonth" is after "endMonth".`);
    }
    let startDate = new Date(body.startMonth);
    if (isNaN(startDate.valueOf())) {
      throw newBadRequestError(`"startMonth" is not a valid ISO string.`);
    }
    let endDate = new Date(body.endMonth);
    if (isNaN(endDate.valueOf())) {
      throw newBadRequestError(`"endMonth" is not a valid ISO string.`);
    }
    if (getMonthDifference(startDate, endDate) > MAX_MONTH_RANGE) {
      throw newBadRequestError(
        `The range between "startMonth" and "endMonth" is too large.`,
      );
    }
    let { accountId, capabilities } = await exchangeSessionAndCheckCapability(
      this.serviceClient,
      {
        signedSession: sessionStr,
        capabilitiesMask: {
          checkCanBeBilled: true,
        },
      },
    );
    if (!capabilities.canBeBilled) {
      throw newUnauthorizedError(`Account ${accountId} cannot list billings.`);
    }
    let billingRows = await listBillings(
      this.database,
      accountId,
      body.startMonth,
      body.endMonth,
    );
    return {
      billings: billingRows.map((row) => ({
        billingId: row.billingData.billingId,
        month: row.billingData.month,
        currency: row.billingData.currency,
        totalAmount: row.billingData.totalAmount,
        state: this.convertState(row.billingData.state),
        items: row.billingData.items.map((item) => ({
          amount: item.amount,
          productType: item.productType,
          quantity: item.quantity,
        })),
        stripeInvoiceUrl: row.billingData.stripeInvoiceUrl,
      })),
    };
  }

  private convertState(state: PaymentState): PaymentStateResponse {
    switch (state) {
      case PaymentState.PROCESSING:
        return PaymentStateResponse.PROCESSING;
      case PaymentState.CHARGING:
        return PaymentStateResponse.PROCESSING;
      case PaymentState.PAID:
        return PaymentStateResponse.PAID;
      case PaymentState.FAILED:
        return PaymentStateResponse.FAILED;
      default:
        throw newInternalServerErrorError(
          `Unknown state: ${PaymentState[state]}`,
        );
    }
  }
}
