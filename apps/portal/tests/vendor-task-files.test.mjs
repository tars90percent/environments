import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";

const env = {
  FEISHU_APP_ID: "cli_test",
  FEISHU_APP_SECRET: "test-secret",
  FEISHU_ALLOWED_TENANT_KEY: "tenant_test",
  PORTAL_BASE_URL: "https://portal.example.com",
  PORTAL_SESSION_SECRET: "test-session-secret-that-is-long-enough",
  CASE_REGISTRY_URL: "https://case.example",
  CASE_REGISTRY_CATALOG_TOKEN: "catalog-test",
  HARBOR_TASK_GATEWAY_URL: "https://gateway.example",
  HARBOR_TASK_GATEWAY_TOKEN: "gateway-test",
};
function cookie() {
  const payload = Buffer.from(JSON.stringify({ openId: "ou_test", tenantKey: env.FEISHU_ALLOWED_TENANT_KEY, name: "Test", expiresAt: Date.now() + 60_000 })).toString("base64url");
  return `env_portal_session=${payload}.${createHmac("sha256", env.PORTAL_SESSION_SECRET).update(payload).digest("base64url")}`;
}
const task = { id: "task-a", title: "Shared name", stableKey: "task-a", sourcePath: "tasks/shared", kind: "task", format: "harbor", artifactId: "artifact-a", benchmark: { id: "terminal-bench", displayName: "Terminal-Bench" }, checks: {}, attempts: {}, findings: [] };
const catalog = { vendors: [{ id: "vendor-a", name: "Vendor A", submissions: [{ id: "delivery-a", label: "First delivery", date: "2026-09-12", tasks: [task, { ...task, id: "native", format: "non_harbor" }] }, { id: "delivery-b", tasks: [{ ...task, id: "task-b" }] }] }] };
const root = "vendor-a/delivery-a/shared/";
const entry = (path, sizeBytes = 12) => ({ type: "file", path: root + path, sizeBytes });
const app = (await import("../dist/server/index.js")).default;
const request = (suffix, authenticated = true, method = "GET") => app.fetch(new Request(`https://portal.example.com/api/tasks/${suffix}`, { method, headers: authenticated ? { cookie: cookie() } : {} }), env, {});

test("task files require a researcher session and resolve the exact submission before listing every page", async () => {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (input, init) => {
    calls.push(String(input));
    if (input === "https://case.example/v1/catalog") return Response.json(catalog);
    assert.equal(init.headers.authorization, "Bearer gateway-test");
    const url = new URL(input);
    assert.equal(url.pathname, "/" + root);
    assert.equal(url.searchParams.get("recursive"), "true");
    return url.searchParams.has("cursor")
      ? Response.json({ entries: [entry("environment/data/资料.txt"), entry("tests/test.sh")], nextCursor: null })
      : Response.json({ entries: [entry("instruction.md"), entry("task.toml")], nextCursor: "next-page" });
  };
  try {
    assert.equal((await request("task-a/files", false)).status, 401);
    assert.equal((await request("task-a/files", true, "POST")).status, 405);
    assert.equal(calls.length, 0);
    assert.equal((await request("native/files")).status, 404);
    assert.equal((await request("missing/files")).status, 404);
    const result = await request("task-a/files");
    assert.equal(result.status, 200);
    assert.equal(result.headers.get("cache-control"), "private, no-store");
    const data = await result.json();
    assert.equal(data.available, true);
    assert.equal(data.submission.id, "delivery-a");
    assert.equal(data.task.artifactId, "artifact-a");
    assert.deepEqual(data.entries.filter((entry) => entry.kind === "directory").map((entry) => entry.path), ["environment", "environment/data", "tests"]);
    assert.equal(data.entries.find((entry) => entry.path === "tests/test.sh").role, "verifier");
  } finally { globalThis.fetch = original; }
});

