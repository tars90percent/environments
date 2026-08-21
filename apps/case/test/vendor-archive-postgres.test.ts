import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { Pool } from "pg";
import { PostgresRegistry } from "../src/registry/postgres.js";
import type { SubmissionManifest } from "../src/registry/types.js";

const testDatabaseUrl = process.env.CASE_REGISTRY_TEST_DATABASE_URL;

test("archives and restores vendors through the trusted repository", { skip: !testDatabaseUrl }, async () => {
  if (!testDatabaseUrl) throw new Error("CASE_REGISTRY_TEST_DATABASE_URL is required");
  const schema = `case_vendor_archive_${randomUUID().replaceAll("-", "_")}`;
  const administrator = new Pool({ connectionString: testDatabaseUrl });
  let repository: PostgresRegistry | undefined;
  try {
    await administrator.query(`CREATE SCHEMA "${schema}"`);
    repository = new PostgresRegistry(databaseUrlWithSearchPath(testDatabaseUrl, schema));
    await repository.initialize();
    const activeIndex = await administrator.query<{ indexdef: string }>(
      `SELECT indexdef FROM pg_indexes
       WHERE schemaname = $1 AND indexname = 'registry_vendors_active_directory_idx'`,
      [schema],
    );
    assert.match(activeIndex.rows[0]?.indexdef ?? "", /\(name, id\).*WHERE \(archived_at IS NULL\)/i);
    await repository.ingestSubmission(manifest("internal-vendor", "internal-batch", "internal"));
    await repository.ingestSubmission(manifest("visible-vendor", "visible-batch", "available"));

    const request = {
      vendorId: "internal-vendor",
      reason: "The duplicate vendor identity was reconciled.",
      actor: "TARS",
    };
    const archived = await repository.archiveVendor(request);
    assert.equal(archived.changed, true);
    assert.equal(archived.archived, true);

    const repeated = await repository.archiveVendor(request);
    assert.equal(repeated.changed, false);

    const activeDirectory = await repository.vendorDirectory();
    assert.deepEqual(ids(activeDirectory), ["visible-vendor"]);
    const fullDirectory = await repository.vendorDirectory(true);
    assert.deepEqual(ids(fullDirectory), ["internal-vendor", "visible-vendor"]);
    const archivedEntry = entries(fullDirectory).find((entry) => entry.id === "internal-vendor");
    assert.equal(archivedEntry?.archivedBy, "TARS");
    assert.equal(archivedEntry?.archiveReason, request.reason);

    const portalCatalog = await repository.sampleCatalogSnapshot();
    assert.equal(ids(portalCatalog.vendors).includes("internal-vendor"), false);
    const visibleCatalogVendor = entries(portalCatalog.vendors).find((entry) => entry.id === "visible-vendor");
    assert.equal(Array.isArray(visibleCatalogVendor?.submissions), true);
    assert.equal("procurementSummary" in (visibleCatalogVendor ?? {}), false);
    assert.equal("demands" in portalCatalog, false);

    await repository.ingestSubmission(manifest("internal-vendor", "later-internal-batch", "internal"));
    const stillArchived = await repository.vendorDirectory();
    assert.equal(ids(stillArchived).includes("internal-vendor"), false);

    await assert.rejects(() => repository!.archiveVendor({ ...request, vendorId: "visible-vendor" }), /has non-internal submission/);

    const restored = await repository.restoreVendor({
      vendorId: "internal-vendor",
      reason: "The corrected vendor record is active again.",
      actor: "TARS",
    });
    assert.equal(restored.changed, true);
    assert.equal(restored.archived, false);
    assert.equal(restored.previousArchive?.archivedBy, "TARS");

    const repeatedRestore = await repository.restoreVendor({
      vendorId: "internal-vendor",
      reason: "The corrected vendor record is active again.",
      actor: "TARS",
    });
    assert.equal(repeatedRestore.changed, false);

    const events = await administrator.query<{ event_type: string; payload: Record<string, unknown> }>(
      `SELECT event_type, payload FROM "${schema}".registry_status_events
       WHERE entity_type = 'vendor' AND entity_id = 'internal-vendor'
       ORDER BY occurred_at, created_at`,
    );
    assert.deepEqual(events.rows.map((event) => event.event_type), ["vendor.archived", "vendor.restored"]);
    assert.equal((events.rows[1]?.payload.previousArchive as { archivedBy?: unknown }).archivedBy, "TARS");
  } finally {
    await repository?.close();
    await administrator.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await administrator.end();
  }
});

function manifest(vendorId: string, batchId: string, visibility: "available" | "internal"): SubmissionManifest {
  return {
    vendor: {
      id: vendorId,
      name: vendorId.replaceAll("-", " "),
      short: vendorId,
      description: `Registry fixture for ${vendorId}.`,
      aliases: [],
    },
    sourceEvent: {
      id: `${batchId}-source`,
      channel: "workspace",
      externalRef: `workspace://${batchId}`,
      receivedAt: "2026-08-14T00:00:00.000Z",
    },
    batch: {
      id: batchId,
      date: "2026-08-14",
      label: batchId,
      sourceLabel: batchId,
      taskCount: 0,
      formats: [],
      workflowStatus: visibility === "internal" ? "quarantined" : "unchecked",
      catalogVisibility: visibility,
      delta: { added: 0, removed: 0, note: "Integration test fixture." },
      metadata: { intakePurpose: "sample_evaluation" },
    },
    categories: [],
    tasks: [],
  };
}

function databaseUrlWithSearchPath(databaseUrl: string, schema: string): string {
  const url = new URL(databaseUrl);
  url.searchParams.set("options", `-csearch_path=${schema}`);
  return url.toString();
}

function entries(value: unknown): Array<Record<string, any>> {
  assert.ok(Array.isArray(value));
  return value as Array<Record<string, any>>;
}

function ids(value: unknown): string[] {
  return entries(value).map((entry) => String(entry.id)).sort();
}
