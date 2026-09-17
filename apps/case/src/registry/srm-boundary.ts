import { parseCaptureSubmission } from "./validation.js";
import type { CaptureSubmissionInput } from "./types.js";

export const SRM_BASE_URL = "https://vrfi1sk8a0.feishu.cn/base/WqS9bTgadatBNusLu7aciS7wn8f";
export const SRM_ONLY_MESSAGE = `Supplier timelines and original deliveries belong in Feishu Base: ${SRM_BASE_URL}. Railway accepts Harbor task packages and technical task metadata only.`;

export const retiredRegistryCommands = new Set([
  "create-vendor-timeline", "record-vendor-interaction", "update-vendor-interaction",
  "delete-vendor-interaction", "delete-vendor-timeline", "capture-submission",
  "import", "import-source", "reconcile-submission-source-items",
]);

export function assertRegistryWriteBoundary(command: string | undefined, arguments_: string[]): void {
  if (command && retiredRegistryCommands.has(command)) throw new Error(SRM_ONLY_MESSAGE);
  if (command === "store-file") assertTaskArtifactKind(arguments_[0]);
}

export function assertTaskArtifactKind(kind: unknown): void {
  if (kind !== "task_package") throw new Error(SRM_ONLY_MESSAGE);
}

export function assertHarborTasks(tasks: Array<{ kind: string; format: string }>): void {
  if (tasks.some((task) => task.kind !== "task" || task.format !== "harbor")) {
    throw new Error("Only statically valid Harbor tasks can be registered in Railway. Keep failed validation, other tasks, and traces with their delivery in Feishu Base.");
  }
}

// A technical grouping and durable Base pointer, without copying the delivery
// narrative, sender, attachments, or supplier history into Railway.
export function harborSubmissionFromBase(value: unknown): CaptureSubmissionInput {
  const input = object(value);
  onlyKeys(input, ["vendor", "submission", "baseRecordId", "actor"]);
  const vendor = object(input.vendor);
  onlyKeys(vendor, ["id", "name", "short"]);
  const submission = object(input.submission);
  onlyKeys(submission, ["id", "date", "label"]);
  const baseRecordId = string(input.baseRecordId, "baseRecordId");
  if (!/^rec[a-zA-Z0-9]+$/.test(baseRecordId)) throw new Error("baseRecordId must be a Feishu record ID");
  const date = string(submission.date, "submission.date");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(date).toISOString().slice(0, 10) !== date) throw new Error("submission.date must be a valid YYYY-MM-DD date");
  const id = string(submission.id, "submission.id");
  const vendorId = string(vendor.id, "vendor.id");
  const baseUrl = `${SRM_BASE_URL}?table=tbl38dJ8U3V5vGT0&record=${baseRecordId}`;
  const eventId = `base-harbor:${id}`;
  return parseCaptureSubmission({
    purpose: "sample_evaluation",
    vendor: { id: vendorId, name: string(vendor.name, "vendor.name"), short: string(vendor.short, "vendor.short"), description: "Harbor task reference; supplier details are maintained in Feishu Base." },
    submission: { id, date, label: string(submission.label, "submission.label"), sourceLabel: "Feishu Base", formats: ["harbor"], metadata: { baseRecordId, baseUrl } },
    sources: [{
      sourceEvent: { id: eventId, channel: "other", externalRef: `${baseUrl}#harbor=${encodeURIComponent(id)}`, receivedAt: `${date}T00:00:00.000Z`, metadata: { purpose: "harbor_base_reference", datePrecision: "day", baseRecordId, baseUrl } },
      items: [{ id: `${eventId}:record`, kind: "url", displayName: "Feishu Base delivery record", locator: baseUrl, fetchStatus: "external_only", parseStatus: "not_requested", mutable: true }],
      relations: [],
    }],
    actor: string(input.actor, "actor"),
  });
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected a JSON object");
  return value as Record<string, unknown>;
}

function string(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field} is required`);
  return value.trim();
}

function onlyKeys(value: Record<string, unknown>, allowed: string[]): void {
  if (Object.keys(value).some((key) => !allowed.includes(key))) throw new Error("Harbor registration accepts technical grouping fields and a Base record ID only; preserve delivery contents in Base.");
}