test("file reads reject traversal, isolate gateway credentials, and serve executable content as inert text", async () => {
  const original = globalThis.fetch;
  let gatewayCalls = 0;
  let storageCalls = 0;
  globalThis.fetch = async (input, init) => {
    if (input === "https://case.example/v1/catalog") return Response.json(catalog);
    if (String(input).startsWith("https://gateway.example/")) {
      gatewayCalls++;
      assert.equal(input, "https://gateway.example/" + root + "environment/page.html");
      assert.equal(init.redirect, "manual");
      assert.equal(init.headers.authorization, "Bearer gateway-test");
      return new Response(null, { status: 302, headers: { location: "https://storage.example/signed-file" } });
    }
    storageCalls++;
    assert.equal(init.headers, undefined);
    return new Response("<script>alert('test')</script>", { headers: { "content-type": "text/html" } });
  };
  try {
    assert.equal((await request("task-a/file?path=instruction.md", false)).status, 401);
    for (const path of ["../other/file", "/absolute", "environment/../../secret", "foo\\bar", "foo//bar", "foo/./bar", "bad\u0000name"]) {
      assert.equal((await request("task-a/file?path=" + encodeURIComponent(path))).status, 400, path);
    }
    assert.equal(gatewayCalls, 0);
    const response = await request("task-a/file?path=environment%2Fpage.html");
    assert.equal(response.headers.get("content-type"), "text/plain; charset=utf-8");
    assert.match(response.headers.get("content-security-policy"), /sandbox/);
    assert.equal(await response.text(), "<script>alert('test')</script>");
    const download = await request("task-a/file?path=environment%2Fpage.html&download=1");
    assert.match(download.headers.get("content-disposition"), /attachment/);
    assert.equal(download.headers.get("content-type"), "application/octet-stream");
    assert.equal(storageCalls, 2);
  } finally { globalThis.fetch = original; }
});

test("missing mirrors, invalid pagination and foreign paths never produce a misleading complete listing", async () => {
  const original = globalThis.fetch;
  let mode = "empty";
  globalThis.fetch = async (input) => {
    if (input === "https://case.example/v1/catalog") return Response.json(catalog);
    if (mode === "empty") return Response.json({ entries: [], nextCursor: null });
    if (mode === "foreign") return Response.json({ entries: [{ ...entry("task.toml"), path: "vendor-b/private/task.toml" }] });
    if (mode === "repeat") return Response.json({ entries: [], nextCursor: "loop" });
    return Response.json({ entries: [entry("task.toml"), entry("task.toml")] });
  };
  try {
    assert.equal((await (await request("task-a/files")).json()).available, false);
    for (mode of ["foreign", "repeat", "duplicate"]) assert.equal((await request("task-a/files")).status, 502);
  } finally { globalThis.fetch = original; }
});

test("oversized previews are bounded, while raw downloads and storage errors remain explicit", async () => {
  const original = globalThis.fetch;
  let mode = "large";
  globalThis.fetch = async (input) => {
    if (input === "https://case.example/v1/catalog") return Response.json(catalog);
    if (String(input).startsWith("https://gateway.example/")) {
      if (mode === "missing") return new Response(null, { status: 404 });
      return new Response(null, { status: 302, headers: { location: "https://storage.example/file" } });
    }
    if (mode === "stream") return new Response(new Uint8Array(8 * 1024 * 1024 + 1));
    return new Response("large file", { headers: { "content-length": String(9 * 1024 * 1024) } });
  };
  try {
    assert.equal((await request("task-a/file?path=large.txt")).status, 413);
    assert.equal((await request("task-a/file?path=large.txt&download=1")).status, 200);
    mode = "missing";
    assert.equal((await request("task-a/file?path=missing.txt")).status, 404);
    mode = "stream";
    await assert.rejects(() => request("task-a/file?path=large.txt").then((response) => response.arrayBuffer()), /Preview too large/);
  } finally { globalThis.fetch = original; }
});
