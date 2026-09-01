import assert from "node:assert/strict";
import test from "node:test";
import { registryRole } from "../src/registry/api.js";
import { contentAddressedStorageKey } from "../src/registry/artifacts.js";
import type { SourceEnvelopeInput, SubmissionManifest } from "../src/registry/types.js";
import {
  parseAssignTaskBenchmarks,
  parseAssignTaskGpuRequirements,
  parseAppendTasks,
  parseHarborCheckAttempt,
  parseHarborCheckResult,
  parseHarborFinding,
  parsePurgeErroneousBenchmarks,
  parseRegisterBenchmark,
  parseReconcileHarborWorkItems,
  parseRemoveUnusedBenchmarks,
  parseReconcileSubmissionSourceItems,
  parseReconcileSubmissionTasks,
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

test("validates audited submission source-item reconciliation", () => {
  const input = {
    submissionId: "submission-one",
    sourceEventId: "source-one",
    items: [
      { sourceItemId: "source-pdf", role: "original_vendor_file" },
      { sourceItemId: "source-message", role: "provenance" },
    ],
    reason: "Attach each delivered file only to its relevant submission.",
    actor: "TARS",
  };
  assert.deepEqual(parseReconcileSubmissionSourceItems(input), input);
  assert.throws(() => parseReconcileSubmissionSourceItems({ ...input, items: [] }), ValidationError);
  assert.throws(() => parseReconcileSubmissionSourceItems({
    ...input,
    items: [{ sourceItemId: "source-pdf", role: "primary" }],
  }), ValidationError);
});

test("registers only clearly identified tasks or traces with two formats", () => {
  const sha = "a".repeat(64);
  const input = {
    submissionId: manifest.batch.id,
    actor: "CASE",
    benchmarkAssignments: [{ sourceItemId: "source-archive", benchmarkId: "terminal-bench" }],
    tasks: [
      { id: "task-harbor", stableKey: "task-one", title: "Task one", kind: "task", format: "harbor", sourcePath: "tasks/task-one", artifactId: `artifact:sha256:${sha}`, contentSha256: sha, sourceItemIds: ["source-archive"] },
      { id: "task-trace", stableKey: "trace-one", title: "Trace one", kind: "trace", format: "non_harbor", sourcePath: "traces/one.jsonl", artifactId: `artifact:sha256:${sha}`, contentSha256: sha, sourceItemIds: ["source-archive"] },
    ],
  };
  const parsed = parseAppendTasks(input);
  assert.deepEqual(parsed.tasks.map((task) => [task.kind, task.format]), [["task", "harbor"], ["trace", "non_harbor"]]);
  assert.deepEqual(parsed.tasks.map((task) => task.benchmarkId), ["terminal-bench", "terminal-bench"]);
  assert.throws(() => parseAppendTasks({ ...input, tasks: [{ ...input.tasks[0], format: "native" }] }), ValidationError);
  assert.throws(() => parseAppendTasks({ ...input, tasks: [{ ...input.tasks[0], sourceItemIds: [] }] }), ValidationError);
  assert.throws(() => parseAppendTasks({ ...input, benchmarkAssignments: [] }), /must have a benchmarkId/);
  assert.equal(parseAppendTasks({
    ...input,
    benchmarkAssignments: [],
    tasks: [{ ...input.tasks[0], benchmarkId: "frontier-cs" }],
  }).tasks[0]?.benchmarkId, "frontier-cs");
});

test("validates complete audited task reconciliations", () => {
  const sha = "b".repeat(64);
  const input = {
    submissionId: manifest.batch.id,
    actor: "TARS",
    reason: "Correct trace classifications while preserving prior task versions.",
    benchmarkAssignments: [],
    tasks: [{
      id: "trace-v2",
      stableKey: "reasoning-record-one",
      title: "Reasoning record one",
      kind: "trace",
      format: "non_harbor",
      benchmarkId: "image-math",
      sourcePath: "reasoning/samples.json#/0",
      artifactId: `artifact:sha256:${sha}`,
      contentSha256: sha,
      sourceItemIds: ["source-archive"],
    }],
  };
  const parsed = parseReconcileSubmissionTasks(input);
  assert.equal(parsed.reason, input.reason);
  assert.deepEqual(parsed.tasks.map((task) => [task.id, task.kind]), [["trace-v2", "trace"]]);
  assert.equal(parseReconcileSubmissionTasks({
    ...input,
    tasks: [{ ...input.tasks[0], artifactId: null }],
  }).tasks[0]?.artifactId, null);
  assert.throws(() => parseAppendTasks({
    ...input,
    tasks: [{ ...input.tasks[0], artifactId: null }],
  }), ValidationError);
  assert.throws(() => parseReconcileSubmissionTasks({ ...input, reason: "" }), ValidationError);
  assert.throws(() => parseReconcileSubmissionTasks({ ...input, tasks: [] }), ValidationError);
});

test("validates managed benchmark directions", () => {
  const parsed = parseRegisterBenchmark({
    id: "terminal-bench",
    displayName: "Terminal-Bench",
    aliases: ["terminal_bench", "TerminalBench"],
    actor: "TARS",
  });
  assert.equal(parsed.id, "terminal-bench");
  assert.deepEqual(parsed.aliases, ["terminal_bench", "TerminalBench"].sort((a, b) => a.localeCompare(b)));
  assert.throws(() => parseRegisterBenchmark({ ...parsed, aliases: ["Terminal Bench", "terminal_bench"] }), /unique ignoring case/);
});

test("validates atomic unused benchmark removals", () => {
  assert.deepEqual(parseRemoveUnusedBenchmarks({
    benchmarkIds: ["unused-two", "unused-one"],
  }), {
    benchmarkIds: ["unused-one", "unused-two"],
  });
  assert.throws(() => parseRemoveUnusedBenchmarks({ benchmarkIds: [] }), /at least one/);
  assert.throws(() => parseRemoveUnusedBenchmarks({ benchmarkIds: ["unused-one", "unused-one"] }), /duplicates/);
});

test("validates explicit erroneous benchmark purges", () => {
  const input = {
    benchmarkIds: ["wrong-two", "wrong-one"],
    reason: "These superseded assignments were confirmed to be erroneous.",
    actor: "TARS",
  };
  assert.deepEqual(parsePurgeErroneousBenchmarks(input), {
    ...input,
    benchmarkIds: ["wrong-one", "wrong-two"],
  });
  assert.throws(() => parsePurgeErroneousBenchmarks({ ...input, reason: "" }), ValidationError);
  assert.throws(() => parsePurgeErroneousBenchmarks({ ...input, actor: "" }), ValidationError);
  assert.throws(() => parsePurgeErroneousBenchmarks({ ...input, benchmarkIds: [] }), /at least one/);
});

test("validates append-only task benchmark assignments", () => {
  const input = {
    submissionId: "submission-one",
    assignments: [
      { taskId: "task-one", benchmarkId: "terminal-bench" },
      { taskId: "task-two", benchmarkId: "unspecified" },
    ],
    reason: "Record the reviewed benchmark direction without replacing task versions.",
    actor: "TARS",
  };
  assert.deepEqual(parseAssignTaskBenchmarks(input), input);
  assert.throws(() => parseAssignTaskBenchmarks({ ...input, assignments: [] }), /at least one/);
  assert.throws(() => parseAssignTaskBenchmarks({
    ...input,
    assignments: [input.assignments[0], input.assignments[0]],
  }), /at most once/);
});

test("validates append-only task GPU requirement assignments", () => {
  const input = {
    submissionId: "submission-one",
    assignments: [{
      taskId: "task-one",
      gpuRequired: true,
      evidence: "task.toml declares environment.gpus = 1 and gpu_types = [H100].",
    }],
    reason: "Record the declared execution requirement without replacing the task version.",
    actor: "TARS",
  };
  assert.deepEqual(parseAssignTaskGpuRequirements(input), input);
  assert.throws(() => parseAssignTaskGpuRequirements({ ...input, assignments: [] }), /at least one/);
  assert.throws(() => parseAssignTaskGpuRequirements({
    ...input,
    assignments: [input.assignments[0], input.assignments[0]],
  }), /at most once/);
  assert.throws(() => parseAssignTaskGpuRequirements({
    ...input,
    assignments: [{ ...input.assignments[0], evidence: "" }],
  }), ValidationError);
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

test("validates non-conclusive Harbor attempts separately from results", () => {
  const attempt = {
    id: "attempt:oracle",
    taskId: "task-harbor",
    phase: "oracle",
    status: "blocked",
    summary: "The evaluation credential was unavailable.",
    evidenceArtifactId: "artifact:oracle-attempt-evidence",
    harborVersion: "0.21.0",
    modalVersion: "1.5.4",
    command: "case-harbor run --agent oracle --provider modal",
    startedAt: "2026-08-21T00:00:00.000Z",
    completedAt: "2026-08-21T00:01:00.000Z",
  };
  assert.equal(parseHarborCheckAttempt(attempt).status, "blocked");
  assert.throws(() => parseHarborCheckAttempt({ ...attempt, status: "not_run" }), ValidationError);
  assert.throws(() => parseHarborCheckAttempt({ ...attempt, outcome: "fail" }), /unsupported fields/);
  assert.throws(() => parseHarborCheckAttempt({ ...attempt, completedAt: "2026-08-20T23:59:00.000Z" }), /must not precede/);
});

test("validates exact Harbor work-item reconciliations", () => {
  const input = {
    taskIds: ["task-two", "task-one"],
    reason: "The exact task versions have recorded Harbor results or attempts.",
    actor: "CASE",
  };
  assert.deepEqual(parseReconcileHarborWorkItems(input), {
    ...input,
    taskIds: ["task-one", "task-two"],
  });
  assert.throws(() => parseReconcileHarborWorkItems({ ...input, taskIds: [] }), /at least one/);
  assert.throws(() => parseReconcileHarborWorkItems({ ...input, taskIds: ["task-one", "task-one"] }), /duplicates/);
  assert.throws(() => parseReconcileHarborWorkItems({ ...input, extra: true }), /unsupported fields/);
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
