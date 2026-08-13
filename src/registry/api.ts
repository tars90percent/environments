import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { timingSafeEqual } from "node:crypto";
import type { AddressInfo } from "node:net";
import { ArtifactStore } from "./artifacts.js";
import { RegistryConflictError, RegistryNotFoundError } from "./postgres.js";
import type { RegistryRepository } from "./repository.js";
import {
  parseArtifact,
  parseCheckResult,
  parseFollowUp,
  parseSourceEnvelope,
  parseStatusUpdate,
  parseSubmissionManifest,
  parseSubmissionReview,
  parseTaskSourceLinks,
  parseVendorEvent,
  parseWorkCompletion,
  ValidationError,
} from "./validation.js";

type RegistryServerOptions = {
  repository: RegistryRepository;
  artifactStore?: ArtifactStore;
  catalogToken: string;
  reviewToken: string;
  adminToken: string;
  port: number;
  host?: string;
};

export type RegistryServer = {
  close(): Promise<void>;
  url: string;
};

export async function startRegistryServer(options: RegistryServerOptions): Promise<RegistryServer> {
  const server = createServer((request, response) => {
    void handle(request, response, options).catch((error) => sendError(response, error));
  });
  const host = options.host ?? "::";
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.port, host, () => {
      server.off("error", reject);
      resolve();
    });
  });
  const address = server.address() as AddressInfo;
  return {
    url: `http://${host === "::" ? "[::1]" : host}:${address.port}`,
    close: () => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())),
  };
}

