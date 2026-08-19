import assert from "node:assert/strict";
import test from "node:test";
import { registryRole } from "../src/registry/api.js";
import { contentAddressedStorageKey } from "../src/registry/artifacts.js";
import type { SourceEnvelopeInput, SubmissionManifest } from "../src/registry/types.js";
import { parseAppendNormalizedTasks, parseResearcherUpload, parseSourceEnvelope, parseSubmissionManifest, parseSubmissionRemoval, parseSubmissionReview, parseTaskFinding, parseTaskSourceLinks, parseVendorEvent, ValidationError } from "../src/registry/validation.js";

const manifest: SubmissionManifest = {
  vendor: { id: "vendor-one", name: "Vendor One", short: "V1", description: "A vendor.", aliases: [] },
  sourceEvent: {
    id: "source-one",
    channel: "workspace",
    externalRef: "workspace://sample-one",
    receivedAt: "2026-08-13T00:00:00.000Z",
  },
  batch: {
    id: "vendor-one-2026-08-13",
    date: "2026-08-13",
    label: "First sample",
    sourceLabel: "sample-one",
    taskCount: 1,
    formats: ["Harbor"],
    workflowStatus: "ready_for_research",
    catalogVisibility: "available",
    delta: { added: 1, removed: 0, note: "First observed submission." },
    metadata: { intakePurpose: "sample_evaluation" },
  },
  categories: [{ id: "vendor-one:systems", name: "Systems", description: "Systems tasks.", count: 1 }],
  tasks: [{
    id: "vendor-one-2026-08-13:task-one",
    stableKey: "task-one",
    title: "Task one",
    categoryId: "vendor-one:systems",
    format: "Harbor",
  }],
};

test("validates a complete immutable submission manifest", () => {
  const parsed = parseSubmissionManifest(manifest);
  assert.equal(parsed.batch.id, manifest.batch.id);
  assert.equal(parsed.tasks?.[0]?.categoryId, manifest.categories[0]?.id);
  assert.equal(parsed.sourceEvent.receivedAt, "2026-08-13T00:00:00.000Z");
  assert.throws(
    () => parseSubmissionManifest({ ...manifest, tasks: [{ ...manifest.tasks?.[0], categoryId: "missing" }] }),
    ValidationError,
  );
});

test("protects catalog reads separately from CASE writes", () => {
  const catalogToken = "catalog-token-with-at-least-32-characters";
  const reviewToken = "review-token-with-at-least-32-characters!";
  const uploadToken = "upload-token-with-at-least-32-characters!!";
  const adminToken = "admin-token-with-at-least-32-characters!!";
  assert.equal(registryRole(undefined, catalogToken, reviewToken, uploadToken, adminToken), null);
  assert.equal(registryRole("Bearer wrong", catalogToken, reviewToken, uploadToken, adminToken), null);
  assert.equal(registryRole(`Bearer ${catalogToken}`, catalogToken, reviewToken, uploadToken, adminToken), "catalog");
  assert.equal(registryRole(`Bearer ${reviewToken}`, catalogToken, reviewToken, uploadToken, adminToken), "review");
  assert.equal(registryRole(`Bearer ${uploadToken}`, catalogToken, reviewToken, uploadToken, adminToken), "upload");
  assert.equal(registryRole(`Bearer ${adminToken}`, catalogToken, reviewToken, uploadToken, adminToken), "admin");
});

test("validates bounded researcher uploads with verified identity and artifact metadata", () => {
  const upload = {
    id: "97f6d26d-9a3a-4a86-a6aa-39289650616c",
    vendorId: "vendor-one",
    label: "Researcher sample",
    category: "Coding environments",
    note: "Please inspect the grader behavior.",
    uploadedAt: "2026-08-17T08:00:00.000Z",
    artifact: {
      sha256: "a".repeat(64),
      sizeBytes: 1024,
      contentType: "application/zip",
      originalName: "sample.zip",
    },
    researcher: {
      openId: "ou_researcher",
      tenantKey: "tenant_one",
      name: "Researcher One",
    },
  };
  assert.equal(parseResearcherUpload(upload).artifact.originalName, "sample.zip");
  assert.throws(() => parseResearcherUpload({ ...upload, artifact: { ...upload.artifact, sha256: "bad" } }), ValidationError);
  assert.throws(() => parseResearcherUpload({ ...upload, vendorId: "vendor/one" }), ValidationError);
});

