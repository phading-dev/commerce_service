import { ENV_VARS } from "./env";
import { spawnSync } from "child_process";
import "./env_local";

async function main() {
  spawnSync(
    "gcloud",
    ["spanner", "instances", "delete", ENV_VARS.spannerInstanceId, "--quiet"],
    { stdio: "inherit" },
  );
}

main();
