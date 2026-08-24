import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
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

async function worker() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${Math.random()}`);
  return (await import(workerUrl.href)).default;
}

test("requires an authenticated researcher session", async () => {
  const response = await (await worker()).fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
  assert.equal(response.status, 307);
  assert.equal(new URL(response.headers.get("location"), "http://localhost").pathname, "/auth/login");
});

test("keeps the researcher UI on the narrow CASE record", async () => {
  const source = await readFile(new URL("../app/portal-client.tsx", import.meta.url), "utf8");
  const workerSource = await readFile(new URL("../worker/index.ts", import.meta.url), "utf8");

  assert.match(source, /Environment & Task Samples/);
  assert.match(source, /Original delivery/);
  assert.match(source, /Tasks/);
  assert.match(source, /Build/);
  assert.match(source, /Boot/);
  assert.match(source, /Oracle/);
  assert.match(source, /Nop/);
  assert.match(source, /task\.format === "harbor"/);
  assert.match(source, /check-mark/);
  assert.match(source, /task\.findings\.length > 0/);
  assert.match(source, /fetch\("\/api\/catalog"/);
  assert.match(source, /filter\(\(vendor\) => vendor\.submissions\.length > 0\)/);
  assert.match(source, /value=\{catalog \? vendors\.length : undefined\}/);
  assert.doesNotMatch(source, /Upload submission|上传提交|\/api\/uploads|x-case-upload/i);
  assert.doesNotMatch(source, /procurement|research demand|category|runtimeVerification|representationPath|normalizationOutcome|needs_vendor_fix|ready_for_research|reviewer/i);
  assert.doesNotMatch(source, /Deeptune|Prime Intellect|Scaler AI Labs/);
  assert.doesNotMatch(source, /FormatBadge|format-badge|kind-badge|submission-formats/);

  assert.match(workerSource, /CASE_REGISTRY_CATALOG_TOKEN/);
  assert.doesNotMatch(workerSource, /CASE_REGISTRY_UPLOAD_TOKEN|CASE_REGISTRY_REVIEW_TOKEN|\/api\/uploads|\/researcher-uploads|x-case-upload|\/reviews|categoryIds/);
  assert.doesNotMatch(workerSource, /method:\s*["']PATCH|method:\s*["']DELETE/i);
});

test("adapts the current CASE catalog during the narrow migration rollout", async () => {
  const app = await worker();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const target = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (target !== "https://case.example/v1/catalog") throw new Error(`Unexpected fetch: ${target}`);
    return Response.json({
      generatedAt: "2026-08-21T00:00:00.000Z",
      demands: [{ id: "obsolete-demand" }],
      vendors: [{
        id: "vendor-1",
        name: "Vendor One",
        short: "V1",
        procurementSummary: { stage: "ordered" },
        batches: [{
          id: "submission-1",
          date: "2026-08-20",
          label: "Sample",
          source: "Feishu attachment",
          formats: ["Harbor task package"],
          sourceEvents: [{
            id: "event-1",
            channel: "feishu",
            externalRef: "message:1",
            sender: "Vendor One",
            receivedAt: "2026-08-20T00:00:00.000Z",
            rawArtifactId: "artifact:raw",
            items: [{ id: "item-1", kind: "attachment", displayName: "sample.tar", locator: "feishu://sample", artifactId: "artifact:raw", contentSha256: "a".repeat(64) }],
          }],
          categories: [{
            id: "legacy-category",
            name: "Obsolete category",
            tasks: [{
              id: "task-1",
              stableKey: "task-one",
              title: "Task one",
              summary: null,
              sourcePath: "tasks/task-one",
              format: "Harbor task package",
              representation: { path: "already_harbor", normalizationOutcome: "already_harbor" },
              runtimeVerification: { phases: {
                build: { outcome: "pass", checkRunId: "check-build", completedAt: "2026-08-20T01:00:00.000Z" },
                boot: { outcome: null, checkRunId: null, completedAt: null },
                positiveControl: { outcome: "fail", checkRunId: "check-oracle", completedAt: "2026-08-20T02:00:00.000Z" },
                negativeControl: { outcome: "blocked", checkRunId: "check-nop", completedAt: "2026-08-20T03:00:00.000Z" },
              } },
              artifactId: "artifact:task",
              contentSha256: "b".repeat(64),
              sourceItemIds: ["item-1"],
              findings: [{ id: "broad-finding", finding: "A legacy opinion" }],
            }],
          }],
        }],
      }],
      totals: { vendors: 1, batches: 1, taskVersions: 1 },
    });
  };

  try {
    const response = await app.fetch(
      new Request("http://localhost/api/catalog", { headers: { cookie: sessionCookie() } }),
      { ...authEnv, CASE_REGISTRY_URL: "https://case.example", CASE_REGISTRY_CATALOG_TOKEN: "catalog-test", ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
      { waitUntil() {}, passThroughOnException() {} },
    );
    assert.equal(response.status, 200);
    const catalog = await response.json();
    assert.deepEqual(catalog.totals, { vendors: 1, submissions: 1, tasks: 1, harborTasks: 1 });
    assert.equal(catalog.demands, undefined);
    assert.equal(catalog.vendors[0].procurementSummary, undefined);
    const submission = catalog.vendors[0].submissions[0];
    assert.deepEqual(submission.formats, ["harbor"]);
    assert.equal(submission.tasks[0].kind, "task");
    assert.equal(submission.tasks[0].format, "harbor");
    assert.deepEqual(Object.keys(submission.tasks[0].checks), ["build", "oracle"]);
    assert.deepEqual(submission.tasks[0].findings, []);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("downloads every available task artifact", async () => {
  const app = await worker();
  const submission = {
    id: "submission-1",
    date: "2026-08-20",
    label: "Vendor sample",
    source: "Captured delivery",
    formats: ["harbor", "non_harbor"],
    tasks: [
      task("task-harbor", "harbor-task", "task", "harbor", "artifact:harbor"),
      task("task-trace", "native-trace", "trace", "non_harbor", "artifact:trace"),
    ],
  };
  const artifactBytes = new Map([
    ["artifact:harbor", new TextEncoder().encode("harbor package")],
    ["artifact:trace", new TextEncoder().encode("trace payload")],
  ]);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const target = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(target);
    if (url.href === "https://case.example/v1/batches/submission-1") return Response.json(submission);
    const signed = url.pathname.match(/^\/v1\/artifacts\/([^/]+)\/download-url$/);
    if (url.origin === "https://case.example" && signed?.[1]) {
      return Response.json({ url: `https://objects.example/artifact?id=${encodeURIComponent(decodeURIComponent(signed[1]))}` });
    }
    if (url.origin === "https://objects.example") {
      const body = artifactBytes.get(url.searchParams.get("id"));
      return body ? new Response(body, { headers: { "content-length": String(body.length) } }) : new Response("Not found", { status: 404 });
    }
    throw new Error(`Unexpected fetch: ${url.href}`);
  };

  try {
    const response = await app.fetch(
      new Request("http://localhost/api/submissions/submission-1/dataset-download", { headers: { cookie: sessionCookie() } }),
      { ...authEnv, CASE_REGISTRY_URL: "https://case.example", CASE_REGISTRY_CATALOG_TOKEN: "catalog-test", ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
      { waitUntil() {}, passThroughOnException() {} },
    );
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("x-case-task-count"), "2");
    assert.match(response.headers.get("content-disposition"), /tasks\.tar/);
    const entries = tarEntries(new Uint8Array(await response.arrayBuffer()));
    assert.deepEqual([...entries.keys()], ["README.md", "manifest.json", "tasks/0001-harbor-task.artifact", "tasks/0002-native-trace.artifact"]);
    const manifest = JSON.parse(new TextDecoder().decode(entries.get("manifest.json")));
    assert.equal(manifest.schemaVersion, "case.tasks.v1");
    assert.deepEqual(manifest.tasks.map((entry) => [entry.kind, entry.format]), [["task", "harbor"], ["trace", "non_harbor"]]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

function task(id, stableKey, kind, format, artifactId) {
  return { id, stableKey, title: stableKey, summary: null, kind, format, sourcePath: `${kind}s/${stableKey}`, artifactId, contentSha256: "a".repeat(64), checks: {}, findings: [] };
}

function sessionCookie() {
  const payload = Buffer.from(JSON.stringify({ openId: "ou_test", unionId: null, tenantKey: authEnv.FEISHU_ALLOWED_TENANT_KEY, name: "Test Researcher", expiresAt: Date.now() + 60_000 })).toString("base64url");
  const signature = createHmac("sha256", authEnv.PORTAL_SESSION_SECRET).update(payload).digest("base64url");
  return `env_portal_session=${payload}.${signature}`;
}

function tarEntries(bytes) {
  const entries = new Map();
  let offset = 0;
  while (offset + 512 <= bytes.length) {
    const header = bytes.subarray(offset, offset + 512);
    const name = new TextDecoder().decode(header.subarray(0, 100)).replace(/\0.*$/, "");
    if (!name) break;
    const sizeText = new TextDecoder().decode(header.subarray(124, 136)).replace(/\0.*$/, "").trim();
    const size = Number.parseInt(sizeText || "0", 8);
    const start = offset + 512;
    entries.set(name, bytes.slice(start, start + size));
    offset = start + Math.ceil(size / 512) * 512;
  }
  return entries;
}
