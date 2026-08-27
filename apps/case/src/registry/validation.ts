import type {
  ArtifactInput,
  AssignTaskGpuRequirementsInput,
  AssignTaskBenchmarksInput,
  AppendTasksInput,
  AppendNormalizedTasksInput,
  CheckEvidenceRole,
  CheckExecutionScope,
  CheckResultInput,
  FollowUpInput,
  HarborCheckAttemptInput,
  HarborCheckResultInput,
  HarborFindingInput,
  RegisterBenchmarkInput,
  ReconcileSubmissionSourceItemsInput,
  ReconcileSubmissionTasksInput,
  ResearcherUploadInput,
  SourceEnvelopeInput,
  StatusUpdateInput,
  SubmissionManifest,
  SubmissionIntakeClassificationInput,
  SubmissionRemovalInput,
  SubmissionReviewInput,
  TaskNormalizationOutcome,
  TaskRepresentationKind,
  TaskRepresentationPath,
  TaskFindingInput,
  TaskFindingUpdateInput,
  TaskSourceLinksInput,
  VendorArchiveInput,
  VendorEventInput,
  WorkCompletionInput,
} from "./types.js";

const WORKFLOW_STATUSES = new Set([
  "unchecked",
  "received",
  "normalizing",
  "checking",
  "needs_vendor_fix",
  "ready_for_research",
  "superseded",
  "quarantined",
]);
const VISIBILITIES = new Set(["featured", "available", "log_only", "internal"]);
const OUTCOMES = new Set(["pass", "fail", "blocked", "not_run"]);
const SOURCE_CHANNELS = new Set(["email", "feishu", "slack", "website", "vendor_portal", "workspace", "upload", "other"]);
const SOURCE_ITEM_KINDS = new Set([
  "message", "attachment", "url", "folder", "document", "spreadsheet", "worksheet", "row", "pdf", "archive",
  "file", "task_package", "container_image", "web_page", "other",
]);
const SOURCE_FETCH_STATUSES = new Set(["not_requested", "queued", "fetching", "snapshotted", "external_only", "blocked", "failed"]);
const SOURCE_PARSE_STATUSES = new Set(["not_requested", "queued", "parsing", "parsed", "partial", "blocked", "failed"]);
const SOURCE_RELATIONS = new Set(["contains", "links_to", "derived_from", "describes", "mirrors", "supersedes"]);
const VENDOR_EVENT_KINDS = new Set(["contact", "sample", "evaluation", "commercial", "delivery", "acceptance", "payment", "relationship", "note"]);
const REPRESENTATION_KINDS = new Set<TaskRepresentationKind>(["harbor", "native", "unknown"]);
const REPRESENTATION_PATHS = new Set<TaskRepresentationPath>(["already_harbor", "normalized_to_harbor", "native_format_exception"]);
const NORMALIZATION_OUTCOMES = new Set<TaskNormalizationOutcome>(["already_harbor", "normalized", "needs_review", "incomplete", "blocked", "not_a_task"]);
const CHECK_EVIDENCE_ROLES = new Set<CheckEvidenceRole>(["contract", "environment", "build", "boot", "positive_control", "negative_control", "hermeticity", "evidence_completeness", "other"]);
const CHECK_EXECUTION_SCOPES = new Set<CheckExecutionScope>(["static", "remote_sandbox", "unknown"]);
const TASK_KINDS = new Set(["task", "trace"] as const);
const TASK_FORMATS = new Set(["harbor", "non_harbor"] as const);
const HARBOR_PHASES = new Set(["environment", "oracle", "nop"] as const);
const SUBMISSION_SOURCE_ITEM_ROLES = new Set(["original_vendor_file", "provenance"] as const);
const HARBOR_OUTCOMES = new Set(["pass", "fail"] as const);
const HARBOR_ATTEMPT_STATUSES = new Set(["blocked", "inconclusive"] as const);

