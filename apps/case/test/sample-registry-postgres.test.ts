import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { Pool } from "pg";
import { PostgresRegistry, RegistryConflictError } from "../src/registry/postgres.js";

const testDatabaseUrl = process.env.CASE_REGISTRY_TEST_DATABASE_URL;

test("stores submissions, tasks, four-phase Harbor results, and failed-check findings", { skip: !testDatabaseUrl }, async () => {
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
          { id: "source-task", kind: "task_package", displayName: "task.tar.gz", artifactId: `artifact:sha256:${taskSha}`, contentSha256: taskSha, fetchStatus: "snapshotted", parseStatus: "parsed", mutable: false },
          { id: "source-trace", kind: "file", displayName: "trace.jsonl", artifactId: `artifact:sha256:${traceSha}`, contentSha256: traceSha, fetchStatus: "snapshotted", parseStatus: "parsed", mutable: false },
        ],
      }],
      actor: "CASE",
    });
    await repository.registerArtifact({ id: `artifact:sha256:${evidenceSha}`, kind: "check_evidence", storageKey: `objects/${evidenceSha}`, sha256: evidenceSha });
    await repository.appendTasks({
      submissionId: "submission-one",
      actor: "CASE",
      tasks: [
        { id: "task-one", stableKey: "task-one", title: "Task one", kind: "task", format: "harbor", sourcePath: "tasks/one", artifactId: `artifact:sha256:${taskSha}`, contentSha256: taskSha, sourceItemIds: ["source-task"] },
        { id: "task-trace", stableKey: "trace-one", title: "Trace one", kind: "trace", format: "non_harbor", sourcePath: "traces/one.jsonl", artifactId: `artifact:sha256:${traceSha}`, contentSha256: traceSha, sourceItemIds: ["source-trace"] },
      ],
    });
    await assert.rejects(() => repository!.recordHarborCheck(check("task-trace", evidenceSha)), RegistryConflictError);
    await repository.recordHarborCheck(check("task-one", evidenceSha));
    await repository.recordHarborFinding({ id: "finding-build", taskId: "task-one", checkRunId: "check-build", finding: "The Dockerfile build exited with code 1." });

    const catalog = await repository.sampleCatalogSnapshot();
    const submission = catalog.vendors[0]?.submissions[0];
    assert.deepEqual(submission?.tasks.map((task) => [task.kind, task.format]), [["task", "harbor"], ["trace", "non_harbor"]]);
    assert.equal(submission?.tasks[0]?.checks.build?.outcome, "fail");
    assert.equal(submission?.tasks[0]?.checks.boot, undefined);
    assert.equal(submission?.tasks[0]?.findings[0]?.phase, "build");
    assert.deepEqual(submission?.tasks[1]?.checks, {});
  } finally {
    await repository?.close();
    await administrator.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await administrator.end();
  }
});

function check(taskId: string, evidenceSha: string) {
  return { id: "check-build", taskId, phase: "build" as const, outcome: "fail" as const, summary: "Dockerfile build failed.", evidenceArtifactId: `artifact:sha256:${evidenceSha}`, harborVersion: "0.1.0", modalVersion: "1.0.0", command: "case-harbor run --phase build --provider modal", startedAt: "2026-08-21T01:00:00.000Z", completedAt: "2026-08-21T01:01:00.000Z" };
}

function databaseUrlWithSearchPath(databaseUrl: string, schema: string): string {
  const url = new URL(databaseUrl);
  url.searchParams.set("options", `-csearch_path=${schema}`);
  return url.toString();
}
