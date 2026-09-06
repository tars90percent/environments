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
function task(id, benchmarkId = "terminal-bench", kind = "task", format = "harbor") {
  return { id, stableKey: id, title: id, summary: null, kind, format, benchmark: { id: benchmarkId, displayName: benchmarkId === "terminal-bench" ? "Terminal-Bench" : benchmarkId }, sourcePath: "tasks/same-name", artifactId: null, sourceItemIds: [], checks: {}, attempts: {}, findings: [], gpuRequired: false };
}
function submission(id, tasks) {
  return { id, date: "2026-09-07", label: id, source: "Vendor delivery", formats: ["harbor", "non_harbor"], sourceEvents: [], tasks };
}
const catalog = {
  generatedAt: "2026-09-07T00:00:00.000Z",
  vendors: [
    { id: "vendor-a", name: "Vendor A", short: "A", submissions: [submission("new", [task("a-new"), task("other", "deep-swe"), task("native", "terminal-bench", "task", "non_harbor"), task("trace", "terminal-bench", "trace", "harbor")]), submission("old", [task("a-old")])] },
    { id: "vendor-b", name: "Vendor B", short: "B", submissions: [submission("delivery", [task("b")])] },
  ],
  totals: { vendors: 2, submissions: 3, tasks: 6, harborTasks: 4 },
};

test("benchmark downloads select exact Harbor roots across vendors and submissions using the ZIP gateway", async () => {
  const app = (await import("../dist/server/index.js")).default;
  const requests = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    if (url === "https://case.example/v1/catalog") {
      assert.equal(new Headers(init.headers).get("authorization"), "Bearer catalog-test");
      return Response.json(catalog);
    }
    assert.equal(url, "https://gateway.example/zip-archives");
    assert.equal(new Headers(init.headers).get("authorization"), "Bearer gateway-test");
    const body = JSON.parse(init.body);
    requests.push(body);
    return Response.json({ status: "ready", cacheHit: true, downloadUrl: "https://cache.example/benchmark.zip", filename: body.filename, sizeBytes: 100, taskCount: body.roots.length, expiresInSeconds: 900 });
  };
  try {
    const response = await app.fetch(new Request("https://portal.example.com/api/benchmarks/terminal-bench/harbor-download?search=vendor-a", { method: "POST", headers: { cookie: cookie() } }), env, {});
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const result = await response.json();
    assert.equal(result.filename, "Terminal-Bench-harbor-tasks.zip");
    assert.equal(result.taskCount, 3);
    assert.equal(requests.length, 1);
    const { roots, manifest } = requests[0];
    assert.deepEqual(new Set(roots), new Set(["vendor-a/new/same-name", "vendor-a/old/same-name", "vendor-b/delivery/same-name"]));
    assert.deepEqual(manifest.benchmark, { id: "terminal-bench", displayName: "Terminal-Bench" });
    assert.deepEqual(new Set(manifest.tasks.map((entry) => entry.taskId)), new Set(["a-new", "a-old", "b"]));
    assert.deepEqual(new Set(manifest.tasks.map((entry) => entry.vendor.id)), new Set(["vendor-a", "vendor-b"]));
    assert.ok(manifest.tasks.every((entry) => entry.kind === "task" && entry.format === "harbor" && entry.sourcePath === "tasks/same-name"));
    assert.equal("contentSha256" in manifest.tasks[0], false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("benchmark downloads require login and reject unknown benchmarks and invalid archives", async () => {
  const app = (await import("../dist/server/index.js")).default;
  const originalFetch = globalThis.fetch;
  let calls = 0;
  let gatewayResult = "incomplete";
  globalThis.fetch = async (url) => {
    calls += 1;
    if (url === "https://case.example/v1/catalog") return Response.json(catalog);
    if (gatewayResult === "incomplete") return Response.json({ error: "one or more task roots are incomplete" }, { status: 409 });
    return Response.json({ status: "ready", downloadUrl: "https://cache.example/partial.zip", filename: "Terminal-Bench-harbor-tasks.zip", taskCount: 1, sizeBytes: 100, expiresInSeconds: 900 });
  };
  const request = (id, method = "POST", authenticated = true) => app.fetch(new Request(`https://portal.example.com/api/benchmarks/${id}/harbor-download`, { method, headers: authenticated ? { cookie: cookie() } : {} }), env, {});
  try {
    assert.equal((await request("terminal-bench", "POST", false)).status, 401);
    assert.equal((await request("terminal-bench", "GET")).status, 405);
    assert.equal(calls, 0);
    assert.equal((await request("unknown")).status, 404);
    assert.equal(calls, 1);
    const incomplete = await request("terminal-bench");
    assert.notEqual(incomplete.status, 200);
    assert.equal("downloadUrl" in await incomplete.json(), false);
    gatewayResult = "wrong-count";
    assert.equal((await request("terminal-bench")).status, 502);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
