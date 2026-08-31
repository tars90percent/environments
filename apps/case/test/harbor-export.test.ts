import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { findHarborTaskRoot, harborTaskFiles, publishTaskFiles, taskExportPrefix } from "../src/harbor-export-cli.js";
import type { ArtifactStore } from "../src/registry/artifacts.js";

test("builds the requested vendor/submission/task export path without stable keys", () => {
  assert.equal(
    taskExportPrefix("vendor-a", "submission-2026-09-01", "delivery/tasks/example-task"),
    "vendor-a/submission-2026-09-01/example-task",
  );
  assert.equal(
    taskExportPrefix("vendor-a", "submission-2026-09-01", "delivery/example-task/task"),
    "vendor-a/submission-2026-09-01/example-task",
  );
});

test("selects a task root by its recorded source path and preserves all files", async () => {
  const directory = mkdtempSync(join(tmpdir(), "case-harbor-export-"));
  try {
    const first = join(directory, "delivery", "alpha");
    const second = join(directory, "delivery", "beta");
    mkdirSync(join(first, "environment"), { recursive: true });
    mkdirSync(join(second, "solution"), { recursive: true });
    writeFileSync(join(first, "task.toml"), "alpha\n");
    writeFileSync(join(second, "task.toml"), "beta\n");
    writeFileSync(join(second, "instruction.md"), "Do beta.\n");
    writeFileSync(join(second, "solution", "solve.sh"), "#!/bin/sh\n", { mode: 0o755 });

    const root = await findHarborTaskRoot(directory, "source/tasks/beta");
    assert.equal(root, second);
    const files = await harborTaskFiles(root, "vendor/submission/beta");
    assert.deepEqual(files.map((file) => file.relativePath), ["instruction.md", "solution/solve.sh", "task.toml"]);
    assert.equal(files.find((file) => file.relativePath === "solution/solve.sh")?.mode, 0o755);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("publishes task.toml last and makes exact reruns idempotent", async () => {
  const directory = mkdtempSync(join(tmpdir(), "case-harbor-export-publish-"));
  try {
    writeFileSync(join(directory, "instruction.md"), "Do it.\n");
    writeFileSync(join(directory, "task.toml"), "schema_version = \"1.0\"\n");
    const files = await harborTaskFiles(directory, "vendor/submission/example");
    const objects = new Map<string, { sha256: string; sizeBytes: number }>();
    const writes: string[] = [];
    const store = {
      async listKeys(prefix: string) {
        return [...objects.keys()].filter((key) => key.startsWith(prefix)).sort();
      },
      async objectMetadata(key: string) {
        const value = objects.get(key);
        return value ? { ...value } : null;
      },
      async putFile(input: { key: string; sha256: string; sizeBytes: number }) {
        writes.push(input.key);
        objects.set(input.key, { sha256: input.sha256, sizeBytes: input.sizeBytes });
      },
    } as unknown as ArtifactStore;

    assert.equal(await publishTaskFiles(store, files, "vendor/submission/example", "a".repeat(64)), "published");
    assert.equal(writes.at(-1), "vendor/submission/example/task.toml");
    assert.equal(await publishTaskFiles(store, files, "vendor/submission/example", "a".repeat(64)), "unchanged");
    assert.equal(writes.length, 2);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
