import { join } from "node:path";

export const DEFAULT_MODAL_SANDBOX_TIMEOUT_SECS = 2 * 60 * 60;
export const DEFAULT_MODAL_SANDBOX_IDLE_TIMEOUT_SECS = 10 * 60;

const MAX_MODAL_SANDBOX_TIMEOUT_SECS = 24 * 60 * 60;
const RESERVED_MODAL_ENVIRONMENT_KWARGS = new Set([
  "app_name",
  "sandbox_timeout_secs",
  "sandbox_idle_timeout_secs",
]);

export interface HarborRunPolicy {
  appName: string;
  sandboxTimeoutSecs: number;
  sandboxIdleTimeoutSecs: number;
}

const SAFE_ENVIRONMENT_NAMES = [
  "PATH",
  "LANG",
  "LC_ALL",
  "TERM",
  "COLORTERM",
  "FORCE_COLOR",
  "SSL_CERT_FILE",
  "SSL_CERT_DIR",
  "TZ",
  "MODAL_TOKEN_ID",
  "MODAL_TOKEN_SECRET",
  "MODAL_ENVIRONMENT",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "GEMINI_API_KEY",
  "GOOGLE_API_KEY",
  "OPENROUTER_API_KEY",
  "MINIMAX_API_KEY",
  "DEEPSEEK_API_KEY",
  "MISTRAL_API_KEY",
  "GROQ_API_KEY",
  "TOGETHERAI_API_KEY",
  "XAI_API_KEY",
  "LITELLM_PROXY_API_KEY",
  "LITELLM_PROXY_API_BASE",
] as const;

const RESERVED_ENVIRONMENT_NAMES = new Set([
  "DATABASE_URL",
  "AWS_ENDPOINT_URL",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_SESSION_TOKEN",
  "AWS_S3_BUCKET_NAME",
  "PGPASSWORD",
]);

const RESERVED_ENVIRONMENT_PREFIXES = [
  "CASE_REGISTRY_",
  "FEISHU_",
  "LARK_",
  "LARKSUITE_",
  "PORTAL_",
];

export function createHarborRunPolicy(
  environment: NodeJS.ProcessEnv,
  runId: string,
): HarborRunPolicy {
  const suffix = runId.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 32);
  if (!suffix) throw new Error("CASE Harbor run ID must contain an ASCII letter or digit");

  const sandboxTimeoutSecs = positiveInteger(
    environment.CASE_HARBOR_SANDBOX_TIMEOUT_SECS,
    "CASE_HARBOR_SANDBOX_TIMEOUT_SECS",
    DEFAULT_MODAL_SANDBOX_TIMEOUT_SECS,
    MAX_MODAL_SANDBOX_TIMEOUT_SECS,
  );
  const sandboxIdleTimeoutSecs = positiveInteger(
    environment.CASE_HARBOR_SANDBOX_IDLE_TIMEOUT_SECS,
    "CASE_HARBOR_SANDBOX_IDLE_TIMEOUT_SECS",
    DEFAULT_MODAL_SANDBOX_IDLE_TIMEOUT_SECS,
    sandboxTimeoutSecs,
  );

  return {
    appName: `case-harbor-${suffix}`,
    sandboxTimeoutSecs,
    sandboxIdleTimeoutSecs,
  };
}

export function prepareHarborArguments(
  arguments_: string[],
  policy?: HarborRunPolicy,
): string[] {
  if (arguments_[0] !== "run") return [...arguments_];
  if (!policy) throw new Error("CASE Harbor runs require a lifecycle policy");

  let requestedEnvironment: string | undefined;
  for (let index = 1; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === "--env" || argument === "-e") {
      requestedEnvironment = arguments_[index + 1];
      if (!requestedEnvironment) throw new Error(`${argument} requires an environment name`);
      break;
    }
    if (argument?.startsWith("--env=")) {
      requestedEnvironment = argument.slice("--env=".length);
      break;
    }
    if (argument?.startsWith("-e=")) {
      requestedEnvironment = argument.slice("-e=".length);
      break;
    }
  }

  if (requestedEnvironment && requestedEnvironment !== "modal") {
    throw new Error(`CASE Harbor runs must use the Modal environment, not ${requestedEnvironment}`);
  }
  assertNoReservedModalEnvironmentKwargs(arguments_);

  const prepared = requestedEnvironment ? [...arguments_] : [...arguments_, "--env", "modal"];
  prepared.push(
    "--ek",
    `app_name=${policy.appName}`,
    "--ek",
    `sandbox_timeout_secs=${policy.sandboxTimeoutSecs}`,
    "--ek",
    `sandbox_idle_timeout_secs=${policy.sandboxIdleTimeoutSecs}`,
  );
  return prepared;
}

