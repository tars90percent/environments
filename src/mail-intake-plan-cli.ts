#!/usr/bin/env node

import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { createReadStream } from "node:fs";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, extname, join } from "node:path";
import { contentAddressedStorageKey } from "./registry/artifacts.js";
import { prepareLarkRuntimeEnv } from "./lark-runtime.js";

type Vendor = { id: string; name: string; short: string; description: string; aliases?: string[] };
type Attachment = {
  messageId: string;
  attachmentId: string;
  filename: string;
  contentType?: string;
  sender?: string;
  receivedAt: string;
  categoryId: string;
};
type Submission = {
  vendor: Vendor;
  batch: {
    id: string;
    date: string;
    label: string;
    existing?: boolean;
    categories: Array<{ id: string; name: string; description: string }>;
    attachments: Attachment[];
  };
};

const [command, planPath] = process.argv.slice(2);
if (command !== "capture-mail-plan" || !planPath) {
  throw new Error("Usage: case-mail-intake capture-mail-plan /absolute/path/plan.json");
}

const plan = parsePlan(JSON.parse(await readFile(planPath, "utf8")));
const larkEnv = await prepareLarkRuntimeEnv(process.env);
const ledger: Array<{ batchId: string; files: number; captured: number; failed: number }> = [];

for (const submission of plan) {
  const captured = [];
  for (const attachment of submission.batch.attachments) captured.push(await captureAttachment(submission.vendor, attachment));
  const primary = captured[0];
  if (!primary) continue;

  if (submission.batch.existing) {
    for (const item of captured) {
      item.envelope.batchLinks = [{
        batchId: submission.batch.id,
        role: "supplement",
        sourceItemIds: item.envelope.items.map((sourceItem) => sourceItem.id),
      }];
      await request("POST", "/v1/intake/source-events", item.envelope);
    }
  } else {
    await request("POST", "/v1/intake/source-events", primary.envelope);
    const examplesByCategory = new Map<string, string[]>();
    for (const attachment of submission.batch.attachments) {
      const values = examplesByCategory.get(attachment.categoryId) ?? [];
      values.push(attachment.filename);
      examplesByCategory.set(attachment.categoryId, values);
    }
    await request("POST", "/v1/intake/submissions", {
      vendor: submission.vendor,
      sourceEvent: primary.envelope.sourceEvent,
      batch: {
        id: submission.batch.id,
        date: submission.batch.date,
        label: submission.batch.label,
        sourceLabel: "Feishu Mail sample attachments",
        taskCount: 0,
        formats: [...new Set(submission.batch.attachments.map((attachment) => formatFor(attachment.filename)))],
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
          intakeMethod: "feishu_mail_attachment_capture",
        },
      },
      categories: submission.batch.categories.map((category) => ({
        ...category,
        count: 0,
        examples: examplesByCategory.get(category.id) ?? [],
      })),
      tasks: [],
    });
    for (const item of captured.slice(1)) {
      item.envelope.batchLinks = [{
        batchId: submission.batch.id,
        role: "supplement",
        sourceItemIds: item.envelope.items.map((sourceItem) => sourceItem.id),
      }];
      await request("POST", "/v1/intake/source-events", item.envelope);
    }
  }

  ledger.push({
    batchId: submission.batch.id,
    files: captured.length,
    captured: captured.filter((item) => item.captured).length,
    failed: captured.filter((item) => !item.captured).length,
  });
}

process.stdout.write(`${JSON.stringify({ submissions: ledger.length, ledger }, null, 2)}\n`);

async function captureAttachment(vendor: Vendor, attachment: Attachment) {
  const directory = await mkdtemp(join(tmpdir(), "case-mail-intake-"));
  const outputPath = join(directory, `${shortHash(attachment.messageId)}-${safeName(attachment.filename)}`);
  let artifact: Record<string, unknown> | undefined;
  let errorMessage: string | undefined;
  try {
    const value = await runLark([
      "mail", "user_mailbox.message.attachments", "download_url", "--as", "user",
      "--user-mailbox-id", "me",
      "--message-id", attachment.messageId,
      "--attachment-ids", attachment.attachmentId,
      "--format", "json",
    ]);
    const downloadUrl = mailDownloadUrl(value, attachment.attachmentId);
    const response = await fetch(downloadUrl);
    if (!response.ok) throw new Error(`Mail attachment download failed with ${response.status}`);
    await writeFile(outputPath, Buffer.from(await response.arrayBuffer()));
    artifact = await storeFile(outputPath, attachment);
  } catch (error) {
    errorMessage = error instanceof Error ? error.message.slice(0, 1_000) : "Unknown mail-capture error";
  } finally {
    await rm(directory, { recursive: true, force: true });
  }

  const messageHash = shortHash(attachment.messageId);
  const attachmentHash = shortHash(attachment.attachmentId);
  const locator = `feishu-mail://message/${encodeURIComponent(attachment.messageId)}`;
  return {
    captured: Boolean(artifact),
    envelope: {
      vendor,
      sourceEvent: {
        id: `capture:mail:${messageHash}:${attachmentHash}`,
        channel: "email",
        externalRef: `case-capture://mail/${messageHash}/${attachmentHash}`,
        sender: attachment.sender,
        receivedAt: attachment.receivedAt,
        rawArtifactId: artifact?.id,
        metadata: {
          originalChannel: "feishu_mail",
          messageId: attachment.messageId,
          attachmentId: attachment.attachmentId,
          captureMethod: "lark-cli-mail-download-url",
          ...(errorMessage ? { captureError: errorMessage } : {}),
        },
      },
      items: [{
        id: `source-item:mail:${messageHash}:${attachmentHash}`,
        kind: sourceKindFor(attachment.filename),
        displayName: attachment.filename,
        locator,
        mediaType: artifact?.contentType ?? attachment.contentType,
        artifactId: artifact?.id,
        contentSha256: artifact?.sha256,
        sizeBytes: artifact?.sizeBytes,
        fetchStatus: artifact ? "snapshotted" : "failed",
        parseStatus: "not_requested",
        mutable: false,
        ...(artifact ? { capturedAt: new Date().toISOString() } : {}),
        metadata: {
          messageId: attachment.messageId,
          attachmentId: attachment.attachmentId,
          originalFilename: attachment.filename,
          categoryId: attachment.categoryId,
          ...(errorMessage ? { captureError: errorMessage } : {}),
        },
      }],
      relations: [],
      batchLinks: undefined as Array<{ batchId: string; role: "supplement"; sourceItemIds: string[] }> | undefined,
    },
  };
}

