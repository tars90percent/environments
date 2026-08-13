export type WorkflowStatus =
  | "received"
  | "normalizing"
  | "checking"
  | "needs_vendor_fix"
  | "ready_for_research"
  | "superseded"
  | "quarantined";

export type CatalogVisibility = "featured" | "available" | "log_only" | "internal";
export type CheckOutcome = "pass" | "fail" | "blocked" | "not_run";
export type CatalogScope = "research" | "portal" | "all";

export type SourceChannel =
  | "email"
  | "feishu"
  | "slack"
  | "website"
  | "vendor_portal"
  | "workspace"
  | "upload"
  | "other";

export type SourceItemKind =
  | "message"
  | "attachment"
  | "url"
  | "folder"
  | "document"
  | "spreadsheet"
  | "worksheet"
  | "row"
  | "pdf"
  | "archive"
  | "file"
  | "task_package"
  | "container_image"
  | "web_page"
  | "other";

export type SourceFetchStatus =
  | "not_requested"
  | "queued"
  | "fetching"
  | "snapshotted"
  | "external_only"
  | "blocked"
  | "failed";

export type SourceParseStatus =
  | "not_requested"
  | "queued"
  | "parsing"
  | "parsed"
  | "partial"
  | "blocked"
  | "failed";

export type SourceRelationKind =
  | "contains"
  | "links_to"
  | "derived_from"
  | "describes"
  | "mirrors"
  | "supersedes";

export type RegistryVendorInput = {
  id: string;
  name: string;
  short: string;
  description: string;
  aliases?: string[];
};

export type VendorEventKind =
  | "contact"
  | "sample"
  | "evaluation"
  | "commercial"
  | "delivery"
  | "acceptance"
  | "payment"
  | "relationship"
  | "note";

export type VendorEventInput = {
  id: string;
  vendorId: string;
  kind: VendorEventKind;
  eventType: string;
  summary: string;
  actor: string;
  occurredAt: string;
  sourceEventIds: string[];
  batchIds: string[];
  metadata?: Record<string, unknown>;
};

