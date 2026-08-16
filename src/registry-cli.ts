#!/usr/bin/env node

import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { basename, extname } from "node:path";
import { contentAddressedStorageKey } from "./registry/artifacts.js";

const [command, ...arguments_] = process.argv.slice(2);
const argument = arguments_[0];
const baseUrl = (process.env.CASE_REGISTRY_URL ?? `http://127.0.0.1:${process.env.PORT ?? "3000"}`).replace(/\/$/, "");
const token = process.env.CASE_REGISTRY_ADMIN_TOKEN;

if (!token) fail("CASE_REGISTRY_ADMIN_TOKEN is required");

switch (command) {
  case "catalog":
    output(await request("GET", "/v1/catalog?scope=all"));
    break;
  case "vendors":
    if (arguments_.length > 1 || (argument && argument !== "--all")) fail("Usage: case-registry vendors [--all]");
    output((await request("GET", `/v1/vendor-directory${argument === "--all" ? "?include_archived=true" : ""}`) as { vendors: unknown[] }).vendors);
    break;
  case "vendor":
    output(await request("GET", `/v1/vendor-records/${encode(argument, "vendor id")}`));
    break;
  case "batch":
    output(await request("GET", `/v1/batches/${encode(argument, "batch id")}?scope=all`));
    break;
  case "task":
    output(await request("GET", `/v1/tasks/${encode(argument, "task version id")}?scope=all`));
    break;
  case "source-event":
    output(await request("GET", `/v1/source-events/${encode(argument, "source event id")}`));
    break;
  case "operations":
    output(await request("GET", "/v1/operations/summary"));
    break;
  case "import":
    output(await request("POST", "/v1/intake/submissions", await jsonFile(argument)));
    break;
  case "import-source":
    output(await request("POST", "/v1/intake/source-events", await jsonFile(argument)));
    break;
  case "record-vendor-event":
    output(await request("POST", "/v1/vendor-events", await jsonFile(argument)));
    break;
  case "archive-vendor":
    output(await request("POST", "/v1/vendors/archive", await jsonFile(argument)));
    break;
  case "restore-vendor":
    output(await request("POST", "/v1/vendors/restore", await jsonFile(argument)));
    break;
  case "store-file":
    output(await storeFile(required(argument, "artifact kind"), required(arguments_[1], "file path")));
    break;
  case "record-check":
    output(await request("POST", "/v1/check-results", await jsonFile(argument)));
    break;
  case "record-follow-up":
    output(await request("POST", "/v1/follow-ups", await jsonFile(argument)));
    break;
  case "submission-reviews":
    output(await request("GET", `/v1/submissions/${encode(argument, "submission id")}/reviews`));
    break;
  case "record-submission-review": {
    const review = await jsonFile(argument) as { batchId?: unknown };
    if (typeof review.batchId !== "string" || !review.batchId) fail("review batchId is required");
    output(await request("POST", `/v1/submissions/${encodeURIComponent(review.batchId)}/reviews`, review));
    break;
  }
  case "register-artifact":
    output(await request("POST", "/v1/artifacts", await jsonFile(argument)));
    break;
  case "remove-submission":
    output(await request("POST", "/v1/intake/remove-submission", await jsonFile(argument)));
    break;
  case "delete-artifact":
    output(await request("DELETE", `/v1/artifacts/${encode(argument, "artifact id")}`));
    break;
  case "set-status":
    output(await request("POST", "/v1/status", await jsonFile(argument)));
    break;
  case "link-task-sources":
    output(await request("POST", "/v1/task-source-links", await jsonFile(argument)));
    break;
  case "lease-work":
    output(await request("POST", "/v1/work/lease", { workerId: required(argument, "worker id"), leaseSeconds: 900 }));
    break;
  case "complete-work":
    output(await request("POST", "/v1/work/complete", await jsonFile(argument)));
    break;
  default:
    fail("Usage: case-registry <catalog|vendors|vendor|batch|task|source-event|submission-reviews|operations|import|import-source|record-vendor-event|archive-vendor|restore-vendor|store-file|record-check|record-follow-up|record-submission-review|register-artifact|remove-submission|delete-artifact|set-status|link-task-sources|lease-work|complete-work> [arguments]");
}

async function storeFile(kind: string, path: string): Promise<unknown> {
  const fileStat = await stat(path);
  if (!fileStat.isFile()) fail("file path must name a regular file");
  const sha256 = await sha256File(path);
  const storageKey = contentAddressedStorageKey(sha256);
  const contentType = contentTypeFor(path);
  const upload = await request("POST", "/v1/artifacts/upload-url", { key: storageKey, contentType, sha256 }) as { url: string };
  const response = await fetch(upload.url, {
    method: "PUT",
    headers: { "content-type": contentType, "x-amz-meta-sha256": sha256, "content-length": String(fileStat.size) },
    body: createReadStream(path) as never,
    duplex: "half",
  } as RequestInit & { duplex: "half" });
  if (!response.ok) throw new Error(`Artifact upload failed with ${response.status}`);
  const artifact = {
    id: `artifact:sha256:${sha256}`,
    kind,
    storageKey,
    sha256,
    sizeBytes: fileStat.size,
    contentType,
    metadata: { originalName: basename(path) },
  };
  await request("POST", "/v1/artifacts/confirm", artifact);
  return artifact;
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

function contentTypeFor(path: string): string {
  switch (extname(path).toLowerCase()) {
    case ".json": return "application/json";
    case ".jsonl": return "application/x-ndjson";
    case ".pdf": return "application/pdf";
    case ".xlsx": return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    case ".xls": return "application/vnd.ms-excel";
    case ".zip": return "application/zip";
    case ".gz": return "application/gzip";
    case ".zst": return "application/zstd";
    case ".csv": return "text/csv";
    case ".txt": case ".md": return "text/plain";
    default: return "application/octet-stream";
  }
}

async function request(method: string, path: string, body?: unknown): Promise<unknown> {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const value = await response.json() as Record<string, unknown>;
  if (!response.ok) throw new Error(`${response.status} ${JSON.stringify(value)}`);
  return value;
}

async function jsonFile(path: string | undefined): Promise<unknown> {
  if (!path) fail("A JSON file path is required");
  return JSON.parse(await readFile(path, "utf8"));
}

function encode(value: string | undefined, name: string): string {
  if (!value) fail(`${name} is required`);
  return encodeURIComponent(value);
}

function required(value: string | undefined, name: string): string {
  if (!value?.trim()) fail(`${name} is required`);
  return value.trim();
}

function output(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function fail(message: string): never {
  throw new Error(message);
}
