import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { chmod, mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const DEFAULT_DEVICE_CODE_LIFETIME_SECONDS = 600;

export const LARK_AUTH_DOMAINS = new Set([
  "application",
  "approval",
  "apps",
  "attendance",
  "base",
  "calendar",
  "contact",
  "docs",
  "drive",
  "event",
  "im",
  "mail",
  "markdown",
  "mindnotes",
  "minutes",
  "note",
  "okr",
  "sheets",
  "slides",
  "task",
  "vc",
  "wiki",
  "all",
]);

export type AuthorizationRequest =
  | { mode: "domains"; domains: string[] }
  | { mode: "scopes"; scopes: string[] };

export type AuthorizationStartResult = {
  kind: "user-authorization" | "app-configuration";
  verificationUrl: string;
  qrPath: string;
  expiresAt?: string;
  detail?: string;
};

export type AuthorizationCompletionResult =
  | { kind: "ready"; userName?: string; userOpenId: string }
  | { kind: "pending" }
  | { kind: "missing" }
  | { kind: "expired" }
  | { kind: "wrong-user"; actualUserName?: string; actualUserOpenId?: string };

export type AuthorizationStatusResult =
  | { kind: "ready"; userName?: string; userOpenId: string }
  | { kind: "missing" }
  | { kind: "needs-refresh"; userName?: string; userOpenId: string; detail?: string };

type PendingAuthorization = {
  chatId: string;
  senderId: string;
  deviceCode: string;
  expiresAt: string;
  qrPath: string;
  knownUserOpenIds: string[];
};

type PendingAuthorizationFile = {
  version: 1;
  requests: Record<string, PendingAuthorization>;
};

type CommandOptions = {
  cwd?: string;
  timeout?: number;
};

type CommandResult = {
  stdout: string;
  stderr: string;
};

export type LarkCommandRunner = (
  args: string[],
  options?: CommandOptions,
) => Promise<CommandResult>;

export type LarkAuthorizationOptions = {
  executable: string;
  stateFile: string;
  qrDirectory: string;
  defaultDomains: string[];
  profile?: string;
  env?: NodeJS.ProcessEnv;
  pollTimeoutMs?: number;
  runner?: LarkCommandRunner;
  now?: () => Date;
};

type JsonObject = Record<string, unknown>;

type ConfiguredUser = {
  userOpenId: string;
  userName?: string;
};

export class AuthorizationError extends Error {
  constructor(
    message: string,
    readonly userMessage = message,
  ) {
    super(message);
    this.name = "AuthorizationError";
  }
}

class LarkCliError extends Error {
  constructor(
    message: string,
    readonly payload?: unknown,
    readonly timedOut = false,
  ) {
    super(message);
    this.name = "LarkCliError";
  }
}

export class LarkAuthorizationManager {
  private readonly pending: PendingAuthorizationStore;
  private readonly runner: LarkCommandRunner;
  private readonly now: () => Date;

  constructor(private readonly options: LarkAuthorizationOptions) {
    this.pending = new PendingAuthorizationStore(options.stateFile);
    this.now = options.now ?? (() => new Date());
    this.runner = options.runner ?? this.defaultRunner.bind(this);
  }

  async initialize(): Promise<void> {
    await mkdir(this.options.qrDirectory, { recursive: true, mode: 0o700 });
    await chmod(this.options.qrDirectory, 0o700);
    await this.pending.load();
    await this.removeExpiredRequests();
  }

  async start(
    chatId: string,
    senderId: string,
    request?: AuthorizationRequest,
  ): Promise<AuthorizationStartResult> {
    const selected = request ?? {
      mode: "domains" as const,
      domains: this.options.defaultDomains,
    };
    validateRequest(selected);

    const args = [...this.profileArgs(), "auth", "login"];
    if (selected.mode === "domains") {
      for (const domain of selected.domains) args.push("--domain", domain);
    } else {
      args.push("--scope", selected.scopes.join(","));
    }
    args.push("--no-wait", "--json");

    let payload: unknown;
    try {
      payload = parseJsonResult(await this.runner(args));
      assertCliOk(payload);
    } catch (error) {
      if (error instanceof LarkCliError) {
        const configurationUrl = findString(error.payload, ["console_url"]);
        if (configurationUrl) {
          return this.createConfigurationResult(configurationUrl, error.payload);
        }
        throw new AuthorizationError(
          error.message,
          publicErrorMessage(error.payload) ??
            "Feishu could not start authorization. Try /authorize again; if it repeats, check the app permissions.",
        );
      }
      throw error;
    }

    const configurationUrl = findString(payload, ["console_url"]);
    const verificationUrl = findString(payload, [
      "verification_url",
      "verification_uri_complete",
      "verification_uri",
    ]);
    const deviceCode = findString(payload, ["device_code"]);

    if (!verificationUrl || !deviceCode) {
      if (configurationUrl) return this.createConfigurationResult(configurationUrl, payload);
      throw new AuthorizationError(
        "lark-cli returned no verification URL or device code",
        "Feishu did not return a usable authorization link. Try /authorize again.",
      );
    }

    const expiresIn = findNumber(payload, ["expires_in", "expires_in_seconds"]);
    const expiresAt = new Date(
      this.now().getTime() +
        (expiresIn ?? DEFAULT_DEVICE_CODE_LIFETIME_SECONDS) * 1_000,
    );
    const qrPath = await this.createQrCode(verificationUrl);
    const knownUserOpenIds = (await this.configuredUsers()).map((user) => user.userOpenId);
    const prior = this.pending.get(chatId, senderId);
    await this.pending.set({
      chatId,
      senderId,
      deviceCode,
      expiresAt: expiresAt.toISOString(),
      qrPath,
      knownUserOpenIds,
    });
    if (prior?.qrPath !== qrPath) await removeFile(prior?.qrPath);

    return {
      kind: "user-authorization",
      verificationUrl,
      qrPath,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async complete(
    chatId: string,
    senderId: string,
  ): Promise<AuthorizationCompletionResult> {
    const request = this.pending.get(chatId, senderId);
    if (!request) return { kind: "missing" };
    if (new Date(request.expiresAt).getTime() <= this.now().getTime()) {
      await this.clearRequest(request);
      return { kind: "expired" };
    }

    let completionPayload: unknown;
    try {
      completionPayload = parseJsonResult(
        await this.runner(
          [
            ...this.profileArgs(),
            "auth",
            "login",
            "--device-code",
            request.deviceCode,
            "--json",
          ],
          { timeout: this.options.pollTimeoutMs ?? 45_000 },
        ),
      );
      assertCliOk(completionPayload);
    } catch (error) {
      if (error instanceof LarkCliError && error.timedOut) return { kind: "pending" };
      if (error instanceof LarkCliError) {
        throw new AuthorizationError(
          error.message,
          publicErrorMessage(error.payload) ??
            "Feishu has not completed that authorization yet. Finish it in the browser, then send /authorized again.",
        );
      }
      throw error;
    }

    const configuredUsers = await this.configuredUsers();
    const reportedUserOpenId = findString(completionPayload, [
      "user_open_id",
      "userOpenId",
    ]);
    const newlyConfigured = configuredUsers.filter(
      (candidate) => !request.knownUserOpenIds.includes(candidate.userOpenId),
    );
    const actual = reportedUserOpenId
      ? configuredUsers.find((candidate) => candidate.userOpenId === reportedUserOpenId) ?? {
          userOpenId: reportedUserOpenId,
        }
      : newlyConfigured.at(-1);
    const user = configuredUsers.find((candidate) => candidate.userOpenId === senderId);
    if ((actual && actual.userOpenId !== senderId) || !user) {
      for (const candidate of newlyConfigured) {
        if (candidate.userOpenId !== senderId) {
          await this.removeConfiguredUser(candidate.userOpenId);
        }
      }
      await this.clearRequest(request);
      return {
        kind: "wrong-user",
        actualUserName: actual?.userName,
        actualUserOpenId: actual?.userOpenId,
      };
    }

    const verification = parseJsonResult(
      await this.runner([...this.profileArgs(), "auth", "status", "--json", "--verify"]),
    );
    if (isCliFailure(verification)) {
      throw new AuthorizationError(
        "The stored Feishu login failed server verification",
        publicErrorMessage(verification) ??
          "The login was stored but Feishu could not verify it. Send /auth-status to check it again.",
      );
    }

    await this.clearRequest(request);
    return { kind: "ready", userName: user.userName, userOpenId: user.userOpenId };
  }

  async discardQr(path: string): Promise<void> {
    await removeFile(path);
  }

  async status(senderId: string): Promise<AuthorizationStatusResult> {
    const user = (await this.configuredUsers()).find(
      (candidate) => candidate.userOpenId === senderId,
    );
    if (!user) return { kind: "missing" };

    try {
      const payload = parseJsonResult(
        await this.runner([...this.profileArgs(), "auth", "status", "--json", "--verify"]),
      );
      if (isCliFailure(payload)) {
        return {
          kind: "needs-refresh",
          ...user,
          detail: publicErrorMessage(payload),
        };
      }
      return { kind: "ready", ...user };
    } catch (error) {
      if (error instanceof LarkCliError) {
        return {
          kind: "needs-refresh",
          ...user,
          detail: publicErrorMessage(error.payload),
        };
      }
      throw error;
    }
  }

  private async createConfigurationResult(
    url: string,
    payload: unknown,
  ): Promise<AuthorizationStartResult> {
    return {
      kind: "app-configuration",
      verificationUrl: url,
      qrPath: await this.createQrCode(url),
      detail: publicErrorMessage(payload),
    };
  }

  private async createQrCode(url: string): Promise<string> {
    const filename = `feishu-authorization-${randomUUID()}.png`;
    const path = join(this.options.qrDirectory, filename);
    await this.runner(
      [
        ...this.profileArgs(),
        "auth",
        "qrcode",
        url,
        "--output",
        `./${filename}`,
      ],
      { cwd: this.options.qrDirectory },
    );
    await chmod(path, 0o600);
    return path;
  }

  private async configuredUsers(): Promise<ConfiguredUser[]> {
    const configDirectory = this.options.env?.LARKSUITE_CLI_CONFIG_DIR;
    if (!configDirectory) return [];

    let parsed: unknown;
    try {
      parsed = JSON.parse(await readFile(join(configDirectory, "config.json"), "utf8"));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }

    const users: ConfiguredUser[] = [];
    if (!isObject(parsed) || !Array.isArray(parsed.apps)) return users;
    for (const app of parsed.apps) {
      if (!isObject(app) || !Array.isArray(app.users)) continue;
      for (const candidate of app.users) {
        if (!isObject(candidate) || typeof candidate.userOpenId !== "string") continue;
        users.push({
          userOpenId: candidate.userOpenId,
          userName:
            typeof candidate.userName === "string" ? candidate.userName : undefined,
        });
      }
    }
    return users;
  }

  private async removeConfiguredUser(userOpenId: string): Promise<void> {
    const configDirectory = this.options.env?.LARKSUITE_CLI_CONFIG_DIR;
    if (!configDirectory) return;
    const configPath = join(configDirectory, "config.json");
    const parsed = JSON.parse(await readFile(configPath, "utf8")) as unknown;
    if (!isObject(parsed) || !Array.isArray(parsed.apps)) return;

    for (const app of parsed.apps) {
      if (!isObject(app) || !Array.isArray(app.users)) continue;
      app.users = app.users.filter(
        (candidate) =>
          !isObject(candidate) || candidate.userOpenId !== userOpenId,
      );
    }
    const temporaryPath = `${configPath}.${process.pid}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(parsed, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
    await rename(temporaryPath, configPath);
    await chmod(configPath, 0o600);
  }

  private async clearRequest(request: PendingAuthorization): Promise<void> {
    await this.pending.delete(request.chatId, request.senderId);
    await removeFile(request.qrPath);
  }

  private async removeExpiredRequests(): Promise<void> {
    for (const request of this.pending.all()) {
      if (new Date(request.expiresAt).getTime() <= this.now().getTime()) {
        await this.clearRequest(request);
      }
    }
  }

  private profileArgs(): string[] {
    return this.options.profile ? ["--profile", this.options.profile] : [];
  }

  private async defaultRunner(
    args: string[],
    options: CommandOptions = {},
  ): Promise<CommandResult> {
    try {
      const result = await execFileAsync(this.options.executable, args, {
        cwd: options.cwd,
        env: this.options.env,
        timeout: options.timeout,
        maxBuffer: 2 * 1024 * 1024,
      });
      return { stdout: result.stdout, stderr: result.stderr };
    } catch (error) {
      const failure = error as NodeJS.ErrnoException & {
        stdout?: string;
        stderr?: string;
        killed?: boolean;
        signal?: string;
      };
      const payload = parseJson(failure.stdout) ?? parseJson(failure.stderr);
      throw new LarkCliError(
        "lark-cli authorization command failed",
        payload,
        Boolean(failure.killed || failure.signal === "SIGTERM"),
      );
    }
  }
}

class PendingAuthorizationStore {
  private state: PendingAuthorizationFile = { version: 1, requests: {} };
  private saveChain: Promise<void> = Promise.resolve();

  constructor(private readonly path: string) {}

  async load(): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true, mode: 0o700 });
    try {
      const parsed = JSON.parse(await readFile(this.path, "utf8")) as PendingAuthorizationFile;
      if (parsed.version !== 1 || !isObject(parsed.requests)) {
        throw new Error("Unsupported pending authorization state format");
      }
      this.state = parsed;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      await this.save();
    }
  }

  get(chatId: string, senderId: string): PendingAuthorization | undefined {
    const value = this.state.requests[requestKey(chatId, senderId)];
    return value ? { ...value } : undefined;
  }

  all(): PendingAuthorization[] {
    return Object.values(this.state.requests).map((request) => ({ ...request }));
  }

  async set(request: PendingAuthorization): Promise<void> {
    this.state.requests[requestKey(request.chatId, request.senderId)] = request;
    await this.save();
  }

  async delete(chatId: string, senderId: string): Promise<void> {
    delete this.state.requests[requestKey(chatId, senderId)];
    await this.save();
  }

  private save(): Promise<void> {
    this.saveChain = this.saveChain.then(async () => {
      const temporaryPath = `${this.path}.${process.pid}.tmp`;
      await writeFile(temporaryPath, `${JSON.stringify(this.state, null, 2)}\n`, {
        encoding: "utf8",
        mode: 0o600,
      });
      await rename(temporaryPath, this.path);
      await chmod(this.path, 0o600);
    });
    return this.saveChain;
  }
}

function validateRequest(request: AuthorizationRequest): void {
  if (request.mode === "domains") {
    if (request.domains.length === 0) {
      throw new AuthorizationError("At least one Feishu authorization domain is required");
    }
    const invalid = request.domains.find((domain) => !LARK_AUTH_DOMAINS.has(domain));
    if (invalid) {
      throw new AuthorizationError(
        `Unknown Feishu authorization domain: ${invalid}`,
        `Unknown Feishu authorization domain “${invalid}”.`,
      );
    }
    if (request.domains.includes("all") && request.domains.length > 1) {
      throw new AuthorizationError(
        "The all authorization domain cannot be combined with another domain",
      );
    }
    return;
  }

  if (
    request.scopes.length === 0 ||
    request.scopes.some((scope) => !/^[A-Za-z0-9:_-]{1,200}$/.test(scope))
  ) {
    throw new AuthorizationError(
      "Invalid Feishu scope request",
      "Use /authorize scope followed by a valid Feishu scope name.",
    );
  }
}

function requestKey(chatId: string, senderId: string): string {
  return createHash("sha256").update(`${chatId}\0${senderId}`).digest("hex");
}

function parseJsonResult(result: CommandResult): unknown {
  const parsed = parseJson(result.stdout);
  if (parsed === undefined) {
    throw new LarkCliError("lark-cli returned malformed JSON");
  }
  return parsed;
}

function parseJson(value?: string): unknown | undefined {
  if (!value?.trim()) return undefined;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function assertCliOk(payload: unknown): void {
  if (isCliFailure(payload)) {
    throw new LarkCliError("lark-cli reported an authorization error", payload);
  }
}

function isCliFailure(payload: unknown): boolean {
  return isObject(payload) && payload.ok === false;
}

function publicErrorMessage(payload: unknown): string | undefined {
  const message = findString(payload, ["message"]);
  const hint = findString(payload, ["hint"]);
  return [message, hint]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .slice(0, 800) || undefined;
}

function findString(value: unknown, keys: string[]): string | undefined {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findString(item, keys);
      if (found) return found;
    }
    return undefined;
  }
  if (!isObject(value)) return undefined;

  for (const key of keys) {
    if (typeof value[key] === "string" && value[key].trim()) return value[key];
  }
  for (const child of Object.values(value)) {
    const found = findString(child, keys);
    if (found) return found;
  }
  return undefined;
}

function findNumber(value: unknown, keys: string[]): number | undefined {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findNumber(item, keys);
      if (found !== undefined) return found;
    }
    return undefined;
  }
  if (!isObject(value)) return undefined;

  for (const key of keys) {
    const candidate = value[key];
    if (typeof candidate === "number" && Number.isFinite(candidate)) return candidate;
  }
  for (const child of Object.values(value)) {
    const found = findNumber(child, keys);
    if (found !== undefined) return found;
  }
  return undefined;
}

function isObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function removeFile(path?: string): Promise<void> {
  if (!path) return;
  try {
    await unlink(resolve(path));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}
