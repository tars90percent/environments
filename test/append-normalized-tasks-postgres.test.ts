import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { Pool } from "pg";
import { startRegistryServer, type RegistryServer } from "../src/registry/api.js";
import { PostgresRegistry } from "../src/registry/postgres.js";
import type { AppendNormalizedTasksInput, SubmissionManifest } from "../src/registry/types.js";

const testDatabaseUrl = process.env.CASE_REGISTRY_TEST_DATABASE_URL;

test("appends immutable normalized task versions to an attachment-first submission", { skip: !testDatabaseUrl }, async () => {
  if (!testDatabaseUrl) throw new Error("CASE_REGISTRY_TEST_DATABASE_URL is required");
  const schema = `case_append_normalized_${randomUUID().replaceAll("-", "_")}`;
  const administrator = new Pool({ connectionString: testDatabaseUrl });
  let repository: PostgresRegistry | undefined;
  let server: RegistryServer | undefined;
  try {
    await administrator.query(`CREATE SCHEMA "${schema}"`);
    repository = new PostgresRegistry(databaseUrlWithSearchPath(testDatabaseUrl, schema));
    await repository.initialize();
    await repository.ingestSubmission(emptyManifest());

    const packageSha256 = "a".repeat(64);
    const packageArtifactId = `artifact:sha256:${packageSha256}`;
    await repository.registerArtifact({
      id: packageArtifactId,
      kind: "task_package",
      storageKey: `objects/sha256/aa/${packageSha256}`,
      sha256: packageSha256,
      sizeBytes: 1024,
      contentType: "application/x-tar",
    });
    await repository.ingestSourceEnvelope({
      vendor: emptyManifest().vendor,
      sourceEvent: {
        id: "normalization-source",
        channel: "workspace",
        externalRef: "workspace://normalization-source",
        receivedAt: "2026-08-19T00:00:00.000Z",
      },
      items: [{
        id: "source-task-package-one",
        kind: "task_package",
        displayName: "Task package one",
        artifactId: packageArtifactId,
        contentSha256: packageSha256,
        sizeBytes: 1024,
        fetchStatus: "snapshotted",
        parseStatus: "parsed",
        mutable: false,
      }],
      batchLinks: [{
        batchId: "vendor-one-attachment-first",
        role: "metadata",
        sourceItemIds: ["source-task-package-one"],
      }],
    });

    const adminToken = "admin-token-with-at-least-32-characters";
    server = await startRegistryServer({
      repository,
      adminToken,
      catalogToken: "catalog-token-with-at-least-32-characters",
      reviewToken: "review-token-with-at-least-32-characters",
      uploadToken: "upload-token-with-at-least-32-characters",
      host: "127.0.0.1",
      port: 0,
    });

    const input = normalizedTasks(packageSha256);
    const first = await api(server.url, adminToken, "/v1/intake/normalized-tasks", input);
    assert.equal(first.status, 200);
    assert.equal(first.body.categoriesAdded, 1);
    assert.equal(first.body.taskVersionsAdded, 1);

    const replay = await api(server.url, adminToken, "/v1/intake/normalized-tasks", input);
    assert.equal(replay.status, 200);
    assert.equal(replay.body.categoriesAdded, 0);
    assert.equal(replay.body.taskVersionsAdded, 0);

    const batch = await repository.getBatch("vendor-one-attachment-first", "all");
    assert.equal(batch?.declaredTaskCount, 0);
    assert.equal(batch?.taskCount, 1);
    assert.equal(batch?.categories[0]?.tasks[0]?.artifactId, packageArtifactId);
    assert.equal(batch?.categories[0]?.tasks[0]?.contentSha256, packageSha256);
    assert.deepEqual(batch?.categories[0]?.tasks[0]?.sourceItemIds, ["source-task-package-one"]);

    const row = await administrator.query<{
      artifact_id: string;
      event_count: string;
      work_count: string;
    }>(
      `SELECT tv.artifact_id,
              (SELECT COUNT(*)::text FROM "${schema}".registry_status_events
               WHERE entity_type = 'submission_batch'
                 AND entity_id = 'vendor-one-attachment-first'
                 AND event_type = 'normalization.tasks_appended') AS event_count,
              (SELECT COUNT(*)::text FROM "${schema}".registry_work_items
               WHERE entity_type = 'submission_batch'
                 AND entity_id = 'vendor-one-attachment-first'
                 AND payload->>'reason' = 'normalized_tasks_appended') AS work_count
       FROM "${schema}".registry_task_versions tv
       WHERE tv.id = 'vendor-one-attachment-first:task-one'`,
    );
    assert.equal(row.rows[0]?.artifact_id, packageArtifactId);
    assert.equal(row.rows[0]?.event_count, "1");
    assert.equal(row.rows[0]?.work_count, "1");

    const conflicting = await api(server.url, adminToken, "/v1/intake/normalized-tasks", {
      ...input,
      tasks: [{ ...input.tasks[0], sourcePath: "different/path" }],
    });
    assert.equal(conflicting.status, 409);

    const unrelated = await api(server.url, adminToken, "/v1/intake/normalized-tasks", {
      ...input,
      tasks: [{ ...input.tasks[0], sourceItemIds: ["source-item-not-linked"] }],
    });
    assert.equal(unrelated.status, 409);

    await repository.ingestSubmission(catalogFirstManifest());
    const classification = {
      batchId: "vendor-one-catalog-first",
      purpose: "sample_evaluation",
      sourceEventIds: ["catalog-first-source"],
      reason: "The governing source records this legacy delivery as an evaluation sample.",
      actor: "TARS/CASE",
    };
    const classified = await api(server.url, adminToken, "/v1/intake/classify-submission", classification);
    assert.equal(classified.status, 200);
    assert.equal(classified.body.changed, true);
    const classificationReplay = await api(server.url, adminToken, "/v1/intake/classify-submission", classification);
    assert.equal(classificationReplay.status, 200);
    assert.equal(classificationReplay.body.changed, false);

    const finalizedSha256 = "b".repeat(64);
    const finalizedArtifactId = `artifact:sha256:${finalizedSha256}`;
    await repository.registerArtifact({
      id: finalizedArtifactId,
      kind: "task_package",
      storageKey: `objects/sha256/bb/${finalizedSha256}`,
      sha256: finalizedSha256,
      sizeBytes: 2048,
      contentType: "application/x-tar",
    });
    await repository.ingestSourceEnvelope({
      vendor: catalogFirstManifest().vendor,
      sourceEvent: {
        id: "catalog-finalization-source",
        channel: "workspace",
        externalRef: "case-normalization://vendor-one-catalog-first",
        receivedAt: "2026-08-20T00:00:00.000Z",
      },
      items: [{
        id: "source-catalog-task-package",
        kind: "task_package",
        displayName: "Catalog task package",
        artifactId: finalizedArtifactId,
        contentSha256: finalizedSha256,
        sizeBytes: 2048,
        fetchStatus: "snapshotted",
        parseStatus: "parsed",
        mutable: false,
      }],
      batchLinks: [{
        batchId: "vendor-one-catalog-first",
        role: "metadata",
        sourceItemIds: ["source-catalog-task-package"],
      }],
    });
    const finalization = normalizedCatalogTask(finalizedSha256);
    const finalized = await api(server.url, adminToken, "/v1/intake/normalized-tasks", finalization);
    assert.equal(finalized.status, 200);
    assert.equal(finalized.body.taskVersionsAdded, 0);
    assert.equal(finalized.body.taskVersionsFinalized, 1);

    const finalizedReplay = await api(server.url, adminToken, "/v1/intake/normalized-tasks", finalization);
    assert.equal(finalizedReplay.status, 200);
    assert.equal(finalizedReplay.body.taskVersionsFinalized, 0);

    const finalizedBatch = await repository.getBatch("vendor-one-catalog-first", "all");
    assert.equal(finalizedBatch?.taskCount, 1);
    assert.equal(finalizedBatch?.categories[0]?.tasks[0]?.artifactId, finalizedArtifactId);
    assert.equal(finalizedBatch?.categories[0]?.tasks[0]?.workflowStatus, "unchecked");

    const finalizedRow = await administrator.query<{
      metadata: Record<string, unknown>;
      event_count: string;
    }>(
      `SELECT tv.metadata,
              (SELECT COUNT(*)::text FROM "${schema}".registry_status_events
               WHERE entity_type = 'task_version'
                 AND entity_id = 'vendor-one-catalog-first:catalog-task'
                 AND event_type = 'normalization.task_finalized') AS event_count
       FROM "${schema}".registry_task_versions tv
       WHERE tv.id = 'vendor-one-catalog-first:catalog-task'`,
    );
    assert.deepEqual(finalizedRow.rows[0]?.metadata, {
      discoveredFrom: "catalog",
      normalizationOutcome: "already_harbor",
    });
    assert.equal(finalizedRow.rows[0]?.event_count, "1");
  } finally {
    await server?.close();
    await repository?.close();
    await administrator.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await administrator.end();
  }
});

