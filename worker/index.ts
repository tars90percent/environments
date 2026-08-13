/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

interface Env {
  ASSETS: Fetcher;
  CASE_REGISTRY_URL?: string;
  CASE_REGISTRY_HOST?: string;
  CASE_REGISTRY_PORT?: string;
  CASE_REGISTRY_CATALOG_TOKEN?: string;
  CASE_REGISTRY_REVIEW_TOKEN?: string;
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

    for (const key of ["CASE_REGISTRY_URL", "CASE_REGISTRY_HOST", "CASE_REGISTRY_PORT", "CASE_REGISTRY_CATALOG_TOKEN", "CASE_REGISTRY_REVIEW_TOKEN", "FEISHU_APP_ID", "FEISHU_APP_SECRET", "FEISHU_ALLOWED_TENANT_KEY", "PORTAL_BASE_URL", "PORTAL_SESSION_SECRET"] as const) {
      if (runtimeEnv[key]) process.env[key] = runtimeEnv[key];
    }

    const submissionReviewsMatch = url.pathname.match(/^\/api\/submissions\/([^/]+)\/reviews$/);
    if (submissionReviewsMatch?.[1]) {
      if (request.method !== "GET" && request.method !== "POST") return new Response("Method not allowed", { status: 405 });
      const session = portalSession(request, runtimeEnv);
      if (!session) return Response.json({ error: "unauthorized" }, { status: 401, headers: { "cache-control": "no-store" } });
      if (!registryUrl || !runtimeEnv.CASE_REGISTRY_REVIEW_TOKEN) {
        return Response.json({ error: "case_reviews_not_configured" }, { status: 503, headers: { "cache-control": "no-store" } });
      }
      if (request.method === "POST" && !isSameOrigin(request, runtimeEnv)) {
        return Response.json({ error: "origin_denied" }, { status: 403, headers: { "cache-control": "no-store" } });
      }

      try {
        const batchId = decodeURIComponent(submissionReviewsMatch[1]);
        const body = request.method === "POST" ? await reviewRequestBody(request) : undefined;
        const upstream = await fetch(`${registryUrl}/v1/submissions/${encodeURIComponent(batchId)}/reviews`, {
          method: request.method,
          headers: {
            authorization: `Bearer ${runtimeEnv.CASE_REGISTRY_REVIEW_TOKEN}`,
            accept: "application/json",
            ...(body ? { "content-type": "application/json; charset=utf-8" } : {}),
          },
          body: body ? JSON.stringify({
            id: randomUUID(),
            batchId,
            ...body,
            reviewer: {
              openId: session.openId,
              unionId: session.unionId ?? undefined,
              tenantKey: session.tenantKey,
              name: session.name,
            },
            metadata: { source: "env-portal-proto" },
          }) : undefined,
        });
        return new Response(upstream.body, {
          status: upstream.status,
          headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" },
        });
      } catch (error) {
        if (error instanceof ReviewRequestError) {
          return Response.json({ error: "invalid_review", message: error.message }, { status: error.status, headers: { "cache-control": "no-store" } });
        }
        return Response.json({ error: "case_reviews_unavailable" }, { status: 502, headers: { "cache-control": "no-store" } });
      }
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

type SessionClaim = {
  openId?: unknown;
  unionId?: unknown;
  tenantKey?: unknown;
  name?: unknown;
  expiresAt?: unknown;
};

type VerifiedSession = {
  openId: string;
  unionId: string | null;
  tenantKey: string;
  name: string;
  expiresAt: number;
};

function hasPortalSession(request: Request, env: Env): boolean {
  return Boolean(portalSession(request, env));
}

function portalSession(request: Request, env: Env): VerifiedSession | null {
  if (!env.PORTAL_SESSION_SECRET || !env.FEISHU_ALLOWED_TENANT_KEY) return null;
  const value = readCookie(request.headers.get("cookie"), "env_portal_session");
  if (!value) return null;
  const [payload, signature, extra] = value.split(".");
  if (!payload || !signature || extra) return null;
  const expected = createHmac("sha256", env.PORTAL_SESSION_SECRET).update(payload).digest("base64url");
  if (!safeEqual(signature, expected)) return null;
  try {
    const claim = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SessionClaim;
    if (claim.tenantKey !== env.FEISHU_ALLOWED_TENANT_KEY || typeof claim.expiresAt !== "number" || claim.expiresAt <= Date.now()) return null;
    if (typeof claim.openId !== "string" || !claim.openId || typeof claim.name !== "string" || !claim.name) return null;
    if (claim.unionId !== null && claim.unionId !== undefined && typeof claim.unionId !== "string") return null;
    return {
      openId: claim.openId,
      unionId: claim.unionId ?? null,
      tenantKey: claim.tenantKey,
      name: claim.name,
      expiresAt: claim.expiresAt,
    };
  } catch {
    return null;
  }
}

type ReviewRequestBody = {
  signal: "interested" | "needs_revision" | "not_interested" | "comment";
  scope: "submission" | "categories";
  categoryIds: string[];
  comment?: string;
};

async function reviewRequestBody(request: Request): Promise<ReviewRequestBody> {
  const length = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(length) && length > 16_384) throw new ReviewRequestError(413, "Review is too large.");
  const text = await request.text();
  if (text.length > 16_384) throw new ReviewRequestError(413, "Review is too large.");
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new ReviewRequestError(400, "Review must be valid JSON.");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ReviewRequestError(400, "Review must be an object.");
  const input = value as Record<string, unknown>;
  const signals = new Set(["interested", "needs_revision", "not_interested", "comment"]);
  const scopes = new Set(["submission", "categories"]);
  if (typeof input.signal !== "string" || !signals.has(input.signal)) throw new ReviewRequestError(400, "Choose a valid response.");
  if (typeof input.scope !== "string" || !scopes.has(input.scope)) throw new ReviewRequestError(400, "Choose a valid scope.");
  if (!Array.isArray(input.categoryIds) || input.categoryIds.some((id) => typeof id !== "string" || !id)) {
    throw new ReviewRequestError(400, "Categories must be valid identifiers.");
  }
  const categoryIds = [...new Set(input.categoryIds as string[])];
  if (input.scope === "submission" && categoryIds.length) throw new ReviewRequestError(400, "A submission-wide response cannot select categories.");
  if (input.scope === "categories" && !categoryIds.length) throw new ReviewRequestError(400, "Select at least one category.");
  if (input.comment !== undefined && typeof input.comment !== "string") throw new ReviewRequestError(400, "Comment must be text.");
  const comment = typeof input.comment === "string" ? input.comment.trim() : "";
  if (comment.length > 5_000) throw new ReviewRequestError(400, "Comment must be 5,000 characters or fewer.");
  if (input.signal !== "interested" && !comment) throw new ReviewRequestError(400, "Add a comment for this response.");
  return {
    signal: input.signal as ReviewRequestBody["signal"],
    scope: input.scope as ReviewRequestBody["scope"],
    categoryIds,
    ...(comment ? { comment } : {}),
  };
}

function isSameOrigin(request: Request, env: Env): boolean {
  if (!env.PORTAL_BASE_URL) return false;
  try {
    return request.headers.get("origin") === new URL(env.PORTAL_BASE_URL).origin;
  } catch {
    return false;
  }
}

class ReviewRequestError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
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
