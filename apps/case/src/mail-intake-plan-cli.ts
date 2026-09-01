#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseMailCapturePlan, type MailAttachmentPlan } from "./capture-plan.js";
import {
  capturedSourceLink,
  safeCaptureName,
  shortHash,
  sourceKindFor,
  sourceWasCaptured,
  storeSourcePayload,
} from "./capture-runtime.js";
import { prepareLarkRuntimeEnv } from "./lark-runtime.js";
import { openLocalRegistry, type LocalRegistry } from "./registry/local.js";
import type { ArtifactInput, CapturedSubmissionSourceInput } from "./registry/types.js";

const [command, planPath] = process.argv.slice(2);
if (command !== "capture-mail-plan" || !planPath) {
  throw new Error("Usage: casectl intake mail /absolute/path/plan.json");
}

const plan = parseMailCapturePlan(JSON.parse(await readFile(planPath, "utf8")));
const larkEnv = await prepareLarkRuntimeEnv(process.env);
const local = await openLocalRegistry();

try {
  const ledger: Array<{ submissionId: string; files: number; captured: number; failed: number; skipped: number }> = [];
  for (const planned of plan.submissions) {
    const summary = { submissionId: planned.submission.id, files: planned.submission.attachments.length, captured: 0, failed: 0, skipped: 0 };
    const artifacts: ArtifactInput[] = [];
    const sources: CapturedSubmissionSourceInput[] = [];

    for (const [index, attachment] of planned.submission.attachments.entries()) {
      process.stdout.write(`${JSON.stringify({ type: "capture_started", submissionId: planned.submission.id, position: index + 1, files: summary.files, filename: attachment.filename })}\n`);
      const result = await captureAttachment(local, attachment);
      artifacts.push(...result.artifacts);
      sources.push(...result.sources);
      summary[result.status] += 1;
      process.stdout.write(`${JSON.stringify({ type: "capture_finished", submissionId: planned.submission.id, position: index + 1, status: result.status, filename: attachment.filename })}\n`);
    }

    const uniqueArtifacts = [...new Map(artifacts.map((artifact) => [artifact.id, artifact])).values()];
    await local.repository.captureSubmission({
      vendor: planned.vendor,
      submission: {
        id: planned.submission.id,
        date: planned.submission.date,
        label: planned.submission.label,
        sourceLabel: "Feishu Mail sample attachments",
        formats: planned.submission.format ? [planned.submission.format] : [],
        metadata: {
          intakeMethod: "feishu_mail_attachment_capture",
          sampleFileCount: planned.submission.attachments.length,
        },
      },
      artifacts: uniqueArtifacts,
      sources,
      actor: "CASE",
    });
    ledger.push(summary);
  }
  process.stdout.write(`${JSON.stringify({ submissions: ledger.length, ledger }, null, 2)}\n`);
} finally {
  await local.close();
}

async function captureAttachment(
  local: LocalRegistry,
  attachment: MailAttachmentPlan,
): Promise<{ status: "captured" | "failed" | "skipped"; artifacts: ArtifactInput[]; sources: CapturedSubmissionSourceInput[] }> {
  const baseEventId = eventIdFor(attachment);
  const existing = await local.repository.getSourceEvent(baseEventId);
  if (existing && sourceWasCaptured(existing)) {
    return { status: "skipped", artifacts: [], sources: [capturedSourceLink(existing)] };
  }

  const directory = await mkdtemp(join(tmpdir(), "case-mail-intake-"));
  const outputPath = join(directory, `${shortHash(attachment.messageId)}-${safeCaptureName(attachment.filename)}`);
  let artifact: ArtifactInput | undefined;
  let errorMessage: string | undefined;
  const capturedAt = new Date().toISOString();
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
    artifact = await storeSourcePayload(local.artifactStore, outputPath, {
      filename: attachment.filename,
      contentType: attachment.contentType,
      metadata: { messageId: attachment.messageId, attachmentId: attachment.attachmentId, source: "feishu_mail" },
    });
  } catch (error) {
    errorMessage = error instanceof Error ? error.message.slice(0, 1_000) : "Unknown mail-capture error";
  } finally {
    await rm(directory, { recursive: true, force: true });
  }

  const retryToken = artifact ? artifact.sha256.slice(0, 20) : randomUUID().replaceAll("-", "").slice(0, 20);
  const eventId = existing ? `${baseEventId}:retry:${retryToken}` : baseEventId;
  if (existing && artifact) {
    const recordedRetry = await local.repository.getSourceEvent(eventId);
    if (recordedRetry && sourceWasCaptured(recordedRetry)) {
      return { status: "skipped", artifacts: [], sources: [capturedSourceLink(existing), capturedSourceLink(recordedRetry)] };
    }
  }

  const locator = `feishu-mail://message/${encodeURIComponent(attachment.messageId)}/attachment/${encodeURIComponent(attachment.attachmentId)}`;
  const messageHash = shortHash(attachment.messageId);
  const attachmentHash = shortHash(attachment.attachmentId);
  const source: CapturedSubmissionSourceInput = {
    sourceEvent: {
      id: eventId,
      channel: "email",
      externalRef: `${locator}${existing ? `?case-retry=${retryToken}` : ""}`,
      sender: attachment.sender,
      receivedAt: attachment.receivedAt,
      rawArtifactId: artifact?.id,
      metadata: {
        originalChannel: "feishu_mail",
        messageId: attachment.messageId,
        attachmentId: attachment.attachmentId,
        captureMethod: "lark-cli-mail-download-url",
        ...(existing ? { retryOfSourceEventId: existing.id } : {}),
        ...(errorMessage ? { captureError: errorMessage } : {}),
      },
    },
    items: [{
      id: `source-item:mail:${messageHash}:${attachmentHash}${existing ? `:retry:${retryToken}` : ""}`,
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
      ...(artifact ? { capturedAt } : {}),
      metadata: {
        messageId: attachment.messageId,
        attachmentId: attachment.attachmentId,
        originalFilename: attachment.filename,
        ...(existing ? { retryOfSourceEventId: existing.id } : {}),
        ...(errorMessage ? { captureError: errorMessage } : {}),
      },
    }],
    relations: [],
  };
  return {
    status: artifact ? "captured" : "failed",
    artifacts: artifact ? [artifact] : [],
    sources: [...(existing ? [capturedSourceLink(existing)] : []), source],
  };
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

function eventIdFor(attachment: MailAttachmentPlan): string {
  return `capture:mail:${shortHash(attachment.messageId)}:${shortHash(attachment.attachmentId)}`;
}