export type VendorEvent = VendorEventInput & {
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type VendorDirectoryEntry = RegistryVendorInput & {
  aliases: string[];
  sourceEventCount: number;
  submissionCount: number;
  vendorEventCount: number;
  latestActivityAt: string | null;
  updatedAt: string;
};

export type SourceEventInput = {
  id: string;
  channel: SourceChannel;
  externalRef: string;
  sender?: string;
  receivedAt: string;
  rawArtifactId?: string;
  metadata?: Record<string, unknown>;
};

export type SourceItemInput = {
  id: string;
  kind: SourceItemKind;
  displayName: string;
  locator?: string;
  mediaType?: string;
  artifactId?: string;
  contentSha256?: string;
  sizeBytes?: number;
  fetchStatus: SourceFetchStatus;
  parseStatus: SourceParseStatus;
  mutable: boolean;
  capturedAt?: string;
  metadata?: Record<string, unknown>;
};

export type SourceRelationInput = {
  fromItemId: string;
  toItemId: string;
  relation: SourceRelationKind;
  position?: number;
  metadata?: Record<string, unknown>;
};

export type SourceEnvelopeInput = {
  vendor: RegistryVendorInput;
  sourceEvent: SourceEventInput;
  items: SourceItemInput[];
  relations?: SourceRelationInput[];
  batchLinks?: Array<{
    batchId: string;
    role: "primary" | "supplement" | "correction" | "metadata" | "other";
    sourceItemIds?: string[];
  }>;
  taskLinks?: Array<{
    taskVersionId: string;
    sourceItemId: string;
    role: "normalized_from" | "discovered_in" | "metadata" | "other";
  }>;
};

export type SubmissionCategoryInput = {
  id: string;
  name: string;
  description: string;
  count: number;
  examples?: string[];
};

export type SubmissionTaskInput = {
  id: string;
  stableKey: string;
  title: string;
  summary?: string;
  categoryId: string;
  sourcePath?: string;
  format: string;
  contentSha256?: string;
  sourceItemIds?: string[];
  workflowStatus?: WorkflowStatus;
  catalogVisibility?: CatalogVisibility;
  metadata?: Record<string, unknown>;
};

export type SubmissionManifest = {
  vendor: RegistryVendorInput;
  sourceEvent: SourceEventInput;
  batch: {
    id: string;
    date: string;
    label: string;
    sourceLabel: string;
    taskCount: number;
    formats: string[];
    workflowStatus: WorkflowStatus;
    catalogVisibility: CatalogVisibility;
    revisesBatchId?: string;
    delta: {
      retained?: number;
      added: number;
      removed: number;
      changedFiles?: number;
      note: string;
    };
    metadata?: Record<string, unknown>;
  };
  categories: SubmissionCategoryInput[];
  tasks?: SubmissionTaskInput[];
};

export type ArtifactInput = {
  id: string;
  kind:
    | "source_payload"
    | "source_snapshot"
    | "submission_manifest"
    | "task_package"
    | "trajectory"
    | "check_evidence"
    | "extracted_text"
    | "other";
  storageKey: string;
  sha256: string;
  sizeBytes?: number;
  contentType?: string;
  metadata?: Record<string, unknown>;
};

export type ArtifactRecord = ArtifactInput & {
  createdAt: string;
};

export type StatusUpdateInput = {
  entityType: "submission_batch" | "task_version";
  entityId: string;
  workflowStatus: WorkflowStatus;
  catalogVisibility: CatalogVisibility;
  reason: string;
  actor: string;
};

export type WorkItem = {
  id: string;
  kind: string;
  entityType: string;
  entityId: string;
  attempts: number;
  payload: Record<string, unknown>;
  leaseExpiresAt: string;
};

export type WorkCompletionInput = {
  id: string;
  workerId: string;
  outcome: "completed" | "retry" | "failed";
  error?: string;
};

export type CheckResultInput = {
  id: string;
  taskVersionId: string;
  definitionId: string;
  definitionVersion: number;
  kind: "deterministic" | "heuristic";
  name: string;
  description: string;
  required: boolean;
  outcome: CheckOutcome;
  summary: string;
  runner: Record<string, unknown>;
  evidence: Record<string, unknown>;
  startedAt: string;
  completedAt: string;
};

export type FollowUpInput = {
  id: string;
  batchId: string;
  channel: "email" | "feishu" | "internal" | "other";
  recipient: string;
  status: "drafted" | "sent" | "replied" | "closed";
  reason: string;
  evidenceCheckRunIds: string[];
  sentAt?: string;
  externalRef?: string;
};

export type SubmissionReviewSignal = "interested" | "not_interested" | "needs_revision" | "comment";
export type SubmissionReviewScope = "submission" | "categories";

export type SubmissionReviewInput = {
  id: string;
  batchId: string;
  signal: SubmissionReviewSignal;
  scope: SubmissionReviewScope;
  categoryIds: string[];
  reviewer: {
    openId: string;
    unionId?: string;
    tenantKey: string;
    name: string;
  };
  comment?: string;
  metadata?: Record<string, unknown>;
};

export type SubmissionReview = SubmissionReviewInput & {
  comment: string;
  createdAt: string;
};

export type CatalogTask = {
  id: string;
  stableKey: string;
  title: string;
  summary: string | null;
  sourcePath: string | null;
  format: string;
  workflowStatus: WorkflowStatus;
  catalogVisibility: CatalogVisibility;
  checks: {
    pass: number;
    fail: number;
    blocked: number;
    notRun: number;
  };
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
  formats: string[];
  workflowStatus: WorkflowStatus;
  catalogVisibility: CatalogVisibility;
  revisesBatchId: string | null;
  delta: SubmissionManifest["batch"]["delta"];
  sourceEvents: CatalogSourceEvent[];
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
  totals: {
    vendors: number;
    batches: number;
    taskVersions: number;
  };
};

export type OperationsSummary = {
  vendors: number;
  sourceEvents: number;
  vendorEvents: number;
  submissionsByStatus: Record<string, number>;
  checksByOutcome: Record<string, number>;
  pendingWorkItems: number;
  openFollowUps: number;
  sourceItemsByFetchStatus: Record<string, number>;
  sourceItemsByParseStatus: Record<string, number>;
  artifacts: number;
};
