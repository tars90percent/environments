import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { Pool } from "pg";
import { PostgresRegistry } from "../src/registry/postgres.js";
import { harborSubmissionFromBase } from "../src/registry/srm-boundary.js";

const databaseUrl = process.env.CASE_REGISTRY_TEST_DATABASE_URL;

test("a Base reference registers an idempotent technical grouping without originals or a timeline", { skip: !databaseUrl }, async () => {
  const schema = `case_srm_${randomUUID().replaceAll("-", "_")}`;
  const administrator = new Pool({ connectionString: databaseUrl! });
  let repository: PostgresRegistry | undefined;
  try {
    await administrator.query(`CREATE SCHEMA "${schema}"`);
    const scoped = new URL(databaseUrl!);
    scoped.searchParams.set("options", `-c search_path=${schema},public`);
    repository = new PostgresRegistry(scoped.toString());
    await repository.initialize();
    const input = harborSubmissionFromBase({
      vendor: { id: "example", name: "Example", short: "EX" },
      submission: { id: "example-samples", date: "2026-09-17", label: "Harbor samples" },
      baseRecordId: "recExample", actor: "test",
    });
    assert.equal((await repository.captureSubmission(input)).created, true);
    assert.equal((await repository.captureSubmission(input)).created, false);
    const source = await repository.getSourceEvent("base-harbor:example-samples");
    assert.equal(source?.items.length, 1);
    assert.equal(source?.items[0]?.artifactId, null);
    assert.match(source?.items[0]?.locator ?? "", /record=recExample$/);
    for (const table of ["registry_artifacts", "registry_vendor_interactions", "registry_vendor_timelines"]) {
      const result = await administrator.query(`SELECT count(*)::int AS count FROM "${schema}".${table}`);
      assert.equal(result.rows[0].count, 0, table);
    }
  } finally {
    await repository?.close();
    await administrator.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await administrator.end();
  }
});
