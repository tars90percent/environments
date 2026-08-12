export type WorkflowStatus =
  | "received"
  | "normalizing"
  | "checking"
  | "needs_vendor_fix"
  | "ready_for_research"
  | "superseded"
  | "quarantined";

export type CatalogVisibility = "featured" | "available" | "log_only" | "internal";

export type CatalogTask = {
  id: string;
  stableKey: string;
  title: string;
  summary: string | null;
  sourcePath: string | null;
  format: string;
  workflowStatus: WorkflowStatus;
  catalogVisibility: CatalogVisibility;
  checks: { pass: number; fail: number; blocked: number; notRun: number };
};

export type CatalogCategory = {
  id: string;
  name: string;
  description: string;
  count: number;
  examples: string[];
  tasks: CatalogTask[];
};

export type CatalogBatch = {
  id: string;
  date: string;
  label: string;
  source: string;
  taskCount: number;
  formats: string[];
  workflowStatus: WorkflowStatus;
  catalogVisibility: CatalogVisibility;
  revisesBatchId: string | null;
  delta: { retained?: number; added: number; removed: number; changedFiles?: number; note: string };
  categories: CatalogCategory[];
};

export type CatalogVendor = {
  id: string;
  name: string;
  short: string;
  description: string;
  batches: CatalogBatch[];
};

export type CatalogSnapshot = {
  generatedAt: string;
  vendors: CatalogVendor[];
  totals: { vendors: number; batches: number; taskVersions: number };
};
