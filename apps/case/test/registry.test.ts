import assert from "node:assert/strict";
import test from "node:test";
import { registryRole } from "../src/registry/api.js";
import { contentAddressedStorageKey } from "../src/registry/artifacts.js";
import type { SourceEnvelopeInput, SubmissionManifest } from "../src/registry/types.js";
import {
  parseAppendTasks,
  parseHarborCheckResult,
  parseHarborFinding,
  parseResearcherUpload,
  parseSourceEnvelope,
  parseSubmissionIntakeClassification,
  parseSubmissionManifest,
  parseSubmissionRemoval,
  ValidationError,
} from "../src/registry/validation.js";

const manifest: SubmissionManifest = {
  vendor: { id: "vendor-one", name: "Vendor One", short: "V1", description: "A vendor.", aliases: [] },
  sourceEvent: { id: "source-one", channel: "workspace", externalRef: "workspace://sample-one", sender: "Vendor One", receivedAt: "2026-08-13T00:00:00.000Z" },
  batch: {
    id: "vendor-one-2026-08-13",
    date: "2026-08-13",
    label: "First sample",
    sourceLabel: "sample-one",
    taskCount: 0,
    formats: [],
    workflowStatus: "unchecked",
    catalogVisibility: "available",
    delta: { added: 0, removed: 0, note: "Original delivery preserved before parsing." },
    metadata: { intakePurpose: "sample_evaluation" },
  },
  categories: [],
  tasks: [],
};

test("captures a submission before parsing tasks", () => {
  const parsed = parseSubmissionManifest(manifest);
  assert.equal(parsed.batch.id, manifest.batch.id);
  assert.equal(parsed.sourceEvent.sender, "Vendor One");
  assert.throws(() => parseSubmissionManifest({ ...manifest, categories: [{ id: "cat", name: "Category", description: "Extra layer", count: 0 }] }), /cannot include tasks/);
  assert.throws(() => parseSubmissionManifest({ ...manifest, batch: { ...manifest.batch, formats: ["native"] } }), /only harbor and non_harbor/);
  assert.throws(() => parseSubmissionManifest({ ...manifest, batch: { ...manifest.batch, metadata: { intakePurpose: "purchased_delivery" } } }), ValidationError);
});

test("protects the portal catalog and upload scopes separately", () => {
  const catalog = "catalog-token-with-at-least-32-characters";
  const upload = "upload-token-with-at-least-32-characters!!";
  assert.equal(registryRole(undefined, catalog, upload), null);
  assert.equal(registryRole(`Bearer ${catalog}`, catalog, upload), "catalog");
  assert.equal(registryRole(`Bearer ${upload}`, catalog, upload), "upload");
  assert.equal(registryRole("Bearer unknown", catalog, upload), null);
});

test("validates researcher uploads without category or review fields", () => {
  const upload = {
    id: "97f6d26d-9a3a-4a86-a6aa-39289650616c",
    vendorId: "vendor-one",
    label: "Researcher sample",
    note: "Received in a vendor call.",
    uploadedAt: "2026-08-17T08:00:00.000Z",
    artifact: { sha256: "a".repeat(64), sizeBytes: 1024, contentType: "application/zip", originalName: "sample.zip" },
    researcher: { openId: "ou_researcher", tenantKey: "tenant_one", name: "Researcher One" },
  };
  assert.equal(parseResearcherUpload(upload).artifact.originalName, "sample.zip");
  assert.throws(() => parseResearcherUpload({ ...upload, artifact: { ...upload.artifact, sha256: "bad" } }), ValidationError);
});

test("validates recursive source provenance", () => {
  const envelope: SourceEnvelopeInput = {
    vendor: manifest.vendor,
    sourceEvent: { id: "message-one", channel: "feishu", externalRef: "feishu://message/one", sender: "Vendor One", receivedAt: "2026-08-13T00:00:00.000Z" },
    items: [
      { id: "source-message", kind: "message", displayName: "Inbound message", locator: "feishu://message/one", fetchStatus: "snapshotted", parseStatus: "parsed", mutable: false },
      { id: "source-archive", kind: "archive", displayName: "sample.zip", artifactId: `artifact:sha256:${"a".repeat(64)}`, contentSha256: "a".repeat(64), fetchStatus: "snapshotted", parseStatus: "queued", mutable: false },
    ],
    relations: [{ fromItemId: "source-message", toItemId: "source-archive", relation: "contains", position: 0 }],
  };
  assert.equal(parseSourceEnvelope(envelope).sourceEvent.sender, "Vendor One");
  assert.throws(() => parseSourceEnvelope({ ...envelope, relations: [{ fromItemId: "source-message", toItemId: "missing", relation: "contains" }] }), ValidationError);
});

