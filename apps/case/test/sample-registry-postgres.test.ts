import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { Pool } from "pg";
import { PostgresRegistry, RegistryConflictError } from "../src/registry/postgres.js";
import { parseAppendTasks } from "../src/registry/validation.js";

const testDatabaseUrl = process.env.CASE_REGISTRY_TEST_DATABASE_URL;

test("stores submissions, tasks, three-phase Harbor results, and failed-check findings", { skip: !testDatabaseUrl }, async () => {
  if (!testDatabaseUrl) throw new Error("CASE_REGISTRY_TEST_DATABASE_URL is required");
  const schema = `case_sample_registry_${randomUUID().replaceAll("-", "_")}`;
  const administrator = new Pool({ connectionString: testDatabaseUrl });
  let repository: PostgresRegistry | undefined;
  try {
    await administrator.query(`CREATE SCHEMA "${schema}"`);
    repository = new PostgresRegistry(databaseUrlWithSearchPath(testDatabaseUrl, schema));
    await repository.initialize();
    const vendor = { id: "vendor-one", name: "Vendor One", short: "V1", description: "Fixture", aliases: [] };
    const taskSha = "a".repeat(64);
    const traceSha = "b".repeat(64);
    const evidenceSha = "c".repeat(64);
    await repository.captureSubmission({
      vendor,
      submission: { id: "submission-one", date: "2026-08-21", label: "Sample", sourceLabel: "Email", formats: [] },
      artifacts: [
        { id: `artifact:sha256:${taskSha}`, kind: "source_payload", storageKey: `objects/${taskSha}`, sha256: taskSha },
        { id: `artifact:sha256:${traceSha}`, kind: "source_payload", storageKey: `objects/${traceSha}`, sha256: traceSha },
      ],
      sources: [{
        sourceEvent: { id: "source-one", channel: "email", externalRef: "mail://source-one", sender: "Vendor One", receivedAt: "2026-08-21T00:00:00.000Z" },
        items: [
          { id: "source-message", kind: "message", displayName: "Inbound message", locator: "email://source-one", fetchStatus: "snapshotted", parseStatus: "parsed", mutable: false },
          { id: "source-task", kind: "task_package", displayName: "task.tar.gz", artifactId: `artifact:sha256:${taskSha}`, contentSha256: taskSha, fetchStatus: "snapshotted", parseStatus: "parsed", mutable: false },
          { id: "source-trace", kind: "file", displayName: "trace.jsonl", artifactId: `artifact:sha256:${traceSha}`, contentSha256: traceSha, fetchStatus: "snapshotted", parseStatus: "parsed", mutable: false },
        ],
      }],
      actor: "CASE",
    });
    await repository.captureSubmission({
      vendor,
      submission: { id: "submission-two", date: "2026-08-20", label: "Second sample", sourceLabel: "Email", formats: [] },
      artifacts: [],
      sources: [{ sourceEventId: "source-one", sourceItemIds: ["source-task"] }],
      actor: "CASE",
    });
    await repository.registerArtifact({ id: `artifact:sha256:${evidenceSha}`, kind: "check_evidence", storageKey: `objects/${evidenceSha}`, sha256: evidenceSha });
    const registeredBenchmark = await repository.registerBenchmark({
      id: "science-bench",
      displayName: "Science Bench",
      aliases: ["science_bench"],
      actor: "TARS",
    });
    assert.equal(registeredBenchmark.created, true);
    assert.equal((await repository.registerBenchmark({
      id: "science-bench",
      displayName: "Science Bench",
      aliases: ["science_bench"],
      actor: "TARS",
    })).created, false);
    await repository.registerBenchmark({
      id: "unused-bench",
      displayName: "Unused Bench",
      actor: "TARS",
    });
    await repository.appendTasks(parseAppendTasks({
      submissionId: "submission-one",
      actor: "CASE",
      benchmarkAssignments: [
        { sourceItemId: "source-task", benchmarkId: "terminal-bench" },
        { sourceItemId: "source-trace", benchmarkId: "unspecified" },
      ],
      tasks: [
        { id: "task-one", stableKey: "task-one", title: "Task one", kind: "task", format: "harbor", sourcePath: "tasks/one", artifactId: `artifact:sha256:${taskSha}`, contentSha256: taskSha, sourceItemIds: ["source-task"] },
        { id: "task-trace", stableKey: "trace-one", title: "Trace one", kind: "trace", format: "non_harbor", sourcePath: "traces/one.jsonl", artifactId: `artifact:sha256:${traceSha}`, contentSha256: traceSha, sourceItemIds: ["source-trace"] },
      ],
    }));
    await assert.rejects(
      () => repository!.removeUnusedBenchmarks({ benchmarkIds: ["terminal-bench", "unused-bench"] }),
      /Referenced benchmarks cannot be removed/,
    );
    assert.ok((await repository.listBenchmarks()).some((benchmark) => benchmark.id === "unused-bench"));
    const removedBenchmarks = await repository.removeUnusedBenchmarks({ benchmarkIds: ["unused-bench"] });
    assert.deepEqual(removedBenchmarks.removed.map((benchmark) => benchmark.id), ["unused-bench"]);
    assert.equal(removedBenchmarks.registrationEventsRemoved, 1);
    assert.ok(!(await repository.listBenchmarks()).some((benchmark) => benchmark.id === "unused-bench"));
    await assert.rejects(() => repository!.recordHarborAttempt(attempt("task-trace", evidenceSha)), RegistryConflictError);
    await repository.recordHarborAttempt(attempt("task-one", evidenceSha));
    await assert.rejects(() => repository!.recordHarborCheck(check("task-trace", evidenceSha)), RegistryConflictError);
    await repository.recordHarborCheck(check("task-one", evidenceSha));
    await repository.recordHarborFinding({ id: "finding-environment", taskId: "task-one", checkRunId: "check-environment", finding: "Harbor could not prepare the task environment." });

    const catalog = await repository.sampleCatalogSnapshot();
    const submission = catalog.vendors[0]?.submissions.find((candidate) => candidate.id === "submission-one");
    const secondSubmission = catalog.vendors[0]?.submissions.find((candidate) => candidate.id === "submission-two");
    assert.deepEqual(submission?.sourceEvents[0]?.items.map((item) => item.artifactKind), [null, "source_payload", "source_payload"]);
    assert.deepEqual(submission?.sourceEvents[0]?.items.map((item) => item.submissionRoles), [
      ["provenance"],
      ["original_vendor_file"],
      ["original_vendor_file"],
    ]);
    assert.deepEqual(secondSubmission?.sourceEvents[0]?.items.map((item) => item.id), ["source-task"]);
    assert.deepEqual(submission?.tasks.map((task) => [task.kind, task.format]), [["task", "harbor"], ["trace", "non_harbor"]]);
    assert.deepEqual(submission?.tasks.map((task) => task.benchmark), [
      { id: "terminal-bench", displayName: "Terminal-Bench" },
      { id: "unspecified", displayName: "Unspecified" },
    ]);
    assert.deepEqual(submission?.tasks.map((task) => task.gpuRequired), [false, false]);
    assert.equal(submission?.tasks[0]?.checks.environment?.outcome, "fail");
    assert.equal(submission?.tasks[0]?.checks.oracle, undefined);
    assert.equal(submission?.tasks[0]?.attempts.oracle?.status, "blocked");
    assert.equal(submission?.tasks[0]?.findings[0]?.phase, "environment");
    assert.deepEqual(submission?.tasks[1]?.checks, {});
    assert.deepEqual(submission?.tasks[1]?.attempts, {});

    const benchmarkAssignment = {
      submissionId: "submission-one",
      assignments: [
        { taskId: "task-one", benchmarkId: "science-bench" },
        { taskId: "task-trace", benchmarkId: "unspecified" },
      ],
      reason: "Apply the reviewed benchmark without replacing task versions.",
      actor: "TARS",
    };
    const benchmarkResult = await repository.assignTaskBenchmarks(benchmarkAssignment);
    assert.equal(benchmarkResult.assignmentsAdded, 1);
    assert.equal(benchmarkResult.assignmentsUnchanged, 1);
    const benchmarkedSubmission = await repository.getSampleSubmission("submission-one");
    assert.equal(benchmarkedSubmission?.tasks[0]?.id, "task-one");
    assert.deepEqual(benchmarkedSubmission?.tasks[0]?.benchmark, {
      id: "science-bench",
      displayName: "Science Bench",
    });
    assert.equal(benchmarkedSubmission?.tasks[0]?.checks.environment?.outcome, "fail");
    assert.equal(benchmarkedSubmission?.tasks[0]?.attempts.oracle?.status, "blocked");
    assert.equal(benchmarkedSubmission?.tasks[0]?.findings[0]?.phase, "environment");
    const repeatedBenchmarkResult = await repository.assignTaskBenchmarks(benchmarkAssignment);
    assert.equal(repeatedBenchmarkResult.assignmentsAdded, 0);
    assert.equal(repeatedBenchmarkResult.assignmentsUnchanged, 2);

    const gpuRequirementAssignment = {
      submissionId: "submission-one",
      assignments: [{
        taskId: "task-one",
        gpuRequired: true,
        evidence: "task.toml declares environment.gpus = 1 and gpu_types = [H100].",
      }],
      reason: "Record the declared GPU requirement without replacing the task version.",
      actor: "TARS",
    };
    const gpuRequirementResult = await repository.assignTaskGpuRequirements(gpuRequirementAssignment);
    assert.equal(gpuRequirementResult.assignmentsAdded, 1);
    assert.equal(gpuRequirementResult.assignmentsUnchanged, 0);
    const gpuSubmission = await repository.getSampleSubmission("submission-one");
    assert.equal(gpuSubmission?.tasks[0]?.gpuRequired, true);
    assert.equal(gpuSubmission?.tasks[0]?.checks.environment?.outcome, "fail");
    assert.equal(gpuSubmission?.tasks[0]?.attempts.oracle?.status, "blocked");
    assert.equal((await repository.assignTaskGpuRequirements(gpuRequirementAssignment)).assignmentsUnchanged, 1);

    const reviewedCpuRequirement = await repository.assignTaskGpuRequirements({
      submissionId: "submission-one",
      assignments: [{
        taskId: "task-one",
        gpuRequired: false,
        evidence: "A subsequent review established that the task manifest requires only CPU resources.",
      }],
      reason: "Correct the requirement through append-only history.",
      actor: "TARS",
    });
    assert.equal(reviewedCpuRequirement.assignmentsAdded, 1);
    assert.equal((await repository.getSampleSubmission("submission-one"))?.tasks[0]?.gpuRequired, false);
    assert.equal((await repository.assignTaskGpuRequirements(gpuRequirementAssignment)).assignmentsAdded, 1);

    const reconciliation = await repository.reconcileSubmissionSourceItems({
      submissionId: "submission-one",
      sourceEventId: "source-one",
      items: [
        { sourceItemId: "source-task", role: "original_vendor_file" },
        { sourceItemId: "source-trace", role: "original_vendor_file" },
      ],
      reason: "Remove the message record from the submission's downloadable source material.",
      actor: "TARS",
    });
    assert.deepEqual(reconciliation, {
      submissionId: "submission-one",
      sourceEventId: "source-one",
      previousItemCount: 3,
      itemCount: 2,
      changed: true,
    });
    const reconciledCatalog = await repository.sampleCatalogSnapshot();
    const reconciledSubmission = reconciledCatalog.vendors[0]?.submissions.find((candidate) => candidate.id === "submission-one");
    assert.deepEqual(reconciledSubmission?.sourceEvents[0]?.items.map((item) => item.id), ["source-task", "source-trace"]);

    await repository.appendTasks(parseAppendTasks({
      submissionId: "submission-one",
      actor: "CASE",
      benchmarkAssignments: [],
      tasks: [{
        id: "source-only-record",
        stableKey: "source-only-record",
        title: "Source-only record",
        kind: "task",
        format: "non_harbor",
        benchmarkId: "unspecified",
        sourcePath: "source-only/video.mp4",
        artifactId: `artifact:sha256:${traceSha}`,
        contentSha256: traceSha,
        sourceItemIds: ["source-trace"],
      }],
    }));
    const reconciliationResult = await repository.reconcileSubmissionTasks({
      submissionId: "submission-one",
      actor: "TARS",
      reason: "Correct the parsed object kinds and retire source-only material.",
      benchmarkAssignments: [],
      tasks: [
        {
          id: "task-one",
          stableKey: "task-one",
          title: "Task one",
          kind: "task",
          format: "harbor",
          benchmarkId: "terminal-bench",
          sourcePath: "tasks/one",
          artifactId: `artifact:sha256:${taskSha}`,
          contentSha256: taskSha,
          sourceItemIds: ["source-task"],
        },
        {
          id: "task-trace-v2",
          stableKey: "trace-one",
          title: "Trace one",
          kind: "trace",
          format: "non_harbor",
          benchmarkId: "unspecified",
          sourcePath: "traces/one.jsonl",
          artifactId: `artifact:sha256:${traceSha}`,
          contentSha256: traceSha,
          sourceItemIds: ["source-trace"],
        },
      ],
    });
    assert.equal(reconciliationResult.taskVersionsAdded, 1);
    assert.equal(reconciliationResult.taskVersionsUnchanged, 1);
    assert.deepEqual(reconciliationResult.retiredTaskVersionIds, ["source-only-record"]);
    assert.deepEqual(reconciliationResult.supersededTaskVersionIds.sort(), ["source-only-record", "task-trace"]);
    const reclassifiedSubmission = await repository.getSampleSubmission("submission-one");
    assert.deepEqual(reclassifiedSubmission?.tasks.map((task) => [task.id, task.kind]), [
      ["task-one", "task"],
      ["task-trace-v2", "trace"],
    ]);
    assert.equal(await repository.getSampleTask("task-trace"), null);
    assert.equal(await repository.getSampleTask("source-only-record"), null);
    const reconciledTask = await repository.getSampleTask("task-one");
    assert.deepEqual(reconciledTask?.benchmark, { id: "terminal-bench", displayName: "Terminal-Bench" });
    assert.equal(reconciledTask?.checks.environment?.outcome, "fail");
    assert.equal(reconciledTask?.attempts.oracle?.status, "blocked");
    const benchmarkHistory = await administrator.query<{ benchmark_id: string }>(
      `SELECT benchmark_id
       FROM "${schema}".registry_task_benchmark_assignments
       WHERE task_version_id = 'task-one'
       ORDER BY revision`,
    );
    assert.deepEqual(benchmarkHistory.rows.map((row) => row.benchmark_id), [
      "terminal-bench",
      "science-bench",
      "terminal-bench",
    ]);
    const gpuRequirementHistory = await administrator.query<{ gpu_required: boolean; evidence: string }>(
      `SELECT gpu_required, evidence
       FROM "${schema}".registry_task_gpu_requirement_assignments
       WHERE task_version_id = 'task-one'
       ORDER BY revision`,
    );
    assert.deepEqual(gpuRequirementHistory.rows, [
      {
        gpu_required: true,
        evidence: "task.toml declares environment.gpus = 1 and gpu_types = [H100].",
      },
      {
        gpu_required: false,
        evidence: "A subsequent review established that the task manifest requires only CPU resources.",
      },
      {
        gpu_required: true,
        evidence: "task.toml declares environment.gpus = 1 and gpu_types = [H100].",
      },
    ]);

    await repository.recordHarborCheck({
      ...check("task-one", evidenceSha),
      id: "check-environment-pass",
      outcome: "pass",
      summary: "Harbor prepared a usable environment through an approved provider adapter.",
      startedAt: "2026-08-21T02:00:00.000Z",
      completedAt: "2026-08-21T02:01:00.000Z",
    });
    const correctedCatalog = await repository.sampleCatalogSnapshot();
    const correctedTask = correctedCatalog.vendors[0]?.submissions[0]?.tasks[0];
    assert.equal(correctedTask?.checks.environment?.outcome, "pass");
    assert.equal(correctedTask?.gpuRequired, true);
    assert.deepEqual(correctedTask?.findings, []);
  } finally {
    await repository?.close();
    await administrator.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await administrator.end();
  }
});

