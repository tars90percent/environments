export type WorkflowStatus =
  | "unchecked"
  | "received"
  | "normalizing"
  | "checking"
  | "needs_vendor_fix"
  | "ready_for_research"
  | "superseded"
  | "quarantined";

export type CatalogVisibility = "featured" | "available" | "log_only" | "internal";
export type SubmissionReviewSignal = "interested" | "needs_revision" | "not_interested" | "comment";
export type SubmissionReviewScope = "submission" | "categories";

export type SubmissionReview = {
  id: string;
  batchId: string;
  signal: SubmissionReviewSignal;
  scope: SubmissionReviewScope;
  categoryIds: string[];
  reviewer: { name: string };
  comment: string;
  createdAt: string;
};

export type SourceChannel = "email" | "feishu" | "slack" | "website" | "vendor_portal" | "workspace" | "upload" | "other";
export type SourceItemKind = "message" | "attachment" | "url" | "folder" | "document" | "spreadsheet" | "worksheet" | "row" | "pdf" | "archive" | "file" | "task_package" | "container_image" | "web_page" | "other";
export type SourceFetchStatus = "not_requested" | "queued" | "fetching" | "snapshotted" | "external_only" | "blocked" | "failed";
export type SourceParseStatus = "not_requested" | "queued" | "parsing" | "parsed" | "partial" | "blocked" | "failed";
export type SourceRelationKind = "contains" | "links_to" | "derived_from" | "describes" | "mirrors" | "supersedes";

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
  sourceItemIds: string[];
};

export type CatalogSourceItem = {
  id: string;
  kind: SourceItemKind;
  displayName: string;
  locator: string | null;
  mediaType: string | null;
  artifactId: string | null;
  contentSha256: string | null;
  sizeBytes: number | null;
  fetchStatus: SourceFetchStatus;
  parseStatus: SourceParseStatus;
  mutable: boolean;
  capturedAt: string | null;
  metadata: Record<string, unknown>;
};

export type CatalogSourceRelation = {
  fromItemId: string;
  toItemId: string;
  relation: SourceRelationKind;
  position: number | null;
};

export type CatalogSourceEvent = {
  id: string;
  role: "primary" | "supplement" | "correction" | "metadata" | "other" | null;
  channel: SourceChannel;
  externalRef: string;
  sender: string | null;
  receivedAt: string;
  rawArtifactId: string | null;
  items: CatalogSourceItem[];
  relations: CatalogSourceRelation[];
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
  declaredTaskCount: number;
  formats: string[];
  workflowStatus: WorkflowStatus;
  catalogVisibility: CatalogVisibility;
  revisesBatchId: string | null;
  delta: { retained?: number; added: number; removed: number; changedFiles?: number; note: string };
  sourceEvents: CatalogSourceEvent[];
  categories: CatalogCategory[];
};

export type ProcurementStage =
  | "commercial"
  | "negotiating"
  | "authorized"
  | "contracted"
  | "ordered"
  | "delivering"
  | "delivered"
  | "accepted"
  | "paid"
  | "closed";

export type ProcurementCommitment = "none" | "authorized" | "contracted" | "ordered" | "unknown";

export type CatalogProcurementSummary = {
  stage: ProcurementStage;
  summary: string;
  amountApprox: { currency: string; value: number } | null;
  commitment: ProcurementCommitment;
  occurredAt: string;
  actor: string;
  evidenceEventId: string;
  evidenceSourceCount: number;
  retrospective: boolean;
};

export type CatalogVendor = {
  id: string;
  name: string;
  short: string;
  description: string;
  procurementSummary?: CatalogProcurementSummary | null;
  batches: CatalogBatch[];
};

export type CatalogSnapshot = {
  generatedAt: string;
  vendors: CatalogVendor[];
  totals: { vendors: number; batches: number; taskVersions: number };
};