export function parseSubmissionManifest(value: unknown): SubmissionManifest {
  const root = object(value, "submission manifest");
  const vendor = object(root.vendor, "vendor");
  const sourceEvent = object(root.sourceEvent, "sourceEvent");
  const batch = object(root.batch, "batch");
  const delta = object(batch.delta, "batch.delta");
  const batchMetadata = optionalObject(batch.metadata, "batch.metadata");
  if (batchMetadata?.intakePurpose !== "sample_evaluation") {
    throw new ValidationError("batch.metadata.intakePurpose must be sample_evaluation; purchased deliveries belong in the downstream pipeline");
  }
  const categories = array(root.categories, "categories").map((item, index) => {
    const category = object(item, `categories[${index}]`);
    return {
      id: string(category.id, `categories[${index}].id`),
      name: string(category.name, `categories[${index}].name`),
      description: string(category.description, `categories[${index}].description`),
      count: nonNegativeInteger(category.count, `categories[${index}].count`),
      examples: optionalStringArray(category.examples, `categories[${index}].examples`),
    };
  });
  const categoryIds = new Set(categories.map((category) => category.id));
  const tasks = root.tasks === undefined ? undefined : array(root.tasks, "tasks").map((item, index) => {
    const task = object(item, `tasks[${index}]`);
    const categoryId = string(task.categoryId, `tasks[${index}].categoryId`);
    if (!categoryIds.has(categoryId)) {
      throw new ValidationError(`tasks[${index}].categoryId does not name a submitted category`);
    }
    const representationKind = optionalEnum(task.representationKind, REPRESENTATION_KINDS, `tasks[${index}].representationKind`);
    const representationPath = optionalEnum(task.representationPath, REPRESENTATION_PATHS, `tasks[${index}].representationPath`);
    const normalizationOutcome = optionalEnum(task.normalizationOutcome, NORMALIZATION_OUTCOMES, `tasks[${index}].normalizationOutcome`);
    const representationFields = [representationKind, representationPath, normalizationOutcome].filter((value) => value !== undefined).length;
    if (representationFields !== 0 && representationFields !== 3) {
      throw new ValidationError(`tasks[${index}] must provide representationKind, representationPath, and normalizationOutcome together`);
    }
    if (representationKind && representationPath && normalizationOutcome) {
      validateRepresentation(representationKind, representationPath, normalizationOutcome, `tasks[${index}]`);
    }
    return {
      id: string(task.id, `tasks[${index}].id`),
      stableKey: string(task.stableKey, `tasks[${index}].stableKey`),
      title: string(task.title, `tasks[${index}].title`),
      summary: optionalString(task.summary, `tasks[${index}].summary`),
      categoryId,
      sourcePath: optionalString(task.sourcePath, `tasks[${index}].sourcePath`),
      format: string(task.format, `tasks[${index}].format`),
      representationKind,
      representationPath,
      normalizationOutcome,
      contentSha256: optionalString(task.contentSha256, `tasks[${index}].contentSha256`),
      sourceItemIds: optionalStringArray(task.sourceItemIds, `tasks[${index}].sourceItemIds`),
      workflowStatus: optionalEnum(task.workflowStatus, WORKFLOW_STATUSES, `tasks[${index}].workflowStatus`),
      catalogVisibility: optionalEnum(task.catalogVisibility, VISIBILITIES, `tasks[${index}].catalogVisibility`),
      metadata: optionalObject(task.metadata, `tasks[${index}].metadata`),
    };
  });
  if (categories.length || (tasks?.length ?? 0) > 0) {
    throw new ValidationError("submission capture cannot include tasks; use /v1/intake/tasks after preserving the submission");
  }
  const formats = stringArray(batch.formats, "batch.formats");
  if (formats.some((format) => !TASK_FORMATS.has(format as "harbor" | "non_harbor"))) {
    throw new ValidationError("batch.formats may contain only harbor and non_harbor");
  }

  return {
    vendor: {
      id: identifier(vendor.id, "vendor.id"),
      name: string(vendor.name, "vendor.name"),
      short: string(vendor.short, "vendor.short"),
      description: string(vendor.description, "vendor.description"),
      aliases: optionalStringArray(vendor.aliases, "vendor.aliases"),
    },
    sourceEvent: {
      id: identifier(sourceEvent.id, "sourceEvent.id"),
      channel: enumValue(sourceEvent.channel, SOURCE_CHANNELS, "sourceEvent.channel"),
      externalRef: string(sourceEvent.externalRef, "sourceEvent.externalRef"),
      sender: optionalString(sourceEvent.sender, "sourceEvent.sender"),
      receivedAt: timestamp(sourceEvent.receivedAt, "sourceEvent.receivedAt"),
      rawArtifactId: optionalString(sourceEvent.rawArtifactId, "sourceEvent.rawArtifactId"),
      metadata: optionalObject(sourceEvent.metadata, "sourceEvent.metadata"),
    },
    batch: {
      id: identifier(batch.id, "batch.id"),
      date: date(batch.date, "batch.date"),
      label: string(batch.label, "batch.label"),
      sourceLabel: string(batch.sourceLabel, "batch.sourceLabel"),
      taskCount: nonNegativeInteger(batch.taskCount, "batch.taskCount"),
      formats,
      workflowStatus: enumValue(batch.workflowStatus, WORKFLOW_STATUSES, "batch.workflowStatus"),
      catalogVisibility: enumValue(batch.catalogVisibility, VISIBILITIES, "batch.catalogVisibility"),
      revisesBatchId: optionalString(batch.revisesBatchId, "batch.revisesBatchId"),
      delta: {
        retained: optionalNonNegativeInteger(delta.retained, "batch.delta.retained"),
        added: nonNegativeInteger(delta.added, "batch.delta.added"),
        removed: nonNegativeInteger(delta.removed, "batch.delta.removed"),
        changedFiles: optionalNonNegativeInteger(delta.changedFiles, "batch.delta.changedFiles"),
        note: string(delta.note, "batch.delta.note"),
      },
      metadata: batchMetadata,
    },
    categories,
    tasks,
  } as SubmissionManifest;
}

export function parseAppendNormalizedTasks(value: unknown): AppendNormalizedTasksInput {
  const input = object(value, "normalized task registration");
  const categories = array(input.categories, "categories").map((value, index) => {
    const category = object(value, `categories[${index}]`);
    return {
      id: identifier(category.id, `categories[${index}].id`),
      name: boundedString(category.name, `categories[${index}].name`, 300),
      description: boundedString(category.description, `categories[${index}].description`, 5_000),
      count: nonNegativeInteger(category.count, `categories[${index}].count`),
      examples: optionalStringArray(category.examples, `categories[${index}].examples`),
    };
  });
  if (!categories.length) throw new ValidationError("categories must contain at least one category");
  const categoryIds = new Set(categories.map((category) => category.id));
  if (categoryIds.size !== categories.length) throw new ValidationError("categories must use unique ids");

  const tasks = array(input.tasks, "tasks").map((value, index) => {
    const task = object(value, `tasks[${index}]`);
    const representationKind = enumValue(task.representationKind, REPRESENTATION_KINDS, `tasks[${index}].representationKind`);
    const representationPath = enumValue(task.representationPath, REPRESENTATION_PATHS, `tasks[${index}].representationPath`);
    const normalizationOutcome = enumValue(task.normalizationOutcome, NORMALIZATION_OUTCOMES, `tasks[${index}].normalizationOutcome`);
    validateRepresentation(representationKind, representationPath, normalizationOutcome, `tasks[${index}]`);
    const categoryId = identifier(task.categoryId, `tasks[${index}].categoryId`);
    if (!categoryIds.has(categoryId)) {
      throw new ValidationError(`tasks[${index}].categoryId does not name a supplied category`);
    }
    const artifactId = identifier(task.artifactId, `tasks[${index}].artifactId`);
    const contentSha256 = sha256(task.contentSha256, `tasks[${index}].contentSha256`);
    if (artifactId !== `artifact:sha256:${contentSha256}`) {
      throw new ValidationError(`tasks[${index}].artifactId must identify contentSha256`);
    }
    const sourceItemIds = uniqueIdentifiers(task.sourceItemIds, `tasks[${index}].sourceItemIds`);
    if (!sourceItemIds.length) {
      throw new ValidationError(`tasks[${index}].sourceItemIds must contain at least one source item`);
    }
    return {
      id: identifier(task.id, `tasks[${index}].id`),
      stableKey: boundedString(task.stableKey, `tasks[${index}].stableKey`, 1_000),
      title: boundedString(task.title, `tasks[${index}].title`, 500),
      summary: optionalString(task.summary, `tasks[${index}].summary`),
      categoryId,
      sourcePath: boundedString(task.sourcePath, `tasks[${index}].sourcePath`, 2_000),
      format: boundedString(task.format, `tasks[${index}].format`, 200),
      representationKind,
      representationPath,
      normalizationOutcome,
      artifactId,
      contentSha256,
      sourceItemIds,
      workflowStatus: optionalEnum(task.workflowStatus, WORKFLOW_STATUSES, `tasks[${index}].workflowStatus`),
      catalogVisibility: optionalEnum(task.catalogVisibility, VISIBILITIES, `tasks[${index}].catalogVisibility`),
      metadata: optionalObject(task.metadata, `tasks[${index}].metadata`),
    };
  });
  if (!tasks.length) throw new ValidationError("tasks must contain at least one normalized task version");
  if (new Set(tasks.map((task) => task.id)).size !== tasks.length) {
    throw new ValidationError("tasks must use unique version ids");
  }
  if (new Set(tasks.map((task) => task.stableKey)).size !== tasks.length) {
    throw new ValidationError("tasks must use unique stable keys within one registration");
  }
  for (const category of categories) {
    const taskCount = tasks.filter((task) => task.categoryId === category.id).length;
    if (category.count !== taskCount) {
      throw new ValidationError(`category ${category.id} count must equal its normalized task count`);
    }
  }

  return {
    batchId: identifier(input.batchId, "batchId"),
    categories,
    tasks,
    reason: boundedString(input.reason, "reason", 5_000),
    actor: boundedString(input.actor, "actor", 500),
  } as AppendNormalizedTasksInput;
}

