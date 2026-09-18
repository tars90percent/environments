import { homedir } from "node:os";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

export function readConfig(env: NodeJS.ProcessEnv = process.env) {
  const data = resolve(env.RANGER_DATA_DIR || join(homedir(), ".local/share/ranger"));
  const allowedUsers = new Set((env.ALLOWED_USER_IDS || "").split(",").map(x => x.trim()).filter(Boolean));
  if (!allowedUsers.size) throw new Error("ALLOWED_USER_IDS must explicitly allow at least one Feishu user");
  const sandbox = env.DSH_PERMISSION_MODE || "workspace-write";
  if (!["read-only", "workspace-write", "danger-full-access"].includes(sandbox)) throw new Error("Invalid DSH_PERMISSION_MODE");
  const effort = env.DEEPSEEK_REASONING_EFFORT || "high";
  if (!["off", "low", "high", "max"].includes(effort)) throw new Error("Invalid DEEPSEEK_REASONING_EFFORT");
  const turnTimeoutMs = Number(env.RANGER_TURN_TIMEOUT_SECONDS || 1800) * 1000;
  if (!Number.isSafeInteger(turnTimeoutMs) || turnTimeoutMs < 1000) throw new Error("Invalid turn timeout");
  const maxTokens = Number(env.DEEPSEEK_MAX_TOKENS || 16384);
  if (!Number.isSafeInteger(maxTokens) || maxTokens < 1) throw new Error("Invalid DEEPSEEK_MAX_TOKENS");
  const repo = fileURLToPath(new URL("../../../", import.meta.url));
  return {
    data, allowedUsers, sandbox, effort, maxTokens,
    workspace: resolve(env.AGENT_WORKSPACE || join(data, "workspace")),
    harnessHome: resolve(env.DSH_HOME || join(data, "dsh")),
    sourceRoot: resolve(env.RANGER_SOURCE_ROOT || repo),
    model: env.DEEPSEEK_MODEL || "deepseek-flash",
    harnessPath: env.DSH_BIN || fileURLToPath(new URL("../node_modules/@deepseek-ai/dsh/lib/bin.js", import.meta.url)),
    larkPath: env.LARK_CLI || fileURLToPath(new URL("../node_modules/.bin/lark-cli", import.meta.url)),
    larkConfig: resolve(env.LARKSUITE_CLI_CONFIG_DIR || join(data, "lark-cli")),
    larkProfile: env.LARK_PROFILE || undefined,
    turnTimeoutMs,
  };
}
export type Config = ReturnType<typeof readConfig>;
