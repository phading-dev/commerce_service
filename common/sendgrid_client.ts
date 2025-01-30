import sgMail = require("@sendgrid/mail");
import { SENDGRID_API_KEY } from "./env_vars";

sgMail.setApiKey(SENDGRID_API_KEY);

export let SENDGRID_CLIENT = sgMail;
