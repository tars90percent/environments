import { loadEnvFile } from "node:process";
import { dirname, join, resolve } from "node:path";

try {
  loadEnvFile();
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
    throw error;
  }
}

function bool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  return raw.toLowerCase() === "true";
}

function csv(name: string): Set<string> {
  return new Set(
    (process.env[name] ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

function csvList(name: string, fallback: string[] = []): string[] {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  return raw
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

function choice<const T extends readonly string[]>(
  name: string,
  allowed: T,
  fallback: T[number],
): T[number] {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  if ((allowed as readonly string[]).includes(raw)) return raw as T[number];
  throw new Error(`${name} must be one of: ${allowed.join(", ")}`);
}

const stateFile = resolve(process.env.AGENT_STATE ?? ".data/state.json");
const authStateFile = resolve(
  process.env.LARK_AUTH_STATE ?? join(dirname(stateFile), "authorization.json"),
);

export const config = {
  larkCli: process.env.LARK_CLI ?? "lark-cli",
  larkProfile: process.env.LARK_PROFILE?.trim() || undefined,
  codexPath: process.env.CODEX_PATH?.trim() || "codex",
  allowGroupChats: bool("ALLOW_GROUP_CHATS", false),
  allowAllUsers: bool("ALLOW_ALL_USERS", false),
  allowedUserIds: csv("ALLOWED_USER_IDS"),
  workspace: resolve(process.env.AGENT_WORKSPACE ?? ".data/workspace"),
  stateFile,
  authStateFile,
  authQrDirectory: resolve(
    process.env.LARK_AUTH_QR_DIR ?? join(dirname(authStateFile), "authorization-qr"),
  ),
  authDefaultDomains: csvList("LARK_AUTH_DOMAINS", ["all"]),
  authPollTimeoutMs: Number(process.env.LARK_AUTH_POLL_TIMEOUT_MS ?? 45_000),
  codexSandboxMode: choice(
    "CODEX_SANDBOX_MODE",
    ["read-only", "workspace-write", "danger-full-access"] as const,
    "read-only",
  ),
  codexNetworkAccess: bool("CODEX_NETWORK_ACCESS", false),
  codexWebSearchMode: choice(
    "CODEX_WEB_SEARCH_MODE",
    ["disabled", "cached", "live"] as const,
    "disabled",
  ),
  codexApprovalPolicy: choice(
    "CODEX_APPROVAL_POLICY",
    ["untrusted", "on-request", "never"] as const,
    "never",
  ),
  codexApprovalsReviewer: choice(
    "CODEX_APPROVALS_REVIEWER",
    ["user", "auto_review"] as const,
    "user",
  ),
  maxInputCharacters: Number(process.env.MAX_INPUT_CHARACTERS ?? 12_000),
  maxReplyCharacters: Number(process.env.MAX_REPLY_CHARACTERS ?? 8_000),
};

export function validateConfig(): void {
  if (!config.allowAllUsers && config.allowedUserIds.size === 0) {
    throw new Error(
      "No pilot users are allowed. Set ALLOWED_USER_IDS to comma-separated Feishu open_ids, or explicitly set ALLOW_ALL_USERS=true.",
    );
  }
  if (!Number.isFinite(config.authPollTimeoutMs) || config.authPollTimeoutMs <= 0) {
    throw new Error("LARK_AUTH_POLL_TIMEOUT_MS must be a positive number");
  }
}
