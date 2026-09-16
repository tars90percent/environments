import assert from 'node:assert/strict';
import {createHash, randomBytes} from 'node:crypto';
import {mkdtemp, mkdir, writeFile, readFile, rm, symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import test from 'node:test';
import {createSubmissionManifestService} from '../../apps/harbor-task-gateway/src/submission-manifests.mjs';
import {normalizeSubmissionRequest} from '../../apps/harbor-task-gateway/src/submission-archives.mjs';
import {buildArchive} from './build.mjs';

const sha = data => createHash('sha256').update(data).digest('hex');

test('HEAD manifest -> local ZIP -> independent member/raw verification, without any Railway ZIP', async () => {
  const root = await mkdtemp(join(tmpdir(), 'archive-builder-'));
  try {
    const files = new Map([
      ['vendor/delivery/task/task.toml', Buffer.from('version = "1.0"\n')],
      ['vendor/delivery/task/tests/test.sh', Buffer.from('#!/bin/sh\nexit 0\n')],
      ['vendor/delivery/task/large.bin', Buffer.concat([randomBytes(200000), Buffer.alloc(200000, 42)])],
      ['vendor/delivery/task/empty', Buffer.alloc(0)],
    ]);
    const request = normalizeSubmissionRequest({vendorId: 'vendor', storageVendorId: 'vendor', submissionId: 'delivery', tasks: [{taskVersionId: 'version:1', name: 'task', artifactSha256: 'a'.repeat(64)}]});
    const service = createSubmissionManifestService({
      listSourceObjects: async () => ({objects: [...files].map(([key, bytes]) => ({key, sizeBytes: bytes.length, etag: sha(bytes)}))}),
      headSourceObject: async key => {const bytes = files.get(key); return {contentLength: bytes.length, etag: sha(bytes), sha256: sha(bytes), artifactSha256: 'a'.repeat(64), mode: key.endsWith('.sh') ? '755' : '644'};},
    });
    let manifest;
    for (let i = 0; i < 100; i++) {
      manifest = await service.prepare(request);
      if (manifest.status === 'ready') break;
      assert.notEqual(manifest.status, 'failed');
      await new Promise(resolve => setImmediate(resolve));
    }
    assert.equal(manifest.status, 'ready');
    const manifestBytes = Buffer.from(manifest.manifestJson);
    assert.equal(sha(manifestBytes), manifest.manifestSha256);
    for (const [key, bytes] of files) {await mkdir(join(root, key, '..'), {recursive: true}); await writeFile(join(root, key), bytes);}
    const output = join(root, 'archive.zip');
    const input = {manifestBytes, rawRoot: root, output};
    const result = await buildArchive(input);
    assert.equal(result.status, 'built');
    const encoded = await readFile(output);
    assert.equal(result.sha256, sha(encoded));
    assert.ok(encoded.includes(Buffer.from([0x50, 0x4b, 0x06, 0x06]))); // ZIP64 end record.
    await assert.rejects(buildArchive(input), {code: 'EEXIST'});
    assert.deepEqual(await readFile(output), encoded);
    await rm(output);
    assert.deepEqual(await buildArchive({...input, prefetchBytes: 1024}), result); // Streaming large files, bounded small batches.
    const receipt = {...manifest, ...result};
    delete receipt.manifestJson;
    const payload = join(root, 'verify.json');
    await writeFile(payload, JSON.stringify({receipt, request, output, root, node: process.execPath, builder: new URL("build.mjs", import.meta.url).pathname}));
    const verify = spawnSync('python3', ['-c', `
import importlib.util, json, sys
from pathlib import Path
spec = importlib.util.spec_from_file_location('publisher', 'publisher.py')
p = importlib.util.module_from_spec(spec); spec.loader.exec_module(p)
v = json.loads(Path(sys.argv[1]).read_text())
assert p.verify_archive(Path(v['output']), v['receipt'], v['request'], Path(v['root'])) == 4
# A different valid ZIP encoding is acceptable; member identities are unchanged.
import zipfile
other = Path(v['root']) / 'stored.zip'
with zipfile.ZipFile(v['output']) as source, zipfile.ZipFile(other, 'w') as target:
    for entry in source.infolist():
        data = source.read(entry.filename)
        entry.compress_type = zipfile.ZIP_STORED
        target.writestr(entry, data)
receipt = dict(v['receipt'], sha256=p.file_hash(other), sizeBytes=other.stat().st_size)
assert receipt['sha256'] != v['receipt']['sha256']
assert p.verify_archive(other, receipt, v['request'], Path(v['root'])) == 4
# Exercise the publisher's real local build and immutable destination reuse.
import time
from unittest import mock
root = Path(v['root'])
builder = root / 'builder'; (builder / 'runtime/bin').mkdir(parents=True)
(builder / 'runtime/bin/node').symlink_to(v['node'])
(builder / 'build.mjs').write_bytes(Path(v['builder']).read_bytes())
(builder / 'node_modules').symlink_to(Path(v['builder']).parent / 'node_modules')
manifest_path = root / 'manifest.json'
with zipfile.ZipFile(v['output']) as source:
    manifest_path.write_bytes(source.read('manifest.json'))
manifest_receipt = {k: v['receipt'][k] for k in ('schemaVersion', 'revision', 'manifestSha256', 'fileCount', 'taskCount', 'sourceBytes')}
with mock.patch.multiple(p, BUILDER=builder, STAGING=root / 'staging', RAW=root, RAW_STATE=root / 'state'), mock.patch.object(p, 'raw_ready'):
    built = p.build_archive(v['request'], manifest_path, manifest_receipt, time.monotonic() + 30)
    assert built['path'] == p.archive_path(v['request'], built['sha256'])
    assert p.build_archive(v['request'], manifest_path, manifest_receipt, time.monotonic() + 30) == built
    assert not list((p.STAGING / '.builds').iterdir())
    (root / 'vendor/delivery/task/unexpected').write_bytes(b'extra')
    try:
        p.build_archive(v['request'], manifest_path, manifest_receipt, time.monotonic() + 30)
        raise AssertionError('Extra raw file accepted')
    except ValueError as error:
        assert 'inventory' in str(error)
    assert not list((p.STAGING / '.builds').iterdir())
` , payload], {encoding: 'utf8', cwd: new URL('.', import.meta.url)});
    assert.equal(verify.status, 0, verify.stderr);
    await rm(output);
    const changed = 'vendor/delivery/task/task.toml';
    await writeFile(join(root, changed), Buffer.alloc(files.get(changed).length));
    await assert.rejects(buildArchive(input), /checksum mismatch/);
    await assert.rejects(readFile(output), {code: 'ENOENT'});
    await rm(join(root, changed));
    await symlink(join(root, 'vendor/delivery/task/large.bin'), join(root, changed));
    await assert.rejects(buildArchive(input), /link or special file/);
    await assert.rejects(readFile(output), {code: 'ENOENT'});
  } finally {await rm(root, {recursive: true, force: true});}
});