test("validates append-only submission reviews and category scope", () => {
  const review = {
    id: "review-one",
    batchId: manifest.batch.id,
    signal: "not_interested",
    scope: "categories",
    categoryIds: [manifest.categories[0]?.id],
    reviewer: { openId: "ou_researcher", tenantKey: "tenant_one", name: "Researcher One" },
    comment: "The systems tasks are too shallow for the target use case.",
  };
  assert.equal(parseSubmissionReview(review).signal, "not_interested");
  assert.throws(() => parseSubmissionReview({ ...review, categoryIds: [] }), ValidationError);
  assert.throws(() => parseSubmissionReview({ ...review, signal: "needs_revision", comment: "" }), ValidationError);
  assert.throws(() => parseSubmissionReview({ ...review, scope: "submission", categoryIds: [manifest.categories[0]?.id] }), ValidationError);
});

test("validates recursive source envelopes and their derivation links", () => {
  const envelope: SourceEnvelopeInput = {
    vendor: manifest.vendor,
    sourceEvent: {
      id: "feishu-message-one",
      channel: "feishu",
      externalRef: "feishu://message/one",
      receivedAt: "2026-08-13T00:00:00.000Z",
    },
    items: [
      {
        id: "source-message-one",
        kind: "message",
        displayName: "Inbound vendor message",
        locator: "feishu://message/one",
        fetchStatus: "snapshotted",
        parseStatus: "parsed",
        mutable: false,
      },
      {
        id: "source-sheet-one",
        kind: "spreadsheet",
        displayName: "Task index",
        locator: "https://docs.google.com/spreadsheets/d/example/edit",
        fetchStatus: "queued",
        parseStatus: "not_requested",
        mutable: true,
      },
    ],
    relations: [{ fromItemId: "source-message-one", toItemId: "source-sheet-one", relation: "links_to", position: 0 }],
  };
  assert.equal(parseSourceEnvelope(envelope).relations?.[0]?.relation, "links_to");
  assert.throws(
    () => parseSourceEnvelope({ ...envelope, relations: [{ fromItemId: "source-message-one", toItemId: "missing", relation: "links_to" }] }),
    ValidationError,
  );
});

test("validates append-only vendor and procurement events", () => {
  const event = {
    id: "vendor-one:purchase-authorized:2026-08-13",
    vendorId: "vendor-one",
    kind: "commercial",
    eventType: "purchase_authorized",
    summary: "Researcher authorized a ten-task starter order.",
    actor: "Researcher One",
    occurredAt: "2026-08-13T00:00:00.000Z",
    sourceEventIds: ["feishu-message-one"],
    batchIds: [],
    metadata: { quantity: 10, currency: "USD" },
  };
  assert.equal(parseVendorEvent(event).eventType, "purchase_authorized");
  assert.throws(() => parseVendorEvent({ ...event, sourceEventIds: ["same", "same"] }), ValidationError);
  assert.throws(() => parseVendorEvent({ ...event, kind: "quality_score" }), ValidationError);
});

test("accepts unchecked submissions for visible, unreviewed samples", () => {
  const parsed = parseSubmissionManifest({
    ...manifest,
    batch: {
      ...manifest.batch,
      id: "vendor-one-2026-08-14-unchecked",
      workflowStatus: "unchecked",
      catalogVisibility: "available",
      taskCount: 0,
    },
    categories: [],
    tasks: [],
  });
  assert.equal(parsed.batch.workflowStatus, "unchecked");
  assert.equal(parsed.batch.taskCount, 0);
});

test("rejects purchased or unscoped deliveries from the sample registry", () => {
  assert.throws(
    () => parseSubmissionManifest({ ...manifest, batch: { ...manifest.batch, metadata: { intakePurpose: "purchased_delivery" } } }),
    ValidationError,
  );
  assert.throws(
    () => parseSubmissionManifest({ ...manifest, batch: { ...manifest.batch, metadata: undefined } }),
    ValidationError,
  );
});

test("uses deterministic content-addressed object keys", () => {
  const sha256 = "a".repeat(64);
  assert.equal(contentAddressedStorageKey(sha256), `objects/sha256/aa/${sha256}`);
  assert.throws(() => contentAddressedStorageKey("not-a-sha"));
});

