import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const APP_ID = "LARKSUITE_CLI_APP_ID";
const APP_SECRET = "LARKSUITE_CLI_APP_SECRET";
const USER_TOKEN = "LARKSUITE_CLI_USER_ACCESS_TOKEN";
const TENANT_TOKEN = "LARKSUITE_CLI_TENANT_ACCESS_TOKEN";

/**
 * Railway supplies the Feishu app credentials as secret environment variables.
 * lark-cli's environment credential provider cannot mint renewable tenant tokens,
 * so materialize its normal file-based profile and hide the env credentials from
 * child processes. The app secret remains outside the generated config itself.
 */
export async function prepareLarkRuntimeEnv(
  source: NodeJS.ProcessEnv,
): Promise<NodeJS.ProcessEnv> {
  const env = { ...source };
  const appId = source[APP_ID]?.trim();
  const appSecret = source[APP_SECRET]?.trim();

  if (!appId && !appSecret) return env;
  if (!appId || !appSecret) {
    throw new Error(`${APP_ID} and ${APP_SECRET} must be set together`);
  }

  const configDir = resolve(source.LARKSUITE_CLI_CONFIG_DIR ?? ".data/lark-cli");
  const secretPath = resolve(configDir, "app-secret");
  const configPath = resolve(configDir, "config.json");

  await mkdir(configDir, { recursive: true, mode: 0o700 });
  await chmod(configDir, 0o700);
  await writeFile(secretPath, appSecret, { mode: 0o600 });
  await chmod(secretPath, 0o600);

  const profile = await readProfile(configPath);
  delete profile.strictMode;
  const apps = Array.isArray(profile.apps) ? profile.apps : [];
  const index = apps.findIndex((candidate) => isObject(candidate) && candidate.appId === appId);
  const existing = index >= 0 && isObject(apps[index]) ? apps[index] : {};
  const app: Record<string, unknown> = {
    ...existing,
    appId,
    appSecret: { source: "file", id: secretPath },
    brand: source.LARKSUITE_CLI_BRAND?.trim() || "feishu",
    defaultAs: "bot",
    users: Array.isArray(existing.users) ? existing.users : [],
  };
  delete app.strictMode;
  if (index >= 0) apps[index] = app;
  else apps.push(app);
  profile.apps = apps;

  const temporaryPath = `${configPath}.${process.pid}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(profile, null, 2)}\n`, { mode: 0o600 });
  await rename(temporaryPath, configPath);
  await chmod(configPath, 0o600);

  env.LARKSUITE_CLI_CONFIG_DIR = configDir;
  delete env[APP_ID];
  delete env[APP_SECRET];
  delete env[USER_TOKEN];
  delete env[TENANT_TOKEN];
  return env;
}

type ProfileObject = Record<string, unknown> & { apps?: unknown[] };

async function readProfile(path: string): Promise<ProfileObject> {
  try {
    const value = JSON.parse(await readFile(path, "utf8"));
    if (!isObject(value)) throw new Error("Unsupported lark-cli config format");
    return value;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw error;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
