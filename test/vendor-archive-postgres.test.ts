import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { Pool } from "pg";
import { startRegistryServer, type RegistryServer } from "../src/registry/api.js";
import { PostgresRegistry } from "../src/registry/postgres.js";
import type { SubmissionManifest } from "../src/registry/types.js";

const testDatabaseUrl = process.env.CASE_REGISTRY_TEST_DATABASE_URL;

test("archives and restores vendors through the admin API", { skip: !testDatabaseUrl }, async () => {
  if (!testDatabaseUrl) throw new Error("CASE_REGISTRY_TEST_DATABASE_URL is required");
  const schema = `case_vendor_archive_${randomUUID().replaceAll("-", "_")}`;
  const administrator = new Pool({ connectionString: testDatabaseUrl });
  let repository: PostgresRegistry | undefined;
  let server: RegistryServer | undefined;
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

    const adminToken = "admin-token-with-at-least-32-characters";
    const catalogToken = "catalog-token-with-at-least-32-characters";
    server = await startRegistryServer({
      repository,
      adminToken,
      catalogToken,
      reviewToken: "review-token-with-at-least-32-characters",
      host: "127.0.0.1",
      port: 0,
    });

    const request = {
      vendorId: "internal-vendor",
      reason: "The duplicate vendor identity was reconciled.",
      actor: "TARS",
    };
    const forbidden = await api(server.url, catalogToken, "POST", "/v1/vendors/archive", request);
    assert.equal(forbidden.status, 403);

    const archived = await api(server.url, adminToken, "POST", "/v1/vendors/archive", request);
    assert.equal(archived.status, 200);
    assert.equal(archived.body.changed, true);
    assert.equal(archived.body.archived, true);

    const repeated = await api(server.url, adminToken, "POST", "/v1/vendors/archive", request);
    assert.equal(repeated.status, 200);
    assert.equal(repeated.body.changed, false);

    const activeDirectory = await api(server.url, adminToken, "GET", "/v1/vendor-directory");
    assert.deepEqual(ids(activeDirectory.body.vendors), ["visible-vendor"]);
    const fullDirectory = await api(server.url, adminToken, "GET", "/v1/vendor-directory?include_archived=true");
    assert.deepEqual(ids(fullDirectory.body.vendors), ["internal-vendor", "visible-vendor"]);
    const archivedEntry = entries(fullDirectory.body.vendors).find((entry) => entry.id === "internal-vendor");
    assert.equal(archivedEntry?.archivedBy, "TARS");
    assert.equal(archivedEntry?.archiveReason, request.reason);

    const researchCatalog = await api(server.url, adminToken, "GET", "/v1/catalog?scope=research");
    assert.equal(ids(researchCatalog.body.vendors).includes("internal-vendor"), false);
    const portalCatalog = await api(server.url, catalogToken, "GET", "/v1/catalog?scope=all");
    assert.equal(ids(portalCatalog.body.vendors).includes("internal-vendor"), false);
    const auditCatalog = await api(server.url, adminToken, "GET", "/v1/catalog?scope=all");
    assert.equal(ids(auditCatalog.body.vendors).includes("internal-vendor"), true);
    const auditRecord = await api(server.url, adminToken, "GET", "/v1/vendor-records/internal-vendor");
    assert.equal(auditRecord.status, 200);
    assert.equal(auditRecord.body.vendor.id, "internal-vendor");

    await repository.ingestSubmission(manifest("internal-vendor", "later-internal-batch", "internal"));
    const stillArchived = await api(server.url, adminToken, "GET", "/v1/vendor-directory");
    assert.equal(ids(stillArchived.body.vendors).includes("internal-vendor"), false);

    const unsafe = await api(server.url, adminToken, "POST", "/v1/vendors/archive", {
      ...request,
      vendorId: "visible-vendor",
    });
    assert.equal(unsafe.status, 409);

    const restored = await api(server.url, adminToken, "POST", "/v1/vendors/restore", {
      vendorId: "internal-vendor",
      reason: "The corrected vendor record is active again.",
      actor: "TARS",
    });
    assert.equal(restored.status, 200);
    assert.equal(restored.body.changed, true);
    assert.equal(restored.body.archived, false);
    assert.equal(restored.body.previousArchive.archivedBy, "TARS");

    const repeatedRestore = await api(server.url, adminToken, "POST", "/v1/vendors/restore", {
      vendorId: "internal-vendor",
      reason: "The corrected vendor record is active again.",
      actor: "TARS",
    });
    assert.equal(repeatedRestore.body.changed, false);

    const events = await administrator.query<{ event_type: string; payload: Record<string, unknown> }>(
      `SELECT event_type, payload FROM "${schema}".registry_status_events
       WHERE entity_type = 'vendor' AND entity_id = 'internal-vendor'
       ORDER BY occurred_at, created_at`,
    );
    assert.deepEqual(events.rows.map((event) => event.event_type), ["vendor.archived", "vendor.restored"]);
    assert.equal((events.rows[1]?.payload.previousArchive as { archivedBy?: unknown }).archivedBy, "TARS");
  } finally {
    await server?.close();
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

async function api(
  baseUrl: string,
  token: string,
  method: "GET" | "POST",
  path: string,
  body?: unknown,
): Promise<{ status: number; body: Record<string, any> }> {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() as Record<string, any> };
}

function entries(value: unknown): Array<Record<string, any>> {
  assert.ok(Array.isArray(value));
  return value as Array<Record<string, any>>;
}

function ids(value: unknown): string[] {
  return entries(value).map((entry) => String(entry.id)).sort();
}
