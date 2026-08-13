/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { createHmac, timingSafeEqual } from "node:crypto";

interface Env {
  ASSETS: Fetcher;
  CASE_REGISTRY_URL?: string;
  CASE_REGISTRY_HOST?: string;
  CASE_REGISTRY_PORT?: string;
  CASE_REGISTRY_CATALOG_TOKEN?: string;
  FEISHU_APP_ID?: string;
  FEISHU_APP_SECRET?: string;
  FEISHU_ALLOWED_TENANT_KEY?: string;
  PORTAL_BASE_URL?: string;
  PORTAL_SESSION_SECRET?: string;
  DB: D1Database;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const runtimeEnv = env ?? (process.env as unknown as Env);

    for (const key of ["CASE_REGISTRY_URL", "CASE_REGISTRY_HOST", "CASE_REGISTRY_PORT", "CASE_REGISTRY_CATALOG_TOKEN", "FEISHU_APP_ID", "FEISHU_APP_SECRET", "FEISHU_ALLOWED_TENANT_KEY", "PORTAL_BASE_URL", "PORTAL_SESSION_SECRET"] as const) {
      if (runtimeEnv[key]) process.env[key] = runtimeEnv[key];
    }
    const registryUrl = caseRegistryUrl(runtimeEnv);

    if (url.pathname === "/api/catalog") {
      if (request.method !== "GET") return new Response("Method not allowed", { status: 405 });
      if (!hasPortalSession(request, runtimeEnv)) return Response.json({ error: "unauthorized" }, { status: 401, headers: { "cache-control": "no-store" } });
      if (!registryUrl || !runtimeEnv.CASE_REGISTRY_CATALOG_TOKEN) {
        return Response.json({ error: "case_catalog_not_configured" }, { status: 503, headers: { "cache-control": "no-store" } });
      }
      try {
        const upstream = await fetch(`${registryUrl}/v1/catalog`, {
          headers: { authorization: `Bearer ${runtimeEnv.CASE_REGISTRY_CATALOG_TOKEN}`, accept: "application/json" },
        });
        return new Response(upstream.body, {
          status: upstream.status,
          headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" },
        });
      } catch {
        return Response.json({ error: "case_catalog_unavailable" }, { status: 502, headers: { "cache-control": "no-store" } });
      }
    }

    const artifactDownloadMatch = url.pathname.match(/^\/api\/artifacts\/([^/]+)\/download$/);
    if (artifactDownloadMatch?.[1]) {
      if (request.method !== "GET") return new Response("Method not allowed", { status: 405 });
      if (!hasPortalSession(request, runtimeEnv)) return Response.json({ error: "unauthorized" }, { status: 401, headers: { "cache-control": "no-store" } });
      if (!registryUrl || !runtimeEnv.CASE_REGISTRY_CATALOG_TOKEN) {
        return Response.json({ error: "case_catalog_not_configured" }, { status: 503, headers: { "cache-control": "no-store" } });
      }
      try {
        const artifactId = decodeURIComponent(artifactDownloadMatch[1]);
        const upstream = await fetch(`${registryUrl}/v1/artifacts/${encodeURIComponent(artifactId)}/download-url`, {
          headers: { authorization: `Bearer ${runtimeEnv.CASE_REGISTRY_CATALOG_TOKEN}`, accept: "application/json" },
        });
        if (!upstream.ok) {
          return Response.json({ error: "artifact_unavailable" }, { status: upstream.status, headers: { "cache-control": "no-store" } });
        }
        const payload = await upstream.json() as { url?: unknown };
        if (typeof payload.url !== "string") throw new Error("CASE returned no artifact URL");
        const downloadUrl = new URL(payload.url);
        if (downloadUrl.protocol !== "https:") throw new Error("CASE returned an unsafe artifact URL");
        return Response.redirect(downloadUrl.href, 302);
      } catch {
        return Response.json({ error: "artifact_unavailable" }, { status: 502, headers: { "cache-control": "no-store" } });
      }
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => runtimeEnv.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await runtimeEnv.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    return handler.fetch(request, runtimeEnv, ctx);
  },
};

export default worker;

type SessionClaim = { tenantKey?: unknown; expiresAt?: unknown };

function hasPortalSession(request: Request, env: Env): boolean {
  if (!env.PORTAL_SESSION_SECRET || !env.FEISHU_ALLOWED_TENANT_KEY) return false;
  const value = readCookie(request.headers.get("cookie"), "env_portal_session");
  if (!value) return false;
  const [payload, signature, extra] = value.split(".");
  if (!payload || !signature || extra) return false;
  const expected = createHmac("sha256", env.PORTAL_SESSION_SECRET).update(payload).digest("base64url");
  if (!safeEqual(signature, expected)) return false;
  try {
    const claim = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SessionClaim;
    return claim.tenantKey === env.FEISHU_ALLOWED_TENANT_KEY && typeof claim.expiresAt === "number" && claim.expiresAt > Date.now();
  } catch {
    return false;
  }
}

function readCookie(header: string | null, name: string): string | null {
  for (const part of (header ?? "").split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return null;
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function caseRegistryUrl(env: Env): string | null {
  if (env.CASE_REGISTRY_URL) return env.CASE_REGISTRY_URL.replace(/\/$/, "");
  if (env.CASE_REGISTRY_HOST && env.CASE_REGISTRY_PORT) return `http://${env.CASE_REGISTRY_HOST}:${env.CASE_REGISTRY_PORT}`;
  return null;
}