export function parseAppendTasks(value: unknown): AppendTasksInput {
  const input = object(value, "task registration");
  onlyKeys(input, new Set(["submissionId", "benchmarkAssignments", "tasks", "actor"]), "task registration");
  const benchmarkAssignments = input.benchmarkAssignments === undefined
    ? []
    : array(input.benchmarkAssignments, "benchmarkAssignments").map((value, index) => {
      const assignment = object(value, `benchmarkAssignments[${index}]`);
      onlyKeys(assignment, new Set(["sourceItemId", "benchmarkId"]), `benchmarkAssignments[${index}]`);
      return {
        sourceItemId: identifier(assignment.sourceItemId, `benchmarkAssignments[${index}].sourceItemId`),
        benchmarkId: identifier(assignment.benchmarkId, `benchmarkAssignments[${index}].benchmarkId`),
      };
    });
  if (new Set(benchmarkAssignments.map((assignment) => assignment.sourceItemId)).size !== benchmarkAssignments.length) {
    throw new ValidationError("benchmarkAssignments must assign each source item at most once");
  }
  const tasks = array(input.tasks, "tasks").map((value, index) => {
    const task = object(value, `tasks[${index}]`);
    onlyKeys(task, new Set([
      "id", "stableKey", "title", "summary", "kind", "format", "benchmarkId", "sourcePath",
      "artifactId", "contentSha256", "sourceItemIds",
    ]), `tasks[${index}]`);
    const artifactId = identifier(task.artifactId, `tasks[${index}].artifactId`);
    const contentSha256 = sha256(task.contentSha256, `tasks[${index}].contentSha256`);
    if (artifactId !== `artifact:sha256:${contentSha256}`) {
      throw new ValidationError(`tasks[${index}].artifactId must identify contentSha256`);
    }
    const sourceItemIds = uniqueIdentifiers(task.sourceItemIds, `tasks[${index}].sourceItemIds`);
    if (!sourceItemIds.length) throw new ValidationError(`tasks[${index}].sourceItemIds must not be empty`);
    const assignedBenchmarkIds = [...new Set(benchmarkAssignments
      .filter((assignment) => sourceItemIds.includes(assignment.sourceItemId))
      .map((assignment) => assignment.benchmarkId))];
    const explicitBenchmarkId = task.benchmarkId === undefined
      ? undefined
      : identifier(task.benchmarkId, `tasks[${index}].benchmarkId`);
    if (!explicitBenchmarkId && assignedBenchmarkIds.length === 0) {
      throw new ValidationError(`tasks[${index}] must have a benchmarkId or inherit one from benchmarkAssignments`);
    }
    if (!explicitBenchmarkId && assignedBenchmarkIds.length > 1) {
      throw new ValidationError(`tasks[${index}] inherits conflicting benchmark assignments`);
    }
    return {
      id: identifier(task.id, `tasks[${index}].id`),
      stableKey: boundedString(task.stableKey, `tasks[${index}].stableKey`, 1_000),
      title: boundedString(task.title, `tasks[${index}].title`, 500),
      summary: optionalString(task.summary, `tasks[${index}].summary`),
      kind: enumValue(task.kind, TASK_KINDS, `tasks[${index}].kind`),
      format: enumValue(task.format, TASK_FORMATS, `tasks[${index}].format`),
      benchmarkId: explicitBenchmarkId ?? assignedBenchmarkIds[0]!,
      sourcePath: boundedString(task.sourcePath, `tasks[${index}].sourcePath`, 2_000),
      artifactId,
      contentSha256,
      sourceItemIds,
    };
  });
  if (!tasks.length) throw new ValidationError("tasks must contain at least one clearly parsed task or trace");
  if (new Set(tasks.map((task) => task.id)).size !== tasks.length) throw new ValidationError("tasks must use unique ids");
  if (new Set(tasks.map((task) => task.stableKey)).size !== tasks.length) {
    throw new ValidationError("tasks must use unique stable keys within one registration");
  }
  const usedSourceItemIds = new Set(tasks.flatMap((task) => task.sourceItemIds));
  for (const assignment of benchmarkAssignments) {
    if (!usedSourceItemIds.has(assignment.sourceItemId)) {
      throw new ValidationError(`benchmark assignment source item ${assignment.sourceItemId} is not linked to a supplied task`);
    }
  }
  return {
    submissionId: identifier(input.submissionId, "submissionId"),
    benchmarkAssignments,
    tasks,
    actor: boundedString(input.actor, "actor", 500),
  };
}

