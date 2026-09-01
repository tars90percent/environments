import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import ZipStream from "zip-stream";

const cacheSchema = "case-vendor-harbor-zip-v1";
const archiveDate = new Date("1980-01-01T00:00:00.000Z");

export function createVendorArchiveCache({
  listSourceObjects,
  readSourceObject,
  headCacheObject,
  uploadCacheObject,
  signCacheObject,
  signedUrlTtlSeconds,
  downloadConcurrency = 8,
}) {
  const builds = new Map();

  return async function prepareVendorArchive({ roots, manifest, filename }) {
    const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    const objects = await selectedSourceObjects(roots, listSourceObjects);
    const sourceBytes = objects.reduce((sum, object) => sum + object.sizeBytes, 0);
    if (!Number.isSafeInteger(sourceBytes)) throw new Error("selected source objects are too large");

    const digest = archiveDigest({ roots, manifestBytes, objects });
    const cacheKey = `${roots[0].split("/")[0]}/${digest}.zip`;
    let cached = await headCacheObject(cacheKey);
    let cacheHit = Boolean(cached);

    if (!cached) {
      const activeBuild = builds.get(cacheKey);
      if (activeBuild) {
        cached = await activeBuild;
        cacheHit = true;
      } else {
        const build = buildArchive({
          cacheKey,
          manifestBytes,
          objects,
          readSourceObject,
          headCacheObject,
          uploadCacheObject,
          downloadConcurrency,
          taskCount: roots.length,
          sourceBytes,
        });
        builds.set(cacheKey, build);
        try {
          cached = await build;
        } finally {
          builds.delete(cacheKey);
        }
      }
    }

    if (!Number.isSafeInteger(cached?.contentLength) || cached.contentLength < 1) {
      throw new Error("cached archive has no usable content length");
    }
    const downloadUrl = await signCacheObject({
      key: cacheKey,
      filename,
      expiresInSeconds: signedUrlTtlSeconds,
    });
    return {
      status: "ready",
      cacheHit,
      downloadUrl,
      filename,
      sizeBytes: cached.contentLength,
      sourceBytes,
      fileCount: objects.length,
      taskCount: roots.length,
      expiresInSeconds: signedUrlTtlSeconds,
    };
  };
}

async function selectedSourceObjects(roots, listSourceObjects) {
  const rootOrder = new Map(roots.map((root, index) => [root, index]));
  const submissionPrefixes = [...new Set(roots.map((root) => `${root.split("/").slice(0, 2).join("/")}/`))];
  const listedPages = await mapLimit(submissionPrefixes, 4, async (prefix) => {
    const objects = [];
    let cursor;
    do {
      const page = await listSourceObjects({ prefix, cursor, limit: 1_000, recursive: true });
      objects.push(...(page.objects ?? []));
      cursor = page.nextCursor;
    } while (cursor);
    return objects;
  });

  const selected = [];
  const seen = new Set();
  for (const object of listedPages.flat()) {
    if (typeof object.key !== "string") continue;
    const root = object.key.split("/").slice(0, 3).join("/");
    if (!rootOrder.has(root) || !object.key.startsWith(`${root}/`)) continue;
    validateArchivePath(object.key);
    if (seen.has(object.key)) throw new Error(`source listing returned a duplicate object: ${object.key}`);
    seen.add(object.key);
    if (!Number.isSafeInteger(object.sizeBytes) || object.sizeBytes < 0) {
      throw new Error(`source object has no usable size: ${object.key}`);
    }
    selected.push({
      key: object.key,
      sizeBytes: object.sizeBytes,
      etag: typeof object.etag === "string" ? object.etag : "",
      rootIndex: rootOrder.get(root),
    });
  }

  selected.sort((left, right) => left.rootIndex - right.rootIndex || left.key.localeCompare(right.key));
  for (const root of roots) {
    if (!selected.some((object) => object.key === `${root}/task.toml`)) {
      throw new Error(`source listing is missing the completion marker: ${root}/task.toml`);
    }
  }
  return selected;
}

function archiveDigest({ roots, manifestBytes, objects }) {
  const hash = createHash("sha256");
  digestField(hash, cacheSchema);
  digestField(hash, manifestBytes);
  for (const root of roots) digestField(hash, root);
  for (const object of objects) {
    digestField(hash, object.key);
    digestField(hash, String(object.sizeBytes));
    digestField(hash, object.etag);
  }
  return hash.digest("hex");
}

function digestField(hash, value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value, "utf8");
  hash.update(String(bytes.length));
  hash.update(":");
  hash.update(bytes);
  hash.update(";");
}

async function buildArchive({
  cacheKey,
  manifestBytes,
  objects,
  readSourceObject,
  headCacheObject,
  uploadCacheObject,
  downloadConcurrency,
  taskCount,
  sourceBytes,
}) {
  const directory = await mkdtemp(join(tmpdir(), "harbor-task-zip-"));
  try {
    const localFiles = new Array(objects.length);
    await mapLimit(objects, downloadConcurrency, async (object, index) => {
      const path = join(directory, String(index).padStart(8, "0"));
      const source = await readSourceObject(object.key);
      if (!source?.body) throw new Error(`source object returned no body: ${object.key}`);
      await writeBody(path, source.body);
      const metadata = await stat(path);
      if (metadata.size !== object.sizeBytes) throw new Error(`source object was truncated: ${object.key}`);
      localFiles[index] = path;
    });

    const zip = new ZipStream({ zlib: { level: 6 } });
    const uploadPromise = uploadCacheObject({
      key: cacheKey,
      body: zip,
      contentType: "application/zip",
      metadata: {
        schema: cacheSchema,
        "task-count": String(taskCount),
        "file-count": String(objects.length),
        "source-bytes": String(sourceBytes),
      },
    });
    try {
      await addZipEntry(zip, manifestBytes, { name: "manifest.json", date: archiveDate, mode: 0o644 });
      for (let index = 0; index < objects.length; index += 1) {
        await addZipEntry(zip, createReadStream(localFiles[index]), {
          name: objects[index].key,
          date: archiveDate,
          mode: 0o644,
        });
      }
      zip.finalize();
      await uploadPromise;
    } catch (error) {
      zip.destroy(error instanceof Error ? error : new Error(String(error)));
      await uploadPromise.catch(() => undefined);
      throw error;
    }

    const cached = await headCacheObject(cacheKey);
    if (!cached) throw new Error("archive upload completed without a cache object");
    return cached;
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

function addZipEntry(zip, source, metadata) {
  return new Promise((resolve, reject) => {
    zip.entry(source, metadata, (error) => error ? reject(error) : resolve());
  });
}

async function writeBody(path, body) {
  if (body instanceof Uint8Array) return writeFile(path, body);
  if (typeof body?.getReader === "function") return pipeline(Readable.fromWeb(body), createWriteStream(path));
  return pipeline(body, createWriteStream(path));
}

function validateArchivePath(key) {
  if (!key || key.startsWith("/") || /[\u0000-\u001f\u007f\\]/.test(key)) throw new Error(`unsafe source object path: ${key}`);
  const parts = key.split("/");
  if (parts.length < 4 || parts.some((part) => !part || part === "." || part === "..")) {
    throw new Error(`unsafe source object path: ${key}`);
  }
}

async function mapLimit(values, concurrency, iteratee) {
  const results = new Array(values.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (next < values.length) {
      const index = next;
      next += 1;
      results[index] = await iteratee(values[index], index);
    }
  }));
  return results;
}