test("registers only clearly identified tasks or traces with two formats", () => {
  const sha = "a".repeat(64);
  const input = {
    submissionId: manifest.batch.id,
    actor: "CASE",
    tasks: [
      { id: "task-harbor", stableKey: "task-one", title: "Task one", kind: "task", format: "harbor", sourcePath: "tasks/task-one", artifactId: `artifact:sha256:${sha}`, contentSha256: sha, sourceItemIds: ["source-archive"] },
      { id: "task-trace", stableKey: "trace-one", title: "Trace one", kind: "trace", format: "non_harbor", sourcePath: "traces/one.jsonl", artifactId: `artifact:sha256:${sha}`, contentSha256: sha, sourceItemIds: ["source-archive"] },
    ],
  };
  const parsed = parseAppendTasks(input);
  assert.deepEqual(parsed.tasks.map((task) => [task.kind, task.format]), [["task", "harbor"], ["trace", "non_harbor"]]);
  assert.throws(() => parseAppendTasks({ ...input, tasks: [{ ...input.tasks[0], format: "native" }] }), ValidationError);
  assert.throws(() => parseAppendTasks({ ...input, tasks: [{ ...input.tasks[0], sourceItemIds: [] }] }), ValidationError);
});

test("validates exactly three Harbor pass/fail phases and explicit control scores", () => {
  const base = {
    id: "check:oracle",
    taskId: "task-harbor",
    phase: "oracle",
    outcome: "pass",
    summary: "Oracle received score 1.",
    evidenceArtifactId: "artifact:oracle-evidence",
    harborVersion: "0.1.0",
    modalVersion: "1.0.0",
    command: "case-harbor run --agent oracle --provider modal",
    sandboxRef: "modal:sb-123",
    score: 1,
    startedAt: "2026-08-21T00:00:00.000Z",
    completedAt: "2026-08-21T00:01:00.000Z",
  };
  assert.equal(parseHarborCheckResult(base).phase, "oracle");
  assert.throws(() => parseHarborCheckResult({ ...base, outcome: "fail" }), /must match the observed score/);
  assert.throws(() => parseHarborCheckResult({ ...base, phase: "hermeticity" }), ValidationError);
  assert.throws(() => parseHarborCheckResult({ ...base, phase: "environment", score: 1 }), /cannot record a score/);
  assert.throws(() => parseHarborCheckResult({ ...base, phase: "build", score: undefined }), ValidationError);
  assert.throws(() => parseHarborCheckResult({ ...base, phase: "nop", outcome: "pass", score: 1 }), /must match the observed score/);
});

test("findings cite one failed Harbor check and have no classification fields", () => {
  const finding = { id: "finding:nop", taskId: "task-harbor", checkRunId: "check:nop", finding: "Nop received score 1." };
  assert.deepEqual(parseHarborFinding(finding), finding);
  assert.throws(() => parseHarborFinding({ ...finding, recommendation: "Change the grader." }), /unsupported fields/);
});

test("keeps content-addressed objects and explicit submission removal", () => {
  const sha = "a".repeat(64);
  assert.equal(contentAddressedStorageKey(sha), `objects/sha256/aa/${sha}`);
  const removal = { batchId: "vendor-one-2026-08-13", disposition: "erroneous_registration" as const, reason: "Duplicate registration.", actor: "CASE" };
  assert.deepEqual(parseSubmissionRemoval(removal), removal);
  assert.throws(() => parseSubmissionRemoval({ ...removal, disposition: "low_quality" }), ValidationError);
});

test("classifies a legacy submission only from linked sample evidence", () => {
  const classification = { batchId: "legacy-sample", purpose: "sample_evaluation", sourceEventIds: ["source-event"], reason: "The dated message identifies a sample.", actor: "CASE" };
  assert.deepEqual(parseSubmissionIntakeClassification(classification), classification);
  assert.throws(() => parseSubmissionIntakeClassification({ ...classification, sourceEventIds: [] }), ValidationError);
});