function check(taskId: string, evidenceSha: string) {
  return { id: "check-environment", taskId, phase: "environment" as const, outcome: "fail" as const, summary: "Harbor environment setup failed.", evidenceArtifactId: `artifact:sha256:${evidenceSha}`, harborVersion: "0.21.0", modalVersion: "1.5.4", command: "case-harbor run --path /data/evaluations/input/task --agent oracle --force-build", startedAt: "2026-08-21T01:00:00.000Z", completedAt: "2026-08-21T01:01:00.000Z" };
}

function attempt(taskId: string, evidenceSha: string) {
  return { id: "attempt-oracle", taskId, phase: "oracle" as const, status: "blocked" as const, summary: "The evaluation credential was unavailable.", evidenceArtifactId: `artifact:sha256:${evidenceSha}`, harborVersion: "0.21.0", modalVersion: "1.5.4", command: "case-harbor run --path /data/evaluations/input/task --agent oracle --force-build", startedAt: "2026-08-21T00:00:00.000Z", completedAt: "2026-08-21T00:01:00.000Z" };
}

function databaseUrlWithSearchPath(databaseUrl: string, schema: string): string {
  const url = new URL(databaseUrl);
  url.searchParams.set("options", `-csearch_path=${schema}`);
  return url.toString();
}
