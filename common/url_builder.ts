import { ENV_VARS } from "../env_vars";
import { UrlBuilder } from "@phading/web_interface/url_builder";

export let URL_BUILDER = UrlBuilder.create(ENV_VARS.externalOrigin);
