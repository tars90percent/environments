import type {
  ArtifactInput,
  ArtifactRecord,
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
  SubmissionReview,
  SubmissionReviewInput,
  WorkCompletionInput,
  WorkItem,
} from "./types.js";

export interface RegistryRepository {
  initialize(): Promise<void>;
  close(): Promise<void>;
  ingestSubmission(manifest: SubmissionManifest): Promise<{ batchId: string; created: boolean }>;
  ingestSourceEnvelope(envelope: SourceEnvelopeInput): Promise<{ sourceEventId: string; created: boolean }>;
  recordCheckResult(input: CheckResultInput): Promise<void>;
  recordFollowUp(input: FollowUpInput): Promise<void>;
  recordSubmissionReview(input: SubmissionReviewInput): Promise<SubmissionReview>;
  listSubmissionReviews(batchId: string): Promise<SubmissionReview[]>;
  registerArtifact(input: ArtifactInput): Promise<void>;
  updateStatus(input: StatusUpdateInput): Promise<void>;
  leaseWorkItem(workerId: string, leaseSeconds: number): Promise<WorkItem | null>;
  completeWorkItem(input: WorkCompletionInput): Promise<void>;
  catalogSnapshot(scope: CatalogScope): Promise<CatalogSnapshot>;
  getVendor(id: string, scope: CatalogScope): Promise<CatalogVendor | null>;
  getBatch(id: string, scope: CatalogScope): Promise<CatalogBatch | null>;
  getTask(id: string, scope: CatalogScope): Promise<CatalogTask | null>;
  getSourceEvent(id: string): Promise<CatalogSourceEvent | null>;
  getArtifact(id: string): Promise<ArtifactRecord | null>;
  operationsSummary(): Promise<OperationsSummary>;
}