export function parseReconcileSubmissionTasks(value: unknown): ReconcileSubmissionTasksInput {
  const input = object(value, "submission task reconciliation");
  onlyKeys(
    input,
    new Set(["submissionId", "benchmarkAssignments", "tasks", "reason", "actor"]),
    "submission task reconciliation",
  );
  const parsed = parseAppendTasks({
    submissionId: input.submissionId,
    benchmarkAssignments: input.benchmarkAssignments,
    tasks: input.tasks,
    actor: input.actor,
  });
  return {
    ...parsed,
    reason: boundedString(input.reason, "reason", 2_000),
  };
}

export function parseRegisterBenchmark(value: unknown): RegisterBenchmarkInput {
  const input = object(value, "benchmark registration");
  onlyKeys(input, new Set(["id", "displayName", "aliases", "actor"]), "benchmark registration");
  const aliases = (optionalStringArray(input.aliases, "aliases") ?? [])
    .map((alias) => boundedString(alias, "aliases[]", 300))
    .sort((a, b) => a.localeCompare(b));
  if (new Set(aliases.map((alias) => alias.normalize("NFKC").trim().toLowerCase().replace(/[\s_-]+/g, "-"))).size !== aliases.length) {
    throw new ValidationError("benchmark aliases must be unique ignoring case");
  }
  return {
    id: identifier(input.id, "id"),
    displayName: boundedString(input.displayName, "displayName", 300),
    aliases,
    actor: boundedString(input.actor, "actor", 500),
  };
}

export function parseAssignTaskBenchmarks(value: unknown): AssignTaskBenchmarksInput {
  const input = object(value, "benchmark assignment");
  onlyKeys(input, new Set(["submissionId", "assignments", "reason", "actor"]), "benchmark assignment");
  const assignments = array(input.assignments, "assignments").map((value, index) => {
    const assignment = object(value, `assignments[${index}]`);
    onlyKeys(assignment, new Set(["taskId", "benchmarkId"]), `assignments[${index}]`);
    return {
      taskId: identifier(assignment.taskId, `assignments[${index}].taskId`),
      benchmarkId: identifier(assignment.benchmarkId, `assignments[${index}].benchmarkId`),
    };
  });
  if (!assignments.length) throw new ValidationError("assignments must contain at least one task benchmark assignment");
  if (new Set(assignments.map((assignment) => assignment.taskId)).size !== assignments.length) {
    throw new ValidationError("assignments must name each task at most once");
  }
  return {
    submissionId: identifier(input.submissionId, "submissionId"),
    assignments,
    reason: boundedString(input.reason, "reason", 2_000),
    actor: boundedString(input.actor, "actor", 500),
  };
}

export function parseAssignTaskGpuRequirements(value: unknown): AssignTaskGpuRequirementsInput {
  const input = object(value, "GPU requirement assignment");
  onlyKeys(input, new Set(["submissionId", "assignments", "reason", "actor"]), "GPU requirement assignment");
  const assignments = array(input.assignments, "assignments").map((value, index) => {
    const assignment = object(value, `assignments[${index}]`);
    onlyKeys(assignment, new Set(["taskId", "gpuRequired", "evidence"]), `assignments[${index}]`);
    return {
      taskId: identifier(assignment.taskId, `assignments[${index}].taskId`),
      gpuRequired: boolean(assignment.gpuRequired, `assignments[${index}].gpuRequired`),
      evidence: boundedString(assignment.evidence, `assignments[${index}].evidence`, 2_000),
    };
  });
  if (!assignments.length) throw new ValidationError("assignments must contain at least one task GPU requirement assignment");
  if (new Set(assignments.map((assignment) => assignment.taskId)).size !== assignments.length) {
    throw new ValidationError("assignments must name each task at most once");
  }
  return {
    submissionId: identifier(input.submissionId, "submissionId"),
    assignments,
    reason: boundedString(input.reason, "reason", 2_000),
    actor: boundedString(input.actor, "actor", 500),
  };
}

export function parseHarborCheckResult(value: unknown): HarborCheckResultInput {
  const input = object(value, "Harbor check result");
  onlyKeys(input, new Set([
    "id", "taskId", "phase", "outcome", "summary", "evidenceArtifactId",
    "harborVersion", "modalVersion", "command", "sandboxRef", "score", "startedAt", "completedAt",
  ]), "Harbor check result");
  const phase = enumValue(input.phase, HARBOR_PHASES, "phase");
  const outcome = enumValue(input.outcome, HARBOR_OUTCOMES, "outcome");
  const score = input.score === undefined ? undefined : finiteNumber(input.score, "score");
  if ((phase === "oracle" || phase === "nop") && score === undefined) {
    throw new ValidationError(`${phase} checks must record the observed score`);
  }
  if (phase === "environment" && score !== undefined) {
    throw new ValidationError(`${phase} checks cannot record a score`);
  }
  const expectedScore = phase === "oracle" ? 1 : phase === "nop" ? 0 : undefined;
  if (expectedScore !== undefined && (score === expectedScore) !== (outcome === "pass")) {
    throw new ValidationError(`${phase} outcome must match the observed score`);
  }
  const startedAt = timestamp(input.startedAt, "startedAt");
  const completedAt = timestamp(input.completedAt, "completedAt");
  if (Date.parse(completedAt) < Date.parse(startedAt)) throw new ValidationError("completedAt must not precede startedAt");
  return {
    id: identifier(input.id, "id"),
    taskId: identifier(input.taskId, "taskId"),
    phase,
    outcome,
    summary: boundedString(input.summary, "summary", 10_000),
    evidenceArtifactId: identifier(input.evidenceArtifactId, "evidenceArtifactId"),
    harborVersion: boundedString(input.harborVersion, "harborVersion", 300),
    modalVersion: boundedString(input.modalVersion, "modalVersion", 300),
    command: boundedString(input.command, "command", 10_000),
    sandboxRef: optionalString(input.sandboxRef, "sandboxRef"),
    ...(score === undefined ? {} : { score }),
    startedAt,
    completedAt,
  };
}

