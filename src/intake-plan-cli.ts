#!/usr/bin/env node

import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { createReadStream } from "node:fs";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, extname, join } from "node:path";
import { contentAddressedStorageKey } from "./registry/artifacts.js";
import { prepareLarkRuntimeEnv } from "./lark-runtime.js";

type Vendor = { id: string; name: string; short: string; description: string; aliases?: string[] };
type AttachmentPlan = {
  messageId: string;
  fileKey: string;
  filename: string;
  messageLink: string;
  sender?: string;
  receivedAt: string;
  categoryId: string;
};
type SubmissionPlan = {
  vendor: Vendor;
  batch: {
    id: string;
    date: string;
    label: string;
    existing?: boolean;
    categories: Array<{ id: string; name: string; description: string }>;
    attachments: AttachmentPlan[];
  };
};
type CapturePlan = { submissions: SubmissionPlan[] };

const [command, planPath] = process.argv.slice(2);
if (command !== "capture-feishu-plan" || !planPath) {
  throw new Error("Usage: case-intake capture-feishu-plan /absolute/path/plan.json");
}

const plan = parsePlan(JSON.parse(await readFile(planPath, "utf8")));
const larkEnv = await prepareLarkRuntimeEnv(process.env);
const ledger: Array<{ batchId: string; files: number; captured: number; failed: number }> = [];

for (const submission of plan.submissions) {
  const summary = { batchId: submission.batch.id, files: submission.batch.attachments.length, captured: 0, failed: 0 };
  const alreadyExists = submission.batch.existing || await batchExists(submission.batch.id);
  let primaryCreated = alreadyExists;
  for (const [index, attachment] of submission.batch.attachments.entries()) {
    const existingEvent = await getSourceEvent(eventIdFor(attachment));
    if (existingEvent) {
      process.stdout.write(`${JSON.stringify({ type: "capture_skipped", reason: "source_event_exists", batchId: submission.batch.id, position: index + 1, files: summary.files, filename: attachment.filename })}\n`);
      if (!primaryCreated) {
        await createSubmission(submission, existingEvent);
        primaryCreated = true;
      }
      continue;
    }
    process.stdout.write(`${JSON.stringify({ type: "capture_started", batchId: submission.batch.id, position: index + 1, files: summary.files, filename: attachment.filename })}\n`);
    const item = await captureAttachment(submission.vendor, attachment);
    summary[item.captured ? "captured" : "failed"] += 1;
    process.stdout.write(`${JSON.stringify({ type: "capture_finished", batchId: submission.batch.id, position: index + 1, captured: item.captured, filename: attachment.filename })}\n`);

    if (primaryCreated) {
      item.envelope.batchLinks = [{
        batchId: submission.batch.id,
        role: "supplement",
        sourceItemIds: item.envelope.items.map((sourceItem: { id: string }) => sourceItem.id),
      }];
      await request("POST", "/v1/intake/source-events", item.envelope);
      continue;
    }

    await request("POST", "/v1/intake/source-events", item.envelope);
    await createSubmission(submission, item.envelope.sourceEvent);
    primaryCreated = true;
  }
  ledger.push(summary);
}

process.stdout.write(`${JSON.stringify({ submissions: ledger.length, ledger }, null, 2)}\n`);

async function captureAttachment(vendor: Vendor, attachment: AttachmentPlan) {
  const directory = await mkdtemp(join(tmpdir(), "case-feishu-intake-"));
  const outputName = `${attachment.messageId}-${safeName(attachment.filename)}`;
  const outputPath = join(directory, outputName);
  let artifact: Record<string, unknown> | undefined;
  let errorMessage: string | undefined;
  try {
    await runLark([
      "im", "+messages-resources-download", "--as", "user",
      "--message-id", attachment.messageId,
      "--file-key", attachment.fileKey,
      "--type", "file",
      "--output", outputName,
      "--format", "json",
    ], directory);
    artifact = await storeFile(outputPath, attachment);
  } catch (error) {
    errorMessage = error instanceof Error ? error.message.slice(0, 1_000) : "Unknown resource-capture error";
  } finally {
    await rm(directory, { recursive: true, force: true });
  }

  const eventId = eventIdFor(attachment);
  const itemId = `source-item:feishu:${attachment.messageId}:${shortHash(attachment.fileKey)}`;
  return {
    captured: Boolean(artifact),
    envelope: {
      vendor,
      sourceEvent: {
        id: eventId,
        channel: "other",
        externalRef: `case-capture://feishu/${attachment.messageId}/${shortHash(attachment.fileKey)}`,
        sender: attachment.sender,
        receivedAt: attachment.receivedAt,
        rawArtifactId: artifact?.id,
        metadata: {
          originalChannel: "feishu",
          originalExternalRef: attachment.messageLink,
          messageId: attachment.messageId,
          fileKey: attachment.fileKey,
          captureMethod: "lark-cli-resource-download",
          ...(errorMessage ? { captureError: errorMessage } : {}),
        },
      },
      items: [{
        id: itemId,
        kind: sourceKindFor(attachment.filename),
        displayName: attachment.filename,
        locator: attachment.messageLink,
        mediaType: artifact?.contentType,
        artifactId: artifact?.id,
        contentSha256: artifact?.sha256,
        sizeBytes: artifact?.sizeBytes,
        fetchStatus: artifact ? "snapshotted" : "failed",
        parseStatus: "not_requested",
        mutable: false,
        ...(artifact ? { capturedAt: new Date().toISOString() } : {}),
        metadata: {
          messageId: attachment.messageId,
          fileKey: attachment.fileKey,
          originalFilename: attachment.filename,
          categoryId: attachment.categoryId,
          ...(errorMessage ? { captureError: errorMessage } : {}),
        },
      }],
      relations: [],
      batchLinks: undefined as Array<{
        batchId: string;
        role: "supplement";
        sourceItemIds: string[];
      }> | undefined,
    },
  };
}

