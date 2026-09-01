import assert from "node:assert/strict";
import test from "node:test";
import { taskArchiveChunks } from "../src/task-archive.mjs";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

test("streams exact task files and preserves paths longer than a tar header", async () => {
  const root = "vendor/submission/task";
  const longPath = `${root}/environment/${"nested-directory/".repeat(7)}fixture.txt`;
  const files = new Map([
    [`${root}/task.toml`, encoder.encode("schema_version = \"1.0\"\n")],
    [longPath, encoder.encode("long path payload")],
  ]);
  const chunks = [];
  for await (const chunk of taskArchiveChunks({
    roots: [root],
    listObjects: async ({ prefix }) => ({
      objects: [...files].filter(([path]) => path.startsWith(prefix)).map(([key, bytes]) => ({ key, sizeBytes: bytes.length })),
      nextCursor: undefined,
    }),
    readObject: async (key) => ({ body: new Response(files.get(key)).body, contentLength: files.get(key).length }),
  })) chunks.push(chunk);

  const archive = join(chunks);
  const entries = tarEntries(archive);
  assert.deepEqual([...entries.keys()], [longPath, `${root}/task.toml`]);
  assert.equal(decoder.decode(entries.get(`${root}/task.toml`)), "schema_version = \"1.0\"\n");
  assert.equal(decoder.decode(entries.get(longPath)), "long path payload");
});

function join(chunks) {
  const bytes = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}

function tarEntries(bytes) {
  const entries = new Map();
  let offset = 0;
  let paxPath = null;
  while (offset + 512 <= bytes.length) {
    const header = bytes.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;
    const path = cString(header.subarray(0, 100));
    const size = Number.parseInt(cString(header.subarray(124, 136)).trim() || "0", 8);
    const type = String.fromCharCode(header[156] || 48);
    const body = bytes.slice(offset + 512, offset + 512 + size);
    offset += 512 + size + ((512 - (size % 512)) % 512);
    if (type === "x") {
      const record = decoder.decode(body);
      paxPath = record.match(/ path=([^\n]+)\n$/)?.[1] ?? null;
      continue;
    }
    entries.set(paxPath ?? path, body);
    paxPath = null;
  }
  return entries;
}

function cString(bytes) {
  const end = bytes.indexOf(0);
  return decoder.decode(end >= 0 ? bytes.subarray(0, end) : bytes);
}