export function parseHarborCheckAttempt(value: unknown): HarborCheckAttemptInput {
  const input = object(value, "Harbor check attempt");
  onlyKeys(input, new Set([
    "id", "taskId", "phase", "status", "summary", "evidenceArtifactId",
    "harborVersion", "modalVersion", "command", "sandboxRef", "startedAt", "completedAt",
  ]), "Harbor check attempt");
  const startedAt = timestamp(input.startedAt, "startedAt");
  const completedAt = timestamp(input.completedAt, "completedAt");
  if (Date.parse(completedAt) < Date.parse(startedAt)) throw new ValidationError("completedAt must not precede startedAt");
  return {
    id: identifier(input.id, "id"),
    taskId: identifier(input.taskId, "taskId"),
    phase: enumValue(input.phase, HARBOR_PHASES, "phase"),
    status: enumValue(input.status, HARBOR_ATTEMPT_STATUSES, "status"),
    summary: boundedString(input.summary, "summary", 10_000),
    evidenceArtifactId: identifier(input.evidenceArtifactId, "evidenceArtifactId"),
    harborVersion: boundedString(input.harborVersion, "harborVersion", 300),
    modalVersion: boundedString(input.modalVersion, "modalVersion", 300),
    command: boundedString(input.command, "command", 10_000),
    sandboxRef: optionalString(input.sandboxRef, "sandboxRef"),
    startedAt,
    completedAt,
  };
}

export function parseHarborFinding(value: unknown): HarborFindingInput {
  const input = object(value, "Harbor finding");
  onlyKeys(input, new Set(["id", "taskId", "checkRunId", "finding"]), "Harbor finding");
  return {
    id: identifier(input.id, "id"),
    taskId: identifier(input.taskId, "taskId"),
    checkRunId: identifier(input.checkRunId, "checkRunId"),
    finding: boundedString(input.finding, "finding", 20_000),
  };
}

export function parseSourceEnvelope(value: unknown): SourceEnvelopeInput {
  const root = object(value, "source envelope");
  const vendor = object(root.vendor, "vendor");
  const sourceEvent = object(root.sourceEvent, "sourceEvent");
  const items = array(root.items, "items").map((value, index) => {
    const item = object(value, `items[${index}]`);
    const locator = optionalString(item.locator, `items[${index}].locator`);
    const artifactId = optionalString(item.artifactId, `items[${index}].artifactId`);
    if (!locator && !artifactId) throw new ValidationError(`items[${index}] must include locator or artifactId`);
    return {
      id: identifier(item.id, `items[${index}].id`),
      kind: enumValue(item.kind, SOURCE_ITEM_KINDS, `items[${index}].kind`),
      displayName: string(item.displayName, `items[${index}].displayName`),
      locator,
      mediaType: optionalString(item.mediaType, `items[${index}].mediaType`),
      artifactId,
      contentSha256: item.contentSha256 === undefined ? undefined : sha256(item.contentSha256, `items[${index}].contentSha256`),
      sizeBytes: item.sizeBytes === undefined ? undefined : nonNegativeInteger(item.sizeBytes, `items[${index}].sizeBytes`),
      fetchStatus: enumValue(item.fetchStatus, SOURCE_FETCH_STATUSES, `items[${index}].fetchStatus`),
      parseStatus: enumValue(item.parseStatus, SOURCE_PARSE_STATUSES, `items[${index}].parseStatus`),
      mutable: boolean(item.mutable, `items[${index}].mutable`),
      capturedAt: item.capturedAt === undefined ? undefined : timestamp(item.capturedAt, `items[${index}].capturedAt`),
      metadata: optionalObject(item.metadata, `items[${index}].metadata`),
    };
  });
  const itemIds = new Set(items.map((item) => item.id));
  if (itemIds.size !== items.length) throw new ValidationError("items must use unique ids");

  const relations = root.relations === undefined ? undefined : array(root.relations, "relations").map((value, index) => {
    const relation = object(value, `relations[${index}]`);
    const fromItemId = identifier(relation.fromItemId, `relations[${index}].fromItemId`);
    const toItemId = identifier(relation.toItemId, `relations[${index}].toItemId`);
    if (!itemIds.has(fromItemId) || !itemIds.has(toItemId)) {
      throw new ValidationError(`relations[${index}] references an item outside this envelope`);
    }
    return {
      fromItemId,
      toItemId,
      relation: enumValue(relation.relation, SOURCE_RELATIONS, `relations[${index}].relation`),
      position: relation.position === undefined ? undefined : nonNegativeInteger(relation.position, `relations[${index}].position`),
      metadata: optionalObject(relation.metadata, `relations[${index}].metadata`),
    };
  });

  const batchLinks = root.batchLinks === undefined ? undefined : array(root.batchLinks, "batchLinks").map((value, index) => {
    const link = object(value, `batchLinks[${index}]`);
    const sourceItemIds = optionalStringArray(link.sourceItemIds, `batchLinks[${index}].sourceItemIds`);
    for (const itemId of sourceItemIds ?? []) {
      if (!itemIds.has(itemId)) throw new ValidationError(`batchLinks[${index}] references an item outside this envelope`);
    }
    return {
      batchId: identifier(link.batchId, `batchLinks[${index}].batchId`),
      role: enumValue(link.role, new Set(["primary", "supplement", "correction", "metadata", "other"]), `batchLinks[${index}].role`),
      sourceItemIds,
    };
  });

  const taskLinks = root.taskLinks === undefined ? undefined : array(root.taskLinks, "taskLinks").map((value, index) => {
    const link = object(value, `taskLinks[${index}]`);
    const sourceItemId = identifier(link.sourceItemId, `taskLinks[${index}].sourceItemId`);
    if (!itemIds.has(sourceItemId)) throw new ValidationError(`taskLinks[${index}] references an item outside this envelope`);
    return {
      taskVersionId: identifier(link.taskVersionId, `taskLinks[${index}].taskVersionId`),
      sourceItemId,
      role: enumValue(link.role, new Set(["normalized_from", "discovered_in", "metadata", "other"]), `taskLinks[${index}].role`),
    };
  });

  return {
    vendor: {
      id: identifier(vendor.id, "vendor.id"),
      name: string(vendor.name, "vendor.name"),
      short: string(vendor.short, "vendor.short"),
      description: string(vendor.description, "vendor.description"),
      aliases: optionalStringArray(vendor.aliases, "vendor.aliases"),
    },
    sourceEvent: {
      id: identifier(sourceEvent.id, "sourceEvent.id"),
      channel: enumValue(sourceEvent.channel, SOURCE_CHANNELS, "sourceEvent.channel"),
      externalRef: string(sourceEvent.externalRef, "sourceEvent.externalRef"),
      sender: optionalString(sourceEvent.sender, "sourceEvent.sender"),
      receivedAt: timestamp(sourceEvent.receivedAt, "sourceEvent.receivedAt"),
      rawArtifactId: optionalString(sourceEvent.rawArtifactId, "sourceEvent.rawArtifactId"),
      metadata: optionalObject(sourceEvent.metadata, "sourceEvent.metadata"),
    },
    items,
    relations,
    batchLinks,
    taskLinks,
  } as SourceEnvelopeInput;
}

