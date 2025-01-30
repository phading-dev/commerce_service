import Stripe from "stripe";
import { STRIPE_SECRET_KEY } from "./env_vars";

export let STRIPE_CLIENT = new Stripe(STRIPE_SECRET_KEY);
