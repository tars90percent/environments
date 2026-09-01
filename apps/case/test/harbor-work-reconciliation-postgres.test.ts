import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { Pool } from "pg";
import { PostgresRegistry, RegistryConflictError } from "../src/registry/postgres.js";
import { parseAppendTasks } from "../src/registry/validation.js";

const testDatabaseUrl = process.env.CASE_REGISTRY_TEST_DATABASE_URL;

test("reconciles only exact resolved Harbor work items", { skip: !testDatabaseUrl }, async () => {
  if (!testDatabaseUrl) throw new Error("CASE_REGISTRY_TEST_DATABASE_URL is required");
  const schema = `case_harbor_work_${randomUUID().replaceAll("-", "_")}`;
  const administrator = new Pool({ connectionString: testDatabaseUrl });
  let repository: PostgresRegistry | undefined;
  try {
    await administrator.query(`CREATE SCHEMA "${schema}"`);
    repository = new PostgresRegistry(databaseUrlWithSearchPath(testDatabaseUrl, schema));
    await repository.initialize();
    const taskSha = "a".repeat(64);
    const evidenceSha = "b".repeat(64);
    await repository.captureSubmission({
      vendor: { id: "vendor-one", name: "Vendor One", short: "V1", description: "Fixture", aliases: [] },
      submission: { id: "submission-one", date: "2026-09-01", label: "Sample", sourceLabel: "Email", formats: [] },
      artifacts: [{ id: `artifact:sha256:${taskSha}`, kind: "source_payload", storageKey: `objects/${taskSha}`, sha256: taskSha }],
      sources: [{
        sourceEvent: { id: "source-one", channel: "email", externalRef: "mail://source-one", sender: "Vendor One", receivedAt: "2026-09-01T00:00:00.000Z" },
        items: [{ id: "source-task", kind: "task_package", displayName: "tasks.tar.gz", artifactId: `artifact:sha256:${taskSha}`, contentSha256: taskSha, fetchStatus: "snapshotted", parseStatus: "parsed", mutable: false }],
      }],
      actor: "CASE",
    });
    await repository.registerArtifact({ id: `artifact:sha256:${evidenceSha}`, kind: "check_evidence", storageKey: `objects/${evidenceSha}`, sha256: evidenceSha });
    await repository.appendTasks(parseAppendTasks({
      submissionId: "submission-one",
      actor: "CASE",
      benchmarkAssignments: [{ sourceItemId: "source-task", benchmarkId: "terminal-bench" }],
      tasks: [
        { id: "task-resolved", stableKey: "task-resolved", title: "Resolved", kind: "task", format: "harbor", sourcePath: "tasks/resolved", artifactId: `artifact:sha256:${taskSha}`, contentSha256: taskSha, sourceItemIds: ["source-task"] },
        { id: "task-unresolved", stableKey: "task-unresolved", title: "Unresolved", kind: "task", format: "harbor", sourcePath: "tasks/unresolved", artifactId: `artifact:sha256:${taskSha}`, contentSha256: taskSha, sourceItemIds: ["source-task"] },
        { id: "task-native", stableKey: "task-native", title: "Native", kind: "task", format: "non_harbor", sourcePath: "tasks/native", artifactId: `artifact:sha256:${taskSha}`, contentSha256: taskSha, sourceItemIds: ["source-task"] },
      ],
    }));
    await repository.recordHarborAttempt({
      id: "attempt-environment",
      taskId: "task-resolved",
      phase: "environment",
      status: "blocked",
      summary: "The provider could not enforce the declared policy.",
      evidenceArtifactId: `artifact:sha256:${evidenceSha}`,
      harborVersion: "0.21.0",
      modalVersion: "1.5.4",
      command: "case-harbor run --agent oracle --provider modal",
      startedAt: "2026-09-01T00:00:00.000Z",
      completedAt: "2026-09-01T00:01:00.000Z",
    });

    const input = {
      taskIds: ["task-resolved"],
      reason: "The Environment attempt fully accounts for this work item.",
      actor: "CASE",
    };
    const result = await repository.reconcileHarborWorkItems(input);
    assert.equal(result.itemsCompleted, 1);
    assert.equal(result.itemsUnchanged, 0);
    assert.equal((await repository.reconcileHarborWorkItems(input)).itemsUnchanged, 1);
    await assert.rejects(() => repository!.reconcileHarborWorkItems({ ...input, taskIds: ["task-unresolved"] }), /no Environment check or attempt/);
    await assert.rejects(() => repository!.reconcileHarborWorkItems({ ...input, taskIds: ["task-native"] }), RegistryConflictError);

    const workItems = await administrator.query<{ entity_id: string; status: string }>(
      `SELECT entity_id, status FROM "${schema}".registry_work_items WHERE kind = 'harbor_checks' ORDER BY entity_id`,
    );
    assert.deepEqual(workItems.rows, [
      { entity_id: "task-resolved", status: "completed" },
      { entity_id: "task-unresolved", status: "queued" },
    ]);
    const events = await administrator.query<{ event_type: string; actor: string }>(
      `SELECT event_type, actor FROM "${schema}".registry_status_events WHERE entity_id = 'task-resolved' AND event_type = 'harbor_checks.work_reconciled'`,
    );
    assert.deepEqual(events.rows, [{ event_type: "harbor_checks.work_reconciled", actor: "CASE" }]);
  } finally {
    await repository?.close();
    await administrator.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await administrator.end();
  }
});

function databaseUrlWithSearchPath(databaseUrl: string, schema: string): string {
  const url = new URL(databaseUrl);
  url.searchParams.set("options", `-csearch_path=${schema}`);
  return url.toString();
}