export function parseReconcileSubmissionSourceItems(value: unknown): ReconcileSubmissionSourceItemsInput {
  const input = object(value, "submission source-item reconciliation");
  onlyKeys(input, new Set(["submissionId", "sourceEventId", "items", "reason", "actor"]), "submission source-item reconciliation");
  const items = array(input.items, "items").map((value, index) => {
    const item = object(value, `items[${index}]`);
    onlyKeys(item, new Set(["sourceItemId", "role"]), `items[${index}]`);
    return {
      sourceItemId: identifier(item.sourceItemId, `items[${index}].sourceItemId`),
      role: enumValue(item.role, SUBMISSION_SOURCE_ITEM_ROLES, `items[${index}].role`),
    };
  });
  if (!items.length) throw new ValidationError("items must contain at least one source item");
  if (new Set(items.map((item) => item.sourceItemId)).size !== items.length) {
    throw new ValidationError("items must use unique sourceItemId values");
  }
  return {
    submissionId: identifier(input.submissionId, "submissionId"),
    sourceEventId: identifier(input.sourceEventId, "sourceEventId"),
    items,
    reason: boundedString(input.reason, "reason", 5_000),
    actor: boundedString(input.actor, "actor", 500),
  };
}

export function parseVendorEvent(value: unknown): VendorEventInput {
  const input = object(value, "vendor event");
  return {
    id: identifier(input.id, "id"),
    vendorId: identifier(input.vendorId, "vendorId"),
    kind: enumValue(input.kind, VENDOR_EVENT_KINDS, "kind"),
    eventType: identifier(input.eventType, "eventType"),
    summary: boundedString(input.summary, "summary", 5_000),
    actor: boundedString(input.actor, "actor", 500),
    occurredAt: timestamp(input.occurredAt, "occurredAt"),
    sourceEventIds: uniqueIdentifiers(input.sourceEventIds, "sourceEventIds"),
    batchIds: uniqueIdentifiers(input.batchIds, "batchIds"),
    metadata: optionalObject(input.metadata, "metadata"),
  } as VendorEventInput;
}

export function parseVendorArchive(value: unknown): VendorArchiveInput {
  const input = object(value, "vendor archival request");
  return {
    vendorId: identifier(input.vendorId, "vendorId"),
    reason: boundedString(input.reason, "reason", 5_000),
    actor: boundedString(input.actor, "actor", 500),
  };
}

export function parseArtifact(value: unknown): ArtifactInput {
  const input = object(value, "artifact");
  return {
    id: identifier(input.id, "id"),
    kind: enumValue(input.kind, new Set(["source_payload", "source_snapshot", "submission_manifest", "task_package", "trajectory", "check_evidence", "extracted_text", "other"]), "kind"),
    storageKey: string(input.storageKey, "storageKey"),
    sha256: sha256(input.sha256, "sha256"),
    sizeBytes: input.sizeBytes === undefined ? undefined : nonNegativeInteger(input.sizeBytes, "sizeBytes"),
    contentType: optionalString(input.contentType, "contentType"),
    metadata: optionalObject(input.metadata, "metadata"),
  } as ArtifactInput;
}

export function parseSubmissionRemoval(value: unknown): SubmissionRemovalInput {
  const input = object(value, "submission removal");
  onlyKeys(input, new Set(["batchId", "disposition", "reason", "actor"]), "submission removal");
  return {
    batchId: identifier(input.batchId, "batchId"),
    disposition: enumValue(
      input.disposition,
      new Set<SubmissionRemovalInput["disposition"]>(["erroneous_registration", "purchased_delivery_handoff"]),
      "disposition",
    ),
    reason: boundedString(input.reason, "reason", 5_000),
    actor: boundedString(input.actor, "actor", 500),
  };
}

export function parseSubmissionIntakeClassification(value: unknown): SubmissionIntakeClassificationInput {
  const input = object(value, "submission intake classification");
  const sourceEventIds = uniqueIdentifiers(input.sourceEventIds, "sourceEventIds");
  if (!sourceEventIds.length) throw new ValidationError("sourceEventIds must contain at least one governing source event");
  return {
    batchId: identifier(input.batchId, "batchId"),
    purpose: enumValue(input.purpose, new Set(["sample_evaluation"]), "purpose"),
    sourceEventIds,
    reason: boundedString(input.reason, "reason", 5_000),
    actor: boundedString(input.actor, "actor", 500),
  };
}

export function parseStatusUpdate(value: unknown): StatusUpdateInput {
  const input = object(value, "status update");
  return {
    entityType: enumValue(input.entityType, new Set(["submission_batch", "task_version"]), "entityType"),
    entityId: identifier(input.entityId, "entityId"),
    workflowStatus: enumValue(input.workflowStatus, WORKFLOW_STATUSES, "workflowStatus"),
    catalogVisibility: enumValue(input.catalogVisibility, VISIBILITIES, "catalogVisibility"),
    reason: string(input.reason, "reason"),
    actor: string(input.actor, "actor"),
  } as StatusUpdateInput;
}

