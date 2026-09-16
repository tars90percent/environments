import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import test from 'node:test';
import {createSubmissionManifestService} from '../src/submission-manifests.mjs';
import {normalizeSubmissionRequest, submissionRevision} from '../src/submission-archives.mjs';

const request = {vendorId: 'v', storageVendorId: 'storage', submissionId: 's', tasks: [{taskVersionId: 't:1', name: 'task', artifactSha256: 'a'.repeat(64)}]};
const objects = [
  {key: 'storage/s/task/task.toml', sizeBytes: 3, etag: 'a'},
  {key: 'storage/s/task/tests/run.sh', sizeBytes: 7, etag: 'b'},
];
const head = object => ({contentLength: object.sizeBytes, etag: object.etag, sha256: 'b'.repeat(64), artifactSha256: 'a'.repeat(64), mode: object.key.endsWith('.sh') ? '0755' : '644'});
const fixture = overrides => createSubmissionManifestService({
  listSourceObjects: async () => ({objects}),
  headSourceObject: async (key, {ifMatch}) => {const object = objects.find(o => o.key === key); assert.equal(ifMatch, object.etag); return head(object);},
  ...overrides,
});
async function complete(service, input = request) {
  for (let i = 0; i < 100; i++) {
    const result = await service.prepare(input);
    if (['ready', 'failed'].includes(result.status)) return result;
    await new Promise(resolve => setImmediate(resolve));
  }
  throw new Error('Manifest scan did not finish');
}

test('manifest needs only listing and HEAD metadata, paginates twice, and binds exact versions', async () => {
  const lists = [], heads = [];
  const service = fixture({
    listSourceObjects: async input => {lists.push(input); return input.cursor ? {objects: objects.slice(1)} : {objects: objects.slice(0, 1), nextCursor: 'next'};},
    headSourceObject: async (key, options) => {heads.push({key, ...options}); return head(objects.find(o => o.key === key));},
  });
  const result = await complete(service);
  assert.equal(result.status, 'ready');
  assert.equal(result.revision, submissionRevision(normalizeSubmissionRequest(request)));
  assert.equal(createHash('sha256').update(result.manifestJson).digest('hex'), result.manifestSha256);
  const manifest = JSON.parse(result.manifestJson);
  assert.deepEqual(manifest.tasks, request.tasks);
  assert.deepEqual(manifest.files.map(f => [f.path, f.mode]), [['task/task.toml', '644'], ['task/tests/run.sh', '755']]);
  assert.equal(result.sourceBytes, 10);
  assert.equal(result.fileCount, 2);
  assert.equal(lists.length, 4);
  assert.deepEqual(heads.map(h => h.ifMatch), ['a', 'b']);
  assert.deepEqual(await service.prepare(request), result);
  assert.equal(lists.length, 4);
});

test('missing or mismatched CASE export metadata fails closed and explicit retry rescans', async () => {
  for (const invalid of [{sha256: ''}, {artifactSha256: 'c'.repeat(64)}, {etag: 'changed'}, {contentLength: 99}, {mode: '4755'}]) {
    let bad = true;
    const service = fixture({headSourceObject: async key => ({...head(objects.find(o => o.key === key)), ...(bad ? invalid : {})})});
    assert.equal((await complete(service)).status, 'failed');
    bad = false;
    assert.equal((await service.prepare(request)).status, 'failed');
    assert.equal((await service.prepare({...request, retry: true})).status, 'building');
    assert.equal((await complete(service)).status, 'ready');
  }
});

test('inventory changes, unsafe paths, missing markers and repeated pagination fail closed', async () => {
  let lists = 0;
  const changed = fixture({listSourceObjects: async () => ({objects: ++lists === 1 ? objects : objects.slice(0, 1)})});
  assert.match((await complete(changed)).error, /changed/);
  for (const listing of [objects.slice(1), [...objects, objects[0]], [...objects, {key: 'storage/s/task/../outside', sizeBytes: 0, etag: 'z'}]]) {
    assert.equal((await complete(fixture({listSourceObjects: async () => ({objects: listing})}))).status, 'failed');
  }
  assert.match((await complete(fixture({listSourceObjects: async () => ({objects: [], nextCursor: 'repeated'})}))).error, /repeated/);
});

test('concurrent scans are bounded and completed manifests are evicted within cache limits', async () => {
  let release;
  const blocked = new Promise(resolve => {release = resolve;});
  let calls = 0;
  const service = fixture({maxCachedBytes: 1, listSourceObjects: async () => {calls++; await blocked; return {objects};}});
  assert.equal((await service.prepare(request)).status, 'building');
  const other = {...request, vendorId: 'other'};
  assert.equal((await service.prepare(other)).status, 'busy');
  release();
  assert.equal((await complete(service)).status, 'ready');
  assert.equal((await complete(service, other)).status, 'ready');
  const before = calls;
  assert.equal((await service.prepare(request)).status, 'building');
  assert.equal((await complete(service)).status, 'ready');
  assert.ok(calls > before);
});
