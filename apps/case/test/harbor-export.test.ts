import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  classifyHarborTaskRegistrations,
  findHarborTaskRoot,
  harborTaskFiles,
  pruneInactiveSubmissionHarborTaskPrefixes,
  publishTaskFiles,
  taskExportPrefix,
} from "../src/harbor-export-cli.js";
import type { ArtifactStore } from "../src/registry/artifacts.js";
import type { RegistryRepository } from "../src/registry/repository.js";
import type { TaskRegistrationInput } from "../src/registry/types.js";

const hasPython = spawnSync("python3", ["--version"], { encoding: "utf8" }).status === 0;

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

test("rejects an exact recorded archive directory when the task has no task.toml", async () => {
  const directory = mkdtempSync(join(tmpdir(), "case-harbor-export-missing-manifest-"));
  try {
    const task = join(directory, "broken-task");
    mkdirSync(join(task, "environment"), { recursive: true });
    writeFileSync(join(task, "instruction.md"), "Do the task.\n");
    writeFileSync(join(task, "environment", "Dockerfile"), "FROM scratch\n");

    await assert.rejects(
      () => findHarborTaskRoot(directory, "delivery.zip!/broken-task/"),
      /exact task root contains no task\.toml/,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("retains a task rejected by Harbor's static validator and reclassifies it as non-Harbor", { skip: !hasPython }, async () => {
  const directory = mkdtempSync(join(tmpdir(), "case-harbor-classification-"));
  try {
    const archive = join(directory, "task.zip");
    makeZip(archive, [
      ["delivery/task/task.toml", "schema_version = \"1.0\"\n", 0o100644],
      ["delivery/task/instruction.md", "Do the task.\n", 0o100644],
      ["delivery/task/environment/Dockerfile", "FROM scratch\n", 0o100644],
    ]);
    const sha256 = createHash("sha256").update(readFileSync(archive)).digest("hex");
    const task: TaskRegistrationInput = {
      id: "task-version-1",
      stableKey: "vendor:submission:task",
      title: "Task",
      kind: "task",
      format: "harbor",
      benchmarkId: "unspecified",
      sourcePath: "delivery/task",
      artifactId: `artifact:sha256:${sha256}`,
      contentSha256: sha256,
      sourceItemIds: ["source-item-1"],
    };
    const repository = {
      async getArtifact() {
        return {
          id: task.artifactId,
          kind: "task_package" as const,
          storageKey: "objects/task.zip",
          sha256,
          sizeBytes: statSync(archive).size,
          contentType: "application/zip",
          metadata: { originalName: "task.zip" },
          createdAt: "2026-09-02T00:00:00.000Z",
        };
      },
    } as unknown as RegistryRepository;
    const sourceStore = {
      async downloadFile(input: { path: string }) {
        copyFileSync(archive, input.path);
      },
    } as unknown as ArtifactStore;

    const result = await classifyHarborTaskRegistrations({
      repository,
      sourceStore,
      tasks: [task],
      async validateTaskRoot(taskRoot) {
        assert.equal(taskRoot.endsWith("/delivery/task"), true);
        return { valid: false, harborVersion: "0.21.0", reason: "tests/ is missing" };
      },
    });

    assert.equal(result.tasks.length, 1);
    assert.equal(result.tasks[0]?.id, task.id);
    assert.equal(result.tasks[0]?.format, "non_harbor");
    assert.deepEqual(result.validation, {
      requestedHarborTaskCount: 1,
      validHarborTaskCount: 0,
      reclassifiedTaskCount: 1,
      reclassifiedTasks: [{ taskId: task.id, reason: "Harbor 0.21.0: tests/ is missing" }],
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("retains a task with no task.toml and classifies it as non-Harbor", { skip: !hasPython }, async () => {
  const directory = mkdtempSync(join(tmpdir(), "case-harbor-missing-manifest-classification-"));
  try {
    const archive = join(directory, "task.zip");
    makeZip(archive, [
      ["instruction.md", "Do the task.\n", 0o100644],
      ["environment/Dockerfile", "FROM scratch\n", 0o100644],
    ]);
    const sha256 = createHash("sha256").update(readFileSync(archive)).digest("hex");
    const task: TaskRegistrationInput = {
      id: "task-version-without-manifest",
      stableKey: "vendor:submission:task-without-manifest",
      title: "Task without manifest",
      kind: "task",
      format: "harbor",
      benchmarkId: "unspecified",
      sourcePath: "delivery/task-without-manifest",
      artifactId: `artifact:sha256:${sha256}`,
      contentSha256: sha256,
      sourceItemIds: ["source-item-1"],
    };
    const repository = {
      async getArtifact() {
        return {
          id: task.artifactId,
          kind: "task_package" as const,
          storageKey: "objects/task.zip",
          sha256,
          sizeBytes: statSync(archive).size,
          contentType: "application/zip",
          metadata: { originalName: "task.zip" },
          createdAt: "2026-09-02T00:00:00.000Z",
        };
      },
    } as unknown as RegistryRepository;
    const sourceStore = {
      async downloadFile(input: { path: string }) {
        copyFileSync(archive, input.path);
      },
    } as unknown as ArtifactStore;
    let staticValidatorCalled = false;

    const result = await classifyHarborTaskRegistrations({
      repository,
      sourceStore,
      tasks: [task],
      async validateTaskRoot() {
        staticValidatorCalled = true;
        return { valid: true, harborVersion: "0.21.0" };
      },
    });

    assert.equal(staticValidatorCalled, false);
    assert.equal(result.tasks.length, 1);
    assert.equal(result.tasks[0]?.id, task.id);
    assert.equal(result.tasks[0]?.format, "non_harbor");
    assert.deepEqual(result.validation.reclassifiedTasks, [{
      taskId: task.id,
      reason: "exact task root contains no task.toml",
    }]);
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

test("refuses to publish a Harbor task without task.toml", async () => {
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

    await assert.rejects(
      () => publishTaskFiles(store, files, "vendor/submission/broken", "b".repeat(64)),
      /without task\.toml/,
    );
    assert.deepEqual(writes, []);
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