test("requires an auditable operator and reason for removing a handed-off submission", () => {
  const removal = {
    batchId: "vendor-one-purchased-delivery",
    reason: "The purchased delivery moved to the downstream production-data pipeline.",
    actor: "TARS",
  };
  assert.deepEqual(parseSubmissionRemoval(removal), removal);
  assert.throws(() => parseSubmissionRemoval({ ...removal, reason: "" }), ValidationError);
  assert.throws(() => parseSubmissionRemoval({ ...removal, batchId: "unsafe/id" }), ValidationError);
});

test("validates append-only task-to-source repairs", () => {
  const input = {
    links: [{ taskVersionId: "task-version-one", sourceItemId: "source-package-one", role: "normalized_from" }],
    reason: "Attach an immutable package captured after the original normalization pass.",
    actor: "case",
  };
  assert.equal(parseTaskSourceLinks(input).links.length, 1);
  assert.throws(() => parseTaskSourceLinks({ ...input, links: [] }), ValidationError);
  assert.throws(() => parseTaskSourceLinks({ ...input, links: [...input.links, ...input.links] }), ValidationError);
});

test("validates provenance-complete task registration for an existing submission", () => {
  const sha256 = "a".repeat(64);
  const input = {
    batchId: manifest.batch.id,
    categories: [{
      id: "vendor-one:normalized:systems",
      name: "Normalized systems",
      description: "Interpreted systems tasks.",
      count: 1,
      examples: ["task-one"],
    }],
    tasks: [{
      id: "vendor-one-2026-08-13:task-one:normalized",
      stableKey: "task-one",
      title: "Task one",
      summary: "A normalized systems task.",
      categoryId: "vendor-one:normalized:systems",
      sourcePath: "delivery/tasks/task-one",
      format: "Harbor",
      artifactId: `artifact:sha256:${sha256}`,
      contentSha256: sha256,
      sourceItemIds: ["source-task-package-one", "source-archive-one"],
      workflowStatus: "unchecked",
      catalogVisibility: "log_only",
      metadata: { normalizationOutcome: "already_harbor" },
    }],
    reason: "Register the interpreted task after attachment-first capture.",
    actor: "TARS/CASE",
  };
  const parsed = parseAppendNormalizedTasks(input);
  assert.equal(parsed.tasks[0]?.artifactId, `artifact:sha256:${sha256}`);
  assert.equal(parsed.tasks[0]?.sourcePath, "delivery/tasks/task-one");
  assert.throws(
    () => parseAppendNormalizedTasks({
      ...input,
      tasks: [{ ...input.tasks[0], artifactId: `artifact:sha256:${"b".repeat(64)}` }],
    }),
    ValidationError,
  );
  assert.throws(
    () => parseAppendNormalizedTasks({ ...input, tasks: [{ ...input.tasks[0], sourceItemIds: [] }] }),
    ValidationError,
  );
  assert.throws(
    () => parseAppendNormalizedTasks({ ...input, categories: [{ ...input.categories[0], count: 2 }] }),
    ValidationError,
  );
});

test("validates evidence-labeled task findings with explicit portal visibility", () => {
  const finding = {
    id: "finding:vendor-one:task-one:verifier-isolation",
    taskVersionId: "vendor-one-2026-08-13:task-one",
    kind: "deterministic_result",
    title: "Verifier isolation defect",
    summary: "The verifier tested a pristine environment rather than the Oracle-modified filesystem.",
    resolution: "A separately recorded shared-environment diagnostic passed twice.",
    actor: "TARS/Codex",
    occurredAt: "2026-08-18T12:00:00.000Z",
    evidenceCheckRunIds: ["check:vendor-one:oracle:one"],
    visibility: "portal",
  };
  assert.equal(parseTaskFinding(finding).visibility, "portal");
  assert.throws(() => parseTaskFinding({ ...finding, kind: "quality_score" }), ValidationError);
  assert.throws(() => parseTaskFinding({ ...finding, visibility: "public" }), ValidationError);
  assert.throws(() => parseTaskFinding({ ...finding, evidenceCheckRunIds: ["same", "same"] }), ValidationError);
});
