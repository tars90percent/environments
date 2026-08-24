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
export type CheckOutcome = "pass" | "fail" | "blocked" | "not_run";
export type CatalogScope = "research" | "portal" | "all";

export type SampleTaskKind = "task" | "trace";
export type SampleTaskFormat = "harbor" | "non_harbor";
export type HarborCheckPhase = "environment" | "oracle" | "nop";
export type HarborCheckOutcome = "pass" | "fail";
export type HarborCheckAttemptStatus = "blocked" | "inconclusive";

export type TaskRepresentationKind = "harbor" | "native" | "unknown";
export type TaskRepresentationPath = "already_harbor" | "normalized_to_harbor" | "native_format_exception";
export type TaskNormalizationOutcome = "already_harbor" | "normalized" | "needs_review" | "incomplete" | "blocked" | "not_a_task";
export type TaskRepresentationBasis = "recorded" | "legacy_format_backfill" | "unknown";

export type CheckEvidenceRole =
  | "contract"
  | "environment"
  | "build"
  | "boot"
  | "positive_control"
  | "negative_control"
  | "hermeticity"
  | "evidence_completeness"
  | "other";
export type CheckExecutionScope = "static" | "remote_sandbox" | "unknown";
export type RuntimeVerificationStatus = "not_checked" | "unclassified" | "partial" | "blocked" | "failed" | "verified";

export type RuntimePhaseEvidence = {
  outcome: CheckOutcome | null;
  checkRunId: string | null;
  completedAt: string | null;
};

export type RuntimeVerificationSummary = {
  status: RuntimeVerificationStatus;
  hasBeenChecked: boolean;
  runtimeSuiteCompleted: boolean;
  runtimeVerified: boolean;
  unclassifiedCheckRuns: number;
  phases: {
    environment: RuntimePhaseEvidence;
    positiveControl: RuntimePhaseEvidence;
    negativeControl: RuntimePhaseEvidence;
  };
};

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

export type VendorArchiveInput = {
  vendorId: string;
  reason: string;
  actor: string;
};

export type VendorArchiveContext = {
  archivedAt: string;
  archivedBy: string;
  archiveReason: string;
};

