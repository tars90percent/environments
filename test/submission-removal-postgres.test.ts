import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { Pool } from "pg";
import { PostgresRegistry } from "../src/registry/postgres.js";
import type { SubmissionManifest } from "../src/registry/types.js";

const testDatabaseUrl = process.env.CASE_REGISTRY_TEST_DATABASE_URL;

test("removes an erroneous task-bearing submission and preserves surviving task versions", { skip: !testDatabaseUrl }, async () => {
  if (!testDatabaseUrl) throw new Error("CASE_REGISTRY_TEST_DATABASE_URL is required");
  const schema = `case_submission_removal_${randomUUID().replaceAll("-", "_")}`;
  const administrator = new Pool({ connectionString: testDatabaseUrl });
  let repository: PostgresRegistry | undefined;
  try {
    await administrator.query(`CREATE SCHEMA "${schema}"`);
    repository = new PostgresRegistry(databaseUrlWithSearchPath(testDatabaseUrl, schema));
    await repository.initialize();
    await repository.ingestSubmission(manifest("erroneous-submission", "2026-08-19", [
      { stableKey: "shared-task", id: "erroneous-submission:shared-task" },
      { stableKey: "only-erroneous-task", id: "erroneous-submission:only-task" },
    ]));
    await repository.ingestSubmission(manifest("retained-submission", "2026-08-20", [
      { stableKey: "shared-task", id: "retained-submission:shared-task" },
    ], "erroneous-submission"));
    await repository.ingestSourceEnvelope({
      vendor: { id: "vendor-one", name: "Vendor One", short: "V1", description: "A vendor.", aliases: [] },
      sourceEvent: {
        id: "erroneous-submission-source",
        channel: "workspace",
        externalRef: "workspace://erroneous-submission",
        receivedAt: "2026-08-19T00:00:00.000Z",
      },
      items: [{
        id: "shared-source-item",
        kind: "document",
        displayName: "Shared source item",
        fetchStatus: "queued",
        parseStatus: "queued",
        mutable: true,
      }],
      batchLinks: [{
        batchId: "retained-submission",
        role: "supplement",
        sourceItemIds: ["shared-source-item"],
      }],
      taskLinks: [{
        taskVersionId: "retained-submission:shared-task",
        sourceItemId: "shared-source-item",
        role: "normalized_from",
      }],
    });
    await repository.ingestSourceEnvelope({
      vendor: { id: "vendor-one", name: "Vendor One", short: "V1", description: "A vendor.", aliases: [] },
      sourceEvent: {
        id: "erroneous-submission-unique-source",
        channel: "workspace",
        externalRef: "workspace://erroneous-submission/unique",
        receivedAt: "2026-08-19T00:01:00.000Z",
      },
      items: [],
      batchLinks: [{ batchId: "erroneous-submission", role: "supplement" }],
    });
    await repository.recordTaskFinding({
      id: "finding:erroneous-submission:only-task",
      taskVersionId: "erroneous-submission:only-task",
      finding: "This finding belongs to the erroneously registered task version.",
    });
    await repository.recordCheckResult({
      id: "check:erroneous-submission:only-task",
      taskVersionId: "erroneous-submission:only-task",
      definitionId: "fixture-check",
      definitionVersion: 1,
      kind: "deterministic",
      name: "Fixture check",
      description: "Integration fixture.",
      required: true,
      outcome: "pass",
      summary: "Fixture check passed.",
      runner: {},
      evidence: {},
      startedAt: "2026-08-20T00:00:00.000Z",
      completedAt: "2026-08-20T00:00:01.000Z",
    });

    const logicalTasks = await administrator.query<{ id: string; stable_key: string }>(
      `SELECT id, stable_key FROM "${schema}".registry_tasks ORDER BY stable_key`,
    );
    const sharedTaskId = logicalTasks.rows.find((row) => row.stable_key === "shared-task")?.id;
    const onlyTaskId = logicalTasks.rows.find((row) => row.stable_key === "only-erroneous-task")?.id;
    assert.ok(sharedTaskId);
    assert.ok(onlyTaskId);

    const result = await repository.removeSubmission({
      batchId: "erroneous-submission",
      disposition: "erroneous_registration",
      reason: "CASE registered a fixture submission under the wrong delivery event.",
      actor: "CASE",
    });
    assert.equal(result.disposition, "erroneous_registration");
    assert.deepEqual(result.detachedRevisionBatchIds, ["retained-submission"]);
    assert.deepEqual(result.removedTaskVersionIds, [
      "erroneous-submission:only-task",
      "erroneous-submission:shared-task",
    ]);
    assert.deepEqual(result.removedTaskIds, [onlyTaskId]);
    assert.deepEqual(result.retainedTaskIds, [sharedTaskId]);
    assert.deepEqual(result.removedSourceEventIds, ["erroneous-submission-unique-source"]);
    assert.deepEqual(result.retainedSourceEventIds, ["erroneous-submission-source"]);

    assert.equal(await repository.getBatch("erroneous-submission", "all"), null);
    assert.ok(await repository.getBatch("retained-submission", "all"));
    assert.ok(await repository.getTask("retained-submission:shared-task", "all"));
    assert.equal(await repository.getTask("erroneous-submission:only-task", "all"), null);
    assert.ok(await repository.getSourceEvent("erroneous-submission-source"));
    assert.equal(await repository.getSourceEvent("erroneous-submission-unique-source"), null);

    const rows = await administrator.query<{
      shared_first_seen: string;
      only_task_count: string;
      finding_count: string;
      check_count: string;
      work_count: string;
      shared_fetch_status: string;
      shared_parse_status: string;
      retained_revises_batch_id: string | null;
    }>(
      `SELECT
         (SELECT first_seen_batch_id FROM "${schema}".registry_tasks WHERE id = $1) AS shared_first_seen,
         (SELECT COUNT(*)::text FROM "${schema}".registry_tasks WHERE id = $2) AS only_task_count,
         (SELECT COUNT(*)::text FROM "${schema}".registry_task_findings WHERE task_version_id LIKE 'erroneous-submission:%') AS finding_count,
         (SELECT COUNT(*)::text FROM "${schema}".registry_check_runs WHERE task_version_id LIKE 'erroneous-submission:%') AS check_count,
         (SELECT COUNT(*)::text FROM "${schema}".registry_work_items
          WHERE entity_id = 'erroneous-submission' OR entity_id LIKE 'erroneous-submission:%') AS work_count,
         (SELECT fetch_status FROM "${schema}".registry_source_items WHERE id = 'shared-source-item') AS shared_fetch_status,
         (SELECT parse_status FROM "${schema}".registry_source_items WHERE id = 'shared-source-item') AS shared_parse_status,
         (SELECT revises_batch_id FROM "${schema}".registry_submission_batches WHERE id = 'retained-submission') AS retained_revises_batch_id`,
      [sharedTaskId, onlyTaskId],
    );
    assert.deepEqual(rows.rows[0], {
      shared_first_seen: "retained-submission",
      only_task_count: "0",
      finding_count: "0",
      check_count: "0",
      work_count: "0",
      shared_fetch_status: "queued",
      shared_parse_status: "queued",
      retained_revises_batch_id: null,
    });

    const tombstone = await administrator.query<{ actor: string; payload: Record<string, unknown> }>(
      `SELECT actor, payload FROM "${schema}".registry_status_events
       WHERE entity_type = 'removed_submission' AND entity_id = 'erroneous-submission'`,
    );
    assert.equal(tombstone.rows[0]?.actor, "CASE");
    assert.deepEqual(tombstone.rows[0]?.payload, {
      disposition: "erroneous_registration",
      reason: "CASE registered a fixture submission under the wrong delivery event.",
      vendorId: "vendor-one",
      detachedRevisionBatchIds: ["retained-submission"],
      removedTaskVersionIds: ["erroneous-submission:only-task", "erroneous-submission:shared-task"],
      removedTaskIds: [onlyTaskId],
      retainedTaskIds: [sharedTaskId],
      removedSourceEventIds: ["erroneous-submission-unique-source"],
      retainedSourceEventIds: ["erroneous-submission-source"],
    });
    const revisionEvent = await administrator.query<{ payload: Record<string, unknown> }>(
      `SELECT payload FROM "${schema}".registry_status_events
       WHERE entity_type = 'submission_batch'
         AND entity_id = 'retained-submission'
         AND event_type = 'submission.revision_reference_removed'`,
    );
    assert.deepEqual(revisionEvent.rows[0]?.payload, {
      disposition: "erroneous_registration",
      reason: "CASE registered a fixture submission under the wrong delivery event.",
      removedSubmissionId: "erroneous-submission",
    });
  } finally {
    await repository?.close();
    await administrator.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await administrator.end();
  }
});