async function createSubmission(submission: SubmissionPlan, sourceEvent: Record<string, unknown>) {
  const examplesByCategory = new Map<string, string[]>();
  for (const planned of submission.batch.attachments) {
    const values = examplesByCategory.get(planned.categoryId) ?? [];
    values.push(planned.filename);
    examplesByCategory.set(planned.categoryId, values);
  }
  await request("POST", "/v1/intake/submissions", {
    vendor: submission.vendor,
    sourceEvent: {
      id: sourceEvent.id,
      channel: sourceEvent.channel,
      externalRef: sourceEvent.externalRef,
      sender: sourceEvent.sender ?? undefined,
      receivedAt: sourceEvent.receivedAt,
      rawArtifactId: sourceEvent.rawArtifactId ?? undefined,
    },
    batch: {
      id: submission.batch.id,
      date: submission.batch.date,
      label: submission.batch.label,
      sourceLabel: "Feishu sample attachments",
      taskCount: 0,
      formats: [...new Set(submission.batch.attachments.map((planned) => formatFor(planned.filename)))],
      workflowStatus: "unchecked",
      catalogVisibility: "available",
      delta: {
        added: 0,
        removed: 0,
        changedFiles: submission.batch.attachments.length,
        note: `${submission.batch.attachments.length} sample files captured; task records and deterministic checks are pending.`,
      },
      metadata: {
        countUnit: "sample_files",
        sampleFileCount: submission.batch.attachments.length,
        intakeMethod: "feishu_resource_capture",
      },
    },
    categories: submission.batch.categories.map((category) => ({
      ...category,
      count: 0,
      examples: examplesByCategory.get(category.id) ?? [],
    })),
    tasks: [],
  });
}

async function storeFile(path: string, attachment: AttachmentPlan) {
  const fileStat = await stat(path);
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
    kind: "task_package",
    storageKey,
    sha256,
    sizeBytes: fileStat.size,
    contentType,
    metadata: {
      originalName: attachment.filename,
      messageId: attachment.messageId,
      fileKey: attachment.fileKey,
      source: "feishu",
    },
  };
  await request("POST", "/v1/artifacts/confirm", artifact);
  return artifact;
}

async function runLark(arguments_: string[], cwd: string): Promise<void> {
  const executable = process.env.LARK_CLI?.trim() || "lark-cli";
  const result = await new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(executable, arguments_, {
      cwd,
      env: {
        ...larkEnv,
        LARKSUITE_CLI_NO_UPDATE_NOTIFIER: "1",
        LARKSUITE_CLI_NO_SKILLS_NOTIFIER: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => child.kill("SIGTERM"), 5 * 60_000);
    child.stdout.on("data", (chunk) => { stdout += String(chunk); });
    child.stderr.on("data", (chunk) => { stderr += String(chunk); });
    child.once("error", reject);
    child.once("close", (code) => { clearTimeout(timeout); resolve({ code, stdout, stderr }); });
  });
  if (result.code !== 0) throw new Error(`Feishu resource download failed: ${result.stderr || result.stdout}`);
  const value = JSON.parse(result.stdout) as { ok?: unknown };
  if (value.ok !== true) throw new Error("Feishu resource download did not report success");
}

