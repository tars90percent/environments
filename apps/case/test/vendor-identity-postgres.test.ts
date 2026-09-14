import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { Pool } from "pg";
import { PostgresRegistry } from "../src/registry/postgres.js";
import { parseRenameVendorId } from "../src/registry/vendor-identity.js";

test("vendor rename requires a canonical ID and an explicit audit reason", () => {
  const input = { vendorId: "old-vendor", newVendorId: "new-vendor", actor: "researcher", reason: "Use the company name" };
  assert.deepEqual(parseRenameVendorId(input), input);
  for (const newVendorId of ["New Vendor", "../vendor", "", " new-vendor", "New-Vendor"]) {
    assert.throws(() => parseRenameVendorId({ ...input, newVendorId }));
  }
  assert.throws(() => parseRenameVendorId({ ...input, reason: "" }));
  assert.throws(() => parseRenameVendorId({ ...input, deleteFiles: true }));
});

const databaseUrl = process.env.CASE_REGISTRY_TEST_DATABASE_URL;
test("renames vendor ownership atomically while preserving deliveries, timeline history, identities and storage", { skip: !databaseUrl }, async () => {
  const schema = `case_vendor_identity_${randomUUID().replaceAll("-", "_")}`;
  const admin = new Pool({ connectionString: databaseUrl });
  let repository: PostgresRegistry | undefined;
  let sql: Pool | undefined;
  try {
    await admin.query(`CREATE SCHEMA "${schema}"`);
    const scopedUrl = new URL(databaseUrl!);
    scopedUrl.searchParams.set("options", `-csearch_path=${schema}`);
    repository = new PostgresRegistry(scopedUrl.toString());
    sql = new Pool({ connectionString: scopedUrl.toString() });
    await repository.initialize();
    const capture = {
      vendor: { id: "old-vendor", name: "Company", short: "Company", description: "Fixture" },
      submission: { id: "old-vendor-delivery", date: "2026-09-14", label: "Sample", sourceLabel: "Email", formats: [] },
      artifacts: [{ id: "old-vendor/archive.zip", kind: "source_payload" as const, storageKey: "old-vendor/archive.zip", sha256: "a".repeat(64) }],
      sources: [{
        sourceEvent: { id: "old-vendor-email", channel: "email" as const, externalRef: "email://fixture", receivedAt: "2026-09-14T00:00:00Z" },
        items: [{ id: "old-vendor-package", kind: "task_package" as const, displayName: "archive.zip", artifactId: "old-vendor/archive.zip", fetchStatus: "snapshotted" as const, parseStatus: "parsed" as const, mutable: false }],
      }],
      actor: "researcher",
    };
    await repository.captureSubmission(capture);
    await repository.appendTasks({
      submissionId: capture.submission.id, actor: "researcher", benchmarkAssignments: [],
      tasks: [{ id: "old-vendor-task-v1", stableKey: "science-task", title: "Science task", kind: "task", format: "harbor", benchmarkId: "unspecified", sourcePath: "tasks/science-task", artifactId: "old-vendor/archive.zip", sourceItemIds: ["old-vendor-package"] }],
    });
    await repository.recordVendorInteraction({
      id: "old-vendor-delivery-note", vendorId: "old-vendor", kind: "sample", eventType: "sample_delivered",
      title: "Sample arrived", summary: "Original delivery retained", channel: "email", evidence: "direct", visibility: "portal",
      occurredAt: "2026-09-14T00:00:00Z", sourceEventIds: ["old-vendor-email"], submissionIds: [capture.submission.id], actor: "researcher",
    });
    const before = await repository.sampleCatalogSnapshot();
    const artifactBefore = await repository.getArtifact("old-vendor/archive.zip");
    const historyBefore = await repository.getVendorTimelineHistory("old-vendor");
    const input = { vendorId: "old-vendor", newVendorId: "company", actor: "researcher", reason: "Use the verified company identity" };
    assert.deepEqual(await repository.renameVendorId(input), {
      previousVendorId: "old-vendor", vendorId: "company", harborStorageId: "old-vendor", renamed: true,
    });
    const after = await repository.sampleCatalogSnapshot();
    assert.deepEqual(after.totals, before.totals);
    assert.deepEqual(after.vendors[0], { ...before.vendors[0], id: "company", harborStorageId: "old-vendor" });
    assert.deepEqual(await repository.getArtifact("old-vendor/archive.zip"), artifactBefore);
    assert.deepEqual((await repository.getVendorTimelineHistory("company")).map(({ vendorId, ...rest }) => rest),
      historyBefore.map(({ vendorId, ...rest }) => rest));
    assert.equal((await repository.getVendorTimeline("company"))?.interactions[0]?.id, "old-vendor-delivery-note");
    for (const table of ["registry_source_events", "registry_submission_batches", "registry_tasks", "registry_vendor_interactions", "registry_vendor_timelines", "registry_vendor_timeline_changes"]) {
      assert.equal((await sql.query(`SELECT count(*)::int AS n FROM ${table} WHERE vendor_id = 'old-vendor'`)).rows[0].n, 0);
      assert.ok((await sql.query(`SELECT count(*)::int AS n FROM ${table} WHERE vendor_id = 'company'`)).rows[0].n > 0);
    }
    assert.equal(await repository.resolveVendorId("old-vendor"), "company");
    assert.equal((await repository.renameVendorId(input)).renamed, false);
    await assert.rejects(() => repository!.captureSubmission(capture), /retired/);
    assert.equal((await repository.sampleCatalogSnapshot()).totals.vendors, 1);

    // A later rename keeps the original publication root and all historical aliases.
    await repository.renameVendorId({ ...input, vendorId: "company", newVendorId: "company-final" });
    assert.equal(await repository.resolveVendorId("old-vendor"), "company-final");
    assert.equal(await repository.resolveVendorId("company"), "company-final");
    assert.equal((await repository.sampleCatalogSnapshot()).vendors[0]?.harborStorageId, "old-vendor");
    await assert.rejects(() => repository!.renameVendorId({ ...input, vendorId: "company-final", newVendorId: "old-vendor" }), /registered or retired/);
    assert.equal(await repository.resolveVendorId("company-final"), "company-final");
    const audit = await sql.query("SELECT old_id, new_id, vendor_id, actor, reason FROM registry_vendor_id_changes ORDER BY created_at");
    assert.deepEqual(audit.rows.map((row) => [row.old_id, row.new_id, row.vendor_id]), [
      ["old-vendor", "company", "company-final"], ["company", "company-final", "company-final"],
    ]);
    assert.ok(audit.rows.every((row) => row.actor === input.actor && row.reason === input.reason));
  } finally {
    await repository?.close();
    await sql?.end();
    await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await admin.end();
  }
});
