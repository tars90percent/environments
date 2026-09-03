import type { CatalogSnapshot, CatalogVendor, CatalogVendorInteraction } from "../app/catalog";
import type { DatasetSubmission } from "../app/dataset-archive";

export function normalizeCaseCatalog(value: unknown): CatalogSnapshot {
  const root = record(value);
  const vendors = records(root.vendors).map(normalizeVendor);
  const submissions = vendors.flatMap((vendor) => vendor.submissions);
  const tasks = submissions.flatMap((submission) => submission.tasks);
  return {
    generatedAt: text(root.generatedAt, new Date(0).toISOString()),
    vendors,
    totals: {
      vendors: vendors.length,
      submissions: submissions.length,
      tasks: tasks.length,
      harborTasks: tasks.filter((task) => task.format === "harbor").length,
    },
  };
}

export function normalizeCaseSubmission(value: unknown): DatasetSubmission {
  return value as DatasetSubmission;
}

type JsonRecord = Record<string, unknown>;

function normalizeVendor(value: JsonRecord): CatalogVendor {
  const interactions = records(value.interactions).map(normalizeInteraction);
  return {
    id: text(value.id),
    name: text(value.name),
    short: text(value.short, text(value.name)),
    hasTimeline: value.hasTimeline === true || interactions.length > 0,
    interactions,
    submissions: Array.isArray(value.submissions) ? value.submissions as CatalogVendor["submissions"] : [],
  };
}

function normalizeInteraction(value: JsonRecord): CatalogVendorInteraction {
  return {
    id: text(value.id),
    kind: interactionKind(value.kind),
    eventType: text(value.eventType),
    title: text(value.title),
    summary: text(value.summary),
    channel: interactionChannel(value.channel),
    evidence: interactionEvidence(value.evidence),
    occurredAt: text(value.occurredAt),
  };
}

function interactionKind(value: unknown): CatalogVendorInteraction["kind"] {
  return new Set(["contact", "sample", "evaluation", "commercial", "delivery", "acceptance", "payment", "relationship", "note"]).has(value as string)
    ? value as CatalogVendorInteraction["kind"]
    : "note";
}

function interactionChannel(value: unknown): CatalogVendorInteraction["channel"] {
  return new Set(["meeting", "email", "feishu", "slack", "wechat", "file_delivery", "internal", "other"]).has(value as string)
    ? value as CatalogVendorInteraction["channel"]
    : "other";
}

function interactionEvidence(value: unknown): CatalogVendorInteraction["evidence"] {
  return new Set(["direct", "relayed", "automated", "internal"]).has(value as string)
    ? value as CatalogVendorInteraction["evidence"]
    : "internal";
}

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function records(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.map(record) : [];
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}
