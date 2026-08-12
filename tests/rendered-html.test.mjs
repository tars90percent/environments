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

test("server-renders the RL environment evidence registry", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>TARS Environments — Evidence Registry<\/title>/i);
  assert.match(html, /Prototype registry/);
  assert.match(html, /atlas-kernel-pack/);
  assert.match(html, /Deterministic package and execution evidence/);
  assert.match(html, /does not rate task quality/i);
  assert.match(html, /Clean builds/);
  assert.match(html, /Gold baseline/);
  assert.match(html, /Attached rollouts/);
  assert.doesNotMatch(html, /RECOMMENDATION|EXPECTED USABLE YIELD|high-signal/i);
});

test("keeps external side effects out of the prototype source", async () => {
  const source = await import("node:fs/promises").then(({ readFile }) =>
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
  );

  assert.doesNotMatch(source, /fetch\s*\(/);
  assert.doesNotMatch(source, /axios|lark-cli|open\.feishu\.cn|webhook/i);
  assert.match(source, /No research judgment recorded/);
  assert.doesNotMatch(source, /upstream|recommendation|usable yield/i);
});