function manifest(
  batchId: string,
  date: string,
  tasks: Array<{ stableKey: string; id: string }>,
  revisesBatchId?: string,
): SubmissionManifest {
  return {
    vendor: { id: "vendor-one", name: "Vendor One", short: "V1", description: "A vendor.", aliases: [] },
    sourceEvent: {
      id: `${batchId}-source`,
      channel: "workspace",
      externalRef: `workspace://${batchId}`,
      receivedAt: `${date}T00:00:00.000Z`,
    },
    batch: {
      id: batchId,
      date,
      label: batchId,
      sourceLabel: `${batchId}-source`,
      taskCount: tasks.length,
      formats: ["Harbor"],
      workflowStatus: "unchecked",
      catalogVisibility: "available",
      revisesBatchId,
      delta: { added: tasks.length, removed: 0, note: "Integration test fixture." },
      metadata: { intakePurpose: "sample_evaluation" },
    },
    categories: [{
      id: "vendor-one:systems",
      name: "Systems",
      description: "Systems tasks.",
      count: tasks.length,
      examples: tasks.map((task) => task.stableKey),
    }],
    tasks: tasks.map((task) => ({
      id: task.id,
      stableKey: task.stableKey,
      title: task.stableKey,
      categoryId: "vendor-one:systems",
      sourcePath: task.stableKey,
      format: "Harbor",
      workflowStatus: "unchecked",
      catalogVisibility: "available",
    })),
  };
}

function databaseUrlWithSearchPath(databaseUrl: string, schema: string): string {
  const url = new URL(databaseUrl);
  url.searchParams.set("options", `-csearch_path=${schema}`);
  return url.toString();
}
