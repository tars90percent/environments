import assert from "node:assert/strict";
import test, { after, before } from "node:test";

const authEnv = {
  FEISHU_APP_ID: "cli_test",
  FEISHU_APP_SECRET: "test-secret",
  FEISHU_ALLOWED_TENANT_KEY: "tenant_test",
  PORTAL_BASE_URL: "https://portal.example.com",
  PORTAL_SESSION_SECRET: "test-session-secret-that-is-long-enough",
};

before(() => Object.assign(process.env, authEnv));
after(() => Object.keys(authEnv).forEach((key) => delete process.env[key]));

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the environment catalog", async () => {
  const response = await render();
  assert.equal(response.status, 307);
  assert.equal(new URL(response.headers.get("location"), "http://localhost").pathname, "/auth/login");
});

test("keeps the portal read-only and free of vendor snapshot data", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(new URL("../app/portal-client.tsx", import.meta.url), "utf8");
  const worker = await readFile(new URL("../worker/index.ts", import.meta.url), "utf8");

  assert.doesNotMatch(source, /axios|lark-cli|open\.feishu\.cn|webhook/i);
  assert.match(source, /Researchers make those judgments/);
  assert.match(source, /强化学习环境目录/);
  assert.match(source, /RL Environment Catalog/);
  assert.match(source, /Update history/);
  assert.match(source, /Original sources/);
  assert.match(source, /Open live source/);
  assert.match(source, /Download captured copy/);
  assert.doesNotMatch(source, /className="vendor-mark/);
  assert.doesNotMatch(source, /Every received batch|submission batches|供应商样本库|个提交批次/);
  assert.doesNotMatch(source, /type Tab|global-nav|ChecksView|CriteriaView/);
  assert.match(source, /className="task-details"/);
  assert.match(source, /Switch to English/);
  assert.doesNotMatch(source, /className="criteria-aside"/);
  assert.match(source, /fetch\("\/api\/catalog"/);
  assert.match(source, /\/auth\/logout/);
  assert.doesNotMatch(source, /Deeptune|Prime Intellect|Scaler AI Labs/);
  assert.match(worker, /CASE_REGISTRY_CATALOG_TOKEN/);
  assert.match(worker, /hasPortalSession/);
  assert.doesNotMatch(worker, /method:\s*["']PUT|method:\s*["']PATCH|method:\s*["']DELETE/i);
  assert.doesNotMatch(source, /upstream|recommendation|usable yield/i);
});
