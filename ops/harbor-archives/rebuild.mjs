import {createReadStream} from 'node:fs';
import {readFile, lstat, unlink, open} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {resolve, sep} from 'node:path';
import {pathToFileURL} from 'node:url';
import ZipStream from 'zip-stream';

const date = new Date('1980-01-01T00:00:00.000Z');

async function sourcePath(root, key) {
  const parts = key.split('/');
  if (parts.some(p => !p || p === '.' || p === '..' || /[\x00-\x1f\x7f\\]/.test(p))) throw new Error('Unsafe source path');
  let target = resolve(root);
  if (!(await lstat(target)).isDirectory() || (await lstat(target)).isSymbolicLink()) throw new Error('Invalid source root');
  for (const [index, part] of parts.entries()) {
    target += sep + part;
    const stat = await lstat(target);
    if (stat.isSymbolicLink() || !(index === parts.length - 1 ? stat.isFile() : stat.isDirectory())) throw new Error('Source contains a link or special file');
  }
  return target;
}

function entry(zip, source, options) {
  return new Promise((resolve, reject) => {
    const fail = error => {zip.off('error', fail); reject(error);};
    zip.once('error', fail);
    zip.entry(source, {...options, date}, error => {zip.off('error', fail); error ? reject(error) : resolve();});
  });
}

// Uses the gateway's pinned ZIP implementation, entry order, modes and dates.
// Even an equivalent ZIP is rejected unless it matches the cached ZIP's SHA-256.
export async function rebuild({manifestBytes, rawRoot, output, expectedSha256}) {
  const manifest = JSON.parse(manifestBytes);
  if (manifest.schemaVersion !== 'case.submission-harbor-archive.v1' || !Array.isArray(manifest.files)) throw new Error('Unsupported archive manifest');
  if (!/^[a-f0-9]{64}$/.test(expectedSha256)) throw new Error('Invalid expected checksum');
  const names = new Set();
  for (const file of manifest.files) {
    if (typeof file.path !== 'string' || file.path.split('/').some(p => !p || p === '.' || p === '..' || /[\x00-\x1f\x7f\\]/.test(p)) || file.path === 'manifest.json' || names.has(file.path)) throw new Error('Unsafe or duplicate archive path');
    names.add(file.path);
  }
  // Acquire our output exclusively before entering cleanup. An EEXIST error
  // must never remove a file owned by an earlier run or another process.
  const handle = await open(output, 'wx', 0o600);
  const zip = new ZipStream({zlib: {level: 6}, forceZip64: true});
  const digest = createHash('sha256');
  let bytes = 0;
  const meter = new Transform({transform(chunk, encoding, callback) {digest.update(chunk); bytes += chunk.length; callback(null, chunk);}});
  const completion = pipeline(zip, meter, handle.createWriteStream()).then(() => null, error => error);
  try {
    for (const file of manifest.files) {
      const path = await sourcePath(rawRoot, file.sourceKey);
      if ((await lstat(path)).size !== file.sizeBytes || !/^[a-f0-9]{64}$/.test(file.sha256) || !/^[0-7]{3}$/.test(file.mode)) throw new Error('Source metadata mismatch');
      const fileHash = createHash('sha256');
      let length = 0;
      const checked = new Transform({
        transform(chunk, encoding, callback) {fileHash.update(chunk); length += chunk.length; callback(null, chunk);},
        flush(callback) {callback(length === file.sizeBytes && fileHash.digest('hex') === file.sha256 ? null : new Error('Raw JFS source checksum mismatch'));},
      });
      const checkedResult = pipeline(createReadStream(path), checked).then(() => null, error => {zip.destroy(error); return error;});
      await entry(zip, checked, {name: file.path, mode: parseInt(file.mode, 8)});
      const error = await checkedResult;
      if (error) throw error;
    }
    await entry(zip, manifestBytes, {name: 'manifest.json', mode: 0o644});
    zip.finalize();
    const error = await completion;
    if (error) throw error;
    const sha256 = digest.digest('hex');
    if (sha256 !== expectedSha256) {
      await unlink(output);
      return {status: 'different_encoding', sha256, bytes};
    }
    return {status: 'identical', sha256, bytes};
  } catch (error) {
    zip.destroy(error);
    await completion;
    await unlink(output).catch(() => {});
    throw error;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [manifestPath, rawRoot, output, expectedSha256] = process.argv.slice(2);
  try {
    const result = await rebuild({manifestBytes: await readFile(manifestPath), rawRoot, output, expectedSha256});
    console.log(JSON.stringify(result));
    if (result.status !== 'identical') process.exitCode = 2;
  } catch (error) {
    console.log(JSON.stringify({status: 'failed', error: error.message}));
    process.exitCode = 1;
  }
}
