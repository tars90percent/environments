import { timingSafeEqual } from "node:crypto";
import { basename } from "node:path/posix";
import { documentationHtml, openApiDocument } from "./docs.mjs";

const defaultPageSize = 200;
const maximumPageSize = 1_000;

export function createGatewayHandler({
  authToken,
  listObjects,
  headObject,
  archiveRoots,
  signGetObject,
  signedUrlTtlSeconds,
}) {
  if (typeof authToken !== "string" || authToken.length < 32) {
    throw new Error("GATEWAY_AUTH_TOKEN must contain at least 32 characters");
  }
  if (!Number.isInteger(signedUrlTtlSeconds) || signedUrlTtlSeconds < 60 || signedUrlTtlSeconds > 86_400) {
    throw new Error("SIGNED_URL_TTL_SECONDS must be between 60 and 86400");
  }

  return async function gatewayHandler(request, response) {
    applySecurityHeaders(response);
    const url = new URL(request.url ?? "/", "http://gateway.local");

    if (url.pathname === "/healthz") {
      if (request.method !== "GET" && request.method !== "HEAD") return methodNotAllowed(response, ["GET", "HEAD"]);
      response.statusCode = 200;
      response.setHeader("Content-Type", "application/json; charset=utf-8");
      return response.end(request.method === "HEAD" ? undefined : JSON.stringify({ status: "ok" }));
    }

    if (url.pathname === "/docs" || url.pathname === "/docs/") {
      if (request.method !== "GET" && request.method !== "HEAD") return methodNotAllowed(response, ["GET", "HEAD"]);
      response.statusCode = 200;
      response.setHeader("Cache-Control", "public, max-age=300");
      response.setHeader("Content-Type", "text/html; charset=utf-8");
      response.setHeader("Link", '</openapi.json>; rel="service-desc"; type="application/vnd.oai.openapi+json"');
      return response.end(request.method === "HEAD" ? undefined : documentationHtml());
    }

    if (url.pathname === "/openapi.json") {
      if (request.method !== "GET" && request.method !== "HEAD") return methodNotAllowed(response, ["GET", "HEAD"]);
      response.statusCode = 200;
      response.setHeader("Cache-Control", "public, max-age=300");
      response.setHeader("Content-Type", "application/vnd.oai.openapi+json; charset=utf-8");
      response.setHeader("Link", '</docs>; rel="help"; type="text/html"');
      return response.end(request.method === "HEAD" ? undefined : JSON.stringify(openApiDocument()));
    }

    if (!authorized(request.headers.authorization, authToken)) {
      response.statusCode = 401;
      response.setHeader("WWW-Authenticate", 'Bearer realm="harbor-tasks"');
      response.setHeader("Link", '</docs>; rel="help"; type="text/html", </openapi.json>; rel="service-desc"; type="application/vnd.oai.openapi+json"');
      return json(response, { error: "unauthorized", documentation: "/docs", openapi: "/openapi.json" });
    }

    if (url.pathname === "/archives") {
      if (request.method !== "POST") return methodNotAllowed(response, ["POST"]);
      let roots;
      try {
        roots = archiveTaskRoots((await readJsonBody(request)).roots);
      } catch (error) {
        response.statusCode = 400;
        return json(response, { error: error instanceof Error ? error.message : "invalid archive request" });
      }
      const markers = await mapLimit(roots, 16, (root) => headObject(`${root}/task.toml`));
      const missing = roots.filter((_, index) => !markers[index]);
      if (missing.length) {
        response.statusCode = 409;
        return json(response, { error: "one or more task roots are incomplete", missing });
      }
      response.statusCode = 200;
      response.setHeader("Content-Type", "application/x-tar");
      response.setHeader("X-Harbor-Task-Count", String(roots.length));
      try {
        for await (const chunk of archiveRoots(roots)) await writeChunk(response, chunk);
        return response.end();
      } catch (error) {
        console.error(JSON.stringify({
          level: "error",
          message: "gateway archive failed",
          taskRootCount: roots.length,
          error: error instanceof Error ? error.message : String(error),
        }));
        response.destroy(error instanceof Error ? error : new Error(String(error)));
        return;
      }
    }

    if (request.method !== "GET" && request.method !== "HEAD") return methodNotAllowed(response, ["GET", "HEAD"]);

    let key;
    try {
      key = decodeObjectPath(url.pathname);
    } catch (error) {
      response.statusCode = 400;
      return json(response, { error: error instanceof Error ? error.message : "invalid path" });
    }

    try {
      if (url.pathname.endsWith("/")) {
        if (request.method === "HEAD") return directoryHead(response);
        const recursive = url.searchParams.get("recursive") === "true" || url.searchParams.get("recursive") === "1";
        let limit;
        try {
          limit = pageSize(url.searchParams.get("limit"));
        } catch (error) {
          response.statusCode = 400;
          return json(response, { error: error instanceof Error ? error.message : "invalid limit" });
        }
        const cursor = url.searchParams.get("cursor") || undefined;
        const result = await listObjects({ prefix: key, cursor, limit, recursive });
        response.statusCode = 200;
        return json(response, directoryResponse(key, recursive, result));
      }

      if (!key) {
        response.statusCode = 400;
        return json(response, { error: "object paths must not be empty" });
      }

      const metadata = await headObject(key);
      if (!metadata) {
        response.statusCode = 404;
        return json(response, { error: "object not found" });
      }

      if (request.method === "HEAD") return objectHead(response, metadata);

      const download = url.searchParams.get("download") === "1" || url.searchParams.get("download") === "true";
      const location = await signGetObject({
        key,
        expiresInSeconds: signedUrlTtlSeconds,
        downloadName: download ? basename(key) : undefined,
      });
      response.statusCode = 302;
      response.setHeader("Location", location);
      response.setHeader("X-Presigned-Url-Expires-In", String(signedUrlTtlSeconds));
      return response.end();
    } catch (error) {
      if (isNotFound(error)) {
        response.statusCode = 404;
        return json(response, { error: "object not found" });
      }
      console.error(JSON.stringify({
        level: "error",
        message: "gateway request failed",
        method: request.method,
        path: url.pathname,
        error: error instanceof Error ? error.message : String(error),
      }));
      response.statusCode = 502;
      return json(response, { error: "bucket request failed" });
    }
  };
}

