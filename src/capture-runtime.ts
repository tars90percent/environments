import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { basename } from "node:path";
import { ArtifactStore, contentAddressedStorageKey } from "./registry/artifacts.js";
import type { ArtifactInput, CatalogSourceEvent } from "./registry/types.js";

export async function storeSourcePayload(
  store: ArtifactStore,
  path: string,
  input: { filename: string; contentType?: string; metadata: Record<string, unknown> },
): Promise<ArtifactInput> {
  const file = await stat(path);
  if (!file.isFile()) throw new Error("Captured payload is not a regular file");
  const sha256 = await sha256File(path);
  const storageKey = contentAddressedStorageKey(sha256);
  const contentType = input.contentType || contentTypeFor(input.filename);
  await store.putFile({ key: storageKey, path, contentType, sha256, sizeBytes: file.size });
  return {
    id: `artifact:sha256:${sha256}`,
    kind: "source_payload",
    storageKey,
    sha256,
    sizeBytes: file.size,
    contentType,
    metadata: { originalName: input.filename, ...input.metadata },
  };
}

export function capturedSourceLink(event: CatalogSourceEvent): { sourceEventId: string; sourceItemIds: string[] } {
  return { sourceEventId: event.id, sourceItemIds: event.items.map((item) => item.id) };
}

export function sourceWasCaptured(event: CatalogSourceEvent): boolean {
  return event.items.some((item) => item.fetchStatus === "snapshotted" && Boolean(item.artifactId));
}

export function safeCaptureName(value: string): string {
  return basename(value).replace(/[\r\n\\/:*?"<>|]/g, "_").slice(0, 180) || "attachment";
}

export function shortHash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 20);
}

export function sourceKindFor(value: string): "archive" | "pdf" | "spreadsheet" | "attachment" {
  const lower = value.toLowerCase();
  if (lower.endsWith(".zip") || lower.endsWith(".rar") || lower.endsWith(".tar.gz") || lower.endsWith(".tgz")) return "archive";
  if (lower.endsWith(".pdf")) return "pdf";
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls") || lower.endsWith(".csv")) return "spreadsheet";
  return "attachment";
}

export function contentTypeFor(value: string): string {
  const lower = value.toLowerCase();
  if (lower.endsWith(".json")) return "application/json";
  if (lower.endsWith(".jsonl")) return "application/x-ndjson";
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".xlsx")) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (lower.endsWith(".xls")) return "application/vnd.ms-excel";
  if (lower.endsWith(".zip")) return "application/zip";
  if (lower.endsWith(".gz") || lower.endsWith(".tgz")) return "application/gzip";
  if (lower.endsWith(".csv")) return "text/csv";
  if (lower.endsWith(".md") || lower.endsWith(".txt")) return "text/plain";
  return "application/octet-stream";
}

async function sha256File(path: string): Promise<string> {
  const hash = createHash("sha256");
  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(path);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", resolve);
  });
  return hash.digest("hex");
}
