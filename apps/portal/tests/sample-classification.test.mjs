import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";

async function moduleAt(path) {
  const result = await build({ entryPoints: [new URL(path, import.meta.url).pathname], bundle: true, format: "esm", platform: "node", write: false });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);
}

function task(id, version, capabilityId = "software", kind = "task") {
  return { id, stableKey: id, title: id, kind, format: "harbor", benchmark: { id: "terminal-bench", displayName: "Original direction" }, sourcePath: `tasks/${id}`, checks: {}, findings: [], gpuRequired: false,
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
  assert.equal(landscape.categories.some((category) => category.id === "active-procurement"), false);
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

test("classification preserves the three procurement collections, membership, shortlist and download scope", async () => {
  const { buildBenchmarkLandscape } = await moduleAt("../app/benchmark-landscape.ts");
  const { benchmarkDeliveries } = await moduleAt("../app/benchmark-deliveries.ts");
  const { benchmarkHarborDatasetManifest } = await moduleAt("../app/dataset-archive.ts");
  const { sampleGroup } = await moduleAt("../app/sample-classification.ts");
  const three = task("three", "3 / 3.0");
  const combined = task("combined", "3 / 4");
  const four = task("four", "4");
  for (const item of [three, combined, four]) item.benchmark = { id: "terminal-bench-3-4", displayName: "Terminal-Bench 3/4" };
  const science = task("science", null);
  science.benchmark = { id: "terminal-bench-science", displayName: "Terminal-Bench Science" };
  science.classification.benchmarkGroup = { id: "science", family: "Terminal-Bench-Science", version: null };
  const deep = task("deep", null);
  deep.benchmark = { id: "deep-swe", displayName: "DeepSWE" };
  deep.classification.benchmarkGroup = { id: "deep", family: "DeepSWE", version: null };
  const otherDeep = { ...structuredClone(deep), id: "other-deep" };
  const outside = task("outside", "4");
  const vendor = (id, tasks) => ({ id, name: id, submissions: [{ id: `${id}-submission`, label: "Sample", date: "2026-09-11", tasks }] });
  const catalog = { vendors: [vendor("mercor", [three, combined, four, science, deep, outside]), vendor("other", [otherDeep])] };
  const before = structuredClone(catalog);
  for (const vendor of before.vendors) for (const submission of vendor.submissions) for (const task of submission.tasks) delete task.classification;
  const procurement = (snapshot) => buildBenchmarkLandscape(snapshot).categories.find((category) => category.id === "active-procurement");
  const scope = (group) => ({ id: group.id, name: group.displayName, tasks: group.records.map((record) => record.task.id), shortlist: group.shortlist?.records.map((record) => record.task.id) });
  const after = procurement(catalog);
  assert.equal(after.groups.length, 3);
  assert.deepEqual(after.groups.map(scope), procurement(before).groups.map(scope));
  for (const group of after.groups) {
    assert.deepEqual(benchmarkDeliveries(catalog.vendors, group.id), benchmarkDeliveries(before.vendors, group.id));
    assert.deepEqual(benchmarkHarborDatasetManifest(group).tasks.map((row) => row.taskId), group.records.map((row) => row.task.id));
  }
  const terminal = after.groups.find((group) => group.id === "terminal-bench-3-4");
  assert.equal(new Set(terminal.records.map((record) => sampleGroup(record.task).id)).size, 3);
  assert.ok(!terminal.records.some((record) => record.task.id === "outside"));
  assert.equal(benchmarkHarborDatasetManifest(after.groups.find((group) => group.id === "deep-swe"), "shortlisted").tasks.length, 1);
});
