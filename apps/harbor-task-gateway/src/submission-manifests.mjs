import {createHash} from 'node:crypto';
import {normalizeSubmissionRequest, submissionRevision} from './submission-archives.mjs';

const maximumBytes = 128 * 1024 * 1024;
const shaPattern = /^[a-f0-9]{64}$/;

// This service reads only source listings and HEAD metadata. It never reads task
// bodies, builds archives, or accesses the disposable archive bucket.
export function createSubmissionManifestService({listSourceObjects, headSourceObject, maxScans = 1, maxCachedBytes = maximumBytes}) {
  const jobs = new Map();
  let active = 0;

  function prune(keep) {
    let bytes = [...jobs.values()].reduce((sum, job) => sum + (job.bytes ?? 0), 0);
    for (const [key, job] of jobs) {
      if (jobs.size <= 32 && bytes <= maxCachedBytes) break;
      if (key === keep || job.status === 'building') continue;
      jobs.delete(key);
      bytes -= job.bytes ?? 0;
    }
  }

  return {
    async prepare(input) {
      const request = normalizeSubmissionRequest(input);
      const revision = submissionRevision(request);
      let job = jobs.get(revision);
      if (job && !(job.status === 'failed' && input.retry)) {
        jobs.delete(revision); jobs.set(revision, job);
        return job.result ?? {status: job.status, revision, ...job.progress};
      }
      if (active >= maxScans) return {status: 'busy', revision};
      job = {status: 'building', progress: {completedFiles: 0, fileCount: 0}};
      jobs.set(revision, job);
      active += 1;
      void scan(request, revision, job).then(result => {
        job.status = 'ready'; job.result = result;
        job.bytes = Buffer.byteLength(result.manifestJson);
      }).catch(error => {
        job.status = 'failed';
        job.result = {status: 'failed', revision, error: error instanceof Error ? error.message : String(error)};
      }).finally(() => {active -= 1; prune(revision);});
      prune(revision);
      return {status: 'building', revision, ...job.progress};
    },
  };

  async function inventory(request) {
    const prefix = `${request.storageVendorId}/${request.submissionId}/`;
    const tasks = new Map(request.tasks.map(task => [task.name, task]));
    const objects = new Map();
    const cursors = new Set();
    let cursor;
    do {
      const page = await listSourceObjects({prefix, cursor, limit: 1000, recursive: true});
      for (const object of page.objects ?? []) {
        if (!object.key?.startsWith(prefix)) throw new Error('Source listing escaped the submission');
        const path = object.key.slice(prefix.length);
        const parts = path.split('/');
        if (!tasks.has(parts[0])) continue;
        if (parts.length < 2 || parts.some(part => !part || part === '.' || part === '..') || /[\x00-\x1f\x7f\\]/.test(path) || objects.has(path)) throw new Error('Unsafe or duplicate source path');
        if (!Number.isSafeInteger(object.sizeBytes) || object.sizeBytes < 0 || !object.etag) throw new Error('Source listing lacks size or ETag');
        objects.set(path, {...object, path, task: tasks.get(parts[0])});
        if (objects.size > 500_000) throw new Error('Submission exceeds manifest file limit');
      }
      cursor = page.nextCursor;
      if (cursor && cursors.has(cursor)) throw new Error('Source listing repeated a cursor');
      if (cursor) cursors.add(cursor);
    } while (cursor);
    for (const task of request.tasks) if (!objects.has(`${task.name}/task.toml`)) throw new Error(`Missing task.toml: ${task.name}`);
    return objects;
  }

  async function scan(request, revision, job) {
    const before = await inventory(request);
    const objects = [...before.values()].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
    job.progress.fileCount = objects.length;
    const files = [];
    let sourceBytes = 0;
    for (let offset = 0; offset < objects.length; offset += 16) {
      const batch = objects.slice(offset, offset + 16);
      const heads = await Promise.allSettled(batch.map(object => headSourceObject(object.key, {ifMatch: object.etag})));
      for (let index = 0; index < batch.length; index += 1) {
        if (heads[index].status === 'rejected') throw heads[index].reason;
        const object = batch[index], head = heads[index].value;
        const mode = typeof head?.mode === 'string' && /^[0-7]{3,4}$/.test(head.mode) ? parseInt(head.mode, 8) : NaN;
        if (!head || head.contentLength !== object.sizeBytes || head.etag !== object.etag || !shaPattern.test(head.sha256 ?? '') || head.artifactSha256 !== object.task.artifactSha256 || !Number.isInteger(mode) || mode > 0o777) {
          throw new Error(`Missing or inconsistent CASE export metadata: ${object.path}`);
        }
        files.push({path: object.path, sourceKey: object.key, sizeBytes: object.sizeBytes, sha256: head.sha256, mode: mode.toString(8).padStart(3, '0')});
        sourceBytes += object.sizeBytes;
        job.progress.completedFiles += 1;
      }
    }
    const after = await inventory(request);
    if (before.size !== after.size || objects.some(object => {
      const current = after.get(object.path);
      return !current || current.etag !== object.etag || current.sizeBytes !== object.sizeBytes;
    })) throw new Error('Source inventory changed during manifest scan');
    if (!Number.isSafeInteger(sourceBytes)) throw new Error('Submission byte count exceeds safe integer limit');
    const manifestJson = JSON.stringify({...request, revision, layout: 'task-directories-at-root', files}, null, 2) + '\n';
    if (Buffer.byteLength(manifestJson) > maximumBytes) throw new Error('Submission manifest is too large');
    return {status: 'ready', schemaVersion: request.schemaVersion, revision, manifestJson,
      manifestSha256: createHash('sha256').update(manifestJson).digest('hex'),
      fileCount: files.length, taskCount: request.tasks.length, sourceBytes};
  }
}
