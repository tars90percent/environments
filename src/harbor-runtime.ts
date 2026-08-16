import { join } from "node:path";

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

export function prepareHarborArguments(arguments_: string[]): string[] {
  if (arguments_[0] !== "run") return [...arguments_];

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
  return requestedEnvironment ? [...arguments_] : [...arguments_, "--env", "modal"];
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

export function assertModalCredentials(environment: NodeJS.ProcessEnv): void {
  if (!environment.MODAL_TOKEN_ID || !environment.MODAL_TOKEN_SECRET) {
    throw new Error(
      "Modal credentials are required. Configure MODAL_TOKEN_ID and MODAL_TOKEN_SECRET as Railway secrets.",
    );
  }
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