function catalogFirstManifest(): SubmissionManifest {
  return {
    vendor: { id: "vendor-one", name: "Vendor One", short: "V1", description: "A vendor.", aliases: [] },
    sourceEvent: {
      id: "catalog-first-source",
      channel: "workspace",
      externalRef: "workspace://catalog-first-source",
      receivedAt: "2026-08-19T00:00:00.000Z",
    },
    batch: {
      id: "vendor-one-catalog-first",
      date: "2026-08-19",
      label: "Catalog-first sample",
      sourceLabel: "catalog-first-source",
      taskCount: 1,
      formats: ["Harbor"],
      workflowStatus: "received",
      catalogVisibility: "available",
      delta: { added: 1, removed: 0, changedFiles: 1, note: "Task discovered before its exact package was bound." },
      metadata: { legacyImport: true },
    },
    categories: [{
      id: "vendor-one:catalog-systems",
      name: "Catalog systems",
      description: "Systems tasks discovered from a catalog.",
      count: 1,
      examples: ["Catalog task"],
    }],
    tasks: [{
      id: "vendor-one-catalog-first:catalog-task",
      stableKey: "catalog-task",
      title: "Catalog task",
      categoryId: "vendor-one:catalog-systems",
      sourcePath: "delivery/catalog-task",
      format: "Harbor",
      workflowStatus: "received",
      catalogVisibility: "available",
      metadata: { discoveredFrom: "catalog" },
    }],
  };
}

