#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseFeishuCapturePlan, type FeishuAttachmentPlan } from "./capture-plan.js";
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
import type { ArtifactInput, CapturedSubmissionSourceInput, RegistryVendorInput } from "./registry/types.js";

const [command, planPath] = process.argv.slice(2);
if (command !== "capture-feishu-plan" || !planPath) {
  throw new Error("Usage: casectl intake feishu /absolute/path/plan.json");
}

const plan = parseFeishuCapturePlan(JSON.parse(await readFile(planPath, "utf8")));
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
        sourceLabel: "Feishu sample attachments",
        formats: planned.submission.format ? [planned.submission.format] : [],
        metadata: {
          intakeMethod: "feishu_resource_capture",
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
  attachment: FeishuAttachmentPlan,
): Promise<{ status: "captured" | "failed" | "skipped"; artifacts: ArtifactInput[]; sources: CapturedSubmissionSourceInput[] }> {
  const baseEventId = eventIdFor(attachment);
  const existing = await local.repository.getSourceEvent(baseEventId);
  if (existing && sourceWasCaptured(existing)) {
    return { status: "skipped", artifacts: [], sources: [capturedSourceLink(existing)] };
  }

  const directory = await mkdtemp(join(tmpdir(), "case-feishu-intake-"));
  const outputName = `${attachment.messageId}-${safeCaptureName(attachment.filename)}`;
  const outputPath = join(directory, outputName);
  let artifact: ArtifactInput | undefined;
  let errorMessage: string | undefined;
  const capturedAt = new Date().toISOString();
  try {
    await runLark([
      "im", "+messages-resources-download", "--as", "user",
      "--message-id", attachment.messageId,
      "--file-key", attachment.fileKey,
      "--type", "file",
      "--output", outputName,
      "--format", "json",
    ], directory);
    artifact = await storeSourcePayload(local.artifactStore, outputPath, {
      filename: attachment.filename,
      metadata: { messageId: attachment.messageId, fileKey: attachment.fileKey, source: "feishu" },
    });
  } catch (error) {
    errorMessage = error instanceof Error ? error.message.slice(0, 1_000) : "Unknown resource-capture error";
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

  const itemId = `source-item:feishu:${attachment.messageId}:${shortHash(attachment.fileKey)}${existing ? `:retry:${retryToken}` : ""}`;
  const source: CapturedSubmissionSourceInput = {
    sourceEvent: {
      id: eventId,
      channel: "feishu",
      externalRef: `${attachment.messageLink}${attachment.messageLink.includes("#") ? "&" : "#"}case-file=${shortHash(attachment.fileKey)}${existing ? `&case-retry=${retryToken}` : ""}`,
      sender: attachment.sender,
      receivedAt: attachment.receivedAt,
      rawArtifactId: artifact?.id,
      metadata: {
        messageId: attachment.messageId,
        fileKey: attachment.fileKey,
        captureMethod: "lark-cli-resource-download",
        ...(existing ? { retryOfSourceEventId: existing.id } : {}),
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
      ...(artifact ? { capturedAt } : {}),
      metadata: {
        messageId: attachment.messageId,
        fileKey: attachment.fileKey,
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

async function runLark(arguments_: string[], cwd: string): Promise<void> {
  const executable = process.env.LARK_CLI?.trim() || "lark-cli";
  const result = await new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(executable, arguments_, {
      cwd,
      detached: process.platform !== "win32",
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
  if (result.code !== 0) throw new Error(`Feishu resource command failed: ${result.stderr || result.stdout}`);
}

function eventIdFor(attachment: FeishuAttachmentPlan): string {
  return `capture:feishu:${attachment.messageId}:${shortHash(attachment.fileKey)}`;
}
