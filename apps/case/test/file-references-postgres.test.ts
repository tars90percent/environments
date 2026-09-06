import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { Pool } from "pg";
import { PostgresRegistry } from "../src/registry/postgres.js";
import { registryMigrations } from "../src/registry/migrations.js";
import { registryFileReferences } from "../src/registry/file-references.js";
import { parseAppendTasks, parseCaptureSubmission, parseReconcileSubmissionTasks, parseSourceEnvelope } from "../src/registry/validation.js";

const databaseUrl = process.env.CASE_REGISTRY_TEST_DATABASE_URL;
const execute = promisify(execFile);

test("upgrades existing files without rewriting history and uses short references across mixed deliveries", { skip: !databaseUrl }, async () => {
  const schema = `case_files_${randomUUID().replaceAll("-", "_")}`;
  const administrator = new Pool({ connectionString: databaseUrl });
  const scoped = new URL(databaseUrl!);
  scoped.searchParams.set("options", `-c search_path=${schema}`);
  const sql = new Pool({ connectionString: scoped.toString() });
  const repository = new PostgresRegistry(scoped.toString());
  try {
    await administrator.query(`CREATE SCHEMA "${schema}"`);
    await sql.query("CREATE TABLE registry_migrations(id text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");
    for (const migration of registryMigrations.filter((migration) => migration.id !== "025_file_references")) {
      await sql.query(migration.sql);
      await sql.query("INSERT INTO registry_migrations(id) VALUES ($1)", [migration.id]);
    }
    const oldId = `artifact:sha256:${"a".repeat(64)}`;
    await sql.query(`INSERT INTO registry_artifacts(id, kind, storage_key, sha256, size_bytes, content_type, metadata)
      VALUES ($1, 'source_payload', $2, $3, 321, 'application/pdf', $4::jsonb)`,
    [oldId, "objects/sha256/aa/original-location", "a".repeat(64), JSON.stringify({ originalName: "交付清单.pdf", source: "vendor email", note: "keep all original metadata" })]);
    const before = (await sql.query("SELECT to_jsonb(a) AS value FROM registry_artifacts a")).rows[0].value;
    await repository.initialize();
    await repository.initialize();
    const after = (await sql.query("SELECT to_jsonb(a) - 'reference' AS value FROM registry_artifacts a")).rows[0].value;
    assert.deepEqual(after, before);
    const file = await repository.getArtifact(oldId);
    assert.match(file!.reference!, /^file-\d+$/);
    assert.deepEqual(await repository.getArtifact(file!.reference!), file);
    const freshReference = await repository.reserveFileReference();
    assert.notEqual(freshReference, file!.reference);
    await repository.registerArtifact({ id: freshReference, reference: freshReference, kind: "trajectory", storageKey: `files/${freshReference}/attempt.jsonl`, sha256: "b".repeat(64), metadata: { originalName: "attempt.jsonl" } });

    const vendor = { id: "mixed-vendor", name: "Mixed Vendor", short: "MV", description: "Test fixture" };
    const sourceEvent = { id: "vendor-mail", channel: "email", externalRef: "mail://delivery/one", sender: "Vendor contact", receivedAt: "2026-09-01T09:00:00Z" };
    const pdf = { id: "delivery-pdf", kind: "pdf", displayName: "交付清单.pdf", artifactId: file!.reference, fetchStatus: "snapshotted", parseStatus: "not_requested", mutable: false };
    const sheet = { id: "delivery-sheet", kind: "spreadsheet", displayName: "Sample index", locator: "https://docs.google.com/spreadsheets/d/example", fetchStatus: "external_only", parseStatus: "not_requested", mutable: true };
    const drive = { id: "delivery-drive", kind: "folder", displayName: "Mixed sample folder", locator: "https://drive.google.com/drive/folders/example", fetchStatus: "external_only", parseStatus: "not_requested", mutable: true };
    const input = {
      purpose: "sample_evaluation", vendor,
      submission: { id: "mixed-delivery", date: "2026-09-01", label: "PDF, spreadsheet and mixed folder", sourceLabel: "Vendor email" },
      sources: [{ sourceEvent, items: [pdf, sheet, drive], relations: [
        { fromItemId: pdf.id, toItemId: sheet.id, relation: "links_to" },
        { fromItemId: sheet.id, toItemId: drive.id, relation: "links_to" },
      ] }], actor: "CASE",
    };
    const capture = parseCaptureSubmission(await registryFileReferences(repository, input, "input"));
    assert.equal((await repository.captureSubmission(capture)).created, true);
    assert.equal((await repository.captureSubmission(capture)).created, false);
    assert.equal((await repository.getSampleSubmission("mixed-delivery"))!.tasks.length, 0);

    // Discover more material later; preserve all earlier nodes and their relationships.
    await sql.query("UPDATE registry_source_events SET metadata = '{\"originalContext\":\"retained\"}'::jsonb WHERE id = $1", [sourceEvent.id]);
    const trace = { id: "trace-file", kind: "file", displayName: "attempt.jsonl", artifactId: freshReference, fetchStatus: "snapshotted", parseStatus: "parsed", mutable: false };
    const expanded = parseSourceEnvelope(await registryFileReferences(repository, {
      vendor, sourceEvent, items: [drive, trace], relations: [{ fromItemId: drive.id, toItemId: trace.id, relation: "contains" }],
      submissionLinks: [{ submissionId: "mixed-delivery", role: "supplement", sourceItemIds: [drive.id, trace.id] }],
    }, "input"));
    await repository.ingestSourceEnvelope(expanded);
    await repository.ingestSourceEnvelope(expanded);
    const source = await repository.getSourceEvent(sourceEvent.id);
    assert.equal(source!.items.length, 4);
    assert.equal(source!.relations.length, 3);
    assert.deepEqual((await sql.query("SELECT metadata FROM registry_source_events WHERE id = $1", [sourceEvent.id])).rows[0].metadata, { originalContext: "retained" });
    await assert.rejects(() => repository.ingestSourceEnvelope({ ...expanded, sourceEvent: { ...expanded.sourceEvent, sender: "Changed sender" } }), /different immutable contents/);

    const taskInput = parseAppendTasks({ submissionId: "mixed-delivery", actor: "CASE", tasks: [{
      id: "trace-version-one", stableKey: "attempt-one", title: "Attempt one", kind: "trace", format: "non_harbor",
      benchmarkId: "unspecified", sourcePath: "mixed/attempt.jsonl", artifactId: freshReference, sourceItemIds: [trace.id],
    }, {
      id: "task-version-one", stableKey: "pdf-work-unit", title: "Work unit described in the PDF", kind: "task", format: "non_harbor",
      benchmarkId: "unspecified", sourcePath: "交付清单.pdf", artifactId: file!.reference!, sourceItemIds: [pdf.id],
    }] });
    assert.equal(taskInput.tasks[0]!.contentSha256, undefined);
    assert.equal((await repository.appendTasks(taskInput)).tasksAdded, 2);
    assert.equal((await repository.appendTasks(taskInput)).tasksAdded, 0);
    assert.equal((await repository.getSampleTask("trace-version-one"))!.contentSha256, "b".repeat(64));
    await assert.rejects(() => repository.appendTasks({ ...taskInput, tasks: [{ ...taskInput.tasks[0]!, contentSha256: "c".repeat(64) }] }), /exact immutable artifact/);

    // Older catalogs contain versions whose source evidence holds the file link.
    await sql.query("UPDATE registry_task_versions SET artifact_id = NULL WHERE id = 'trace-version-one'");
    const retainedLegacy = parseReconcileSubmissionTasks({ ...taskInput, tasks: [
      { ...taskInput.tasks[0], artifactId: null }, taskInput.tasks[1],
    ], reason: "Retain the original parsed items" });
    assert.equal((await repository.reconcileSubmissionTasks(retainedLegacy)).taskVersionsUnchanged, 2);
    assert.equal((await repository.getSampleTask("trace-version-one"))!.contentSha256, "b".repeat(64));
    await sql.query("UPDATE registry_task_versions SET artifact_id = $1 WHERE id = 'trace-version-one'", [freshReference]);

    const interaction = { id: "sample-delivery", vendorId: vendor.id, kind: "sample" as const, eventType: "sample_delivered", title: "Sample arrived", summary: "PDF and spreadsheet link to a mixed drive folder.", channel: "email" as const, evidence: "direct" as const, visibility: "portal" as const, occurredAt: sourceEvent.receivedAt, sourceEventIds: [sourceEvent.id], submissionIds: ["mixed-delivery"], actor: "CASE" };
    await repository.recordVendorInteraction(interaction);
    assert.equal((await repository.recordVendorInteraction(interaction)).created, false);
    await repository.updateVendorInteraction({ id: interaction.id, changes: { summary: "Trace discovered in the folder; PDF and source links retained." }, reason: "Inspect the delivery", actor: "CASE" });
    const timeline = await repository.getVendorTimeline(vendor.id);
    assert.equal(timeline!.interactions.length, 1);
    assert.equal(timeline!.history.filter((change) => change.action === "interaction_updated").length, 1);

    // An identical decision made again later is a new event, not a duplicate-key failure.
    for (const benchmarkId of ["terminal-bench", "unspecified", "terminal-bench"]) {
      await repository.assignTaskBenchmarks({ submissionId: "mixed-delivery", assignments: [{ taskId: "trace-version-one", benchmarkId }], actor: "CASE", reason: "Review direction" });
    }
    for (const gpuRequired of [true, false, true]) {
      await repository.assignTaskGpuRequirements({ submissionId: "mixed-delivery", assignments: [{ taskId: "task-version-one", gpuRequired, evidence: "Researcher declaration" }], actor: "CASE", reason: "Review runtime needs" });
    }
    assert.equal((await sql.query("SELECT count(*)::int AS n FROM registry_task_benchmark_assignments")).rows[0].n, 5);
    assert.equal((await sql.query("SELECT count(*)::int AS n FROM registry_task_gpu_requirement_assignments")).rows[0].n, 3);

    const cli = fileURLToPath(new URL("../src/registry-cli.ts", import.meta.url));
    const env = { ...process.env, DATABASE_URL: scoped.toString() };
    const compact = JSON.parse((await execute(process.execPath, ["--import", "tsx", cli, "catalog"], { env })).stdout);
    assert.doesNotMatch(JSON.stringify(compact), /artifact:sha256:|contentSha256/);
    assert.equal(compact.vendors[0].submissions[0].tasks.find((task: { id: string }) => task.id === "trace-version-one").artifactId, freshReference);
    const raw = JSON.parse((await execute(process.execPath, ["--import", "tsx", cli, "catalog", "--raw"], { env })).stdout);
    assert.match(JSON.stringify(raw), /artifact:sha256:/);
    assert.equal(raw.vendors[0].submissions[0].sourceEvents[0].sender, "Vendor contact");
  } finally {
    await repository.close();
    await sql.end();
    await administrator.query(`DROP SCHEMA "${schema}" CASCADE`);
    await administrator.end();
  }
});
