import type { CatalogSnapshot, CatalogVendor } from "../app/catalog";

export function normalizeCaseCatalog(value: unknown): CatalogSnapshot {
  const root = record(value);
  const vendors = records(root.vendors).map(normalizeVendor).filter((vendor) => vendor.submissions.length > 0);
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


type JsonRecord = Record<string, unknown>;

function normalizeVendor(value: JsonRecord): CatalogVendor {

  return {
    id: text(value.id),
    ...(text(value.harborStorageId) ? { harborStorageId: text(value.harborStorageId) } : {}),
    name: text(value.name),
    short: text(value.short, text(value.name)),
    hasTimeline: false,
    interactions: [],
    submissions: records(value.submissions).map((submission) => ({
      id: text(submission.id), date: text(submission.date), label: text(submission.label),
      source: "Feishu Base", formats: ["harbor"], sourceEvents: [],
      tasks: records(submission.tasks).filter((task) => task.kind === "task" && task.format === "harbor") as CatalogVendor["submissions"][number]["tasks"],
    })).filter((submission) => submission.tasks.length > 0),
  };
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
