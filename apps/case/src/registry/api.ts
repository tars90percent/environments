import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { timingSafeEqual } from "node:crypto";
import type { AddressInfo } from "node:net";
import { ArtifactStore } from "./artifacts.js";
import { RegistryConflictError, RegistryNotFoundError } from "./postgres.js";
import { registryFileReferences } from "./file-references.js";
import type { RegistryRepository } from "./repository.js";
import {
  ValidationError,
} from "./validation.js";

import { SRM_BASE_URL } from "./srm-boundary.js";

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

  if (method === "POST" && ["/v1/researcher-uploads", "/v1/researcher-uploads/upload-url"].includes(url.pathname)) {
    return sendJson(response, 410, { error: "original_deliveries_moved_to_feishu_base", url: SRM_BASE_URL });
  }

  if (role !== "catalog") return sendJson(response, 403, { error: "catalog_token_required" });

  if (method === "GET" && url.pathname === "/v1/catalog") {
    return sendJson(response, 200, await registryFileReferences(options.repository, await options.repository.sampleCatalogSnapshot(), "output", true));
  }

  const vendorMatch = url.pathname.match(/^\/v1\/vendors\/([^/]+)$/);
  if (method === "GET" && vendorMatch?.[1]) {
    const vendorId = decodeURIComponent(vendorMatch[1]);
    const value = (await options.repository.sampleCatalogSnapshot()).vendors
      .find((vendor) => vendor.id === vendorId);
    return value ? sendJson(response, 200, await registryFileReferences(options.repository, value, "output", true)) : sendJson(response, 404, { error: "vendor_not_found" });
  }

  const submissionMatch = url.pathname.match(/^\/v1\/submissions\/([^/]+)$/);
  if (method === "GET" && submissionMatch?.[1]) {
    const value = await options.repository.getSampleSubmission(decodeURIComponent(submissionMatch[1]));
    return value ? sendJson(response, 200, await registryFileReferences(options.repository, value, "output", true)) : sendJson(response, 404, { error: "submission_not_found" });
  }

  const taskMatch = url.pathname.match(/^\/v1\/tasks\/([^/]+)$/);
  if (method === "GET" && taskMatch?.[1]) {
    const value = await options.repository.getSampleTask(decodeURIComponent(taskMatch[1]));
    return value ? sendJson(response, 200, await registryFileReferences(options.repository, value, "output", true)) : sendJson(response, 404, { error: "task_not_found" });
  }

  const sourceEventMatch = url.pathname.match(/^\/v1\/source-events\/([^/]+)$/);
  if (method === "GET" && sourceEventMatch?.[1]) {
    const value = await options.repository.getSourceEvent(decodeURIComponent(sourceEventMatch[1]));
    return value ? sendJson(response, 200, await registryFileReferences(options.repository, value, "output", true)) : sendJson(response, 404, { error: "source_event_not_found" });
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


function sendJson(response: ServerResponse, status: number, value: unknown): void {
  if (response.headersSent) return;
  response.statusCode = status;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.end(`${JSON.stringify(value)}\n`);
}

function sendError(response: ServerResponse, error: unknown): void {
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

function safeError(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : "Unknown error";
}
