import type {
  ArtifactInput,
  CatalogBatch,
  CatalogSnapshot,
  CatalogTask,
  CatalogVendor,
  CheckResultInput,
  FollowUpInput,
  OperationsSummary,
  StatusUpdateInput,
  SubmissionManifest,
  WorkCompletionInput,
  WorkItem,
} from "./types.js";

export interface RegistryRepository {
  initialize(): Promise<void>;
  close(): Promise<void>;
  ingestSubmission(manifest: SubmissionManifest): Promise<{ batchId: string; created: boolean }>;
  recordCheckResult(input: CheckResultInput): Promise<void>;
  recordFollowUp(input: FollowUpInput): Promise<void>;
  registerArtifact(input: ArtifactInput): Promise<void>;
  updateStatus(input: StatusUpdateInput): Promise<void>;
  leaseWorkItem(workerId: string, leaseSeconds: number): Promise<WorkItem | null>;
  completeWorkItem(input: WorkCompletionInput): Promise<void>;
  catalogSnapshot(scope: "research" | "all"): Promise<CatalogSnapshot>;
  getVendor(id: string, scope: "research" | "all"): Promise<CatalogVendor | null>;
  getBatch(id: string, scope: "research" | "all"): Promise<CatalogBatch | null>;
  getTask(id: string, scope: "research" | "all"): Promise<CatalogTask | null>;
  operationsSummary(): Promise<OperationsSummary>;
}