export function parseTaskSourceLinks(value: unknown): TaskSourceLinksInput {
  const input = object(value, "task source links");
  const links = array(input.links, "links").map((value, index) => {
    const link = object(value, `links[${index}]`);
    return {
      taskVersionId: identifier(link.taskVersionId, `links[${index}].taskVersionId`),
      sourceItemId: identifier(link.sourceItemId, `links[${index}].sourceItemId`),
      role: enumValue(link.role, new Set(["normalized_from", "discovered_in", "metadata", "other"]), `links[${index}].role`),
    };
  });
  if (!links.length) throw new ValidationError("links must contain at least one task-source link");
  const unique = new Set(links.map((link) => `${link.taskVersionId}\u0000${link.sourceItemId}\u0000${link.role}`));
  if (unique.size !== links.length) throw new ValidationError("links must not contain duplicates");
  return {
    links,
    reason: string(input.reason, "reason"),
    actor: string(input.actor, "actor"),
  } as TaskSourceLinksInput;
}

export function parseWorkCompletion(value: unknown): WorkCompletionInput {
  const input = object(value, "work completion");
  return {
    id: identifier(input.id, "id"),
    workerId: string(input.workerId, "workerId"),
    outcome: enumValue(input.outcome, new Set(["completed", "retry", "failed"]), "outcome"),
    error: optionalString(input.error, "error"),
  } as WorkCompletionInput;
}

export function parseCheckResult(value: unknown): CheckResultInput {
  const input = object(value, "check result");
  const evidenceRole = enumValue(input.evidenceRole, CHECK_EVIDENCE_ROLES, "evidenceRole");
  const executionScope = enumValue(input.executionScope, CHECK_EXECUTION_SCOPES, "executionScope");
  const isRuntimeCheck = ["environment", "build", "boot", "positive_control", "negative_control"].includes(evidenceRole);
  const completedRuntimeAttempt = input.outcome === "pass" || input.outcome === "fail";
  if (isRuntimeCheck && executionScope === "static") {
    throw new ValidationError(`${evidenceRole} checks cannot use executionScope static`);
  }
  if (isRuntimeCheck && completedRuntimeAttempt && executionScope !== "remote_sandbox") {
    throw new ValidationError(`${evidenceRole} ${String(input.outcome)} checks must use executionScope remote_sandbox`);
  }
  return {
    id: identifier(input.id, "id"),
    taskVersionId: identifier(input.taskVersionId, "taskVersionId"),
    definitionId: identifier(input.definitionId, "definitionId"),
    definitionVersion: positiveInteger(input.definitionVersion, "definitionVersion"),
    kind: enumValue(input.kind, new Set(["deterministic", "heuristic"]), "kind"),
    evidenceRole,
    executionScope,
    name: string(input.name, "name"),
    description: string(input.description, "description"),
    required: boolean(input.required, "required"),
    outcome: enumValue(input.outcome, OUTCOMES, "outcome"),
    summary: string(input.summary, "summary"),
    runner: object(input.runner, "runner"),
    evidence: object(input.evidence, "evidence"),
    startedAt: timestamp(input.startedAt, "startedAt"),
    completedAt: timestamp(input.completedAt, "completedAt"),
  } as CheckResultInput;
}

function validateRepresentation(
  kind: TaskRepresentationKind,
  path: TaskRepresentationPath,
  outcome: TaskNormalizationOutcome,
  name: string,
): void {
  if (kind === "harbor" && path === "native_format_exception") {
    throw new ValidationError(`${name}.representationKind harbor conflicts with native_format_exception`);
  }
  if (kind === "native" && path !== "native_format_exception") {
    throw new ValidationError(`${name}.representationKind native requires native_format_exception`);
  }
  if (kind === "unknown") {
    throw new ValidationError(`${name}.representationKind must be resolved before registering an exact normalized package`);
  }
  if (outcome === "already_harbor" && path !== "already_harbor") {
    throw new ValidationError(`${name}.normalizationOutcome already_harbor requires representationPath already_harbor`);
  }
  if (outcome === "normalized" && path === "already_harbor") {
    throw new ValidationError(`${name}.normalizationOutcome normalized requires a transformed or native-exception representation path`);
  }
}

export function parseTaskFinding(value: unknown): TaskFindingInput {
  const input = object(value, "task finding");
  onlyKeys(input, new Set(["id", "taskVersionId", "finding"]), "task finding");
  return {
    id: identifier(input.id, "id"),
    taskVersionId: identifier(input.taskVersionId, "taskVersionId"),
    finding: boundedString(input.finding, "finding", 20_000),
  };
}

export function parseTaskFindingUpdate(value: unknown, findingId: string): TaskFindingUpdateInput {
  const input = object(value, "task finding update");
  onlyKeys(input, new Set(["id", "finding"]), "task finding update");
  const id = identifier(findingId, "id");
  if (input.id !== undefined && identifier(input.id, "id") !== id) {
    throw new ValidationError("id must match the task finding in the request path");
  }
  return {
    id,
    finding: boundedString(input.finding, "finding", 20_000),
  };
}

export function parseTaskFindingId(value: unknown): string {
  return identifier(value, "id");
}

export function parseFollowUp(value: unknown): FollowUpInput {
  const input = object(value, "follow-up");
  return {
    id: identifier(input.id, "id"),
    batchId: identifier(input.batchId, "batchId"),
    channel: enumValue(input.channel, new Set(["email", "feishu", "internal", "other"]), "channel"),
    recipient: string(input.recipient, "recipient"),
    status: enumValue(input.status, new Set(["drafted", "sent", "replied", "closed"]), "status"),
    reason: string(input.reason, "reason"),
    evidenceCheckRunIds: stringArray(input.evidenceCheckRunIds, "evidenceCheckRunIds"),
    sentAt: input.sentAt === undefined ? undefined : timestamp(input.sentAt, "sentAt"),
    externalRef: optionalString(input.externalRef, "externalRef"),
  } as FollowUpInput;
}

