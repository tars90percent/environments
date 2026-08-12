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
  workflowStatus?: WorkflowStatus;
  catalogVisibility?: CatalogVisibility;
  metadata?: Record<string, unknown>;
};

export type SubmissionManifest = {
  vendor: {
    id: string;
    name: string;
    short: string;
    description: string;
    aliases?: string[];
  };
  sourceEvent: {
    id: string;
    channel: "email" | "feishu" | "website" | "workspace" | "other";
    externalRef: string;
    sender?: string;
    receivedAt: string;
    rawArtifactId?: string;
    metadata?: Record<string, unknown>;
  };
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
  kind: "submission" | "task_package" | "trajectory" | "check_evidence" | "other";
  storageKey: string;
  sha256: string;
  sizeBytes?: number;
  contentType?: string;
  metadata?: Record<string, unknown>;
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
  submissionsByStatus: Record<string, number>;
  checksByOutcome: Record<string, number>;
  pendingWorkItems: number;
  openFollowUps: number;
};