async function handle(request: IncomingMessage, response: ServerResponse, options: RegistryServerOptions): Promise<void> {
  const method = request.method ?? "GET";
  const url = new URL(request.url ?? "/", "http://registry.local");
  setSecurityHeaders(response);

  if (method === "GET" && url.pathname === "/health") {
    return sendJson(response, 200, { status: "ok", service: "case-registry" });
  }

  const role = authenticate(request, options);
  if (!role) return sendJson(response, 401, { error: "unauthorized" });

  const submissionReviewsMatch = url.pathname.match(/^\/v1\/submissions\/([^/]+)\/reviews$/);
  if (submissionReviewsMatch?.[1]) {
    if (role === "catalog") return sendJson(response, 403, { error: "review_token_required" });
    const batchId = decodeURIComponent(submissionReviewsMatch[1]);
    if (method === "GET") return sendJson(response, 200, { reviews: await options.repository.listSubmissionReviews(batchId) });
    if (method === "POST") {
      const review = parseSubmissionReview(await readJson(request));
      if (review.batchId !== batchId) throw new RequestError(400, "batch_id_mismatch");
      return sendJson(response, 201, { review: await options.repository.recordSubmissionReview(review) });
    }
    return sendJson(response, 405, { error: "method_not_allowed" });
  }

  if (role === "review") return sendJson(response, 403, { error: "review_scope_only" });

  if (method === "GET" && url.pathname === "/v1/catalog") {
    const scope = role === "admin" ? requestedScope(url) : "portal";
    return sendJson(response, 200, await options.repository.catalogSnapshot(scope));
  }

  const vendorMatch = url.pathname.match(/^\/v1\/vendors\/([^/]+)$/);
  if (method === "GET" && vendorMatch?.[1]) {
    const value = await options.repository.getVendor(decodeURIComponent(vendorMatch[1]), role === "admin" ? requestedScope(url) : "portal");
    return value ? sendJson(response, 200, value) : sendJson(response, 404, { error: "vendor_not_found" });
  }

  const batchMatch = url.pathname.match(/^\/v1\/batches\/([^/]+)$/);
  if (method === "GET" && batchMatch?.[1]) {
    const value = await options.repository.getBatch(decodeURIComponent(batchMatch[1]), role === "admin" ? requestedScope(url) : "portal");
    return value ? sendJson(response, 200, value) : sendJson(response, 404, { error: "batch_not_found" });
  }

  const taskMatch = url.pathname.match(/^\/v1\/tasks\/([^/]+)$/);
  if (method === "GET" && taskMatch?.[1]) {
    const value = await options.repository.getTask(decodeURIComponent(taskMatch[1]), role === "admin" ? requestedScope(url) : "portal");
    return value ? sendJson(response, 200, value) : sendJson(response, 404, { error: "task_not_found" });
  }

  const sourceEventMatch = url.pathname.match(/^\/v1\/source-events\/([^/]+)$/);
  if (method === "GET" && sourceEventMatch?.[1]) {
    const value = await options.repository.getSourceEvent(decodeURIComponent(sourceEventMatch[1]));
    return value ? sendJson(response, 200, value) : sendJson(response, 404, { error: "source_event_not_found" });
  }

  const artifactDownloadMatch = url.pathname.match(/^\/v1\/artifacts\/([^/]+)\/download-url$/);
  if (method === "GET" && artifactDownloadMatch?.[1]) {
    if (!options.artifactStore) return sendJson(response, 503, { error: "artifact_store_unavailable" });
    const artifact = await options.repository.getArtifact(decodeURIComponent(artifactDownloadMatch[1]));
    if (!artifact) return sendJson(response, 404, { error: "artifact_not_found" });
    const originalName = typeof artifact.metadata?.originalName === "string" ? artifact.metadata.originalName : undefined;
    return sendJson(response, 200, await options.artifactStore.createDownloadUrl(artifact.storageKey, originalName));
  }

  if (role !== "admin") return sendJson(response, 403, { error: "admin_token_required" });

  if (method === "GET" && url.pathname === "/v1/vendor-directory") {
    return sendJson(response, 200, { vendors: await options.repository.vendorDirectory() });
  }
  const vendorRecordMatch = url.pathname.match(/^\/v1\/vendor-records\/([^/]+)$/);
  if (method === "GET" && vendorRecordMatch?.[1]) {
    const vendorId = decodeURIComponent(vendorRecordMatch[1]);
    const vendor = (await options.repository.vendorDirectory()).find((entry) => entry.id === vendorId);
    if (!vendor) return sendJson(response, 404, { error: "vendor_not_found" });
    const [catalog, events] = await Promise.all([
      options.repository.getVendor(vendorId, "all"),
      options.repository.listVendorEvents(vendorId),
    ]);
    return sendJson(response, 200, { vendor, submissions: catalog?.batches ?? [], events });
  }
  const vendorEventsMatch = url.pathname.match(/^\/v1\/vendor-events\/([^/]+)$/);
  if (method === "GET" && vendorEventsMatch?.[1]) {
    const vendorId = decodeURIComponent(vendorEventsMatch[1]);
    return sendJson(response, 200, { events: await options.repository.listVendorEvents(vendorId) });
  }
  if (method === "POST" && url.pathname === "/v1/vendor-events") {
    const result = await options.repository.recordVendorEvent(parseVendorEvent(await readJson(request)));
    return sendJson(response, result.created ? 201 : 200, result);
  }

  if (method === "POST" && url.pathname === "/v1/intake/submissions") {
    const result = await options.repository.ingestSubmission(parseSubmissionManifest(await readJson(request)));
    return sendJson(response, result.created ? 201 : 200, result);
  }
  if (method === "POST" && url.pathname === "/v1/intake/source-events") {
    const result = await options.repository.ingestSourceEnvelope(parseSourceEnvelope(await readJson(request)));
    return sendJson(response, result.created ? 201 : 200, result);
  }
  if (method === "POST" && url.pathname === "/v1/check-results") {
    await options.repository.recordCheckResult(parseCheckResult(await readJson(request)));
    return sendJson(response, 201, { recorded: true });
  }
  if (method === "POST" && url.pathname === "/v1/follow-ups") {
    await options.repository.recordFollowUp(parseFollowUp(await readJson(request)));
    return sendJson(response, 201, { recorded: true });
  }
  if (method === "POST" && url.pathname === "/v1/artifacts") {
    await options.repository.registerArtifact(parseArtifact(await readJson(request)));
    return sendJson(response, 201, { recorded: true });
  }
  if (method === "POST" && url.pathname === "/v1/artifacts/confirm") {
    if (!options.artifactStore) return sendJson(response, 503, { error: "artifact_store_unavailable" });
    const artifact = parseArtifact(await readJson(request));
    await options.artifactStore.verifyObject({ key: artifact.storageKey, sha256: artifact.sha256, sizeBytes: artifact.sizeBytes });
    await options.repository.registerArtifact(artifact);
    return sendJson(response, 201, { recorded: true });
  }
  if (method === "POST" && url.pathname === "/v1/status") {
    await options.repository.updateStatus(parseStatusUpdate(await readJson(request)));
    return sendJson(response, 200, { updated: true });
  }
  if (method === "POST" && url.pathname === "/v1/task-source-links") {
    return sendJson(response, 200, await options.repository.linkTaskSources(parseTaskSourceLinks(await readJson(request))));
  }
  if (method === "POST" && url.pathname === "/v1/work/lease") {
    const body = asObject(await readJson(request));
    const workerId = requiredString(body.workerId, "workerId");
    const leaseSeconds = boundedInteger(body.leaseSeconds, "leaseSeconds", 30, 3_600);
    return sendJson(response, 200, { item: await options.repository.leaseWorkItem(workerId, leaseSeconds) });
  }
  if (method === "POST" && url.pathname === "/v1/work/complete") {
    await options.repository.completeWorkItem(parseWorkCompletion(await readJson(request)));
    return sendJson(response, 200, { updated: true });
  }
  if (method === "GET" && url.pathname === "/v1/operations/summary") {
    return sendJson(response, 200, await options.repository.operationsSummary());
  }
  if (method === "POST" && url.pathname === "/v1/artifacts/upload-url") {
    if (!options.artifactStore) return sendJson(response, 503, { error: "artifact_store_unavailable" });
    const body = asObject(await readJson(request));
    return sendJson(response, 200, await options.artifactStore.createUploadUrl({
      key: requiredString(body.key, "key"),
      contentType: requiredString(body.contentType, "contentType"),
      sha256: optionalString(body.sha256),
    }));
  }
  if (method === "POST" && url.pathname === "/v1/artifacts/download-url") {
    if (!options.artifactStore) return sendJson(response, 503, { error: "artifact_store_unavailable" });
    const body = asObject(await readJson(request));
    return sendJson(response, 200, await options.artifactStore.createDownloadUrl(requiredString(body.key, "key")));
  }

  return sendJson(response, 404, { error: "not_found" });
}

