import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";

async function moduleAt(path) {
  const result = await build({ entryPoints: [new URL(path, import.meta.url).pathname], bundle: true, format: "esm", platform: "node", write: false });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);
}

function task(id, version, capabilityId = "software", kind = "task") {
  return { id, stableKey: id, title: id, kind, format: "harbor", benchmark: { id: "terminal-bench-3-4", displayName: "Original direction" }, sourcePath: `tasks/${id}`, checks: {}, findings: [], gpuRequired: false,
    classification: { id, capability: { id: capabilityId, displayName: capabilityId, description: "Fixture" }, benchmarkGroup: { id: version ?? "unknown", family: "Terminal-Bench", version }, evidence: "Retained declaration", relationship: "Vendor target; membership unverified", sourceBenchmark: { id: "terminal-bench-3-4", displayName: "Original direction" } } };
}

test("version grouping, capability filtering and downloads select the same exact task set", async () => {
  const { buildBenchmarkLandscape } = await moduleAt("../app/benchmark-landscape.ts");
  const { benchmarkHarborDatasetManifest, benchmarkHarborDatasetFilename } = await moduleAt("../app/dataset-archive.ts");
  const { groupSubmissionTasks } = await moduleAt("../app/task-groups.ts");
  const tasks = [task("two", "2 / 2.1"), task("three", "3 / 3.0"), task("three-science", "3 / 3.0", "science"), task("combined", "3 / 4"), task("four", "4"), task("unknown", null), task("trace", "3 / 3.0", "software", "trace")];
  const catalog = { vendors: [{ id: "vendor", name: "Vendor", submissions: [{ id: "submission", label: "Sample", date: "2026-09-11", tasks }] }] };
  const before = structuredClone(catalog);
  const landscape = buildBenchmarkLandscape(catalog);
  assert.equal(landscape.taskCount, 6);
  assert.equal(landscape.groups.length, 5);
  assert.equal(new Set(landscape.groups.flatMap((group) => group.records.map((row) => row.task.id))).size, 6);
  assert.equal(landscape.groups.find((group) => group.id === "benchmark:unknown").displayName, "Terminal-Bench · Unversioned");
  assert.equal(landscape.categories.find((category) => category.id === "active-procurement").taskCount, 4);
  const filtered = buildBenchmarkLandscape(catalog, "science");
  assert.equal(filtered.taskCount, 1);
  assert.equal(filtered.groups.length, 1);
  const manifest = benchmarkHarborDatasetManifest(filtered.groups[0]);
  assert.deepEqual(manifest.tasks.map((row) => row.taskId), ["three-science"]);
  assert.equal(manifest.selection.capabilityId, "science");
  assert.equal(manifest.tasks[0].classification.benchmarkGroup.version, "3 / 3.0");
  assert.equal(manifest.tasks[0].benchmark.displayName, "Original direction");
  assert.match(benchmarkHarborDatasetFilename(filtered.groups[0]), /science/);
  assert.equal(buildBenchmarkLandscape(catalog, "missing").groups.length, 0);
  assert.equal(groupSubmissionTasks(tasks).length, 6);
  assert.deepEqual(catalog, before);
});

test("family-only and capability-only classifications do not invent versions or benchmark membership", async () => {
  const { buildBenchmarkLandscape } = await moduleAt("../app/benchmark-landscape.ts");
  const apex = task("apex", null);
  apex.classification.benchmarkGroup = { id: "apex", family: "APEX-Agents", version: null };
  const generic = task("generic", null);
  generic.classification.benchmarkGroup = null;
  const catalog = { vendors: [{ id: "v", name: "V", submissions: [{ id: "s", date: "2026-09-11", tasks: [apex, generic] }] }] };
  const groups = buildBenchmarkLandscape(catalog).groups;
  assert.equal(groups.find((group) => group.id === "benchmark:apex").displayName, "APEX-Agents");
  assert.equal(groups.find((group) => group.id === "capability:software").categoryId, "capability-only");
});
