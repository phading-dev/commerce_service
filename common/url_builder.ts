import { ENV_VARS } from "../env";
import { UrlBuilder } from "@phading/web_interface/url_builder";

export let URL_BUILDER = UrlBuilder.create(ENV_VARS.externalOrigin);
