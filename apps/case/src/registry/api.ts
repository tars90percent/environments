import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { timingSafeEqual } from "node:crypto";
import type { AddressInfo } from "node:net";
import { basename } from "node:path";
import { ArtifactStore, contentAddressedStorageKey } from "./artifacts.js";
import { RegistryConflictError, RegistryNotFoundError } from "./postgres.js";
import type { RegistryRepository } from "./repository.js";
import type { ResearcherUploadInput } from "./types.js";
import {
  parseResearcherUpload,
  ValidationError,
} from "./validation.js";

type RegistryServerOptions = {
  repository: RegistryRepository;
  artifactStore?: ArtifactStore;
  catalogToken: string;
  uploadToken: string;
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

  if (method === "POST" && url.pathname === "/v1/researcher-uploads/upload-url") {
    if (role !== "upload") return sendJson(response, 403, { error: "upload_token_required" });
    if (!options.artifactStore) return sendJson(response, 503, { error: "artifact_store_unavailable" });
    const body = asObject(await readJson(request));
    const sha256 = requiredSha256(body.sha256, "sha256");
    const sizeBytes = boundedInteger(body.sizeBytes, "sizeBytes", 1, MAX_RESEARCHER_UPLOAD_BYTES);
    const contentType = boundedRequiredString(body.contentType, "contentType", 300);
    return sendJson(response, 200, await options.artifactStore.createUploadUrl({
      key: contentAddressedStorageKey(sha256),
      contentType,
      sha256,
      sizeBytes,
    }));
  }

  if (method === "POST" && url.pathname === "/v1/researcher-uploads") {
    if (role !== "upload") return sendJson(response, 403, { error: "upload_token_required" });
    if (!options.artifactStore) return sendJson(response, 503, { error: "artifact_store_unavailable" });
    const upload = parseResearcherUpload(await readJson(request));
    if (upload.artifact.sizeBytes > MAX_RESEARCHER_UPLOAD_BYTES) throw new RequestError(413, "upload_too_large");
    return sendJson(response, 201, await recordResearcherUpload(upload, options));
  }

  if (role !== "catalog") return sendJson(response, 403, { error: "catalog_token_required" });

  if (method === "GET" && url.pathname === "/v1/catalog") {
    return sendJson(response, 200, await options.repository.sampleCatalogSnapshot());
  }

  const vendorMatch = url.pathname.match(/^\/v1\/vendors\/([^/]+)$/);
  if (method === "GET" && vendorMatch?.[1]) {
    const vendorId = decodeURIComponent(vendorMatch[1]);
    const value = (await options.repository.sampleCatalogSnapshot()).vendors
      .find((vendor) => vendor.id === vendorId);
    return value ? sendJson(response, 200, value) : sendJson(response, 404, { error: "vendor_not_found" });
  }

  const batchMatch = url.pathname.match(/^\/v1\/batches\/([^/]+)$/);
  if (method === "GET" && batchMatch?.[1]) {
    const value = await options.repository.getSampleSubmission(decodeURIComponent(batchMatch[1]));
    return value ? sendJson(response, 200, value) : sendJson(response, 404, { error: "batch_not_found" });
  }

  const taskMatch = url.pathname.match(/^\/v1\/tasks\/([^/]+)$/);
  if (method === "GET" && taskMatch?.[1]) {
    const value = await options.repository.getSampleTask(decodeURIComponent(taskMatch[1]));
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

  return sendJson(response, 404, { error: "not_found" });
}

async function recordResearcherUpload(upload: ResearcherUploadInput, options: RegistryServerOptions) {
  if (!options.artifactStore) throw new RequestError(503, "artifact_store_unavailable");
  const directoryEntry = (await options.repository.vendorDirectory()).find((vendor) => vendor.id === upload.vendorId);
  if (!directoryEntry) throw new RequestError(404, "vendor_not_found");

  const vendor = {
    id: directoryEntry.id,
    name: directoryEntry.name,
    short: directoryEntry.short,
    description: directoryEntry.description,
    aliases: directoryEntry.aliases,
  };
  const filename = safeUploadName(upload.artifact.originalName);
  const storageKey = contentAddressedStorageKey(upload.artifact.sha256);
  const artifactId = `artifact:sha256:${upload.artifact.sha256}`;
  const sourceEventId = `portal-upload:${upload.id}`;
  const sourceItemId = `source-item:portal-upload:${upload.id}`;
  const batchId = `researcher-upload:${upload.id}`;
  const uploadDate = new Date(upload.uploadedAt).toISOString().slice(0, 10);

  await options.artifactStore.verifyObject({
    key: storageKey,
    sha256: upload.artifact.sha256,
    sizeBytes: upload.artifact.sizeBytes,
  });
  await options.repository.captureSubmission({
    vendor,
    submission: {
      id: batchId,
      date: uploadDate,
      label: upload.label,
      sourceLabel: "Researcher upload through 小环境",
      formats: [],
      metadata: {
        countUnit: "sample_files",
        sampleFileCount: 1,
        intakeMethod: "researcher_portal_upload",
        uploaderOpenId: upload.researcher.openId,
        ...(upload.note ? { researcherNote: upload.note } : {}),
      },
    },
    artifacts: [{
      id: artifactId,
      kind: "source_payload",
      storageKey,
      sha256: upload.artifact.sha256,
      sizeBytes: upload.artifact.sizeBytes,
      contentType: upload.artifact.contentType,
      metadata: {
        originalName: filename,
        source: "researcher_portal_upload",
        intakePurpose: "sample_evaluation",
        uploaderOpenId: upload.researcher.openId,
      },
    }],
    sources: [{
      sourceEvent: {
        id: sourceEventId,
        channel: "upload",
        externalRef: `portal-upload://${upload.id}`,
        sender: upload.researcher.name,
        receivedAt: upload.uploadedAt,
        rawArtifactId: artifactId,
        metadata: {
          uploadId: upload.id,
          intakePurpose: "sample_evaluation",
          uploaderOpenId: upload.researcher.openId,
          uploaderUnionId: upload.researcher.unionId,
          uploaderTenantKey: upload.researcher.tenantKey,
          ...(upload.note ? { researcherNote: upload.note } : {}),
        },
      },
      items: [{
        id: sourceItemId,
        kind: sourceKindFor(filename),
        displayName: filename,
        artifactId,
        mediaType: upload.artifact.contentType,
        contentSha256: upload.artifact.sha256,
        sizeBytes: upload.artifact.sizeBytes,
        fetchStatus: "snapshotted",
        parseStatus: "not_requested",
        mutable: false,
        capturedAt: upload.uploadedAt,
        metadata: { uploadId: upload.id, originalFilename: filename, intakePurpose: "sample_evaluation" },
      }],
      relations: [],
    }],
    actor: `portal:${upload.researcher.openId}`,
  });

  return { uploadId: upload.id, submissionId: batchId, sourceEventId, artifactId };
}

function authenticate(request: IncomingMessage, options: RegistryServerOptions): "catalog" | "upload" | null {
  return registryRole(request.headers.authorization, options.catalogToken, options.uploadToken);
}

export function registryRole(header: string | undefined, catalogToken: string, uploadToken: string): "catalog" | "upload" | null {
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length);
  if (safeEqual(token, uploadToken)) return "upload";
  if (safeEqual(token, catalogToken)) return "catalog";
  return null;
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
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

function boundedInteger(value: unknown, name: string, minimum: number, maximum: number): number {
  if (!Number.isInteger(value) || (value as number) < minimum || (value as number) > maximum) {
    throw new RequestError(400, `${name}_invalid`);
  }
  return value as number;
}

const MAX_RESEARCHER_UPLOAD_BYTES = 250 * 1024 * 1024;

function boundedRequiredString(value: unknown, name: string, maximum: number): string {
  const parsed = requiredString(value, name);
  if (parsed.length > maximum) throw new RequestError(400, `${name}_too_long`);
  return parsed;
}

function requiredSha256(value: unknown, name: string): string {
  const parsed = requiredString(value, name).toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(parsed)) throw new RequestError(400, `${name}_invalid`);
  return parsed;
}

function safeUploadName(value: string): string {
  return basename(value.replace(/\\/g, "/")).replace(/[\r\n"]/g, "_").slice(0, 240) || "sample";
}

function sourceKindFor(value: string): "archive" | "pdf" | "spreadsheet" | "attachment" {
  const lower = value.toLowerCase();
  if ([".zip", ".rar", ".tar.gz", ".tgz", ".tar", ".gz", ".zst"].some((suffix) => lower.endsWith(suffix))) return "archive";
  if (lower.endsWith(".pdf")) return "pdf";
  if ([".xlsx", ".xls", ".csv"].some((suffix) => lower.endsWith(suffix))) return "spreadsheet";
  return "attachment";
}

function safeError(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : "Unknown error";
}
