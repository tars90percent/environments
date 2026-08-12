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
  assert.match(html, /<title>小环境 — Vendor Sample Registry<\/title>/i);
  assert.match(html, /Prototype registry/);
  assert.match(html, /小环境/);
  assert.match(html, /Vendor sample registry/);
  assert.match(html, /Submission history/);
  assert.match(html, /Deeptune/);
  assert.match(html, /Long-horizon revision B/);
  assert.match(html, /Task categories/);
  assert.match(html, /Observed package inventory/);
  assert.doesNotMatch(html, /RECOMMENDATION|EXPECTED USABLE YIELD|high-signal|getting better|getting worse/i);
});

test("keeps external side effects out of the prototype source", async () => {
  const source = await import("node:fs/promises").then(({ readFile }) =>
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  );

  assert.doesNotMatch(source, /fetch\s*\(/);
  assert.doesNotMatch(source, /axios|lark-cli|open\.feishu\.cn|webhook/i);
  assert.match(source, /Researchers make those judgments/);
  assert.doesNotMatch(source, /upstream|recommendation|usable yield/i);
});
