import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import test from "node:test";
import { createGatewayHandler } from "../src/app.mjs";

const token = "test-token-that-is-at-least-thirty-two-characters";

async function fixture(overrides = {}) {
  const calls = { list: [], head: [], sign: [] };
  const handler = createGatewayHandler({
    authToken: token,
    signedUrlTtlSeconds: 900,
    listObjects: async (input) => {
      calls.list.push(input);
      return overrides.listResult ?? {
        directories: ["vendor/submission/"],
        objects: [{
          key: "vendor/readme.txt",
          sizeBytes: 12,
          lastModified: new Date("2026-09-01T00:00:00Z"),
          etag: '"etag"',
        }],
        nextCursor: "next-page",
      };
    },
    headObject: async (key) => {
      calls.head.push(key);
      if (key === "missing") return null;
      return {
        contentLength: 7,
        contentType: "text/plain",
        etag: '"etag"',
        lastModified: new Date("2026-09-01T00:00:00Z"),
        sha256: "abc123",
      };
    },
    signGetObject: async (input) => {
      calls.sign.push(input);
      return "https://storage.example/signed";
    },
  });
  const server = createServer(handler);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  return {
    calls,
    baseUrl,
    close: async () => {
      server.close();
      await once(server, "close");
    },
  };
}

test("health check is public but bucket paths require a bearer token", async () => {
  const app = await fixture();
  try {
    const health = await fetch(`${app.baseUrl}/healthz`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { status: "ok" });

    const unauthorized = await fetch(`${app.baseUrl}/`);
    assert.equal(unauthorized.status, 401);
    assert.equal(unauthorized.headers.get("www-authenticate"), 'Bearer realm="harbor-tasks"');
  } finally {
    await app.close();
  }
});

test("directory URLs list the exact bucket prefix with pagination", async () => {
  const app = await fixture();
  try {
    const response = await fetch(`${app.baseUrl}/vendor/?limit=25&cursor=page-one`, {
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(response.status, 200);
    assert.deepEqual(app.calls.list, [{ prefix: "vendor/", cursor: "page-one", limit: 25, recursive: false }]);
    assert.deepEqual(await response.json(), {
      path: "vendor/",
      recursive: false,
      entries: [
        { type: "file", name: "readme.txt", path: "vendor/readme.txt", url: "/vendor/readme.txt", sizeBytes: 12, lastModified: "2026-09-01T00:00:00.000Z", etag: '"etag"' },
        { type: "directory", name: "submission", path: "vendor/submission/", url: "/vendor/submission/" },
      ],
      nextCursor: "next-page",
    });
  } finally {
    await app.close();
  }
});

test("file URLs verify existence and redirect to a short-lived signed URL", async () => {
  const app = await fixture();
  try {
    const response = await fetch(`${app.baseUrl}/vendor/submission/task/instruction.md?download=1`, {
      headers: { authorization: `Bearer ${token}` },
      redirect: "manual",
    });
    assert.equal(response.status, 302);
    assert.equal(response.headers.get("location"), "https://storage.example/signed");
    assert.equal(response.headers.get("x-presigned-url-expires-in"), "900");
    assert.deepEqual(app.calls.head, ["vendor/submission/task/instruction.md"]);
    assert.deepEqual(app.calls.sign, [{
      key: "vendor/submission/task/instruction.md",
      expiresInSeconds: 900,
      downloadName: "instruction.md",
    }]);
  } finally {
    await app.close();
  }
});

test("HEAD exposes immutable object metadata without signing a download", async () => {
  const app = await fixture();
  try {
    const response = await fetch(`${app.baseUrl}/vendor/submission/task/task.toml`, {
      method: "HEAD",
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-length"), "7");
    assert.equal(response.headers.get("content-type"), "text/plain");
    assert.equal(response.headers.get("x-content-sha256"), "abc123");
    assert.deepEqual(app.calls.sign, []);
  } finally {
    await app.close();
  }
});

test("missing objects return 404 and malformed page sizes return 400", async () => {
  const app = await fixture();
  try {
    const missing = await fetch(`${app.baseUrl}/missing`, {
      headers: { authorization: `Bearer ${token}` },
      redirect: "manual",
    });
    assert.equal(missing.status, 404);

    const invalidLimit = await fetch(`${app.baseUrl}/?limit=1001`, {
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(invalidLimit.status, 400);
    assert.deepEqual(await invalidLimit.json(), { error: "limit must be an integer between 1 and 1000" });
  } finally {
    await app.close();
  }
});
