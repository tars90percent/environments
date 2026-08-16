import type {
  ArtifactInput,
  CheckResultInput,
  FollowUpInput,
  ResearcherUploadInput,
  SourceEnvelopeInput,
  StatusUpdateInput,
  SubmissionManifest,
  SubmissionRemovalInput,
  SubmissionReviewInput,
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
    return {
      id: string(task.id, `tasks[${index}].id`),
      stableKey: string(task.stableKey, `tasks[${index}].stableKey`),
      title: string(task.title, `tasks[${index}].title`),
      summary: optionalString(task.summary, `tasks[${index}].summary`),
      categoryId,
      sourcePath: optionalString(task.sourcePath, `tasks[${index}].sourcePath`),
      format: string(task.format, `tasks[${index}].format`),
      contentSha256: optionalString(task.contentSha256, `tasks[${index}].contentSha256`),
      sourceItemIds: optionalStringArray(task.sourceItemIds, `tasks[${index}].sourceItemIds`),
      workflowStatus: optionalEnum(task.workflowStatus, WORKFLOW_STATUSES, `tasks[${index}].workflowStatus`),
      catalogVisibility: optionalEnum(task.catalogVisibility, VISIBILITIES, `tasks[${index}].catalogVisibility`),
      metadata: optionalObject(task.metadata, `tasks[${index}].metadata`),
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
    batch: {
      id: identifier(batch.id, "batch.id"),
      date: date(batch.date, "batch.date"),
      label: string(batch.label, "batch.label"),
      sourceLabel: string(batch.sourceLabel, "batch.sourceLabel"),
      taskCount: nonNegativeInteger(batch.taskCount, "batch.taskCount"),
      formats: stringArray(batch.formats, "batch.formats"),
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
  return {
    batchId: identifier(input.batchId, "batchId"),
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
  return {
    id: identifier(input.id, "id"),
    taskVersionId: identifier(input.taskVersionId, "taskVersionId"),
    definitionId: identifier(input.definitionId, "definitionId"),
    definitionVersion: positiveInteger(input.definitionVersion, "definitionVersion"),
    kind: enumValue(input.kind, new Set(["deterministic", "heuristic"]), "kind"),
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
  const category = boundedString(input.category, "category", 200);
  const note = input.note === undefined ? undefined : boundedString(input.note, "note", 5_000);
  return {
    id: identifier(input.id, "id"),
    vendorId: identifier(input.vendorId, "vendorId"),
    label: boundedString(input.label, "label", 300),
    category,
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
