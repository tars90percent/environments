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
  const worker = await readFile(new URL("../worker/index.ts", import.meta.url), "utf8");

  assert.doesNotMatch(source, /axios|lark-cli|open\.feishu\.cn|webhook/i);
  assert.match(source, /环境与任务样本/);
  assert.match(source, /Environment & Task Samples/);
  assert.match(source, /Submission history/);
  assert.match(source, /Original sources/);
  assert.match(source, /Open live source/);
  assert.match(source, /Download captured copy/);
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
  assert.match(source, /finding\.evidenceCheckRunIds\.length/);
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
  assert.match(worker, /url\.pathname === ["']\/api\/uploads["']/);
  assert.match(worker, /method:\s*["']PUT["']/);
  assert.doesNotMatch(worker, /method:\s*["']PATCH|method:\s*["']DELETE/i);
  assert.match(worker, /\/api\\\/submissions\\\/\(\[\^\/\]\+\)\\\/reviews/);
  assert.match(worker, /reviewer:\s*\{/);
  assert.match(worker, /openId:\s*session\.openId/);
  assert.doesNotMatch(source, /upstream|recommendation|usable yield/i);
});
