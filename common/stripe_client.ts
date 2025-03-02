import getStream from "get-stream";
import Stripe from "stripe";
import { ENV_VARS } from "../env_vars";
import { STORAGE_CLIENT } from "./storage_client";
import { Ref } from "@selfage/ref";

export let STRIPE_CLIENT = new Ref<Stripe>();

export async function initStripeClient(): Promise<void> {
  let [stripeSecretKey] = await Promise.all([
    getStream(
      STORAGE_CLIENT.bucket(ENV_VARS.gcsSecretBucketName)
        .file(ENV_VARS.stripeSecretKeyFile)
        .createReadStream(),
    ),
  ]);
  STRIPE_CLIENT.val = new Stripe(stripeSecretKey);
}