export type VendorArchiveResult = {
  vendorId: string;
  archived: boolean;
  changed: boolean;
  archive: VendorArchiveContext | null;
  previousArchive?: VendorArchiveContext;
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
  archivedAt: string | null;
  archivedBy: string | null;
  archiveReason: string | null;
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

export type CapturedSubmissionSourceInput =
  | {
      sourceEvent: SourceEventInput;
      items: SourceItemInput[];
      relations?: SourceRelationInput[];
    }
  | {
      sourceEventId: string;
      sourceItemIds?: string[];
    };

/**
 * Canonical capture contract used by trusted CASE processes. Object bytes must
 * already be present in CASE storage; this operation records all relational
 * provenance and the dated submission in one database transaction.
 */
export type CaptureSubmissionInput = {
  vendor: RegistryVendorInput;
  submission: {
    id: string;
    date: string;
    label: string;
    sourceLabel: string;
    formats?: SampleTaskFormat[];
    revisesSubmissionId?: string;
    metadata?: Record<string, unknown>;
  };
  artifacts: ArtifactInput[];
  sources: CapturedSubmissionSourceInput[];
  actor: string;
};

export type CaptureSubmissionResult = {
  submissionId: string;
  created: boolean;
  sourceEventIds: string[];
};

export type TaskSourceLinksInput = {
  links: Array<{
    taskVersionId: string;
    sourceItemId: string;
    role: "normalized_from" | "discovered_in" | "metadata" | "other";
  }>;
  reason: string;
  actor: string;
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
  representationKind?: TaskRepresentationKind;
  representationPath?: TaskRepresentationPath;
  normalizationOutcome?: TaskNormalizationOutcome;
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

export type NormalizedTaskRegistrationInput = Omit<
  SubmissionTaskInput,
  "sourcePath" | "contentSha256" | "sourceItemIds" | "representationKind" | "representationPath" | "normalizationOutcome"
> & {
  sourcePath: string;
  artifactId: string;
  contentSha256: string;
  sourceItemIds: string[];
  representationKind: TaskRepresentationKind;
  representationPath: TaskRepresentationPath;
  normalizationOutcome: TaskNormalizationOutcome;
};

export type AppendNormalizedTasksInput = {
  batchId: string;
  categories: SubmissionCategoryInput[];
  tasks: NormalizedTaskRegistrationInput[];
  reason: string;
  actor: string;
};

export type AppendNormalizedTasksResult = {
  batchId: string;
  categoriesAdded: number;
  taskVersionsAdded: number;
  taskVersionsFinalized: number;
  taskVersionIds: string[];
};

/** Active task-registration contract. Categories and normalization states are deliberately absent. */
export type TaskRegistrationInput = {
  id: string;
  stableKey: string;
  title: string;
  summary?: string;
  kind: SampleTaskKind;
  format: SampleTaskFormat;
  sourcePath: string;
  artifactId: string;
  contentSha256: string;
  sourceItemIds: string[];
};

export type AppendTasksInput = {
  submissionId: string;
  tasks: TaskRegistrationInput[];
  actor: string;
};

export type AppendTasksResult = {
  submissionId: string;
  tasksAdded: number;
  taskIds: string[];
};

export type HarborCheckResultInput = {
  id: string;
  taskId: string;
  phase: HarborCheckPhase;
  outcome: HarborCheckOutcome;
  summary: string;
  evidenceArtifactId: string;
  harborVersion: string;
  modalVersion: string;
  command: string;
  sandboxRef?: string;
  score?: number;
  startedAt: string;
  completedAt: string;
};

export type HarborCheckAttemptInput = {
  id: string;
  taskId: string;
  phase: HarborCheckPhase;
  status: HarborCheckAttemptStatus;
  summary: string;
  evidenceArtifactId: string;
  harborVersion: string;
  modalVersion: string;
  command: string;
  sandboxRef?: string;
  startedAt: string;
  completedAt: string;
};

export type HarborFindingInput = {
  id: string;
  taskId: string;
  checkRunId: string;
  finding: string;
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

export type SubmissionRemovalInput = {
  batchId: string;
  disposition: "erroneous_registration" | "purchased_delivery_handoff";
  reason: string;
  actor: string;
};

export type SubmissionRemovalResult = {
  batchId: string;
  vendorId: string;
  disposition: SubmissionRemovalInput["disposition"];
  detachedRevisionBatchIds: string[];
  removedTaskVersionIds: string[];
  removedTaskIds: string[];
  retainedTaskIds: string[];
  removedSourceEventIds: string[];
  retainedSourceEventIds: string[];
  unreferencedArtifacts: ArtifactRecord[];
};

export type SubmissionIntakeClassificationInput = {
  batchId: string;
  purpose: "sample_evaluation";
  sourceEventIds: string[];
  reason: string;
  actor: string;
};

export type SubmissionIntakeClassificationResult = {
  batchId: string;
  purpose: "sample_evaluation";
  changed: boolean;
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
  evidenceRole: CheckEvidenceRole;
  executionScope: CheckExecutionScope;
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

export type TaskFindingInput = {
  id: string;
  taskVersionId: string;
  finding: string;
};

export type TaskFindingUpdateInput = {
  id: string;
  finding: string;
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

export type ResearcherUploadInput = {
  id: string;
  vendorId: string;
  label: string;
  note?: string;
  uploadedAt: string;
  artifact: {
    sha256: string;
    sizeBytes: number;
    contentType: string;
    originalName: string;
  };
  researcher: {
    openId: string;
    unionId?: string;
    tenantKey: string;
    name: string;
  };
};

export type CatalogTaskFinding = {
  id: string;
  finding: string;
};

export type CatalogTask = {
  id: string;
  stableKey: string;
  title: string;
  summary: string | null;
  sourcePath: string | null;
  format: string;
  representation: {
    kind: TaskRepresentationKind;
    isHarbor: boolean | null;
    path: TaskRepresentationPath | null;
    normalizationOutcome: TaskNormalizationOutcome | null;
    basis: TaskRepresentationBasis;
  };
  runtimeVerification: RuntimeVerificationSummary;
  artifactId: string | null;
  contentSha256: string | null;
  workflowStatus: WorkflowStatus;
  catalogVisibility: CatalogVisibility;
  checks: {
    pass: number;
    fail: number;
    blocked: number;
    notRun: number;
  };
  sourceItemIds: string[];
  findings: CatalogTaskFinding[];
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
  /** Number of normalized task versions currently available in the catalog. */
  taskCount: number;
  /** Quantity stated at intake before normalization, when it differs from taskCount. */
  declaredTaskCount: number;
  formats: string[];
  workflowStatus: WorkflowStatus;
  catalogVisibility: CatalogVisibility;
  revisesBatchId: string | null;
  delta: SubmissionManifest["batch"]["delta"];
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
  procurementSummary: CatalogProcurementSummary | null;
  batches: CatalogBatch[];
};

export type LocalizedCatalogText = {
  en: string;
  zh: string;
};

export type CatalogResearchDemand = {
  id: string;
  domain: LocalizedCatalogText;
  subdomain: LocalizedCatalogText;
  title: LocalizedCatalogText;
  note: LocalizedCatalogText;
  sourceLabel: LocalizedCatalogText;
  sourceDate: string;
  sourceUrl: string;
};

export type CatalogSnapshot = {
  generatedAt: string;
  demands: CatalogResearchDemand[];
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
  submissions: number;
  tasks: {
    tasks: number;
    traces: number;
    harbor: number;
    nonHarbor: number;
  };
  harborChecks: Record<string, { pass: number; fail: number }>;
  pendingWorkItems: number;
  artifacts: number;
};

export type SampleCatalogCheck = {
  id: string;
  phase: HarborCheckPhase;
  outcome: HarborCheckOutcome;
  summary: string;
  score: number | null;
  completedAt: string;
};

export type SampleCatalogAttempt = {
  id: string;
  phase: HarborCheckPhase;
  status: HarborCheckAttemptStatus;
  summary: string;
  completedAt: string;
};

export type SampleCatalogFinding = {
  id: string;
  phase: HarborCheckPhase;
  checkRunId: string;
  finding: string;
};

export type SampleCatalogTask = {
  id: string;
  stableKey: string;
  title: string;
  summary: string | null;
  kind: SampleTaskKind;
  format: SampleTaskFormat;
  sourcePath: string | null;
  artifactId: string | null;
  contentSha256: string | null;
  sourceItemIds: string[];
  checks: Partial<Record<HarborCheckPhase, SampleCatalogCheck>>;
  attempts: Partial<Record<HarborCheckPhase, SampleCatalogAttempt>>;
  findings: SampleCatalogFinding[];
};

export type SampleCatalogSourceItem = {
  id: string;
  kind: string;
  displayName: string;
  locator: string | null;
  mediaType: string | null;
  artifactId: string | null;
  artifactKind: ArtifactInput["kind"] | null;
  contentSha256: string | null;
  sizeBytes: number | null;
};

export type SampleCatalogRawArtifact = {
  id: string;
  kind: ArtifactInput["kind"];
  contentSha256: string;
  sizeBytes: number | null;
  contentType: string | null;
  originalName: string | null;
};

export type SampleCatalogSourceEvent = {
  id: string;
  channel: string;
  externalRef: string;
  sender: string | null;
  receivedAt: string;
  rawArtifactId: string | null;
  rawArtifact: SampleCatalogRawArtifact | null;
  items: SampleCatalogSourceItem[];
};

export type SampleCatalogSubmission = {
  id: string;
  date: string;
  label: string;
  source: string;
  formats: SampleTaskFormat[];
  sourceEvents: SampleCatalogSourceEvent[];
  tasks: SampleCatalogTask[];
};

export type SampleCatalogVendor = {
  id: string;
  name: string;
  short: string;
  submissions: SampleCatalogSubmission[];
};

export type SampleCatalogSnapshot = {
  generatedAt: string;
  vendors: SampleCatalogVendor[];
  totals: {
    vendors: number;
    submissions: number;
    tasks: number;
    harborTasks: number;
  };
};