export function createHarborEnvironment(
  source: NodeJS.ProcessEnv,
  home: string,
): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = {};
  for (const name of SAFE_ENVIRONMENT_NAMES) copyIfSet(source, environment, name);

  const configuredNames = (source.CASE_HARBOR_ALLOWED_ENV ?? "")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
  for (const name of configuredNames) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
      throw new Error(`Invalid CASE_HARBOR_ALLOWED_ENV name: ${name}`);
    }
    if (isReservedEnvironmentName(name)) {
      throw new Error(`CASE_HARBOR_ALLOWED_ENV cannot expose production credential ${name}`);
    }
    copyIfSet(source, environment, name);
  }

  environment.PATH = source.PATH ?? "/usr/local/bin:/usr/bin:/bin";
  environment.HOME = home;
  environment.TMPDIR = "/tmp";
  environment.XDG_CACHE_HOME = join(home, ".cache");
  environment.UV_CACHE_DIR = join(home, ".cache", "uv");
  return environment;
}

export function createModalControlEnvironment(
  source: NodeJS.ProcessEnv,
  home: string,
): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = {};
  for (const name of [
    "PATH",
    "LANG",
    "LC_ALL",
    "TERM",
    "COLORTERM",
    "FORCE_COLOR",
    "SSL_CERT_FILE",
    "SSL_CERT_DIR",
    "TZ",
    "MODAL_TOKEN_ID",
    "MODAL_TOKEN_SECRET",
    "MODAL_ENVIRONMENT",
  ] as const) copyIfSet(source, environment, name);

  environment.PATH = source.PATH ?? "/usr/local/bin:/usr/bin:/bin";
  environment.HOME = home;
  environment.TMPDIR = "/tmp";
  environment.XDG_CACHE_HOME = join(home, ".cache");
  return environment;
}

export function assertModalCredentials(environment: NodeJS.ProcessEnv): void {
  if (
    !environment.MODAL_TOKEN_ID
    || !environment.MODAL_TOKEN_SECRET
    || !environment.MODAL_ENVIRONMENT
  ) {
    throw new Error(
      "Modal credentials and environment are required. Configure MODAL_TOKEN_ID, MODAL_TOKEN_SECRET, and MODAL_ENVIRONMENT as Railway secrets.",
    );
  }
}

export interface ModalAppSummary {
  appId: string;
  description: string;
  state: string;
  tasks: number;
}

export function parseModalAppList(output: string): ModalAppSummary[] {
  const value: unknown = JSON.parse(output);
  if (!Array.isArray(value)) throw new Error("Modal app list did not return an array");
  return value.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error("Modal app list contained an invalid entry");
    }
    const row = entry as Record<string, unknown>;
    if (
      typeof row.app_id !== "string"
      || typeof row.description !== "string"
      || typeof row.state !== "string"
      || (typeof row.tasks !== "string" && typeof row.tasks !== "number")
    ) {
      throw new Error("Modal app list entry is missing required fields");
    }
    const tasks = Number(row.tasks);
    if (!Number.isInteger(tasks) || tasks < 0) {
      throw new Error("Modal app list entry has an invalid task count");
    }
    return {
      appId: row.app_id,
      description: row.description,
      state: row.state,
      tasks,
    };
  });
}

export function parseModalContainerList(output: string): unknown[] {
  const value: unknown = JSON.parse(output);
  if (!Array.isArray(value)) throw new Error("Modal container list did not return an array");
  return value;
}

function assertNoReservedModalEnvironmentKwargs(arguments_: string[]): void {
  for (let index = 1; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    let value: string | undefined;
    if (argument === "--ek" || argument === "--environment-kwarg") {
      value = arguments_[index + 1];
      index += 1;
    } else if (argument?.startsWith("--ek=")) {
      value = argument.slice("--ek=".length);
    } else if (argument?.startsWith("--environment-kwarg=")) {
      value = argument.slice("--environment-kwarg=".length);
    }
    if (!value) continue;
    const separator = value.indexOf("=");
    const name = (separator === -1 ? value : value.slice(0, separator)).trim();
    if (RESERVED_MODAL_ENVIRONMENT_KWARGS.has(name)) {
      throw new Error(`Modal environment kwarg ${name} is reserved by CASE lifecycle policy`);
    }
  }
}

function positiveInteger(
  raw: string | undefined,
  name: string,
  defaultValue: number,
  maximum: number,
): number {
  const value = raw === undefined || raw === "" ? defaultValue : Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > maximum) {
    throw new Error(`${name} must be an integer between 1 and ${maximum}`);
  }
  return value;
}

function copyIfSet(
  source: NodeJS.ProcessEnv,
  destination: NodeJS.ProcessEnv,
  name: string,
): void {
  const value = source[name];
  if (value !== undefined && value !== "") destination[name] = value;
}

function isReservedEnvironmentName(name: string): boolean {
  const normalized = name.toUpperCase();
  return RESERVED_ENVIRONMENT_NAMES.has(normalized)
    || RESERVED_ENVIRONMENT_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}
