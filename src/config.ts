import { loadEnvFile } from "node:process";
import { resolve } from "node:path";

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

function optionalNumber(name: string, fallback: number): number {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value < 1 || value > 65_535) throw new Error(`${name} must be a valid TCP port`);
  return value;
}

export const config = {
  larkCli: process.env.LARK_CLI ?? "lark-cli",
  larkProfile: process.env.LARK_PROFILE?.trim() || undefined,
  codexPath: process.env.CODEX_PATH?.trim() || "codex",
  allowGroupChats: bool("ALLOW_GROUP_CHATS", false),
  allowAllUsers: bool("ALLOW_ALL_USERS", false),
  allowedUserIds: csv("ALLOWED_USER_IDS"),
  workspace: resolve(process.env.AGENT_WORKSPACE ?? ".data/workspace"),
  agentInstructionsFile: resolve(process.env.AGENT_INSTRUCTIONS_FILE ?? "AGENTS.md"),
  stateFile,
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
  registryDatabaseUrl: process.env.DATABASE_URL?.trim() || undefined,
  registryCatalogToken: process.env.CASE_REGISTRY_CATALOG_TOKEN?.trim() || undefined,
  registryReviewToken: process.env.CASE_REGISTRY_REVIEW_TOKEN?.trim() || undefined,
  registryUploadToken: process.env.CASE_REGISTRY_UPLOAD_TOKEN?.trim() || undefined,
  registryAdminToken: process.env.CASE_REGISTRY_ADMIN_TOKEN?.trim() || undefined,
  registryPort: optionalNumber("PORT", 3000),
  registryS3: process.env.AWS_ENDPOINT_URL && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && process.env.AWS_S3_BUCKET_NAME
    ? {
        endpoint: process.env.AWS_ENDPOINT_URL,
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        bucket: process.env.AWS_S3_BUCKET_NAME,
        region: process.env.AWS_DEFAULT_REGION?.trim() || "auto",
      }
    : undefined,
};

export function validateConfig(): void {
  if (!config.allowAllUsers && config.allowedUserIds.size === 0) {
    throw new Error(
      "No pilot users are allowed. Set ALLOWED_USER_IDS to comma-separated Feishu open_ids, or explicitly set ALLOW_ALL_USERS=true.",
    );
  }
  const registryValues = [config.registryDatabaseUrl, config.registryCatalogToken, config.registryReviewToken, config.registryUploadToken, config.registryAdminToken];
  if (registryValues.some(Boolean) && !registryValues.every(Boolean)) {
    throw new Error("DATABASE_URL and all CASE registry role tokens must be set together");
  }
  for (const [name, token] of [["CASE_REGISTRY_CATALOG_TOKEN", config.registryCatalogToken], ["CASE_REGISTRY_REVIEW_TOKEN", config.registryReviewToken], ["CASE_REGISTRY_UPLOAD_TOKEN", config.registryUploadToken], ["CASE_REGISTRY_ADMIN_TOKEN", config.registryAdminToken]] as const) {
    if (token && token.length < 32) throw new Error(`${name} must contain at least 32 characters`);
  }
  const tokens = [config.registryCatalogToken, config.registryReviewToken, config.registryUploadToken, config.registryAdminToken].filter(Boolean);
  if (new Set(tokens).size !== tokens.length) throw new Error("CASE registry tokens must be distinct");
}
