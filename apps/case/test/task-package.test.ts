import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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

test("recovers UTF-8 ZIP paths whose encoding flag was omitted", { skip: !hasPython }, () => {
  const directory = mkdtempSync(join(tmpdir(), "case-task-package-utf8-"));
  try {
    const sourceZip = join(directory, "source.zip");
    const path = "benchmark样例数据-实现网-Call数大于100/packages/task_01/task.toml";
    makeZip(sourceZip, [[path, "schema_version = \"1.0\"\n", 0o100644]]);
    clearUtf8Flags(sourceZip);

    const extracted = join(directory, "extracted");
    const extraction = run("extract-zip", sourceZip, extracted);
    assert.equal(extraction.safe, true);
    assert.equal(readFileSync(join(extracted, path), "utf8"), "schema_version = \"1.0\"\n");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("safely extracts TAR task packages and rejects TAR links", { skip: !hasPython }, () => {
  const directory = mkdtempSync(join(tmpdir(), "case-task-package-tar-"));
  try {
    const sourceTar = join(directory, "source.tar.gz");
    makeTar(sourceTar, [
      [".", "", 0o755, "directory"],
      ["sample/task.toml", "schema_version = \"1.0\"\n", 0o644, "file"],
      ["sample/solution/solve.sh", "#!/bin/sh\nexit 0\n", 0o755, "file"],
    ]);
    const inspected = run("inspect-tar", sourceTar);
    assert.equal(inspected.safe, true);
    assert.equal(inspected.entryCount, 2);

    const extracted = join(directory, "extracted");
    const extraction = run("extract-tar", sourceTar, extracted);
    assert.equal(extraction.safe, true);
    assert.equal(readFileSync(join(extracted, "sample/task.toml"), "utf8"), "schema_version = \"1.0\"\n");

    const linkTar = join(directory, "link.tar.gz");
    makeTar(linkTar, [["sample/link", "target", 0o777, "link"]]);
    const linkResult = spawnSync("python3", [script, "inspect-tar", linkTar], { encoding: "utf8" });
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

function makeTar(path: string, entries: Array<[string, string, number, "file" | "link" | "directory"]>): void {
  const program = [
    "import io, json, sys, tarfile",
    "entries = json.loads(sys.argv[2])",
    "with tarfile.open(sys.argv[1], 'w:gz') as archive:",
    "    for name, content, mode, kind in entries:",
    "        info = tarfile.TarInfo(name)",
    "        info.mode = mode",
    "        if kind == 'link':",
    "            info.type = tarfile.SYMTYPE",
    "            info.linkname = content",
    "            archive.addfile(info)",
    "        elif kind == 'directory':",
    "            info.type = tarfile.DIRTYPE",
    "            archive.addfile(info)",
    "        else:",
    "            data = content.encode()",
    "            info.size = len(data)",
    "            archive.addfile(info, io.BytesIO(data))",
  ].join("\n");
  const result = spawnSync("python3", ["-c", program, path, JSON.stringify(entries)], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
}

function clearUtf8Flags(path: string): void {
  const bytes = Buffer.from(readFileSync(path));
  for (const [signature, flagOffset] of [[Buffer.from("PK\u0003\u0004"), 6], [Buffer.from("PK\u0001\u0002"), 8]] as const) {
    let offset = 0;
    while ((offset = bytes.indexOf(signature, offset)) >= 0) {
      bytes.writeUInt16LE(bytes.readUInt16LE(offset + flagOffset) & ~0x800, offset + flagOffset);
      offset += signature.length;
    }
  }
  writeFileSync(path, bytes);
}
