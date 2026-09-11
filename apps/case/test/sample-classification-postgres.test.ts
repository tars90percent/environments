import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { Pool } from "pg";
import { PostgresRegistry } from "../src/registry/postgres.js";
import { parseClassifyTasks, parseSampleTaxonomy } from "../src/registry/validation.js";

const databaseUrl = process.env.CASE_REGISTRY_TEST_DATABASE_URL;

test("classification validation requires explicit unknowns and review preconditions", () => {
  const input = { submissionId: "sample", actor: "reviewer", reason: "Reviewed samples", assignments: [{ taskId: "task", capabilityId: "software", benchmarkGroupId: null, evidence: "Source objective", relationship: "Capability only", expectedClassificationId: null, expectedBenchmarkId: "unspecified" }] };
  assert.equal(parseClassifyTasks(input).assignments[0]?.benchmarkGroupId, null);
  assert.throws(() => parseClassifyTasks({ ...input, assignments: [{ ...input.assignments[0], expectedClassificationId: undefined }] }));
  assert.throws(() => parseClassifyTasks({ ...input, assignments: [...input.assignments, ...input.assignments] }), /at most once/);
  assert.throws(() => parseSampleTaxonomy({ capabilities: [], benchmarkGroups: [{ id: "tb", family: "Terminal-Bench" }], actor: "reviewer", reason: "Reviewed samples" }));
});

test("classifications separate distributions, preserve originals, replay safely and reject stale or partial updates", { skip: !databaseUrl }, async () => {
  const schema = `classification_${randomUUID().replaceAll("-", "_")}`;
  const administrator = new Pool({ connectionString: databaseUrl });
  const url = new URL(databaseUrl!);
  url.searchParams.set("options", `-c search_path=${schema}`);
  const registry = new PostgresRegistry(url.toString());
  try {
    await administrator.query(`CREATE SCHEMA "${schema}"`);
    await registry.initialize();
    await registry.captureSubmission({
      vendor: { id: "vendor", name: "Vendor", short: "V", description: "Fixture", aliases: [] },
      submission: { id: "sample", date: "2026-09-11", label: "Sample", sourceLabel: "Email", formats: [] },
      artifacts: [{ id: "file-one", kind: "source_payload", storageKey: "fixture", sha256: "a".repeat(64) }],
      sources: [{ sourceEvent: { id: "source", channel: "email", externalRef: "mail://fixture", receivedAt: "2026-09-11T00:00:00Z" }, items: [{ id: "item", kind: "file", displayName: "Fixture", artifactId: "file-one", fetchStatus: "snapshotted", parseStatus: "parsed", mutable: false }] }],
      actor: "reviewer",
    });
    await registry.appendTasks({ submissionId: "sample", actor: "reviewer", benchmarkAssignments: [], tasks: ["one", "two"].map((id) => ({ id, stableKey: id, title: id, kind: id === "one" ? "task" : "trace", format: "non_harbor", benchmarkId: "terminal-bench", sourcePath: id, artifactId: "file-one", sourceItemIds: ["item"] })) });
    const taxonomy = parseSampleTaxonomy({ capabilities: [{ id: "software", displayName: "Software Engineering", description: "Engineering tasks" }], benchmarkGroups: [{ id: "tb2", family: "Terminal-Bench", version: "2 / 2.1" }, { id: "tb3", family: "Terminal-Bench", version: "3 / 3.0" }, { id: "apex", family: "APEX-Agents", version: null }], actor: "reviewer", reason: "Reviewed taxonomy" });
    await registry.registerSampleTaxonomy(taxonomy);
    await registry.registerSampleTaxonomy(taxonomy);
    await assert.rejects(() => registry.registerSampleTaxonomy({ ...taxonomy, benchmarkGroups: [{ id: "tb2", family: "Terminal-Bench", version: "4" }] }), /different contents/);
    const before = await registry.getSampleTask("one");
    const input = parseClassifyTasks({ submissionId: "sample", actor: "reviewer", reason: "Source review", assignments: ["one", "two"].map((taskId, index) => ({ taskId, capabilityId: "software", benchmarkGroupId: index ? "tb3" : "tb2", evidence: "Explicit generation declaration", relationship: "Vendor-targeted", expectedClassificationId: null, expectedBenchmarkId: "terminal-bench" })) });
    assert.equal((await registry.classifyTasks(input)).added, 2);
    assert.equal((await registry.classifyTasks(input)).unchanged, 2);
    const first = (await registry.getSampleTask("one"))!;
    assert.deepEqual({ ...first, classification: null }, before);
    assert.equal(first.classification?.benchmarkGroup?.version, "2 / 2.1");
    assert.equal((await registry.getSampleTask("two"))?.classification?.benchmarkGroup?.version, "3 / 3.0");
    const correction = { ...input, assignments: [{ ...input.assignments[0]!, benchmarkGroupId: null, expectedClassificationId: first.classification!.id }] };
    await assert.rejects(() => registry.classifyTasks({ ...correction, assignments: [...correction.assignments, { ...input.assignments[1]!, taskId: "missing" }] }), /does not belong/);
    assert.equal((await registry.taskClassificationHistory("one")).length, 1);
    await registry.classifyTasks(correction);
    await assert.rejects(() => registry.classifyTasks(input), /Classification changed/);
    const history = await registry.taskClassificationHistory("one");
    assert.equal(history.length, 2);
    assert.equal(history[0]?.benchmarkGroup, null);
    assert.equal(history[1]?.benchmarkGroup?.id, "tb2");
    assert.deepEqual(history[0]?.sourceBenchmark, before?.benchmark);
    await assert.rejects(() => registry.classifyTasks({ ...input, assignments: [{ ...input.assignments[0]!, expectedBenchmarkId: "unspecified" }] }), /Source benchmark changed/);
  } finally {
    await registry.close();
    await administrator.query(`DROP SCHEMA "${schema}" CASCADE`);
    await administrator.end();
  }
});
