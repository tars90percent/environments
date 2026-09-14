import assert from 'node:assert/strict';
import {createHash, randomBytes} from 'node:crypto';
import {mkdtemp, mkdir, writeFile, readFile, rm, symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {inflateRawSync} from 'node:zlib';
import test from 'node:test';
import {createSubmissionArchiveService, submissionCacheKey} from '../../apps/harbor-task-gateway/src/submission-archives.mjs';
import {rebuild} from './rebuild.mjs';

const sha = data => createHash('sha256').update(data).digest('hex');

test('JFS builder reproduces gateway ZIP64 bytes and rejects changed sources, links, and encoding', async () => {
  const root = await mkdtemp(join(tmpdir(), 'archive-builder-'));
  try {
    const cache = new Map(), receipts = new Map();
    const files = new Map([
      ['vendor/delivery/task/task.toml', Buffer.from('version = "1.0"\n')],
      ['vendor/delivery/task/tests/test.sh', Buffer.from('#!/bin/sh\nexit 0\n')],
      ['vendor/delivery/task/large.bin', Buffer.concat([randomBytes(200000), Buffer.alloc(200000, 42)])],
      ['vendor/delivery/task/empty', Buffer.alloc(0)],
    ]);
    const service = createSubmissionArchiveService({
      listSourceObjects: async () => ({objects: [...files].map(([key, bytes]) => ({key, sizeBytes: bytes.length, etag: sha(bytes)}))}),
      readSourceObject: async key => {const bytes = files.get(key); return {body: bytes, contentLength: bytes.length, etag: sha(bytes), sha256: sha(bytes), artifactSha256: 'a'.repeat(64), mode: key.endsWith('.sh') ? '755' : '644'};},
      headCacheObject: async key => cache.has(key) ? {contentLength: cache.get(key).length} : null,
      readCacheJson: async key => receipts.get(key),
      writeCacheJson: async (key, value) => receipts.set(key, value),
      uploadCacheObject: async ({key, body}) => {const chunks = []; for await (const chunk of body) chunks.push(chunk); cache.set(key, Buffer.concat(chunks));},
      signCacheObject: async () => 'https://example.test/archive.zip', signedUrlTtlSeconds: 900,
    });
    const request = {vendorId: 'vendor', storageVendorId: 'vendor', submissionId: 'delivery', tasks: [{taskVersionId: 'version:1', name: 'task', artifactSha256: 'a'.repeat(64)}]};
    let receipt;
    for (let i = 0; i < 500; i++) {
      receipt = await service.prepare(request);
      if (receipt.status === 'ready') break;
      assert.notEqual(receipt.status, 'failed');
      await new Promise(resolve => setTimeout(resolve, 5));
    }
    assert.equal(receipt.status, 'ready');
    const expected = cache.get(submissionCacheKey(receipt.revision));
    const zip64 = Number(expected.readBigUInt64LE(expected.length - 34));
    let offset = Number(expected.readBigUInt64LE(zip64 + 48)), manifestBytes;
    while (expected.readUInt32LE(offset) === 0x02014b50) {
      const length = expected.readUInt16LE(offset + 28), name = expected.subarray(offset + 46, offset + 46 + length).toString();
      if (name === 'manifest.json') {
        const local = expected.readUInt32LE(offset + 42), size = expected.readUInt32LE(offset + 20);
        const start = local + 30 + expected.readUInt16LE(local + 26) + expected.readUInt16LE(local + 28);
        manifestBytes = inflateRawSync(expected.subarray(start, start + size));
        break;
      }
      offset += 46 + length + expected.readUInt16LE(offset + 30) + expected.readUInt16LE(offset + 32);
    }
    assert.equal(sha(manifestBytes), receipt.manifestSha256);
    for (const [key, bytes] of files) {await mkdir(join(root, key, '..'), {recursive: true}); await writeFile(join(root, key), bytes);}
    const output = join(root, 'rebuilt.zip');
    const input = {manifestBytes, rawRoot: root, output, expectedSha256: receipt.sha256};
    assert.equal((await rebuild(input)).status, 'identical');
    assert.deepEqual(await readFile(output), expected);
    await assert.rejects(rebuild(input), {code: 'EEXIST'});
    assert.deepEqual(await readFile(output), expected);
    await rm(output);
    assert.equal((await rebuild({...input, expectedSha256: 'b'.repeat(64)})).status, 'different_encoding');
    await assert.rejects(readFile(output), {code: 'ENOENT'});
    const changed = 'vendor/delivery/task/task.toml';
    await writeFile(join(root, changed), Buffer.alloc(files.get(changed).length));
    await assert.rejects(rebuild(input), /checksum mismatch/);
    await assert.rejects(readFile(output), {code: 'ENOENT'});
    await rm(join(root, changed));
    await symlink(join(root, 'vendor/delivery/task/large.bin'), join(root, changed));
    await assert.rejects(rebuild(input), /link or special file/);
    await assert.rejects(readFile(output), {code: 'ENOENT'});
  } finally {await rm(root, {recursive: true, force: true});}
});
