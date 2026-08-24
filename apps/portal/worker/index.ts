/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import { createHmac, timingSafeEqual } from "node:crypto";
import { taskDatasetArchive, taskDatasetFilename, taskDatasetManifest, type DatasetPackage } from "../app/dataset-archive";
import { originalSubmissionArchive } from "../app/original-submission-archive";
import { originalSubmissionArchiveFilename, originalSubmissionArtifacts, type OriginalSubmissionArtifact } from "../app/original-submission";
import { normalizeCaseCatalog, normalizeCaseSubmission } from "./case-compat";

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

    const originalDownloadMatch = url.pathname.match(/^\/api\/submissions\/([^/]+)\/original-download$/);
    if (originalDownloadMatch?.[1]) {
      if (request.method !== "GET") return new Response("Method not allowed", { status: 405 });
      if (!hasPortalSession(request, runtimeEnv)) return Response.json({ error: "unauthorized" }, { status: 401, headers: { "cache-control": "no-store" } });
      if (!registryUrl || !runtimeEnv.CASE_REGISTRY_CATALOG_TOKEN) {
        return Response.json({ error: "case_catalog_not_configured" }, { status: 503, headers: { "cache-control": "no-store" } });
      }
      try {
        const submissionId = decodeURIComponent(originalDownloadMatch[1]);
        const upstream = await fetch(`${registryUrl}/v1/batches/${encodeURIComponent(submissionId)}`, {
          headers: { authorization: `Bearer ${runtimeEnv.CASE_REGISTRY_CATALOG_TOKEN}`, accept: "application/json" },
        });
        if (!upstream.ok) return registryErrorResponse(upstream, "original_submission_unavailable");
        const submission = normalizeCaseSubmission(await upstream.json());
        const artifacts = originalSubmissionArtifacts(submission.sourceEvents ?? []);
        if (!artifacts.length) return Response.json({ error: "original_submission_empty" }, { status: 404, headers: { "cache-control": "no-store" } });
        const archive = originalSubmissionArchive(artifacts, (artifact) => fetchOriginalArtifact(artifact, registryUrl, runtimeEnv.CASE_REGISTRY_CATALOG_TOKEN!));
        return new Response(archive, {
          status: 200,
          headers: {
            "content-type": "application/zip",
            "content-disposition": `attachment; filename="${originalSubmissionArchiveFilename(submission)}"`,
            "cache-control": "no-store",
            "x-content-type-options": "nosniff",
            "x-case-original-file-count": String(artifacts.length),
          },
        });
      } catch {
        return Response.json({ error: "original_submission_unavailable" }, { status: 502, headers: { "cache-control": "no-store" } });
      }
    }

    const datasetDownloadMatch = url.pathname.match(/^\/api\/submissions\/([^/]+)\/dataset-download$/);
    if (datasetDownloadMatch?.[1]) {
      if (request.method !== "GET") return new Response("Method not allowed", { status: 405 });
      if (!hasPortalSession(request, runtimeEnv)) return Response.json({ error: "unauthorized" }, { status: 401, headers: { "cache-control": "no-store" } });
      if (!registryUrl || !runtimeEnv.CASE_REGISTRY_CATALOG_TOKEN) {
        return Response.json({ error: "case_catalog_not_configured" }, { status: 503, headers: { "cache-control": "no-store" } });
      }
      try {
        const submissionId = decodeURIComponent(datasetDownloadMatch[1]);
        const upstream = await fetch(`${registryUrl}/v1/batches/${encodeURIComponent(submissionId)}`, {
          headers: { authorization: `Bearer ${runtimeEnv.CASE_REGISTRY_CATALOG_TOKEN}`, accept: "application/json" },
        });
        if (!upstream.ok) return registryErrorResponse(upstream, "dataset_unavailable");
        const submission = normalizeCaseSubmission(await upstream.json());
        const manifest = taskDatasetManifest(submission);
        if (!manifest.tasks.length) return Response.json({ error: "dataset_empty" }, { status: 404, headers: { "cache-control": "no-store" } });
        const archive = taskDatasetArchive(submission, (task) => fetchArtifact(task.artifactId, registryUrl, runtimeEnv.CASE_REGISTRY_CATALOG_TOKEN!));
        return new Response(archive, {
          status: 200,
          headers: {
            "content-type": "application/x-tar",
            "content-disposition": `attachment; filename="${taskDatasetFilename(submission)}"`,
            "cache-control": "no-store",
            "x-content-type-options": "nosniff",
            "x-case-task-count": String(manifest.tasks.length),
          },
        });
      } catch {
        return Response.json({ error: "dataset_unavailable" }, { status: 502, headers: { "cache-control": "no-store" } });
      }
    }

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
        if (!upstream.ok) return registryErrorResponse(upstream, "case_catalog_unavailable");
        return Response.json(normalizeCaseCatalog(await upstream.json()), {
          headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" },
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

async function fetchOriginalArtifact(artifact: OriginalSubmissionArtifact, registryUrl: string, catalogToken: string): Promise<Response> {
  return fetchArtifact(artifact.artifactId, registryUrl, catalogToken);
}

async function fetchArtifact(artifactId: DatasetPackage["artifactId"], registryUrl: string, catalogToken: string): Promise<Response> {
  const signed = await fetch(`${registryUrl}/v1/artifacts/${encodeURIComponent(artifactId)}/download-url`, {
    headers: { authorization: `Bearer ${catalogToken}`, accept: "application/json" },
  });
  if (!signed.ok) return signed;
  const payload = await signed.json() as { url?: unknown };
  if (typeof payload.url !== "string") throw new Error("CASE returned no artifact URL");
  const downloadUrl = new URL(payload.url);
  if (downloadUrl.protocol !== "https:") throw new Error("CASE returned an unsafe artifact URL");
  return await fetch(downloadUrl, { headers: { accept: "application/octet-stream" } });
}

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

async function registryErrorResponse(response: Response, fallback: string): Promise<Response> {
  let message: string | undefined;
  try {
    const value = await response.json() as { message?: unknown; error?: unknown };
    message = typeof value.message === "string" ? value.message : typeof value.error === "string" ? value.error : undefined;
  } catch {
    message = undefined;
  }
  return Response.json({ error: fallback, ...(message ? { message } : {}) }, {
    status: response.status,
    headers: { "cache-control": "no-store" },
  });
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