export function parseSubmissionReview(value: unknown): SubmissionReviewInput {
  const input = object(value, "submission review");
  const reviewer = object(input.reviewer, "reviewer");
  const signal = enumValue(input.signal, new Set<SubmissionReviewInput["signal"]>(["interested", "not_interested", "needs_revision", "comment"]), "signal");
  const scope = enumValue(input.scope, new Set<SubmissionReviewInput["scope"]>(["submission", "categories"]), "scope");
  const categoryIds = stringArray(input.categoryIds, "categoryIds").map((value, index) => identifier(value, `categoryIds[${index}]`));
  if (new Set(categoryIds).size !== categoryIds.length) throw new ValidationError("categoryIds must be unique");
  if (scope === "submission" && categoryIds.length) throw new ValidationError("submission-scoped reviews cannot select categories");
  if (scope === "categories" && !categoryIds.length) throw new ValidationError("category-scoped reviews must select at least one category");
  const comment = input.comment === undefined || input.comment === null ? undefined : boundedString(input.comment, "comment", 5_000);
  if (signal !== "interested" && !comment) throw new ValidationError(`${signal} reviews require a comment`);
  return {
    id: identifier(input.id, "id"),
    batchId: identifier(input.batchId, "batchId"),
    signal,
    scope,
    categoryIds,
    reviewer: {
      openId: identifier(reviewer.openId, "reviewer.openId"),
      unionId: reviewer.unionId === undefined || reviewer.unionId === null ? undefined : identifier(reviewer.unionId, "reviewer.unionId"),
      tenantKey: identifier(reviewer.tenantKey, "reviewer.tenantKey"),
      name: boundedString(reviewer.name, "reviewer.name", 200),
    },
    comment,
    metadata: optionalObject(input.metadata, "metadata"),
  };
}

export function parseResearcherUpload(value: unknown): ResearcherUploadInput {
  const input = object(value, "researcher upload");
  const artifact = object(input.artifact, "artifact");
  const researcher = object(input.researcher, "researcher");
  const note = input.note === undefined ? undefined : boundedString(input.note, "note", 5_000);
  return {
    id: identifier(input.id, "id"),
    vendorId: identifier(input.vendorId, "vendorId"),
    label: boundedString(input.label, "label", 300),
    ...(note ? { note } : {}),
    uploadedAt: timestamp(input.uploadedAt, "uploadedAt"),
    artifact: {
      sha256: sha256(artifact.sha256, "artifact.sha256"),
      sizeBytes: positiveInteger(artifact.sizeBytes, "artifact.sizeBytes"),
      contentType: boundedString(artifact.contentType, "artifact.contentType", 300),
      originalName: boundedString(artifact.originalName, "artifact.originalName", 500),
    },
    researcher: {
      openId: boundedString(researcher.openId, "researcher.openId", 500),
      unionId: optionalString(researcher.unionId, "researcher.unionId"),
      tenantKey: boundedString(researcher.tenantKey, "researcher.tenantKey", 500),
      name: boundedString(researcher.name, "researcher.name", 500),
    },
  };
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

function object(value: unknown, name: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ValidationError(`${name} must be an object`);
  return value as Record<string, unknown>;
}

function onlyKeys(value: Record<string, unknown>, allowed: Set<string>, name: string): void {
  const unsupported = Object.keys(value).filter((key) => !allowed.has(key));
  if (unsupported.length) throw new ValidationError(`${name} contains unsupported fields: ${unsupported.join(", ")}`);
}

function optionalObject(value: unknown, name: string): Record<string, unknown> | undefined {
  return value === undefined ? undefined : object(value, name);
}

function array(value: unknown, name: string): unknown[] {
  if (!Array.isArray(value)) throw new ValidationError(`${name} must be an array`);
  return value;
}

function string(value: unknown, name: string): string {
  if (typeof value !== "string" || !value.trim()) throw new ValidationError(`${name} must be a non-empty string`);
  return value.trim();
}

function boundedString(value: unknown, name: string, maximum: number): string {
  const parsed = string(value, name);
  if (parsed.length > maximum) throw new ValidationError(`${name} must contain at most ${maximum} characters`);
  return parsed;
}

function optionalString(value: unknown, name: string): string | undefined {
  return value === undefined || value === null ? undefined : string(value, name);
}

function identifier(value: unknown, name: string): string {
  const parsed = string(value, name);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,199}$/.test(parsed)) {
    throw new ValidationError(`${name} contains unsupported characters`);
  }
  return parsed;
}

function uniqueIdentifiers(value: unknown, name: string): string[] {
  const values = stringArray(value, name).map((item, index) => identifier(item, `${name}[${index}]`));
  if (new Set(values).size !== values.length) throw new ValidationError(`${name} must be unique`);
  return values;
}

function boolean(value: unknown, name: string): boolean {
  if (typeof value !== "boolean") throw new ValidationError(`${name} must be a boolean`);
  return value;
}

function nonNegativeInteger(value: unknown, name: string): number {
  if (!Number.isInteger(value) || (value as number) < 0) throw new ValidationError(`${name} must be a non-negative integer`);
  return value as number;
}

function positiveInteger(value: unknown, name: string): number {
  if (!Number.isInteger(value) || (value as number) < 1) throw new ValidationError(`${name} must be a positive integer`);
  return value as number;
}

function finiteNumber(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new ValidationError(`${name} must be a finite number`);
  }
  return value;
}

function optionalNonNegativeInteger(value: unknown, name: string): number | undefined {
  return value === undefined ? undefined : nonNegativeInteger(value, name);
}

function stringArray(value: unknown, name: string): string[] {
  return array(value, name).map((item, index) => string(item, `${name}[${index}]`));
}

function optionalStringArray(value: unknown, name: string): string[] | undefined {
  return value === undefined ? undefined : stringArray(value, name);
}

function enumValue<T extends string>(value: unknown, allowed: Set<T>, name: string): T {
  const parsed = string(value, name) as T;
  if (!allowed.has(parsed)) throw new ValidationError(`${name} must be one of: ${[...allowed].join(", ")}`);
  return parsed;
}

function optionalEnum<T extends string>(value: unknown, allowed: Set<T>, name: string): T | undefined {
  return value === undefined ? undefined : enumValue(value, allowed, name);
}

function timestamp(value: unknown, name: string): string {
  const parsed = string(value, name);
  if (Number.isNaN(Date.parse(parsed))) throw new ValidationError(`${name} must be an ISO timestamp`);
  return new Date(parsed).toISOString();
}

function date(value: unknown, name: string): string {
  const parsed = string(value, name);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(parsed) || Number.isNaN(Date.parse(`${parsed}T00:00:00Z`))) {
    throw new ValidationError(`${name} must be YYYY-MM-DD`);
  }
  return parsed;
}

function sha256(value: unknown, name: string): string {
  const parsed = string(value, name).toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(parsed)) throw new ValidationError(`${name} must be a SHA-256 hex digest`);
  return parsed;
}
