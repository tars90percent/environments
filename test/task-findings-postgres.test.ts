import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { Pool } from "pg";
import { PostgresRegistry } from "../src/registry/postgres.js";
import type { SubmissionManifest } from "../src/registry/types.js";

const testDatabaseUrl = process.env.CASE_REGISTRY_TEST_DATABASE_URL;

test("stores only finding words and supports update and delete", { skip: !testDatabaseUrl }, async () => {
  if (!testDatabaseUrl) throw new Error("CASE_REGISTRY_TEST_DATABASE_URL is required");
  const schema = `case_task_findings_${randomUUID().replaceAll("-", "_")}`;
  const administrator = new Pool({ connectionString: testDatabaseUrl });
  let repository: PostgresRegistry | undefined;
  try {
    await administrator.query(`CREATE SCHEMA "${schema}"`);
    repository = new PostgresRegistry(databaseUrlWithSearchPath(testDatabaseUrl, schema));
    await repository.initialize();

    const columns = await administrator.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = $1 AND table_name = 'registry_task_findings'
       ORDER BY column_name`,
      [schema],
    );
    assert.deepEqual(columns.rows.map((row) => row.column_name), [
      "created_at",
      "finding",
      "id",
      "task_version_id",
      "updated_at",
      "visibility",
    ]);

    await repository.ingestSubmission(manifest());
    const created = await repository.recordTaskFinding({
      id: "finding:task-one:verifier",
      taskVersionId: "submission-one:task-one",
      finding: "The verifier reads the wrong filesystem.",
    });
    assert.deepEqual(created, { findingId: "finding:task-one:verifier", created: true });
    assert.deepEqual((await repository.getTask("submission-one:task-one", "all"))?.findings, [{
      id: "finding:task-one:verifier",
      finding: "The verifier reads the wrong filesystem.",
    }]);

    const updated = await repository.updateTaskFinding({
      id: "finding:task-one:verifier",
      finding: "The verifier now reads the modified filesystem.",
    });
    assert.deepEqual(updated, { findingId: "finding:task-one:verifier", updated: true });
    assert.equal((await repository.getTask("submission-one:task-one", "all"))?.findings[0]?.finding,
      "The verifier now reads the modified filesystem.");

    const deleted = await repository.deleteTaskFinding("finding:task-one:verifier");
    assert.deepEqual(deleted, { findingId: "finding:task-one:verifier", deleted: true });
    assert.deepEqual((await repository.getTask("submission-one:task-one", "all"))?.findings, []);

    const events = await administrator.query<{ event_type: string; payload: Record<string, unknown> }>(
      `SELECT event_type, payload FROM "${schema}".registry_status_events
       WHERE entity_type = 'task_version' AND entity_id = 'submission-one:task-one'
       ORDER BY occurred_at, created_at`,
    );
    assert.deepEqual(events.rows.map((row) => row.event_type), [
      "finding.recorded",
      "finding.updated",
      "finding.deleted",
    ]);
    assert.deepEqual(events.rows.map((row) => row.payload), [
      { findingId: "finding:task-one:verifier" },
      { findingId: "finding:task-one:verifier" },
      { findingId: "finding:task-one:verifier" },
    ]);
  } finally {
    await repository?.close();
    await administrator.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await administrator.end();
  }
});

function manifest(): SubmissionManifest {
  return {
    vendor: { id: "vendor-one", name: "Vendor One", short: "V1", description: "A vendor.", aliases: [] },
    sourceEvent: {
      id: "submission-one-source",
      channel: "workspace",
      externalRef: "workspace://submission-one",
      receivedAt: "2026-08-20T00:00:00.000Z",
    },
    batch: {
      id: "submission-one",
      date: "2026-08-20",
      label: "Submission one",
      sourceLabel: "Local integration fixture",
      taskCount: 1,
      formats: ["Harbor"],
      workflowStatus: "unchecked",
      catalogVisibility: "available",
      delta: { added: 1, removed: 0, note: "Integration test fixture." },
      metadata: { intakePurpose: "sample_evaluation" },
    },
    categories: [{
      id: "vendor-one:systems",
      name: "Systems",
      description: "Systems tasks.",
      count: 1,
      examples: ["Task one"],
    }],
    tasks: [{
      id: "submission-one:task-one",
      stableKey: "task-one",
      title: "Task one",
      categoryId: "vendor-one:systems",
      sourcePath: "task-one",
      format: "Harbor",
      workflowStatus: "unchecked",
      catalogVisibility: "available",
    }],
  };
}

function databaseUrlWithSearchPath(databaseUrl: string, schema: string): string {
  const url = new URL(databaseUrl);
  url.searchParams.set("options", `-csearch_path=${schema}`);
  return url.toString();
}
