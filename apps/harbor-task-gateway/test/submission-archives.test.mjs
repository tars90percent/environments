import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { inflateRawSync } from 'node:zlib';
import test from 'node:test';
import { createSubmissionArchiveService, normalizeSubmissionRequest, submissionRevision, submissionCacheKey } from '../src/submission-archives.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const request = {vendorId: 'vendor', storageVendorId: 'vendor', submissionId: 'delivery', tasks: [{taskVersionId: 'version:1', name: 'task', artifactSha256: 'a'.repeat(64)}]};
function fixture(mutate = () => {}) {
  const cache = new Map(); const receipts = new Map(); const reads = [];
  const files = new Map([['vendor/delivery/task/task.toml', Buffer.from('version = "1.0"\n')], ['vendor/delivery/task/tests/test.sh', Buffer.from('#!/bin/sh\nexit 0\n')]]);
  const deps = {
    listSourceObjects: async () => ({objects: [...files].map(([key, bytes]) => ({key, sizeBytes: bytes.length, etag: sha(bytes)}))}),
    readSourceObject: async (key, {ifMatch}) => {const bytes = files.get(key); reads.push(key); assert.equal(ifMatch, sha(bytes)); return {body: bytes, contentLength: bytes.length, etag: sha(bytes), sha256: sha(bytes), artifactSha256: 'a'.repeat(64), mode: key.endsWith('.sh') ? '755' : '644'};},
    headCacheObject: async key => cache.has(key) ? {contentLength: cache.get(key).length} : null,
    readCacheJson: async key => receipts.get(key),
    writeCacheJson: async (key, value) => receipts.set(key, value),
    uploadCacheObject: async ({key, body}) => {const chunks = []; for await (const chunk of body) chunks.push(chunk); cache.set(key, Buffer.concat(chunks));},
    signCacheObject: async ({key}) => 'https://example.test/' + key,
    readCacheObject: async key => ({body: cache.get(key), contentLength: cache.get(key).length}),
    signedUrlTtlSeconds: 900,
  };
  mutate(deps, files);
  return {service: createSubmissionArchiveService(deps), cache, receipts, reads, files, deps};
}
async function finish(service, input = request) {
  for (let i = 0; i < 500; i++) {const result = await service.prepare(input); if (['ready', 'failed'].includes(result.status)) return result; await new Promise(resolve => setTimeout(resolve, 5));}
  assert.fail('build did not finish');
}
// Inspect central directory, including ZIP64, and decompress without extracting code.
function entries(bytes) {
  const locator = bytes.length - 42;
  assert.equal(bytes.readUInt32LE(locator), 0x07064b50);
  const end = Number(bytes.readBigUInt64LE(locator + 8));
  const count = Number(bytes.readBigUInt64LE(end + 32));
  let offset = Number(bytes.readBigUInt64LE(end + 48));
  const result = new Map();
  for (let i = 0; i < count; i++) {
    assert.equal(bytes.readUInt32LE(offset), 0x02014b50);
    const nameLength = bytes.readUInt16LE(offset + 28), extraLength = bytes.readUInt16LE(offset + 30), commentLength = bytes.readUInt16LE(offset + 32);
    const name = bytes.subarray(offset + 46, offset + 46 + nameLength).toString();
    const local = bytes.readUInt32LE(offset + 42), size = bytes.readUInt32LE(offset + 20);
    const start = local + 30 + bytes.readUInt16LE(local + 26) + bytes.readUInt16LE(local + 28);
    const compressed = bytes.subarray(start, start + size);
    result.set(name, {mode: (bytes.readUInt32LE(offset + 38) >>> 16) & 0o777, bytes: bytes.readUInt16LE(offset + 10) === 8 ? inflateRawSync(compressed) : compressed});
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return result;
}
test('submission ZIP64 preserves bytes and modes, receipts bind exact versions, and restart reuses cache', async () => {
  const f = fixture(); const result = await finish(f.service);
  assert.equal(result.status, 'ready'); assert.equal(result.fileCount, 2);
  const bytes = f.cache.get(submissionCacheKey(result.revision));
  assert.equal(result.sha256, sha(bytes));
  const contents = entries(bytes);
  assert.deepEqual([...contents.keys()], ['task/task.toml', 'task/tests/test.sh', 'manifest.json']);
  assert.equal(contents.get('task/tests/test.sh').mode, 0o755);
  const manifest = JSON.parse(contents.get('manifest.json').bytes);
  assert.equal(result.manifestSha256, sha(contents.get('manifest.json').bytes));
  assert.deepEqual(manifest.tasks, normalizeSubmissionRequest(request).tasks);
  for (const file of manifest.files) assert.equal(sha(contents.get(file.path).bytes), file.sha256);
  f.reads.length = 0;
  const restarted = createSubmissionArchiveService(f.deps);
  assert.equal((await restarted.prepare(request)).status, 'ready');
  assert.deepEqual(f.reads, []);
});
test('revisions ignore notes, include task versions, and reject duplicates or unsafe paths', () => {
  assert.equal(submissionRevision({...request, evaluation: 'changed'}), submissionRevision(request));
  assert.notEqual(submissionRevision({...request, tasks: [{...request.tasks[0], taskVersionId: 'version:2'}]}), submissionRevision(request));
  assert.throws(() => normalizeSubmissionRequest({...request, tasks: [...request.tasks, ...request.tasks]}), /duplicate/);
  assert.throws(() => normalizeSubmissionRequest({...request, submissionId: '../escape'}), /invalid/);
});
for (const field of ['sha256', 'artifactSha256', 'mode', 'contentLength']) test(`rejects inconsistent source ${field} without publishing a receipt`, async () => {
  const f = fixture(deps => {const original = deps.readSourceObject; deps.readSourceObject = async (...args) => ({...await original(...args), [field]: field === 'contentLength' ? 999 : field === 'mode' ? '4755' : 'b'.repeat(64)});});
  assert.equal((await finish(f.service)).status, 'failed');
  assert.equal(f.receipts.size, 0);
});
test('upload failure is retryable and an orphan ZIP is never treated as ready', async () => {
  let fail = true;
  const f = fixture(deps => {const original = deps.uploadCacheObject; deps.uploadCacheObject = async input => {if (fail) {input.body.destroy(new Error('interrupted upload')); throw new Error('interrupted upload');} return original(input);};});
  assert.equal((await finish(f.service)).status, 'failed');
  assert.equal(f.receipts.size, 0); fail = false;
  assert.equal((await finish(f.service, {...request, retry: true})).status, 'ready');
});
test('simultaneous identical requests only build once and capacity is bounded', async () => {
  const f = fixture();
  const results = await Promise.all([f.service.prepare(request), f.service.prepare(request), f.service.prepare({...request, submissionId: 'another'})]);
  assert.equal(results[2].status, 'busy');
  assert.equal((await finish(f.service)).status, 'ready');
  assert.equal(f.reads.length, 2);
});
test('a task gaining a file during construction cannot publish an incomplete archive', async () => {
  let listings = 0;
  const f = fixture(deps => {const original = deps.listSourceObjects; deps.listSourceObjects = async () => {
    const result = await original();
    if (++listings > 1) result.objects.push({key: 'vendor/delivery/task/late-file', sizeBytes: 1, etag: 'new'});
    return result;
  };});
  assert.equal((await finish(f.service)).status, 'failed'); assert.equal(f.receipts.size, 0);
});
