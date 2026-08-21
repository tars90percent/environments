import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const SESSION_COOKIE = "env_portal_session";
const OAUTH_COOKIE = "env_portal_oauth";
const SESSION_TTL_SECONDS = 12 * 60 * 60;
const OAUTH_TTL_SECONDS = 10 * 60;

export type PortalSession = {
  openId: string;
  unionId: string | null;
  tenantKey: string;
  name: string;
  avatarUrl: string | null;
  issuedAt: number;
  expiresAt: number;
};

export type OAuthAttempt = {
  state: string;
  returnTo: string;
  issuedAt: number;
  expiresAt: number;
};

export type FeishuUserInfo = {
  openId: string;
  unionId: string | null;
  tenantKey: string;
  name: string;
  avatarUrl: string | null;
};

export function authConfig() {
  return {
    appId: requiredEnv("FEISHU_APP_ID"),
    appSecret: requiredEnv("FEISHU_APP_SECRET"),
    tenantKey: requiredEnv("FEISHU_ALLOWED_TENANT_KEY"),
    sessionSecret: requiredEnv("PORTAL_SESSION_SECRET"),
    baseUrl: new URL(portalBaseUrl()),
  };
}

export async function getPortalSession(): Promise<PortalSession | null> {
  const value = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!value) return null;
  const session = verifySignedValue<PortalSession>(value, authConfig().sessionSecret);
  if (!session || session.expiresAt <= Date.now() || session.tenantKey !== authConfig().tenantKey) return null;
  return session;
}

export function createOAuthAttempt(returnTo: string): OAuthAttempt {
  const issuedAt = Date.now();
  return {
    state: randomBytes(32).toString("base64url"),
    returnTo: safeReturnPath(returnTo),
    issuedAt,
    expiresAt: issuedAt + OAUTH_TTL_SECONDS * 1000,
  };
}

export async function setOAuthAttempt(attempt: OAuthAttempt): Promise<void> {
  const jar = await cookies();
  jar.set(OAUTH_COOKIE, signValue(attempt, authConfig().sessionSecret), secureCookie(OAUTH_TTL_SECONDS));
}

export async function consumeOAuthAttempt(state: string): Promise<OAuthAttempt | null> {
  const jar = await cookies();
  const value = jar.get(OAUTH_COOKIE)?.value;
  jar.delete(OAUTH_COOKIE);
  if (!value) return null;
  const attempt = verifySignedValue<OAuthAttempt>(value, authConfig().sessionSecret);
  if (!attempt || attempt.expiresAt <= Date.now() || !safeEqual(attempt.state, state)) return null;
  return attempt;
}

export async function setPortalSession(user: FeishuUserInfo): Promise<void> {
  const issuedAt = Date.now();
  const session: PortalSession = {
    ...user,
    issuedAt,
    expiresAt: issuedAt + SESSION_TTL_SECONDS * 1000,
  };
  (await cookies()).set(SESSION_COOKIE, signValue(session, authConfig().sessionSecret), secureCookie(SESSION_TTL_SECONDS));
}

export async function clearPortalSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

export function feishuAuthorizeUrl(state: string): URL {
  const config = authConfig();
  const callbackUrl = new URL("/auth/callback", config.baseUrl);
  const url = new URL("https://accounts.feishu.cn/open-apis/authen/v1/authorize");
  url.searchParams.set("client_id", config.appId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", callbackUrl.href);
  url.searchParams.set("state", state);
  return url;
}

export async function exchangeFeishuCode(code: string): Promise<FeishuUserInfo> {
  const config = authConfig();
  const callbackUrl = new URL("/auth/callback", config.baseUrl).href;
  const tokenResponse = await fetch("https://open.feishu.cn/open-apis/authen/v2/oauth/token", {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8", accept: "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      client_id: config.appId,
      client_secret: config.appSecret,
      code,
      redirect_uri: callbackUrl,
    }),
    cache: "no-store",
  });
  const token = await tokenResponse.json() as { code?: number; access_token?: string; error_description?: string };
  if (!tokenResponse.ok || token.code || !token.access_token) throw new Error(token.error_description ?? "Feishu token exchange failed");

  const userResponse = await fetch("https://open.feishu.cn/open-apis/authen/v1/user_info", {
    headers: { authorization: `Bearer ${token.access_token}`, accept: "application/json" },
    cache: "no-store",
  });
  const payload = await userResponse.json() as {
    code?: number;
    msg?: string;
    data?: { open_id?: string; union_id?: string; tenant_key?: string; name?: string; en_name?: string; avatar_url?: string };
  };
  const value = payload.data;
  if (!userResponse.ok || payload.code || !value?.open_id || !value.tenant_key) throw new Error(payload.msg ?? "Feishu user lookup failed");
  if (value.tenant_key !== config.tenantKey) throw new TenantDeniedError();

  return {
    openId: value.open_id,
    unionId: value.union_id ?? null,
    tenantKey: value.tenant_key,
    name: value.name ?? value.en_name ?? "Researcher",
    avatarUrl: value.avatar_url ?? null,
  };
}

export class TenantDeniedError extends Error {}

function secureCookie(maxAge: number) {
  return { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/", maxAge };
}

function signValue(value: unknown, secret: string): string {
  const payload = Buffer.from(JSON.stringify(value)).toString("base64url");
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function verifySignedValue<T>(value: string, secret: string): T | null {
  const [payload, signature, extra] = value.split(".");
  if (!payload || !signature || extra) return null;
  const expected = createHmac("sha256", secret).update(payload).digest("base64url");
  if (!safeEqual(signature, expected)) return null;
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function safeReturnPath(value: string | null | undefined): string {
  if (!value?.startsWith("/") || value.startsWith("//")) return "/";
  try {
    const url = new URL(value, "https://portal.local");
    return url.origin === "https://portal.local" ? `${url.pathname}${url.search}${url.hash}` : "/";
  } catch {
    return "/";
  }
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function portalBaseUrl(): string {
  const configured = process.env.PORTAL_BASE_URL?.trim();
  if (configured) return configured;
  const railwayDomain = process.env.RAILWAY_PUBLIC_DOMAIN?.trim();
  if (railwayDomain) return railwayDomain.startsWith("http://") || railwayDomain.startsWith("https://") ? railwayDomain : `https://${railwayDomain}`;
  throw new Error("PORTAL_BASE_URL is not configured");
}