function authenticate(request: IncomingMessage, options: RegistryServerOptions): "catalog" | "review" | "admin" | null {
  return registryRole(request.headers.authorization, options.catalogToken, options.reviewToken, options.adminToken);
}

export function registryRole(header: string | undefined, catalogToken: string, reviewToken: string, adminToken: string): "catalog" | "review" | "admin" | null {
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length);
  if (safeEqual(token, adminToken)) return "admin";
  if (safeEqual(token, reviewToken)) return "review";
  if (safeEqual(token, catalogToken)) return "catalog";
  return null;
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function requestedScope(url: URL): "research" | "portal" | "all" {
  const scope = url.searchParams.get("scope");
  return scope === "research" || scope === "portal" ? scope : "all";
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 10 * 1024 * 1024) throw new RequestError(413, "request_too_large");
    chunks.push(buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new RequestError(400, "invalid_json");
  }
}

function sendJson(response: ServerResponse, status: number, value: unknown): void {
  if (response.headersSent) return;
  response.statusCode = status;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.end(`${JSON.stringify(value)}\n`);
}

function sendError(response: ServerResponse, error: unknown): void {
  if (error instanceof RequestError) return sendJson(response, error.status, { error: error.code });
  if (error instanceof ValidationError) return sendJson(response, 400, { error: "validation_error", message: error.message });
  if (error instanceof RegistryConflictError) return sendJson(response, 409, { error: "registry_conflict", message: error.message });
  if (error instanceof RegistryNotFoundError) return sendJson(response, 404, { error: "registry_not_found", message: error.message });
  console.error("CASE registry request failed:", safeError(error));
  return sendJson(response, 500, { error: "internal_error" });
}

function setSecurityHeaders(response: ServerResponse): void {
  response.setHeader("cache-control", "no-store");
  response.setHeader("x-content-type-options", "nosniff");
  response.setHeader("referrer-policy", "no-referrer");
}

class RequestError extends Error {
  constructor(readonly status: number, readonly code: string) {
    super(code);
  }
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new RequestError(400, "object_required");
  return value as Record<string, unknown>;
}

function requiredString(value: unknown, name: string): string {
  if (typeof value !== "string" || !value.trim()) throw new RequestError(400, `${name}_required`);
  return value.trim();
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function boundedInteger(value: unknown, name: string, minimum: number, maximum: number): number {
  if (!Number.isInteger(value) || (value as number) < minimum || (value as number) > maximum) {
    throw new RequestError(400, `${name}_invalid`);
  }
  return value as number;
}

function safeError(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : "Unknown error";
}