function authorized(header, expectedToken) {
  if (typeof header !== "string" || !header.startsWith("Bearer ")) return false;
  const presented = Buffer.from(header.slice("Bearer ".length), "utf8");
  const expected = Buffer.from(expectedToken, "utf8");
  return presented.length === expected.length && timingSafeEqual(presented, expected);
}

async function readJsonBody(request) {
  const declared = Number(request.headers["content-length"] ?? 0);
  if (Number.isFinite(declared) && declared > 1_048_576) throw new Error("archive request exceeds 1 MiB");
  const chunks = [];
  let received = 0;
  for await (const chunk of request) {
    received += chunk.length;
    if (received > 1_048_576) throw new Error("archive request exceeds 1 MiB");
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new Error("archive request must contain valid JSON");
  }
}

function archiveTaskRoots(value) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 1_000) throw new Error("roots must contain between 1 and 1000 task roots");
  const roots = value.map((root) => {
    if (typeof root !== "string") throw new Error("each task root must be a string");
    const parts = root.split("/");
    if (parts.length !== 3 || parts.some((part) => !part || part === "." || part === ".." || /[\u0000-\u001f\u007f\\]/.test(part))) {
      throw new Error("each task root must use vendor/submission/task format");
    }
    return root;
  });
  if (new Set(roots).size !== roots.length) throw new Error("task roots must be unique");
  if (new Set(roots.map((root) => root.split("/")[0])).size !== 1) throw new Error("task roots must belong to one vendor");
  return roots;
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

function writeChunk(response, chunk) {
  if (response.destroyed) return Promise.reject(new Error("archive response closed"));
  if (response.write(chunk)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      response.off("drain", onDrain);
      response.off("error", onError);
      response.off("close", onClose);
    };
    const onDrain = () => { cleanup(); resolve(); };
    const onError = (error) => { cleanup(); reject(error); };
    const onClose = () => { cleanup(); reject(new Error("archive response closed")); };
    response.once("drain", onDrain);
    response.once("error", onError);
    response.once("close", onClose);
  });
}

function decodeObjectPath(pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname.slice(1));
  } catch {
    throw new Error("path is not valid percent-encoded UTF-8");
  }
  if (decoded.includes("\0")) throw new Error("path contains a null byte");
  return decoded;
}

function pageSize(value) {
  if (value === null) return defaultPageSize;
  if (!/^\d+$/.test(value)) throw new Error("limit must be an integer between 1 and 1000");
  const parsed = Number(value);
  if (parsed < 1 || parsed > maximumPageSize) throw new Error("limit must be an integer between 1 and 1000");
  return parsed;
}

function directoryResponse(prefix, recursive, result) {
  const directories = (result.directories ?? []).map((path) => ({
    type: "directory",
    name: relativeName(prefix, path),
    path,
    url: objectUrl(path),
  }));
  const files = (result.objects ?? []).map((object) => ({
    type: "file",
    name: relativeName(prefix, object.key),
    path: object.key,
    url: objectUrl(object.key),
    sizeBytes: object.sizeBytes,
    lastModified: object.lastModified ? new Date(object.lastModified).toISOString() : null,
    etag: object.etag ?? null,
  }));
  return {
    path: prefix,
    recursive,
    entries: [...directories, ...files].sort((left, right) => left.path.localeCompare(right.path)),
    nextCursor: result.nextCursor ?? null,
  };
}

function relativeName(prefix, path) {
  const relative = path.startsWith(prefix) ? path.slice(prefix.length) : path;
  return relative.endsWith("/") ? relative.slice(0, -1) : relative;
}

function objectUrl(key) {
  return `/${key.split("/").map((part) => encodeURIComponent(part)).join("/")}`;
}

function applySecurityHeaders(response) {
  response.setHeader("Cache-Control", "private, no-store");
  response.setHeader("Content-Security-Policy", "default-src 'none'");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("X-Content-Type-Options", "nosniff");
}

function methodNotAllowed(response, methods) {
  response.statusCode = 405;
  response.setHeader("Allow", methods.join(", "));
  return json(response, { error: "method not allowed" });
}

function directoryHead(response) {
  response.statusCode = 200;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  return response.end();
}

function objectHead(response, metadata) {
  response.statusCode = 200;
  if (metadata.contentLength !== undefined) response.setHeader("Content-Length", String(metadata.contentLength));
  if (metadata.contentType) response.setHeader("Content-Type", metadata.contentType);
  if (metadata.etag) response.setHeader("ETag", metadata.etag);
  if (metadata.lastModified) response.setHeader("Last-Modified", new Date(metadata.lastModified).toUTCString());
  if (metadata.sha256) response.setHeader("X-Content-SHA256", metadata.sha256);
  return response.end();
}

function json(response, body) {
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  return response.end(JSON.stringify(body));
}

function isNotFound(error) {
  if (!error || typeof error !== "object") return false;
  return error.name === "NoSuchKey"
    || error.name === "NotFound"
    || error.$metadata?.httpStatusCode === 404;
}
