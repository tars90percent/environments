import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const python = spawnSync("python3", ["--version"], { encoding: "utf8" });
const hasPython = python.status === 0;
const script = resolve(dirname(fileURLToPath(import.meta.url)), "../scripts/case-task-package.py");

test("safely extracts ZIPs and creates deterministic task packages", { skip: !hasPython }, () => {
  const directory = mkdtempSync(join(tmpdir(), "case-task-package-"));
  try {
    const sourceZip = join(directory, "source.zip");
    makeZip(sourceZip, [
      ["delivery/task/task.toml", "schema_version = \"1.0\"\n", 0o100644],
      ["delivery/task/instruction.md", "Do the task.\n", 0o100644],
      ["delivery/task/solution/solve.sh", "#!/bin/sh\nexit 0\n", 0o100755],
    ]);

    const inspected = run("inspect-zip", sourceZip);
    assert.equal(inspected.safe, true);
    assert.equal(inspected.entryCount, 3);

    const extracted = join(directory, "extracted");
    const extraction = run("extract-zip", sourceZip, extracted);
    assert.equal(extraction.safe, true);
    assert.equal(readFileSync(join(extracted, "delivery/task/instruction.md"), "utf8"), "Do the task.\n");

    const first = run("package-dir", join(extracted, "delivery/task"), join(directory, "first.tar.gz"));
    const second = run("package-dir", join(extracted, "delivery/task"), join(directory, "second.tar.gz"));
    assert.equal(first.contentSha256, second.contentSha256);
    assert.equal(first.sizeBytes, second.sizeBytes);
    assert.equal(first.archiveRoot, "task_contents");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("rejects traversal paths and links before extraction", { skip: !hasPython }, () => {
  const directory = mkdtempSync(join(tmpdir(), "case-task-package-unsafe-"));
  try {
    const traversal = join(directory, "traversal.zip");
    makeZip(traversal, [["../escape", "bad", 0o100644]]);
    const traversalResult = spawnSync("python3", [script, "inspect-zip", traversal], { encoding: "utf8" });
    assert.equal(traversalResult.status, 2);
    assert.equal(JSON.parse(traversalResult.stdout).safe, false);

    const link = join(directory, "link.zip");
    makeZip(link, [["task/link", "target", 0o120777]]);
    const linkResult = spawnSync("python3", [script, "inspect-zip", link], { encoding: "utf8" });
    assert.equal(linkResult.status, 2);
    assert.equal(JSON.parse(linkResult.stdout).safe, false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

function run(command: string, ...arguments_: string[]): Record<string, unknown> {
  const result = spawnSync("python3", [script, command, ...arguments_], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout) as Record<string, unknown>;
}

function makeZip(path: string, entries: Array<[string, string, number]>): void {
  const program = [
    "import json, sys, zipfile",
    "entries = json.loads(sys.argv[2])",
    "with zipfile.ZipFile(sys.argv[1], 'w', zipfile.ZIP_DEFLATED) as archive:",
    "    for name, content, mode in entries:",
    "        info = zipfile.ZipInfo(name)",
    "        info.create_system = 3",
    "        info.external_attr = mode << 16",
    "        info.compress_type = zipfile.ZIP_DEFLATED",
    "        archive.writestr(info, content)",
  ].join("\n");
  const result = spawnSync("python3", ["-c", program, path, JSON.stringify(entries)], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
}