function normalizedCatalogTask(sha256: string): AppendNormalizedTasksInput {
  return {
    batchId: "vendor-one-catalog-first",
    categories: [{
      id: "vendor-one:catalog-systems",
      name: "Catalog systems",
      description: "Systems tasks discovered from a catalog.",
      count: 1,
      examples: ["Catalog task"],
    }],
    tasks: [{
      id: "vendor-one-catalog-first:catalog-task",
      stableKey: "catalog-task",
      title: "Catalog task",
      categoryId: "vendor-one:catalog-systems",
      sourcePath: "delivery/catalog-task",
      format: "Harbor",
      artifactId: `artifact:sha256:${sha256}`,
      contentSha256: sha256,
      sourceItemIds: ["source-catalog-task-package"],
      workflowStatus: "unchecked",
      catalogVisibility: "available",
      metadata: { normalizationOutcome: "already_harbor" },
    }],
    reason: "Bind the exact immutable package to the previously discovered task record.",
    actor: "TARS/CASE",
  };
}

function emptyManifest(): SubmissionManifest {
  return {
    vendor: { id: "vendor-one", name: "Vendor One", short: "V1", description: "A vendor.", aliases: [] },
    sourceEvent: {
      id: "attachment-source",
      channel: "workspace",
      externalRef: "workspace://attachment-source",
      receivedAt: "2026-08-19T00:00:00.000Z",
    },
    batch: {
      id: "vendor-one-attachment-first",
      date: "2026-08-19",
      label: "Attachment-first sample",
      sourceLabel: "Attachment capture",
      taskCount: 0,
      formats: ["ZIP"],
      workflowStatus: "unchecked",
      catalogVisibility: "available",
      delta: { added: 0, removed: 0, changedFiles: 1, note: "Task boundaries pending." },
      metadata: { intakePurpose: "sample_evaluation" },
    },
    categories: [],
    tasks: [],
  };
}

function normalizedTasks(sha256: string): AppendNormalizedTasksInput {
  return {
    batchId: "vendor-one-attachment-first",
    categories: [{
      id: "vendor-one:normalized:systems",
      name: "Normalized systems",
      description: "Interpreted systems tasks.",
      count: 1,
      examples: ["Task one"],
    }],
    tasks: [{
      id: "vendor-one-attachment-first:task-one",
      stableKey: "task-one",
      title: "Task one",
      summary: "An interpreted task.",
      categoryId: "vendor-one:normalized:systems",
      sourcePath: "delivery/tasks/task-one",
      format: "Harbor",
      artifactId: `artifact:sha256:${sha256}`,
      contentSha256: sha256,
      sourceItemIds: ["source-task-package-one"],
      workflowStatus: "unchecked",
      catalogVisibility: "log_only",
      metadata: { normalizationOutcome: "already_harbor" },
    }],
    reason: "Register the interpreted task after attachment-first capture.",
    actor: "TARS/CASE",
  };
}

function databaseUrlWithSearchPath(databaseUrl: string, schema: string): string {
  const url = new URL(databaseUrl);
  url.searchParams.set("options", `-csearch_path=${schema}`);
  return url.toString();
}

async function api(
  baseUrl: string,
  token: string,
  path: string,
  body: unknown,
): Promise<{ status: number; body: Record<string, any> }> {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() as Record<string, any> };
}
