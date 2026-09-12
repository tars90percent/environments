import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";

const result = await build({ entryPoints: [new URL("../app/task-navigation.ts", import.meta.url).pathname], bundle: true, format: "esm", platform: "node", write: false });
const { taskListHref, readTaskListLocation } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);

test("task round trips preserve the originating benchmark and search, including URL punctuation", () => {
  const origin = { view: "benchmarks", benchmark: "terminal-bench:2", vendor: "", query: "cache? 修复 & tests", language: "en" };
  const task = new URL(`https://portal.example/tasks/task?returnTo=${encodeURIComponent(taskListHref(origin))}`);
  assert.deepEqual(readTaskListLocation(task.searchParams.get("returnTo")), origin);
});

test("vendor and preview task round trips return to the selected vendor", () => {
  const origin = { view: "vendors", benchmark: null, vendor: "osmosis", query: "", language: "zh" };
  for (const preview of [false, true]) assert.deepEqual(readTaskListLocation(taskListHref(origin, preview), preview), origin);
});

test("direct task links fall back safely and return destinations cannot leave the list page", () => {
  for (const href of [null, "", "//evil.example", "https://evil.example/", "/\\evil.example", "/tasks/other", "/auth/logout"]) assert.equal(readTaskListLocation(href), null);
  assert.equal(readTaskListLocation("/").view, "benchmarks");
});
