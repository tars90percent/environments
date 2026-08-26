import type {
  ArtifactInput,
  ArtifactRecord,
  AssignTaskBenchmarksInput,
  AssignTaskBenchmarksResult,
  AppendTasksInput,
  AppendTasksResult,
  CaptureSubmissionInput,
  CaptureSubmissionResult,
  CatalogSourceEvent,
  HarborCheckAttemptInput,
  HarborCheckResultInput,
  HarborFindingInput,
  OperationsSummary,
  ReconcileSubmissionSourceItemsInput,
  ReconcileSubmissionSourceItemsResult,
  ReconcileSubmissionTasksInput,
  ReconcileSubmissionTasksResult,
  RegisterBenchmarkInput,
  RegisterBenchmarkResult,
  RegistryBenchmark,
  SampleCatalogSnapshot,
  SampleCatalogSubmission,
  SampleCatalogTask,
  SourceEnvelopeInput,
  SubmissionManifest,
  SubmissionIntakeClassificationInput,
  SubmissionIntakeClassificationResult,
  SubmissionRemovalInput,
  SubmissionRemovalResult,
  VendorArchiveInput,
  VendorArchiveResult,
  VendorDirectoryEntry,
  WorkCompletionInput,
  WorkItem,
} from "./types.js";

export interface RegistryRepository {
  initialize(): Promise<void>;
  close(): Promise<void>;
  captureSubmission(input: CaptureSubmissionInput): Promise<CaptureSubmissionResult>;
  reconcileSubmissionSourceItems(input: ReconcileSubmissionSourceItemsInput): Promise<ReconcileSubmissionSourceItemsResult>;
  ingestSubmission(manifest: SubmissionManifest): Promise<{ batchId: string; created: boolean }>;
  listBenchmarks(): Promise<RegistryBenchmark[]>;
  registerBenchmark(input: RegisterBenchmarkInput): Promise<RegisterBenchmarkResult>;
  assignTaskBenchmarks(input: AssignTaskBenchmarksInput): Promise<AssignTaskBenchmarksResult>;
  appendTasks(input: AppendTasksInput): Promise<AppendTasksResult>;
  reconcileSubmissionTasks(input: ReconcileSubmissionTasksInput): Promise<ReconcileSubmissionTasksResult>;
  classifySubmissionIntake(input: SubmissionIntakeClassificationInput): Promise<SubmissionIntakeClassificationResult>;
  removeSubmission(input: SubmissionRemovalInput): Promise<SubmissionRemovalResult>;
  ingestSourceEnvelope(envelope: SourceEnvelopeInput): Promise<{ sourceEventId: string; created: boolean }>;
  vendorDirectory(includeArchived?: boolean): Promise<VendorDirectoryEntry[]>;
  archiveVendor(input: VendorArchiveInput): Promise<VendorArchiveResult>;
  restoreVendor(input: VendorArchiveInput): Promise<VendorArchiveResult>;
  recordHarborAttempt(input: HarborCheckAttemptInput): Promise<void>;
  recordHarborCheck(input: HarborCheckResultInput): Promise<void>;
  recordHarborFinding(input: HarborFindingInput): Promise<{ findingId: string; created: boolean }>;
  registerArtifact(input: ArtifactInput): Promise<void>;
  leaseWorkItem(workerId: string, leaseSeconds: number): Promise<WorkItem | null>;
  completeWorkItem(input: WorkCompletionInput): Promise<void>;
  sampleCatalogSnapshot(): Promise<SampleCatalogSnapshot>;
  getSampleSubmission(id: string): Promise<SampleCatalogSubmission | null>;
  getSampleTask(id: string): Promise<SampleCatalogTask | null>;
  getSourceEvent(id: string): Promise<CatalogSourceEvent | null>;
  getArtifact(id: string): Promise<ArtifactRecord | null>;
  unregisterArtifactIfUnreferenced(id: string): Promise<ArtifactRecord | null>;
  operationsSummary(): Promise<OperationsSummary>;
}
