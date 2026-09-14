import { createHash } from 'node:crypto';
import { PassThrough, Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import ZipStream from 'zip-stream';

export const submissionArchiveSchema = 'case.submission-harbor-archive.v1';
const archiveDate = new Date('1980-01-01T00:00:00.000Z');
const shaPattern = /^[a-f0-9]{64}$/;
const cachePrefix = 'submission-archives-v1/';

function segment(value, label) {
  if (typeof value !== 'string' || !value || value.length > 200 || value === '.' || value === '..' || /[\x00-\x1f\x7f\\/]/.test(value)) throw new Error(`invalid ${label}`);
  return value;
}

export function normalizeSubmissionRequest(input) {
  if (!input || typeof input !== 'object') throw new Error('submission request is required');
  const vendorId = segment(input.vendorId, 'vendorId');
  const storageVendorId = segment(input.storageVendorId, 'storageVendorId');
  const submissionId = segment(input.submissionId, 'submissionId');
  if (!Array.isArray(input.tasks) || input.tasks.length < 1 || input.tasks.length > 1000) throw new Error('tasks must contain 1–1000 exact Harbor task versions');
  const roots = new Set();
  const ids = new Set();
  const tasks = input.tasks.map(task => {
    const taskVersionId = segment(task?.taskVersionId, 'taskVersionId');
    const name = segment(task?.name, 'task name');
    if (!shaPattern.test(task?.artifactSha256 ?? '')) throw new Error('task artifactSha256 must be SHA-256');
    if (roots.has(name) || ids.has(taskVersionId)) throw new Error('duplicate task name or version');
    roots.add(name); ids.add(taskVersionId);
    return { taskVersionId, name, artifactSha256: task.artifactSha256 };
  }).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
  return { schemaVersion: submissionArchiveSchema, vendorId, storageVendorId, submissionId, tasks };
}

export function submissionRevision(request) {
  return createHash('sha256').update(JSON.stringify(normalizeSubmissionRequest(request))).digest('hex');
}

export function submissionCacheKey(revision, extension = 'zip') {
  if (!shaPattern.test(revision) || !['zip', 'json'].includes(extension)) throw new Error('invalid archive revision');
  return `${cachePrefix}${revision}.${extension}`;
}

/** Source objects are immutable CASE exports. A receipt is published only after every
 * file's recorded identity, mode, length and SHA-256 has been checked. Existing
 * portal archives keep their existing API and layout. */
export function createSubmissionArchiveService({ listSourceObjects, readSourceObject, headCacheObject, readCacheJson, writeCacheJson, uploadCacheObject, signCacheObject, readCacheObject, signedUrlTtlSeconds, maxBuilds = 1 }) {
  const jobs = new Map();
  let active = 0;

  async function receipt(revision) {
    const value = await readCacheJson(submissionCacheKey(revision, 'json'));
    if (!value) return null;
    if (value.schemaVersion !== submissionArchiveSchema || value.revision !== revision || !shaPattern.test(value.sha256 ?? '') || submissionRevision(value.request) !== revision) throw new Error('invalid cached submission receipt');
    const metadata = await headCacheObject(submissionCacheKey(revision));
    if (!metadata || metadata.contentLength !== value.sizeBytes) return null;
    return value;
  }

  async function ready(value, cacheHit) {
    const filename = `${value.request.submissionId}--${value.revision.slice(0, 16)}.zip`;
    return { ...value, request: undefined, status: 'ready', cacheHit, filename,
      downloadPath: `/submission-archives/${value.revision}.zip`,
      downloadUrl: await signCacheObject({key: submissionCacheKey(value.revision), filename, expiresInSeconds: signedUrlTtlSeconds}), expiresInSeconds: signedUrlTtlSeconds };
  }

  return {
    async prepare(input) {
      const request = normalizeSubmissionRequest(input);
      const revision = submissionRevision(request);
      const cached = await receipt(revision);
      if (cached) return ready(cached, true);
      const job = jobs.get(revision);
      if (job?.error && !input.retry) return {status: 'failed', revision, error: job.error};
      if (job && !job.error) return {status: 'building', revision, ...job.progress};
      if (active >= maxBuilds) return {status: 'busy', revision, retryAfterSeconds: 15};
      // No awaits between this capacity check and registering the job.
      active += 1;
      const current = {progress: {completedFiles: 0, fileCount: 0}};
      jobs.set(revision, current);
      void build(request, revision, current).catch(error => {
        current.error = error instanceof Error ? error.message : String(error);
        console.error(JSON.stringify({message: 'submission archive failed', revision, error: current.error}));
      }).finally(() => {
        active -= 1;
        if (!current.error) jobs.delete(revision);
        // Bound failed-job memory; retry is always explicit in the next request.
        if (jobs.size > 128) for (const [key, value] of jobs) { if (value.error && key !== revision) {jobs.delete(key); break;} }
      });
      return {status: 'building', revision, ...current.progress};
    },
    async download(revision, range) {
      const value = await receipt(revision);
      if (!value) return null;
      const object = await readCacheObject(submissionCacheKey(revision), range);
      return { ...object, sha256: value.sha256, sizeBytes: value.sizeBytes };
    },
  };

  async function build(request, revision, job) {
    const prefix = `${request.storageVendorId}/${request.submissionId}/`;
    const tasks = new Map(request.tasks.map(task => [task.name, task]));
    const objects = [];
    const seen = new Set();
    let cursor;
    do {
      const page = await listSourceObjects({prefix, cursor, limit: 1000, recursive: true});
      for (const object of page.objects ?? []) {
        if (!object.key?.startsWith(prefix)) throw new Error('source listing escaped the submission');
        const path = object.key.slice(prefix.length);
        const parts = path.split('/');
        if (!tasks.has(parts[0])) continue;
        if (parts.length < 2 || parts.some(p => !p || p === '.' || p === '..') || /[\x00-\x1f\x7f\\]/.test(path) || seen.has(path)) throw new Error('unsafe or duplicate source file path');
        if (!Number.isSafeInteger(object.sizeBytes) || object.sizeBytes < 0 || !object.etag) throw new Error('source listing lacks length or ETag');
        seen.add(path);
        objects.push({...object, path, task: tasks.get(parts[0])});
      }
      cursor = page.nextCursor;
    } while (cursor);
    for (const task of request.tasks) if (!seen.has(`${task.name}/task.toml`)) throw new Error(`missing task.toml: ${task.name}`);
    objects.sort((a,b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
    job.progress.fileCount = objects.length;
    const sourceBytes = objects.reduce((n, o) => n + o.sizeBytes, 0);
    if (!Number.isSafeInteger(sourceBytes)) throw new Error('source archive is too large');

    const zip = new ZipStream({zlib: {level: 6}, forceZip64: true});
    const output = new PassThrough();
    const hash = createHash('sha256');
    let sizeBytes = 0;
    const digest = new Transform({transform(chunk, encoding, callback) {hash.update(chunk); sizeBytes += chunk.length; callback(null, chunk);}});
    const streamResult = pipeline(zip, digest, output).then(() => null, error => error);
    const uploadResult = Promise.resolve().then(() => uploadCacheObject({key: submissionCacheKey(revision), body: output, contentType: 'application/zip', metadata: {schema: submissionArchiveSchema, revision}}))
      .then(() => null, error => {zip.destroy(error); output.destroy(error); return error;});
    const files = [];
    try {
      // Overlap small-object request latency, with bounded response buffers. Large
      // files get their own batch so other responses do not sit idle behind them.
      for (const batch of sourceBatches(objects)) {
      const opened = await Promise.allSettled(batch.map(async object => {
        const source = await readSourceObject(object.key, {ifMatch: object.etag});
        // A prefetched body can fail while an earlier entry is being consumed.
        source.body?.on?.('error', error => {source.readError = error;});
        return source;
      }));
      try {
      if (opened.some(result => result.status === 'rejected')) throw opened.find(result => result.status === 'rejected').reason;
      for (const [index, object] of batch.entries()) {
        const source = opened[index].value;
        if (source.readError) throw source.readError;
        const modeText = source?.mode;
        const mode = typeof modeText === 'string' && /^[0-7]{3,4}$/.test(modeText) ? parseInt(modeText, 8) : NaN;
        if (!source?.body || source.contentLength !== object.sizeBytes || source.etag !== object.etag || !shaPattern.test(source.sha256 ?? '') || source.artifactSha256 !== object.task.artifactSha256 || !Number.isInteger(mode) || mode > 0o777) {
          source?.body?.destroy?.();
          throw new Error(`missing or inconsistent CASE export metadata: ${object.path}`);
        }
        const fileHash = createHash('sha256');
        let bytes = 0;
        const checked = new Transform({
          transform(chunk, encoding, callback) {fileHash.update(chunk); bytes += chunk.length; callback(null, chunk);},
          flush(callback) {callback(bytes === object.sizeBytes && fileHash.digest('hex') === source.sha256 ? null : new Error(`source checksum mismatch: ${object.path}`));},
        });
        const body = source.body instanceof Uint8Array ? Readable.from([source.body]) : source.body.getReader ? Readable.fromWeb(source.body) : source.body;
        const checkedResult = pipeline(body, checked).then(() => null, error => {zip.destroy(error); return error;});
        await entry(zip, checked, {name: object.path, mode, date: archiveDate});
        const checkedError = await checkedResult;
        if (checkedError) throw checkedError;
        files.push({path: object.path, sourceKey: object.key, sizeBytes: bytes, sha256: source.sha256, mode: mode.toString(8).padStart(3, '0')});
        job.progress.completedFiles += 1;
      }
      } finally {for (const result of opened) if (result.status === 'fulfilled') result.value?.body?.destroy?.();}
      }
      const remaining = new Map(objects.map(object => [object.key, object]));
      let verifyCursor;
      do {
        const page = await listSourceObjects({prefix, cursor: verifyCursor, limit: 1000, recursive: true});
        for (const object of page.objects ?? []) {
          if (!object.key?.startsWith(prefix)) throw new Error('source listing escaped the submission');
          if (!tasks.has(object.key.slice(prefix.length).split('/')[0])) continue;
          const expected = remaining.get(object.key);
          if (!expected || expected.etag !== object.etag || expected.sizeBytes !== object.sizeBytes) throw new Error('source inventory changed during archive construction');
          remaining.delete(object.key);
        }
        verifyCursor = page.nextCursor;
      } while (verifyCursor);
      if (remaining.size) throw new Error('source inventory changed during archive construction');
      const manifest = {...request, revision, layout: 'task-directories-at-root', files};
      const manifestBytes = Buffer.from(JSON.stringify(manifest, null, 2) + '\n');
      await entry(zip, manifestBytes, {name: 'manifest.json', mode: 0o644, date: archiveDate});
      zip.finalize();
      const failures = await Promise.all([streamResult, uploadResult]);
      if (failures.some(Boolean)) throw failures.find(Boolean);
      const metadata = await headCacheObject(submissionCacheKey(revision));
      if (!metadata || metadata.contentLength !== sizeBytes) throw new Error('uploaded archive length mismatch');
      const value = {schemaVersion: submissionArchiveSchema, revision, request, sha256: hash.digest('hex'), sizeBytes, sourceBytes, fileCount: files.length, taskCount: request.tasks.length, manifestSha256: createHash('sha256').update(manifestBytes).digest('hex')};
      await writeCacheJson(submissionCacheKey(revision, 'json'), value);
    } catch (error) {
      zip.destroy(error); output.destroy(error);
      await Promise.all([streamResult, uploadResult]);
      throw error;
    }
  }
}

function* sourceBatches(objects) {
  let batch = [], bytes = 0;
  for (const object of objects) {
    if (batch.length && (batch.length >= 16 || bytes + object.sizeBytes > 32 * 1024 * 1024)) {yield batch; batch = []; bytes = 0;}
    batch.push(object); bytes += object.sizeBytes;
  }
  if (batch.length) yield batch;
}

function entry(zip, source, options) {
  return new Promise((resolve, reject) => {
    const fail = error => {zip.removeListener('error', fail); reject(error);};
    zip.once('error', fail);
    zip.entry(source, options, error => {zip.removeListener('error', fail); error ? reject(error) : resolve();});
  });
}
