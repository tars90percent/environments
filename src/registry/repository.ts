import type {
  ArtifactInput,
  ArtifactRecord,
  AppendNormalizedTasksInput,
  AppendNormalizedTasksResult,
  CatalogBatch,
  CatalogScope,
  CatalogSourceEvent,
  CatalogSnapshot,
  CatalogTask,
  CatalogVendor,
  CheckResultInput,
  FollowUpInput,
  OperationsSummary,
  SourceEnvelopeInput,
  StatusUpdateInput,
  SubmissionManifest,
  SubmissionIntakeClassificationInput,
  SubmissionIntakeClassificationResult,
  SubmissionRemovalInput,
  SubmissionRemovalResult,
  SubmissionReview,
  SubmissionReviewInput,
  TaskFindingInput,
  TaskFindingUpdateInput,
  TaskSourceLinksInput,
  VendorArchiveInput,
  VendorArchiveResult,
  VendorDirectoryEntry,
  VendorEvent,
  VendorEventInput,
  WorkCompletionInput,
  WorkItem,
} from "./types.js";

export interface RegistryRepository {
  initialize(): Promise<void>;
  close(): Promise<void>;
  ingestSubmission(manifest: SubmissionManifest): Promise<{ batchId: string; created: boolean }>;
  appendNormalizedTasks(input: AppendNormalizedTasksInput): Promise<AppendNormalizedTasksResult>;
  classifySubmissionIntake(input: SubmissionIntakeClassificationInput): Promise<SubmissionIntakeClassificationResult>;
  removeSubmission(input: SubmissionRemovalInput): Promise<SubmissionRemovalResult>;
  ingestSourceEnvelope(envelope: SourceEnvelopeInput): Promise<{ sourceEventId: string; created: boolean }>;
  recordVendorEvent(input: VendorEventInput): Promise<{ eventId: string; created: boolean }>;
  listVendorEvents(vendorId: string): Promise<VendorEvent[]>;
  vendorDirectory(includeArchived?: boolean): Promise<VendorDirectoryEntry[]>;
  archiveVendor(input: VendorArchiveInput): Promise<VendorArchiveResult>;
  restoreVendor(input: VendorArchiveInput): Promise<VendorArchiveResult>;
  recordCheckResult(input: CheckResultInput): Promise<void>;
  recordTaskFinding(input: TaskFindingInput): Promise<{ findingId: string; created: boolean }>;
  updateTaskFinding(input: TaskFindingUpdateInput): Promise<{ findingId: string; updated: boolean }>;
  deleteTaskFinding(id: string): Promise<{ findingId: string; deleted: boolean }>;
  recordFollowUp(input: FollowUpInput): Promise<void>;
  recordSubmissionReview(input: SubmissionReviewInput): Promise<SubmissionReview>;
  listSubmissionReviews(batchId: string): Promise<SubmissionReview[]>;
  registerArtifact(input: ArtifactInput): Promise<void>;
  updateStatus(input: StatusUpdateInput): Promise<void>;
  linkTaskSources(input: TaskSourceLinksInput): Promise<{ linked: number }>;
  leaseWorkItem(workerId: string, leaseSeconds: number): Promise<WorkItem | null>;
  completeWorkItem(input: WorkCompletionInput): Promise<void>;
  catalogSnapshot(scope: CatalogScope): Promise<CatalogSnapshot>;
  getVendor(id: string, scope: CatalogScope): Promise<CatalogVendor | null>;
  getBatch(id: string, scope: CatalogScope): Promise<CatalogBatch | null>;
  getTask(id: string, scope: CatalogScope): Promise<CatalogTask | null>;
  getSourceEvent(id: string): Promise<CatalogSourceEvent | null>;
  getArtifact(id: string): Promise<ArtifactRecord | null>;
  unregisterArtifactIfUnreferenced(id: string): Promise<ArtifactRecord | null>;
  operationsSummary(): Promise<OperationsSummary>;
}
