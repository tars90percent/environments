import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
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

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(new URL(path, "http://localhost/"), {
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

test("does not expose the local demand preview in a production build", async () => {
  const response = await render("/?preview=demand-board");
  assert.equal(response.status, 307);
  assert.equal(new URL(response.headers.get("location"), "http://localhost").pathname, "/auth/login");
});

test("keeps the portal narrowly scoped and free of vendor snapshot data", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(new URL("../app/portal-client.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const worker = await readFile(new URL("../worker/index.ts", import.meta.url), "utf8");

  assert.doesNotMatch(source, /axios|lark-cli|open\.feishu\.cn|webhook/i);
  assert.match(source, /环境与任务样本/);
  assert.match(source, /Environment & Task Samples/);
  assert.match(source, /stats: \{ vendors: "家供应商", submissions: "次提交", tasks: "个任务" \}/);
  assert.match(source, /stats: \{ vendors: "vendors", submissions: "submissions", tasks: "tasks" \}/);
  assert.match(source, /const logicalTaskCount = useMemo/);
  assert.match(source, /task\.stableKey/);
  assert.match(source, /function logicalTaskCountForVendor/);
  assert.match(source, /const taskCount = logicalTaskCountForVendor\(vendor\)/);
  assert.match(source, /const taskCount = logicalTaskCountForVendor\(selectedVendor\)/);
  assert.doesNotMatch(source, /const inventory =/);
  assert.doesNotMatch(source, /t\.records/);
  assert.doesNotMatch(source, /catalog\?\.totals\.taskVersions/);
  assert.match(source, /Submission history/);
  assert.match(source, /Original sources/);
  assert.match(source, /Open live source/);
  assert.match(source, /Download captured copy/);
  assert.match(source, /Download complete dataset/);
  assert.match(source, /Download task package/);
  assert.match(source, /task\.artifactId && <a href=/);
  assert.match(source, /taskDownloadBase="\/local-preview\/task-package"/);
  assert.match(source, /Researcher response/);
  assert.match(source, /Interested in the full set/);
  assert.match(source, /Selected task categories/);
  assert.match(source, /商务洽谈中/);
  assert.match(source, /尚未形成采购决定/);
  assert.match(source, /View evidence/);
  assert.match(source, /selectedVendor\.procurementSummary && <ProcurementSummary/);
  assert.doesNotMatch(source, /quote_under_negotiation|purchaseStatus/);
  assert.match(source, /Upload a research sample/);
  assert.match(source, /Market supply/);
  assert.match(source, /Research demand/);
  assert.match(source, /Baseline for every task type/);
  assert.match(source, /Task types in demand/);
  assert.match(source, /Long-horizon 0→1 greenfield development/);
  assert.match(source, /CUDA optimization environments/);
  assert.match(source, /ML and inference engineering/);
  assert.match(source, /Wide and time-sensitive search/);
  assert.match(source, /软件工程/);
  assert.match(source, /长程 0→1 从零开发/);
  assert.match(source, /当前需要的任务类型/);
  assert.doesNotMatch(source, /正在需求的任务类型/);
  assert.match(source, /《数据采购》Wiki — 需求矩阵/);
  assert.match(source, /TARS 样本需求/);
  assert.match(source, /href=\{demand\.sourceUrl\}/);
  assert.doesNotMatch(source, /TARS 研究需求工作草案|Quantitative research|Build or repair a spreadsheet model/);
  assert.match(source, /not live CASE records/);
  assert.doesNotMatch(source, /Illustrative working draft|demand-add-inline/);
  assert.doesNotMatch(source, /Demand status|Requested volume|Target window|matched submissions/);
  assert.match(source, /Contacted, no samples yet/);
  assert.doesNotMatch(source, /className="vendor-mark/);
  assert.doesNotMatch(source, /Every received batch|submission batches|供应商样本库|个提交批次|Update history|RL Environment Catalog|强化学习环境目录/);
  assert.doesNotMatch(source, /type Tab|global-nav|ChecksView|CriteriaView/);
  assert.match(source, /No check results recorded/);
  assert.match(source, /Recorded findings/);
  assert.match(source, /记录发现/);
  assert.match(source, /findings\.length > 0/);
  assert.match(source, /finding\.finding/);
  assert.doesNotMatch(source, /finding\.kind|observed_fact|vendor_claim|deterministic_result|heuristic_assessment|human_judgment|binding_term/);
  assert.doesNotMatch(source, /format-stack|batch\.formats\.map/);
  assert.match(source, /vendorMain\.scrollTo\(\{ top: 0 \}\)/);
  assert.match(source, /vendorMain\.scrollIntoView\(\{ block: "start" \}\)/);
  assert.match(source, /className=\{`app-shell app-shell-\$\{activeView\}`\}/);
  assert.match(styles, /@media \(min-width: 821px\)[\s\S]*\.app-shell-supply \{[^}]*height: 100dvh;[^}]*overflow: hidden/);
  assert.match(styles, /\.app-shell-supply \.portal-grid \{[^}]*height: 100%;[^}]*min-height: 0/);
  assert.match(styles, /\.sidebar-head \{[^}]*position: sticky;[^}]*top: 0/);
  assert.doesNotMatch(styles, /height: calc\(100vh - 102px\)|min-height: 620px/);
  assert.match(styles, /\.vendor-main \{[^}]*overflow-y: auto/);
  assert.match(styles, /@media \(max-width: 820px\)[\s\S]*\.portal-grid \{[^}]*height: auto/);
  assert.match(source, /isExpanded \? "▴" : "▾"/);
  assert.doesNotMatch(source, /task-details|task-evidence|task-criteria|RECORDED EVIDENCE|CURRENT INTAKE CONTRACT/);
  assert.match(source, /切换至英文/);
  assert.match(source, /Switch to Chinese/);
  assert.match(source, /snapshot\.demands\.map/);
  assert.doesNotMatch(source, /className="criteria-aside"/);
  assert.match(source, /fetch\("\/api\/catalog"/);
  assert.match(source, /\/auth\/logout/);
  assert.doesNotMatch(source, /Deeptune|Prime Intellect|Scaler AI Labs/);
  assert.match(worker, /CASE_REGISTRY_CATALOG_TOKEN/);
  assert.match(worker, /CASE_REGISTRY_REVIEW_TOKEN/);
  assert.match(worker, /CASE_REGISTRY_UPLOAD_TOKEN/);
  assert.match(worker, /hasPortalSession/);
  assert.match(worker, /taskDatasetArchive/);
  assert.match(worker, /dataset-download/);
  assert.match(worker, /\/api\\\/artifacts\\\/\(\[\^\/\]\+\)\\\/download/);
  assert.match(worker, /url\.pathname === ["']\/api\/uploads["']/);
  assert.match(worker, /method:\s*["']PUT["']/);
  assert.doesNotMatch(worker, /method:\s*["']PATCH|method:\s*["']DELETE/i);
  assert.match(worker, /\/api\\\/submissions\\\/\(\[\^\/\]\+\)\\\/reviews/);
  assert.match(worker, /reviewer:\s*\{/);
  assert.match(worker, /openId:\s*session\.openId/);
  assert.doesNotMatch(source, /upstream|recommendation|usable yield/i);
});

test("downloads a dataset containing every available task package", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("dataset-test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const submission = {
    id: "submission-1",
    date: "2026-08-20",
    label: "Vendor sample",
    source: "Captured delivery",
    formats: ["harbor"],
    categories: [{
      id: "category-1",
      name: "Example",
      tasks: [
        task("task-ready", "ready", "ready_for_research", "artifact:ready"),
        task("task-checking", "checking", "checking", "artifact:checking"),
        task("task-fix", "needs-fix", "needs_vendor_fix", "artifact:fix"),
      ],
    }],
  };
  const packageBytes = new Map([
    ["artifact:ready", new TextEncoder().encode("ready task package")],
    ["artifact:checking", new TextEncoder().encode("checking task package")],
    ["artifact:fix", new TextEncoder().encode("needs-fix task package")],
  ]);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const target = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(target);
    if (url.href === "https://case.example/v1/batches/submission-1") return Response.json(submission);
    const signed = url.pathname.match(/^\/v1\/artifacts\/([^/]+)\/download-url$/);
    if (url.origin === "https://case.example" && signed?.[1]) {
      const artifactId = decodeURIComponent(signed[1]);
      return Response.json({ url: `https://objects.example/package?artifact=${encodeURIComponent(artifactId)}` });
    }
    if (url.origin === "https://objects.example") {
      const body = packageBytes.get(url.searchParams.get("artifact"));
      return body ? new Response(body, { headers: { "content-length": String(body.length), "content-type": "application/gzip" } }) : new Response("Not found", { status: 404 });
    }
    throw new Error(`Unexpected fetch: ${url.href}`);
  };

  try {
    const response = await worker.fetch(
      new Request("http://localhost/api/submissions/submission-1/dataset-download", { headers: { cookie: sessionCookie() } }),
      {
        ...authEnv,
        CASE_REGISTRY_URL: "https://case.example",
        CASE_REGISTRY_CATALOG_TOKEN: "catalog-test",
        ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
      },
      { waitUntil() {}, passThroughOnException() {} },
    );
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "application/x-tar");
    assert.match(response.headers.get("content-disposition"), /task-dataset\.tar/);
    assert.equal(response.headers.get("x-case-task-count"), "3");

    const entries = tarEntries(new Uint8Array(await response.arrayBuffer()));
    assert.deepEqual([...entries.keys()], [
      "README.md",
      "manifest.json",
      "tasks/0001-ready.tar.gz",
      "tasks/0002-checking.tar.gz",
      "tasks/0003-needs-fix.tar.gz",
    ]);
    assert.equal(new TextDecoder().decode(entries.get("tasks/0001-ready.tar.gz")), "ready task package");
    assert.equal(new TextDecoder().decode(entries.get("tasks/0002-checking.tar.gz")), "checking task package");
    assert.equal(new TextDecoder().decode(entries.get("tasks/0003-needs-fix.tar.gz")), "needs-fix task package");
    const manifest = JSON.parse(new TextDecoder().decode(entries.get("manifest.json")));
    assert.equal(manifest.selection.statusPolicy, "all_statuses_included");
    assert.deepEqual(manifest.tasks.map((entry) => entry.workflowStatus), ["ready_for_research", "checking", "needs_vendor_fix"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

function task(id, stableKey, workflowStatus, artifactId) {
  return {
    id,
    stableKey,
    title: stableKey,
    sourcePath: `tasks/${stableKey}`,
    format: "harbor",
    artifactId,
    contentSha256: "a".repeat(64),
    workflowStatus,
    checks: { pass: 1, fail: 0, blocked: 0, notRun: 0 },
  };
}

function sessionCookie() {
  const payload = Buffer.from(JSON.stringify({
    openId: "ou_test",
    unionId: null,
    tenantKey: authEnv.FEISHU_ALLOWED_TENANT_KEY,
    name: "Test Researcher",
    expiresAt: Date.now() + 60_000,
  })).toString("base64url");
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
