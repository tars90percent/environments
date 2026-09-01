import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  findHarborTaskRoot,
  harborTaskFiles,
  pruneInactiveSubmissionHarborTaskPrefixes,
  publishTaskFiles,
  taskExportPrefix,
} from "../src/harbor-export-cli.js";
import type { ArtifactStore } from "../src/registry/artifacts.js";
import type { RegistryRepository } from "../src/registry/repository.js";

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

test("selects an exact recorded archive directory when a broken Harbor task has no task.toml", async () => {
  const directory = mkdtempSync(join(tmpdir(), "case-harbor-export-missing-manifest-"));
  try {
    const task = join(directory, "broken-task");
    mkdirSync(join(task, "environment"), { recursive: true });
    writeFileSync(join(task, "instruction.md"), "Do the task.\n");
    writeFileSync(join(task, "environment", "Dockerfile"), "FROM scratch\n");

    assert.equal(
      await findHarborTaskRoot(directory, "delivery.zip!/broken-task/"),
      task,
    );
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

test("publishes an exact task without inventing a missing task.toml", async () => {
  const directory = mkdtempSync(join(tmpdir(), "case-harbor-export-broken-publish-"));
  try {
    writeFileSync(join(directory, "instruction.md"), "Do it.\n");
    writeFileSync(join(directory, "tests.py"), "assert True\n");
    const files = await harborTaskFiles(directory, "vendor/submission/broken");
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

    assert.equal(await publishTaskFiles(store, files, "vendor/submission/broken", "b".repeat(64)), "published");
    assert.equal(writes.at(-1), "vendor/submission/broken/tests.py");
    assert.equal(await publishTaskFiles(store, files, "vendor/submission/broken", "b".repeat(64)), "unchanged");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("prunes only inactive task prefixes for one submission and is idempotent", async () => {
  const objects = new Set([
    "vendor-a/submission-1/active/instruction.md",
    "vendor-a/submission-1/active/task.toml",
    "vendor-a/submission-1/stale/instruction.md",
    "vendor-a/submission-1/stale/material.toml",
    "vendor-a/submission-2/unrelated/task.toml",
  ]);
  const repository = {
    async sampleCatalogSnapshot() {
      return {
        generatedAt: "2026-09-01T00:00:00.000Z",
        vendors: [{
          id: "vendor-a",
          name: "Vendor A",
          short: "A",
          submissions: [{
            id: "submission-1",
            date: "2026-09-01",
            label: "Sample",
            source: "Feishu",
            formats: ["harbor"],
            sourceEvents: [],
            tasks: [{
              id: "active-version",
              stableKey: "active",
              title: "Active",
              summary: null,
              kind: "task",
              format: "harbor",
              benchmark: { id: "unspecified", displayName: "Unspecified" },
              gpuRequired: false,
              sourcePath: "delivery.zip!/active/",
              artifactId: `artifact:sha256:${"a".repeat(64)}`,
              contentSha256: "a".repeat(64),
              sourceItemIds: ["source-item-1"],
              checks: {},
              attempts: {},
              findings: [],
            }],
          }],
        }],
        totals: { vendors: 1, submissions: 1, tasks: 1, harborTasks: 1 },
      };
    },
  } as unknown as RegistryRepository;
  const destinationStore = {
    async listKeys(prefix: string) {
      return [...objects].filter((key) => key.startsWith(prefix)).sort();
    },
    async deleteObject(key: string) {
      objects.delete(key);
    },
  } as Pick<ArtifactStore, "listKeys" | "deleteObject">;

  const first = await pruneInactiveSubmissionHarborTaskPrefixes({
    repository,
    destinationStore,
    submissionId: "submission-1",
  });
  assert.equal(first.activePrefixCount, 1);
  assert.equal(first.deletedPrefixCount, 1);
  assert.equal(first.deletedObjectCount, 2);
  assert.deepEqual(first.deletedPrefixes, [{
    prefix: "vendor-a/submission-1/stale",
    objectCount: 2,
  }]);
  assert.equal(objects.has("vendor-a/submission-1/active/task.toml"), true);
  assert.equal(objects.has("vendor-a/submission-2/unrelated/task.toml"), true);

  const second = await pruneInactiveSubmissionHarborTaskPrefixes({
    repository,
    destinationStore,
    submissionId: "submission-1",
  });
  assert.equal(second.deletedPrefixCount, 0);
  assert.equal(second.deletedObjectCount, 0);
});
