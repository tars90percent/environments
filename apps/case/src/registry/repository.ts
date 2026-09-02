import type {
  ArtifactInput,
  ArtifactRecord,
  AssignTaskGpuRequirementsInput,
  AssignTaskGpuRequirementsResult,
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
  ReconcileHarborWorkItemsInput,
  ReconcileHarborWorkItemsResult,
  ReconcileSubmissionSourceItemsInput,
  ReconcileSubmissionSourceItemsResult,
  ReconcileSubmissionTasksInput,
  ReconcileSubmissionTasksResult,
  RegisterBenchmarkInput,
  RegisterBenchmarkResult,
  PurgeErroneousBenchmarksInput,
  PurgeErroneousBenchmarksResult,
  RemoveUnusedBenchmarksInput,
  RemoveUnusedBenchmarksResult,
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
  UpdateBenchmarkInput,
  UpdateBenchmarkResult,
  VendorArchiveInput,
  VendorArchiveResult,
  VendorDirectoryEntry,
  VendorInteraction,
  VendorInteractionDeleteInput,
  VendorInteractionInput,
  VendorInteractionUpdateInput,
  VendorTimeline,
  VendorTimelineChange,
  VendorTimelineCreateInput,
  VendorTimelineDeleteInput,
  VendorTimelineDeleteResult,
  WorkCompletionInput,
  WorkItem,
} from "./types.js";

export interface RegistryRepository {
  initialize(): Promise<void>;
  close(): Promise<void>;
  captureSubmission(input: CaptureSubmissionInput): Promise<CaptureSubmissionResult>;
  reconcileSubmissionSourceItems(input: ReconcileSubmissionSourceItemsInput): Promise<ReconcileSubmissionSourceItemsResult>;
  ingestSubmission(manifest: SubmissionManifest): Promise<{ submissionId: string; created: boolean }>;
  listBenchmarks(): Promise<RegistryBenchmark[]>;
  registerBenchmark(input: RegisterBenchmarkInput): Promise<RegisterBenchmarkResult>;
  updateBenchmark(input: UpdateBenchmarkInput): Promise<UpdateBenchmarkResult>;
  removeUnusedBenchmarks(input: RemoveUnusedBenchmarksInput): Promise<RemoveUnusedBenchmarksResult>;
  purgeErroneousBenchmarks(input: PurgeErroneousBenchmarksInput): Promise<PurgeErroneousBenchmarksResult>;
  assignTaskBenchmarks(input: AssignTaskBenchmarksInput): Promise<AssignTaskBenchmarksResult>;
  assignTaskGpuRequirements(input: AssignTaskGpuRequirementsInput): Promise<AssignTaskGpuRequirementsResult>;
  appendTasks(input: AppendTasksInput): Promise<AppendTasksResult>;
  reconcileSubmissionTasks(input: ReconcileSubmissionTasksInput): Promise<ReconcileSubmissionTasksResult>;
  classifySubmissionIntake(input: SubmissionIntakeClassificationInput): Promise<SubmissionIntakeClassificationResult>;
  removeSubmission(input: SubmissionRemovalInput): Promise<SubmissionRemovalResult>;
  ingestSourceEnvelope(envelope: SourceEnvelopeInput): Promise<{ sourceEventId: string; created: boolean }>;
  vendorDirectory(includeArchived?: boolean): Promise<VendorDirectoryEntry[]>;
  createVendorTimeline(input: VendorTimelineCreateInput): Promise<{ vendorId: string; created: boolean }>;
  getVendorTimeline(vendorId: string): Promise<VendorTimeline | null>;
  getVendorTimelineHistory(vendorId: string): Promise<VendorTimelineChange[]>;
  getVendorInteraction(interactionId: string): Promise<VendorInteraction | null>;
  recordVendorInteraction(input: VendorInteractionInput): Promise<{ interactionId: string; created: boolean }>;
  updateVendorInteraction(input: VendorInteractionUpdateInput): Promise<{ interactionId: string; updated: boolean }>;
  deleteVendorInteraction(input: VendorInteractionDeleteInput): Promise<{ interactionId: string; deleted: boolean }>;
  deleteVendorTimeline(input: VendorTimelineDeleteInput): Promise<VendorTimelineDeleteResult>;
  archiveVendor(input: VendorArchiveInput): Promise<VendorArchiveResult>;
  restoreVendor(input: VendorArchiveInput): Promise<VendorArchiveResult>;
  recordHarborAttempt(input: HarborCheckAttemptInput): Promise<void>;
  recordHarborCheck(input: HarborCheckResultInput): Promise<void>;
  recordHarborFinding(input: HarborFindingInput): Promise<{ findingId: string; created: boolean }>;
  registerArtifact(input: ArtifactInput): Promise<void>;
  leaseWorkItem(workerId: string, leaseSeconds: number): Promise<WorkItem | null>;
  completeWorkItem(input: WorkCompletionInput): Promise<void>;
  reconcileHarborWorkItems(input: ReconcileHarborWorkItemsInput): Promise<ReconcileHarborWorkItemsResult>;
  sampleCatalogSnapshot(): Promise<SampleCatalogSnapshot>;
  getSampleSubmission(id: string): Promise<SampleCatalogSubmission | null>;
  getSampleTask(id: string): Promise<SampleCatalogTask | null>;
  getSourceEvent(id: string): Promise<CatalogSourceEvent | null>;
  getArtifact(id: string): Promise<ArtifactRecord | null>;
  unregisterArtifactIfUnreferenced(id: string): Promise<ArtifactRecord | null>;
  operationsSummary(): Promise<OperationsSummary>;
}
