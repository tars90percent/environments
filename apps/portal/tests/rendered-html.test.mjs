import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import test, { after, before } from "node:test";
import { build as buildModule } from "esbuild";
import { strFromU8, unzipSync } from "fflate";

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

async function benchmarkLandscapeModule() {
  const result = await buildModule({
    entryPoints: [new URL("../app/benchmark-landscape.ts", import.meta.url).pathname],
    bundle: true,
    format: "esm",
    platform: "node",
    write: false,
  });
  const source = result.outputFiles[0].text;
  return import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
}

async function taskGroupsModule() {
  const result = await buildModule({
    entryPoints: [new URL("../app/task-groups.ts", import.meta.url).pathname],
    bundle: true,
    format: "esm",
    platform: "node",
    write: false,
  });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);
}

function landscapeTask(id, benchmarkId, benchmarkName, kind = "task", format = "harbor") {
  return { id, stableKey: id, title: id, summary: null, kind, format, benchmark: { id: benchmarkId, displayName: benchmarkName } };
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

test("groups only Harbor tasks into benchmark directions and portal groups", async () => {
  const { benchmarkCategoryId, buildBenchmarkLandscape } = await benchmarkLandscapeModule();
  const catalog = {
    vendors: [
      { id: "vendor-one", name: "Vendor One", short: "V1", submissions: [{ id: "submission-one", date: "2026-08-20", label: "One", tasks: [
        landscapeTask("deep-one", "deep-swe", "DeepSWE"),
        landscapeTask("terminal-one", "terminal-bench", "Terminal-Bench"),
        landscapeTask("native-one", "deep-swe", "DeepSWE", "task", "non_harbor"),
      ] }] },
      { id: "vendor-two", name: "Vendor Two", short: "V2", submissions: [{ id: "submission-two", date: "2026-08-19", label: "Two", tasks: [
        landscapeTask("deep-two", "deep-swe", "DeepSWE"),
        landscapeTask("security-two", "cybersecurity", "Cybersecurity"),
        landscapeTask("trace-two", "terminal-bench", "Terminal-Bench", "trace", "harbor"),
      ] }] },
    ],
  };
  const landscape = buildBenchmarkLandscape(catalog);
  assert.equal(landscape.taskCount, 4);
  assert.equal(landscape.benchmarkCount, 3);
  assert.equal(landscape.vendorCount, 2);
  assert.deepEqual(landscape.groups.map((group) => [group.id, group.taskCount, group.vendorCount]), [
    ["deep-swe", 2, 2],
    ["cybersecurity", 1, 1],
    ["terminal-bench", 1, 1],
  ]);
  assert.equal(benchmarkCategoryId("deep-swe"), "software-engineering");
  assert.equal(benchmarkCategoryId("terminal-bench"), "systems-infrastructure");
  assert.equal(benchmarkCategoryId("cybersecurity"), "security");
  assert.equal(benchmarkCategoryId("mathematical-reasoning"), "science-reasoning");
  assert.equal(benchmarkCategoryId("scaler-swe"), "other");
  assert.equal(benchmarkCategoryId("brand-new-direction"), "other");
});

test("folds large submissions by benchmark direction and record type", async () => {
  const { groupSubmissionTasks } = await taskGroupsModule();
  const records = [
    landscapeTask("company-task", "companybench", "CompanyBench", "task", "non_harbor"),
    landscapeTask("company-trace-one", "companybench", "CompanyBench", "trace", "non_harbor"),
    landscapeTask("medical-task", "medical-reasoning", "Medical Reasoning", "task", "non_harbor"),
    landscapeTask("company-trace-two", "companybench", "CompanyBench", "trace", "non_harbor"),
  ];
  const groups = groupSubmissionTasks(records);
  assert.deepEqual(groups.map((group) => [group.id, group.kind, group.tasks.map((record) => record.id)]), [
    ["companybench:task", "task", ["company-task"]],
    ["companybench:trace", "trace", ["company-trace-one", "company-trace-two"]],
    ["medical-reasoning:task", "task", ["medical-task"]],
  ]);
});

test("keeps the researcher UI on the narrow CASE record", async () => {
  const source = await readFile(new URL("../app/portal-client.tsx", import.meta.url), "utf8");
  const landscapeSource = await readFile(new URL("../app/benchmark-landscape.ts", import.meta.url), "utf8");
  const workerSource = await readFile(new URL("../worker/index.ts", import.meta.url), "utf8");

  assert.match(source, /Environment & Task Samples/);
  assert.match(source, /RL task landscape/);
  assert.doesNotMatch(source, /Benchmark directions are grouped for navigation only/);
  assert.doesNotMatch(source, /基准分组仅用于浏览/);
  assert.match(source, /useState<PortalView>\("benchmarks"\)/);
  assert.match(source, /BenchmarkOverview/);
  assert.match(source, /BenchmarkDetail/);
  assert.match(source, /grouped by vendor/);
  assert.match(landscapeSource, /task\.kind === "task" && task\.format === "harbor"/);
  assert.match(landscapeSource, /benchmarkCategoryId/);
  assert.match(landscapeSource, /"terminal-bench"/);
  assert.match(landscapeSource, /"mathematical-reasoning"/);
  assert.doesNotMatch(landscapeSource, /"scaler-/);
  assert.match(source, /Original vendor files/);
  assert.doesNotMatch(source, /Source records|来源记录|sourceRecord/);
  assert.doesNotMatch(source, /Show vendor filenames|查看供应商文件名|showFiles/);
  assert.match(source, /Direct CASE import/);
  assert.doesNotMatch(source, /Open source|打开来源|safeExternalUrl/);
  assert.match(source, /originalSubmissionArtifacts/);
  assert.match(source, /artifacts\.map\(\(artifact\)/);
  assert.match(source, /encodeURIComponent\(artifact\.artifactId\)/);
  assert.doesNotMatch(source, /original-download/);
  assert.match(source, /Number\.isFinite\(size\)/);
  assert.match(source, /displayArchivePath\(task\.sourcePath\)/);
  assert.match(source, /Tasks/);
  assert.match(source, /Environment/);
  assert.match(source, /Oracle/);
  assert.match(source, /Nop/);
  assert.match(source, /task\.format === "harbor"/);
  assert.match(source, /task\.benchmark\.displayName/);
  assert.match(source, /task\.benchmark\.id !== "unspecified"/);
  assert.match(source, /task\.gpuRequired/);
  assert.match(source, /check-mark/);
  assert.match(source, /task\.attempts\?\.\[phase\]/);
  assert.match(source, /attempted: "Tried"/);
  assert.match(source, /notAttempted: "Not attempted"/);
  assert.match(source, /task\.findings\.length > 0/);
  assert.match(source, /TASK_GROUP_THRESHOLD = 100/);
  assert.match(source, /groupSubmissionTasks\(tasks\)/);
  assert.match(source, /Show \$\{count\} more/);
  assert.match(source, /fetch\("\/api\/catalog"/);
  assert.match(source, /filter\(\(vendor\) => vendor\.submissions\.length > 0\)/);
  assert.match(source, /value=\{catalog \? vendors\.length : undefined\}/);
  assert.doesNotMatch(source, /catalog\?\.totals\.tasks/);
  assert.match(source, /catalog\?\.totals\.harborTasks/);
  assert.doesNotMatch(source, /Upload submission|上传提交|\/api\/uploads|x-case-upload/i);
  assert.doesNotMatch(source, /procurement|research demand|runtimeVerification|representationPath|normalizationOutcome|needs_vendor_fix|ready_for_research|reviewer/i);
  assert.doesNotMatch(source, /task\.category|submission\.categories|categoryIds/);
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
                boot: { outcome: "fail", checkRunId: "check-boot", completedAt: "2026-08-20T01:30:00.000Z" },
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
    assert.deepEqual(submission.tasks[0].benchmark, { id: "unspecified", displayName: "Unspecified" });
    assert.equal(submission.tasks[0].gpuRequired, false);
    assert.deepEqual(Object.keys(submission.tasks[0].checks), ["oracle", "environment"]);
    assert.equal(submission.tasks[0].checks.environment.outcome, "fail");
    assert.match(submission.tasks[0].checks.environment.summary, /inferred from failed Build or Boot evidence/i);
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
  submission.tasks[0].sourcePath = "benchmarkµá╖Σ╛ïµò░µì«-σ«₧τÄ░τ╜æ-Callµò░σñºΣ║Ä100/packages/task_01";
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
    assert.equal(manifest.tasks[0].sourcePath, "benchmark样例数据-实现网-Call数大于100/packages/task_01");
    assert.deepEqual(manifest.tasks.map((entry) => [entry.kind, entry.format]), [["task", "harbor"], ["trace", "non_harbor"]]);
    assert.deepEqual(manifest.tasks.map((entry) => entry.benchmark.id), ["terminal-bench", "unspecified"]);
    assert.deepEqual(manifest.tasks.map((entry) => entry.gpuRequired), [true, false]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("bundles only inbound vendor files and leaves receipts and derived task packages out", async () => {
  const app = await worker();
  const submission = {
    id: "submission-1",
    date: "2026-08-20",
    label: "Vendor sample",
    source: "Local folder handoff",
    formats: ["harbor"],
    sourceEvents: [{
      id: "event-1",
      channel: "workspace",
      externalRef: "/evidence/vendor-sample",
      sender: null,
      receivedAt: "2026-08-20T00:00:00.000Z",
      rawArtifactId: "artifact:receipt",
      rawArtifact: { id: "artifact:receipt", kind: "source_snapshot", contentSha256: "c".repeat(64), sizeBytes: 20, contentType: "application/json", originalName: "receipt.json" },
      items: [
        sourceItem("item-one", "original-one.zip", "artifact:one", "source_payload", 12),
        sourceItem("item-two", "original-two.zip", "artifact:two", "source_payload", 12),
        sourceItem("item-pdf", "vendor-description.pdf", "artifact:pdf", "source_snapshot", 10, "pdf", "application/pdf", ["original_vendor_file"]),
        sourceItem("item-receipt", "receipt.json", "artifact:receipt", "source_snapshot", 20, "file", "application/json", ["provenance"]),
        sourceItem("item-task", "derived-task.tar.gz", "artifact:task", "task_package", 30, "task_package", "application/gzip", ["provenance"]),
      ],
    }],
    tasks: [],
  };
  const artifactBytes = new Map([
    ["artifact:one", new TextEncoder().encode("first source")],
    ["artifact:two", new TextEncoder().encode("secondsource")],
    ["artifact:pdf", new TextEncoder().encode("vendor pdf")],
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
      new Request("http://localhost/api/submissions/submission-1/original-download", { headers: { cookie: sessionCookie() } }),
      { ...authEnv, CASE_REGISTRY_URL: "https://case.example", CASE_REGISTRY_CATALOG_TOKEN: "catalog-test", ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
      { waitUntil() {}, passThroughOnException() {} },
    );
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "application/zip");
    assert.equal(response.headers.get("x-case-original-file-count"), "3");
    const entries = unzipSync(new Uint8Array(await response.arrayBuffer()));
    assert.deepEqual(Object.keys(entries), ["original-one.zip", "original-two.zip", "vendor-description.pdf"]);
    assert.equal(strFromU8(entries["original-one.zip"]), "first source");
    assert.equal(strFromU8(entries["original-two.zip"]), "secondsource");
    assert.equal(strFromU8(entries["vendor-description.pdf"]), "vendor pdf");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("recovers legacy inbound task packages without bundling messages, screenshots, or normalized tasks", async () => {
  const app = await worker();
  const submission = {
    id: "submission-legacy",
    date: "2026-08-20",
    label: "Vendor legacy sample",
    source: "Feishu attachment",
    formats: ["harbor"],
    sourceEvents: [
      {
        id: "event-screenshot",
        channel: "feishu",
        externalRef: "feishu-message://screenshot",
        sender: "Vendor",
        receivedAt: "2026-08-20T00:00:00.000Z",
        rawArtifactId: "artifact:screenshot",
        rawArtifact: { id: "artifact:screenshot", kind: "source_snapshot", contentSha256: "a".repeat(64), sizeBytes: 10, contentType: "image/png", originalName: "delivery.png" },
        items: [sourceItem("item-screenshot", "delivery.png", "artifact:screenshot", "source_snapshot", 10, "file", "image/png")],
      },
      {
        id: "event-message",
        channel: "feishu",
        externalRef: "https://example.com/message",
        sender: "Vendor",
        receivedAt: "2026-08-20T00:01:00.000Z",
        rawArtifactId: "artifact:message",
        rawArtifact: { id: "artifact:message", kind: "source_payload", contentSha256: "b".repeat(64), sizeBytes: 11, contentType: "application/json", originalName: "message-snapshot.json" },
        items: [sourceItem("item-message", "message-snapshot.json", "artifact:message", "source_payload", 11, "message", "application/json")],
      },
      {
        id: "event-capture",
        channel: "other",
        externalRef: "case-capture://feishu/message/file",
        sender: "Vendor",
        receivedAt: "2026-08-20T00:02:00.000Z",
        rawArtifactId: "artifact:vendor-zip",
        rawArtifact: { id: "artifact:vendor-zip", kind: "task_package", contentSha256: "c".repeat(64), sizeBytes: 15, contentType: "application/zip", originalName: "vendor-original.zip" },
        items: [sourceItem("item-vendor", "vendor-original.zip", "artifact:vendor-zip", "task_package", 15, "archive", "application/zip")],
      },
      {
        id: "normalization:submission-legacy:task-packages:v1",
        channel: "workspace",
        externalRef: "case-normalization://submission-legacy",
        sender: null,
        receivedAt: "2026-08-20T00:03:00.000Z",
        rawArtifactId: null,
        rawArtifact: null,
        items: [sourceItem("item-normalized", "normalized-task.tar.gz", "artifact:normalized", "task_package", 16, "task_package", "application/gzip")],
      },
    ],
    tasks: [task("task-one", "task-one", "task", "harbor", "artifact:normalized")],
  };
  submission.tasks[0].sourceItemIds = ["item-vendor", "item-normalized"];
  const vendorBytes = new TextEncoder().encode("vendor-original");
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const target = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(target);
    if (url.href === "https://case.example/v1/batches/submission-legacy") return Response.json(submission);
    const signed = url.pathname.match(/^\/v1\/artifacts\/([^/]+)\/download-url$/);
    if (url.origin === "https://case.example" && signed?.[1]) {
      assert.equal(decodeURIComponent(signed[1]), "artifact:vendor-zip");
      return Response.json({ url: "https://objects.example/vendor-original" });
    }
    if (url.href === "https://objects.example/vendor-original") {
      return new Response(vendorBytes, { headers: { "content-length": String(vendorBytes.length) } });
    }
    throw new Error(`Unexpected fetch: ${url.href}`);
  };

  try {
    const response = await app.fetch(
      new Request("http://localhost/api/submissions/submission-legacy/original-download", { headers: { cookie: sessionCookie() } }),
      { ...authEnv, CASE_REGISTRY_URL: "https://case.example", CASE_REGISTRY_CATALOG_TOKEN: "catalog-test", ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
      { waitUntil() {}, passThroughOnException() {} },
    );
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("x-case-original-file-count"), "1");
    assert.match(response.headers.get("content-disposition"), /original-vendor-files\.zip/);
    const entries = unzipSync(new Uint8Array(await response.arrayBuffer()));
    assert.deepEqual(Object.keys(entries), ["vendor-original.zip"]);
    assert.equal(strFromU8(entries["vendor-original.zip"]), "vendor-original");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

function task(id, stableKey, kind, format, artifactId) {
  return { id, stableKey, title: stableKey, summary: null, kind, format, benchmark: format === "harbor" ? { id: "terminal-bench", displayName: "Terminal-Bench" } : { id: "unspecified", displayName: "Unspecified" }, gpuRequired: format === "harbor", sourcePath: `${kind}s/${stableKey}`, artifactId, contentSha256: "a".repeat(64), checks: {}, attempts: {}, findings: [] };
}

function sourceItem(id, displayName, artifactId, artifactKind, sizeBytes, kind = artifactKind === "task_package" ? "task_package" : "archive", mediaType = "application/zip", submissionRoles) {
  return { id, kind, displayName, locator: null, mediaType, artifactId, artifactKind, contentSha256: "a".repeat(64), sizeBytes, ...(submissionRoles ? { submissionRoles } : {}) };
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
