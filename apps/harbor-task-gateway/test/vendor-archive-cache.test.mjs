import assert from "node:assert/strict";
import test from "node:test";
import { createVendorArchiveCache } from "../src/vendor-archive-cache.mjs";

const files = new Map([
  ["vendor/submission/task-one/instruction.md", Buffer.from("first instruction\n")],
  ["vendor/submission/task-one/task.toml", Buffer.from("schema_version = \"1.0\"\n")],
  ["vendor/submission/task-two/environment/Dockerfile", Buffer.from("FROM scratch\n")],
  ["vendor/submission/task-two/task.toml", Buffer.from("schema_version = \"1.0\"\n")],
  ["vendor/submission/unselected/task.toml", Buffer.from("not selected\n")],
]);

test("builds one deterministic ZIP, then serves a cache hit without rereading task bytes", async () => {
  const cache = new Map();
  const reads = [];
  const uploads = [];
  const prepare = createVendorArchiveCache({
    listSourceObjects: async ({ prefix }) => ({
      objects: [...files].filter(([key]) => key.startsWith(prefix)).map(([key, bytes]) => ({
        key,
        sizeBytes: bytes.length,
        etag: `\"${key.length}-${bytes.length}\"`,
      })),
    }),
    readSourceObject: async (key) => {
      reads.push(key);
      return { body: files.get(key), contentLength: files.get(key).length };
    },
    headCacheObject: async (key) => cache.has(key) ? { contentLength: cache.get(key).length } : null,
    uploadCacheObject: async ({ key, body, contentType, metadata }) => {
      const chunks = [];
      for await (const chunk of body) chunks.push(Buffer.from(chunk));
      const bytes = Buffer.concat(chunks);
      cache.set(key, bytes);
      uploads.push({ key, contentType, metadata });
    },
    signCacheObject: async ({ key, filename }) => `https://cache.example/${key}?filename=${encodeURIComponent(filename)}`,
    signedUrlTtlSeconds: 900,
  });
  const request = {
    roots: ["vendor/submission/task-two", "vendor/submission/task-one"],
    manifest: { schemaVersion: "case.vendor-harbor-task-files.v1", vendor: { id: "vendor" } },
    filename: "Vendor-harbor-tasks.zip",
  };

  const miss = await prepare(request);
  assert.equal(miss.cacheHit, false);
  assert.equal(miss.fileCount, 4);
  assert.equal(miss.taskCount, 2);
  assert.equal(uploads.length, 1);
  assert.equal(uploads[0].contentType, "application/zip");
  assert.deepEqual(uploads[0].metadata, {
    schema: "case-vendor-harbor-zip-v1",
    "task-count": "2",
    "file-count": "4",
    "source-bytes": String([...files].filter(([key]) => !key.includes("/unselected/")).reduce((sum, [, bytes]) => sum + bytes.length, 0)),
  });
  assert.deepEqual(reads, [
    "vendor/submission/task-two/environment/Dockerfile",
    "vendor/submission/task-two/task.toml",
    "vendor/submission/task-one/instruction.md",
    "vendor/submission/task-one/task.toml",
  ]);
  assert.deepEqual(zipEntryNames(cache.get(uploads[0].key)), [
    "manifest.json",
    "vendor/submission/task-two/environment/Dockerfile",
    "vendor/submission/task-two/task.toml",
    "vendor/submission/task-one/instruction.md",
    "vendor/submission/task-one/task.toml",
  ]);

  reads.length = 0;
  const hit = await prepare(request);
  assert.equal(hit.cacheHit, true);
  assert.equal(hit.downloadUrl, miss.downloadUrl);
  assert.equal(hit.sizeBytes, miss.sizeBytes);
  assert.equal(uploads.length, 1);
  assert.deepEqual(reads, []);
});

test("refuses unsafe source object paths", async () => {
  const prepare = createVendorArchiveCache({
    listSourceObjects: async () => ({
      objects: [
        { key: "vendor/submission/task/task.toml", sizeBytes: 1, etag: "one" },
        { key: "vendor/submission/task/../escape", sizeBytes: 1, etag: "two" },
      ],
    }),
    readSourceObject: async () => ({ body: Buffer.from("x") }),
    headCacheObject: async () => null,
    uploadCacheObject: async () => undefined,
    signCacheObject: async () => "https://cache.example/archive.zip",
    signedUrlTtlSeconds: 900,
  });
  await assert.rejects(
    prepare({ roots: ["vendor/submission/task"], manifest: {}, filename: "tasks.zip" }),
    /unsafe source object path/,
  );
});

function zipEntryNames(bytes) {
  let end = -1;
  for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 65_557); offset -= 1) {
    if (bytes.readUInt32LE(offset) === 0x06054b50) {
      end = offset;
      break;
    }
  }
  assert.notEqual(end, -1, "ZIP end-of-central-directory record should exist");
  const count = bytes.readUInt16LE(end + 10);
  let offset = bytes.readUInt32LE(end + 16);
  const names = [];
  for (let index = 0; index < count; index += 1) {
    assert.equal(bytes.readUInt32LE(offset), 0x02014b50);
    const nameLength = bytes.readUInt16LE(offset + 28);
    const extraLength = bytes.readUInt16LE(offset + 30);
    const commentLength = bytes.readUInt16LE(offset + 32);
    names.push(bytes.subarray(offset + 46, offset + 46 + nameLength).toString("utf8"));
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return names;
}
