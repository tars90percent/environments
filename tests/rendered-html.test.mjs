import assert from "node:assert/strict";
import test from "node:test";

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

test("server-renders the vendor submission registry", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>小环境 — RL Environment Registry<\/title>/i);
  assert.match(html, /小环境/);
  assert.match(html, /供应商样本库/);
  assert.match(html, /正在载入样本库/);
  assert.doesNotMatch(html, /Browse what CASE received/);
  assert.doesNotMatch(html, /Deeptune|Prime Intellect|Long-horizon revision B/);
  assert.doesNotMatch(html, /Submission timeline|Observed package inventory|filesystem snapshot/);
  assert.doesNotMatch(html, /RECOMMENDATION|EXPECTED USABLE YIELD|high-signal|getting better|getting worse/i);
});

test("keeps the portal read-only and free of vendor snapshot data", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(new URL("../app/portal-client.tsx", import.meta.url), "utf8");
  const worker = await readFile(new URL("../worker/index.ts", import.meta.url), "utf8");

  assert.doesNotMatch(source, /axios|lark-cli|open\.feishu\.cn|webhook/i);
  assert.match(source, /Researchers make those judgments/);
  assert.match(source, /供应商样本库/);
  assert.match(source, /Switch to English/);
  assert.match(source, /fetch\("\/api\/catalog"/);
  assert.doesNotMatch(source, /Deeptune|Prime Intellect|Scaler AI Labs/);
  assert.match(worker, /CASE_REGISTRY_CATALOG_TOKEN/);
  assert.doesNotMatch(worker, /method:\s*["']POST|method:\s*["']PUT|method:\s*["']PATCH|method:\s*["']DELETE/i);
  assert.doesNotMatch(source, /upstream|recommendation|usable yield/i);
});