async function storeFile(path: string, attachment: Attachment) {
  const fileStat = await stat(path);
  const sha256 = await sha256File(path);
  const storageKey = contentAddressedStorageKey(sha256);
  const contentType = attachment.contentType || contentTypeFor(path);
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
      attachmentId: attachment.attachmentId,
      source: "feishu_mail",
    },
  };
  await request("POST", "/v1/artifacts/confirm", artifact);
  return artifact;
}

async function runLark(arguments_: string[]): Promise<unknown> {
  const executable = process.env.LARK_CLI?.trim() || "lark-cli";
  const result = await new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(executable, arguments_, {
      env: {
        ...larkEnv,
        LARKSUITE_CLI_NO_UPDATE_NOTIFIER: "1",
        LARKSUITE_CLI_NO_SKILLS_NOTIFIER: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += String(chunk); });
    child.stderr.on("data", (chunk) => { stderr += String(chunk); });
    child.once("error", reject);
    child.once("close", (code) => resolve({ code, stdout, stderr }));
  });
  if (result.code !== 0) throw new Error(`Mail attachment command failed: ${result.stderr || result.stdout}`);
  return JSON.parse(result.stdout) as unknown;
}

async function request(method: string, path: string, body?: unknown): Promise<unknown> {
  const baseUrl = (process.env.CASE_REGISTRY_URL ?? `http://127.0.0.1:${process.env.PORT ?? "3000"}`).replace(/\/$/, "");
  const token = process.env.CASE_REGISTRY_ADMIN_TOKEN;
  if (!token) throw new Error("CASE_REGISTRY_ADMIN_TOKEN is required");
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { authorization: `Bearer ${token}`, ...(body === undefined ? {} : { "content-type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const value = await response.json() as Record<string, unknown>;
  if (!response.ok) throw new Error(`${response.status} ${JSON.stringify(value)}`);
  return value;
}

function parsePlan(value: unknown): Submission[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Capture plan must be an object");
  const submissions = (value as { submissions?: unknown }).submissions;
  if (!Array.isArray(submissions)) throw new Error("Capture plan submissions must be an array");
  for (const [index, entry] of submissions.entries()) {
    const submission = entry as Submission;
    if (!submission?.vendor?.id || !submission.vendor.name || !submission.batch?.id || !submission.batch.date || !submission.batch.label) {
      throw new Error(`submissions[${index}] is missing vendor or submission fields`);
    }
    if (!Array.isArray(submission.batch.categories) || !Array.isArray(submission.batch.attachments) || !submission.batch.attachments.length) {
      throw new Error(`submissions[${index}] must contain categories and at least one attachment`);
    }
    const categoryIds = new Set(submission.batch.categories.map((category) => category.id));
    for (const attachment of submission.batch.attachments) {
      if (!attachment.messageId || !attachment.attachmentId || !attachment.filename) throw new Error(`submissions[${index}] contains an invalid attachment`);
      if (!categoryIds.has(attachment.categoryId)) throw new Error(`submissions[${index}] attachment names an unknown category`);
      if (Number.isNaN(Date.parse(attachment.receivedAt))) throw new Error(`submissions[${index}] attachment has an invalid receivedAt`);
    }
  }
  return submissions as Submission[];
}

function mailDownloadUrl(value: unknown, attachmentId: string): string {
  if (!value || typeof value !== "object") throw new Error("Mail attachment URL response was not an object");
  const root = value as { ok?: unknown; data?: { download_urls?: unknown[] } };
  if (root.ok !== true || !Array.isArray(root.data?.download_urls)) throw new Error("Mail attachment URL response did not report success");
  for (const entry of root.data.download_urls) {
    if (!entry || typeof entry !== "object") continue;
    const item = entry as { attachment_id?: unknown; download_url?: unknown };
    if ((item.attachment_id === attachmentId || root.data.download_urls.length === 1) && typeof item.download_url === "string") return item.download_url;
  }
  throw new Error("Mail attachment URL was missing");
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

function safeName(value: string): string { return basename(value).replace(/[\r\n\\/:*?"<>|]/g, "_").slice(0, 180) || "attachment"; }
function shortHash(value: string): string { return createHash("sha256").update(value).digest("hex").slice(0, 20); }
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
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".zip")) return "application/zip";
  if (lower.endsWith(".xlsx")) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (lower.endsWith(".xls")) return "application/vnd.ms-excel";
  return "application/octet-stream";
}
