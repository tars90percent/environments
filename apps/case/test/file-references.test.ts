import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import test from "node:test";
import { ArtifactStore } from "../src/registry/artifacts.js";
import { storeSourcePayload } from "../src/capture-runtime.js";
import { registryFileReferences } from "../src/registry/file-references.js";

const legacyId = `artifact:sha256:${"a".repeat(64)}`;
const repository = { async fileReferences(ids: string[]) { return ids.some((id) => id === legacyId || id === "file-17") ? [{ id: legacyId, reference: "file-17" }] : []; } };

test("short references round-trip without rewriting vendor metadata or prose", async () => {
  const stored = { artifactId: legacyId, contentSha256: "a".repeat(64), metadata: { artifactId: legacyId, sha256: "vendor's own evidence" }, summary: `Vendor mentioned ${legacyId}` };
  const presented = await registryFileReferences(repository, stored, "output") as Record<string, unknown>;
  assert.equal(presented.artifactId, "file-17");
  assert.equal("contentSha256" in presented, false);
  assert.deepEqual(presented.metadata, stored.metadata);
  assert.equal(presented.summary, stored.summary);
  const resolved = await registryFileReferences(repository, presented, "input") as Record<string, unknown>;
  assert.equal(resolved.artifactId, legacyId);
  assert.deepEqual(resolved.metadata, stored.metadata);
  const artifact = await registryFileReferences(repository, { id: legacyId, kind: "source_payload", storageKey: "old/location", sha256: "a".repeat(64), metadata: { originalName: "sample.pdf" } }, "output") as Record<string, unknown>;
  assert.equal(artifact.id, "file-17");
  assert.equal("storageKey" in artifact, false);
});

test("new stored files use reserved references and original filenames, with internal integrity metadata", async () => {
  const directory = await mkdtemp(join(tmpdir(), "case-file-store-"));
  try {
    const path = join(directory, "source.pdf");
    await writeFile(path, "Fixture bytes");
    let uploaded: Parameters<ArtifactStore["putFile"]>[0] | undefined;
    const store = { async putFile(input: Parameters<ArtifactStore["putFile"]>[0]) { uploaded = input; } } as unknown as ArtifactStore;
    const artifact = await storeSourcePayload(store, path, { reference: "file-42", filename: "交付清单.pdf", metadata: { receivedFrom: "Vendor" } });
    assert.equal(artifact.id, "file-42");
    assert.equal(artifact.storageKey, "files/file-42/交付清单.pdf");
    assert.equal(artifact.metadata!.originalName, "交付清单.pdf");
    assert.equal(uploaded?.sha256, createHash("sha256").update("Fixture bytes").digest("hex"));
    assert.equal(await readFile(path, "utf8"), "Fixture bytes");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("downloads verify bytes and never delete an existing local file", async () => {
  const bytes = Buffer.from("Original sample bytes");
  const server = createServer((_request, response) => { response.setHeader("content-length", bytes.length); response.end(bytes); });
  const directory = await mkdtemp(join(tmpdir(), "case-file-download-"));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const store = new ArtifactStore({ endpoint: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, region: "us-east-1", bucket: "fixture", accessKeyId: "fixture", secretAccessKey: "fixture", forcePathStyle: true });
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const existing = join(directory, "existing.pdf");
    await writeFile(existing, "Keep this original");
    await assert.rejects(() => store.downloadFile({ key: "file-1", path: existing, sha256 }), /EEXIST/);
    assert.equal(await readFile(existing, "utf8"), "Keep this original");
    const output = join(directory, "download.pdf");
    await store.downloadFile({ key: "file-1", path: output, sha256, sizeBytes: bytes.length });
    assert.deepEqual(await readFile(output), bytes);
    const bad = join(directory, "bad.pdf");
    await assert.rejects(() => store.downloadFile({ key: "file-1", path: bad, sha256: "b".repeat(64) }), /do not match/);
    await assert.rejects(() => readFile(bad), /ENOENT/);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(directory, { recursive: true, force: true });
  }
});