async function batchExists(batchId: string): Promise<boolean> {
  const baseUrl = (process.env.CASE_REGISTRY_URL ?? `http://127.0.0.1:${process.env.PORT ?? "3000"}`).replace(/\/$/, "");
  const token = process.env.CASE_REGISTRY_ADMIN_TOKEN;
  if (!token) throw new Error("CASE_REGISTRY_ADMIN_TOKEN is required");
  const response = await fetch(`${baseUrl}/v1/batches/${encodeURIComponent(batchId)}?scope=all`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (response.status === 404) return false;
  if (!response.ok) throw new Error(`Batch lookup failed with ${response.status}`);
  return true;
}

async function getSourceEvent(eventId: string): Promise<Record<string, unknown> | null> {
  const baseUrl = (process.env.CASE_REGISTRY_URL ?? `http://127.0.0.1:${process.env.PORT ?? "3000"}`).replace(/\/$/, "");
  const token = process.env.CASE_REGISTRY_ADMIN_TOKEN;
  if (!token) throw new Error("CASE_REGISTRY_ADMIN_TOKEN is required");
  const response = await fetch(`${baseUrl}/v1/source-events/${encodeURIComponent(eventId)}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (response.status === 404) return null;
  const value = await response.json() as Record<string, unknown>;
  if (!response.ok) throw new Error(`Source-event lookup failed with ${response.status}`);
  return value;
}

async function request(method: string, path: string, body?: unknown): Promise<unknown> {
  const baseUrl = (process.env.CASE_REGISTRY_URL ?? `http://127.0.0.1:${process.env.PORT ?? "3000"}`).replace(/\/$/, "");
  const token = process.env.CASE_REGISTRY_ADMIN_TOKEN;
  if (!token) throw new Error("CASE_REGISTRY_ADMIN_TOKEN is required");
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

function parsePlan(value: unknown): CapturePlan {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Capture plan must be an object");
  const submissions = (value as { submissions?: unknown }).submissions;
  if (!Array.isArray(submissions)) throw new Error("Capture plan submissions must be an array");
  for (const [index, entry] of submissions.entries()) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw new Error(`submissions[${index}] must be an object`);
    const submission = entry as SubmissionPlan;
    if (!submission.vendor?.id || !submission.vendor.name || !submission.batch?.id || !submission.batch.date || !submission.batch.label) {
      throw new Error(`submissions[${index}] is missing vendor or batch fields`);
    }
    if (!Array.isArray(submission.batch.categories) || !Array.isArray(submission.batch.attachments) || !submission.batch.attachments.length) {
      throw new Error(`submissions[${index}] must contain categories and at least one attachment`);
    }
    const categoryIds = new Set(submission.batch.categories.map((category) => category.id));
    for (const attachment of submission.batch.attachments) {
      if (!attachment.messageId?.startsWith("om_") || !attachment.fileKey?.startsWith("file_") || !attachment.filename || !attachment.messageLink) {
        throw new Error(`submissions[${index}] contains an invalid attachment`);
      }
      if (!categoryIds.has(attachment.categoryId)) throw new Error(`submissions[${index}] attachment names an unknown category`);
      if (Number.isNaN(Date.parse(attachment.receivedAt))) throw new Error(`submissions[${index}] attachment has an invalid receivedAt`);
    }
  }
  return { submissions: submissions as SubmissionPlan[] };
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

function safeName(value: string): string {
  const name = basename(value).replace(/[\r\n\\/:*?"<>|]/g, "_").slice(0, 180);
  return name || "attachment";
}
function shortHash(value: string): string { return createHash("sha256").update(value).digest("hex").slice(0, 20); }
function eventIdFor(attachment: AttachmentPlan): string { return `capture:feishu:${attachment.messageId}:${shortHash(attachment.fileKey)}`; }
function formatFor(value: string): string { return extname(value).replace(/^\./, "").toUpperCase() || "file"; }
function sourceKindFor(value: string) {
  const lower = value.toLowerCase();
  if (lower.endsWith(".zip") || lower.endsWith(".rar") || lower.endsWith(".tar.gz") || lower.endsWith(".tgz")) return "archive";
  if (lower.endsWith(".pdf")) return "pdf";
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls") || lower.endsWith(".csv")) return "spreadsheet";
  return "attachment";
}
function contentTypeFor(value: string): string {
  const lower = value.toLowerCase();
  if (lower.endsWith(".json") || lower.endsWith(".jsonl")) return "application/json";
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".xlsx")) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (lower.endsWith(".xls")) return "application/vnd.ms-excel";
  if (lower.endsWith(".zip")) return "application/zip";
  if (lower.endsWith(".gz")) return "application/gzip";
  if (lower.endsWith(".csv")) return "text/csv";
  if (lower.endsWith(".md") || lower.endsWith(".txt")) return "text/plain";
  return "application/octet-stream";
}
