import sgMail = require("@sendgrid/mail");
import getStream = require("get-stream");
import { ENV_VARS } from "../env";
import { STORAGE_CLIENT } from "./storage_client";

export let SENDGRID_CLIENT = sgMail;

export async function initSendgridClient(): Promise<void> {
  let [stripeSecretKey] = await Promise.all([
    getStream(
      STORAGE_CLIENT.bucket(ENV_VARS.gcsSecretBucketName)
        .file(ENV_VARS.sendgridApiKeyFile)
        .createReadStream(),
    ),
  ]);
  SENDGRID_CLIENT.setApiKey(stripeSecretKey);
}
