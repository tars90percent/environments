import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFile, mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { classifyHarborTaskRegistrations, exportSubmissions } from "../src/harbor-export-cli.js";
import type { ArtifactStore } from "../src/registry/artifacts.js";
import type { RegistryRepository } from "../src/registry/repository.js";
import type { TaskRegistrationInput } from "../src/registry/types.js";

test("short-reference Harbor tasks publish exact files and leave intermixed traces out", async () => {
  const directory = await mkdtemp(join(tmpdir(), "case-harbor-file-reference-"));
  try {
    const archive = join(directory, "mixed.zip");
    const entries: Record<string, string> = {
      "mixed/tasks/example/task.toml": 'version = "1.0"\n',
      "mixed/tasks/example/instruction.md": "Synthetic task instructions\n",
      "mixed/tasks/example/environment/Dockerfile": "FROM scratch\n",
      "mixed/tasks/example/solution/solve.sh": "#!/bin/sh\nexit 0\n",
      "mixed/tasks/example/tests/test.sh": "#!/bin/sh\nexit 0\n",
      "mixed/traces/attempt.jsonl": '{"attempt":"synthetic"}\n',
      "mixed/index.txt": "Original delivery index\n",
    };
    const zipped = spawnSync("python3", ["-c", "import json,sys,zipfile\nwith zipfile.ZipFile(sys.argv[1], 'w') as z:\n for path,data in json.loads(sys.argv[2]).items(): z.writestr(path,data)", archive, JSON.stringify(entries)], { encoding: "utf8" });
    assert.equal(zipped.status, 0, zipped.stderr);
    const sha256 = createHash("sha256").update(await readFile(archive)).digest("hex");
    const task: TaskRegistrationInput = { id: "task-example", stableKey: "example", title: "Example", kind: "task", format: "harbor", benchmarkId: "unspecified", sourcePath: "mixed/tasks/example", artifactId: "file-12", sourceItemIds: ["original-mixed-delivery"] };
    const artifact = { id: "file-12", reference: "file-12", kind: "source_payload", storageKey: "files/file-12/mixed.zip", sha256, sizeBytes: (await stat(archive)).size, contentType: "application/zip", metadata: { originalName: "mixed.zip" }, createdAt: new Date().toISOString() };
    const repository = {
      async getArtifact(id: string) { assert.equal(id, "file-12"); return artifact; },
      async sampleCatalogSnapshot() { return { vendors: [{ id: "vendor-a", submissions: [{ id: "september-delivery", sourceEvents: [], tasks: [
        { ...task, contentSha256: sha256 },
        { ...task, id: "trace-example", kind: "trace", format: "non_harbor", sourcePath: "mixed/traces/attempt.jsonl" },
      ] }] }] }; },
    } as unknown as RegistryRepository;
    const sourceStore = { async downloadFile(input: { path: string; sha256: string }) { assert.equal(input.sha256, sha256); await copyFile(archive, input.path); } } as ArtifactStore;
    const validation = await classifyHarborTaskRegistrations({ repository, sourceStore, tasks: [task], async validateTaskRoot(root) {
      assert.equal(await readFile(join(root, "instruction.md"), "utf8"), entries["mixed/tasks/example/instruction.md"]);
      return { valid: true, harborVersion: "fixture-static-validator" };
    } });
    assert.equal(validation.validation.validHarborTaskCount, 1);
    const objects = new Map<string, { sha256: string; sizeBytes: number; bytes: Buffer }>();
    const destinationStore = {
      async listKeys(prefix: string) { return [...objects.keys()].filter((key) => key.startsWith(prefix)); },
      async objectMetadata(key: string) { return objects.get(key) ?? null; },
      async putFile(input: { key: string; path: string; sha256: string; sizeBytes: number }) { objects.set(input.key, { ...input, bytes: await readFile(input.path) }); },
    } as unknown as ArtifactStore;
    const input = { repository, sourceStore, destinationStore, submissionIds: ["september-delivery"] };
    const published = await exportSubmissions(input);
    assert.equal(published.selectedTaskCount, 1);
    assert.equal(published.completedTaskCount, 1);
    assert.equal(published.failedTaskCount, 0);
    assert.equal(objects.size, 5);
    for (const [key, object] of objects) {
      const original = key.replace("vendor-a/september-delivery/", "mixed/tasks/");
      assert.equal(object.bytes.toString(), entries[original]);
      assert.doesNotMatch(key, /trace|index|file-12/);
    }
    assert.equal([...objects.keys()].at(-1), "vendor-a/september-delivery/example/task.toml");
    assert.equal((await exportSubmissions(input)).tasks[0]!.status, "unchanged");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
