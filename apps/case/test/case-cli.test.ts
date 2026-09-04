import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const cli = resolve(dirname(fileURLToPath(import.meta.url)), "../src/case-cli.ts");

test("casectl presents one grouped command surface", () => {
  const result = run("help");

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /casectl registry <command>/);
  assert.match(result.stdout, /casectl intake feishu/);
  assert.match(result.stdout, /casectl intake mail/);
  assert.match(result.stdout, /casectl harbor-tasks/);
  assert.match(result.stdout, /casectl task-package/);
  assert.match(result.stdout, /separate `harbor` command/);
});

test("casectl dispatches registry and task-package operations", () => {
  const registry = run("registry", "operations");
  assert.equal(registry.status, 0, registry.stderr);
  const operations = JSON.parse(registry.stdout) as { commands?: Record<string, unknown> };
  assert.ok(operations.commands?.["append-tasks"]);
  assert.ok(operations.commands?.["create-vendor-timeline"]);
  assert.ok(operations.commands?.["vendor-interaction"]);
  assert.ok(operations.commands?.["update-vendor-interaction"]);
  assert.ok(operations.commands?.["delete-vendor-interaction"]);
  assert.ok(operations.commands?.["delete-vendor-timeline"]);
  assert.ok(operations.commands?.["merge-benchmarks"]);

  const taskPackage = run("task-package", "--help");
  assert.equal(taskPackage.status, 0, taskPackage.stderr);
  assert.match(taskPackage.stdout, /inspect-zip/);
  assert.match(taskPackage.stdout, /package-dir/);
});

function run(...arguments_: string[]): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(process.execPath, ["--import", "tsx", cli, ...arguments_], { encoding: "utf8" });
  return { status: result.status, stdout: String(result.stdout), stderr: String(result.stderr) };
}
