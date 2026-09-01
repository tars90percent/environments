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

async function datasetArchiveModule() {
  const result = await buildModule({
    entryPoints: [new URL("../app/dataset-archive.ts", import.meta.url).pathname],
    bundle: true,
    format: "esm",
    platform: "node",
    write: false,
  });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);
}

async function modelBenchmarkDataModule() {
  const result = await buildModule({
    entryPoints: [new URL("../app/model-benchmark-data.ts", import.meta.url).pathname],
    bundle: true,
    format: "esm",
    platform: "node",
    write: false,
  });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);
}

async function modelBenchmarkSamplesModule() {
  const result = await buildModule({
    entryPoints: [new URL("../app/model-benchmark-samples.ts", import.meta.url).pathname],
    bundle: true,
    format: "esm",
    platform: "node",
    write: false,
  });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);
}

async function modelBenchmarkFilesystemsModule() {
  const result = await buildModule({
    entryPoints: [new URL("../app/model-benchmark-filesystems.ts", import.meta.url).pathname],
    bundle: true,
    format: "esm",
    platform: "node",
    write: false,
  });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);
}

async function modelBenchmarkNativeRecordsModule() {
  const result = await buildModule({
    entryPoints: [new URL("../app/model-benchmark-native-records.ts", import.meta.url).pathname],
    bundle: true,
    format: "esm",
    platform: "node",
    write: false,
  });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);
}

async function modelBenchmarkAgentViewsModule() {
  const result = await buildModule({
    entryPoints: [new URL("../app/model-benchmark-agent-views.ts", import.meta.url).pathname],
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
  const app = await worker();
  const response = await app.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
  assert.equal(response.status, 307);
  assert.equal(new URL(response.headers.get("location"), "http://localhost").pathname, "/auth/login");

  const modelBenchmarkResponse = await app.fetch(
    new Request("http://localhost/model-benchmarks", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
  assert.equal(modelBenchmarkResponse.status, 307);
  assert.equal(new URL(modelBenchmarkResponse.headers.get("location"), "http://localhost").pathname, "/auth/login");

  const modelTaskResponse = await app.fetch(
    new Request("http://localhost/model-benchmarks/terminal-bench-2-1/tasks/terminal-wal-recovery", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
  assert.equal(modelTaskResponse.status, 307);
  assert.equal(new URL(modelTaskResponse.headers.get("location"), "http://localhost").pathname, "/auth/login");
});

test("records standalone benchmark families separately from aggregate indexes", async () => {
  const { aggregateBenchmarks, artificialAnalysisIndex, benchmarkReferenceCategories, modelBenchmarks, modelBenchmarkSearchText } = await modelBenchmarkDataModule();

  assert.equal(artificialAnalysisIndex.version, "4.1.1");
  assert.equal(artificialAnalysisIndex.releasedAt, "2026-08-06");
  assert.equal(artificialAnalysisIndex.verifiedAt, "2026-08-29");
  assert.equal(aggregateBenchmarks.length, 1);
  assert.equal(artificialAnalysisIndex.components.length, 9);
  assert.equal(artificialAnalysisIndex.components.reduce((total, component) => total + component.weight, 0), 100);
  assert.ok(artificialAnalysisIndex.links.every((link) => link.url.startsWith("https://artificialanalysis.ai/")));

  assert.equal(modelBenchmarks.length, 38);
  assert.equal(benchmarkReferenceCategories.length, 5);
  const ids = modelBenchmarks.map((benchmark) => benchmark.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(Object.fromEntries(benchmarkReferenceCategories.map((category) => [category.id, modelBenchmarks.filter((benchmark) => benchmark.categoryId === category.id).length])), {
    "agents-tools": 11,
    coding: 10,
    "research-reasoning": 8,
    "multimodal-documents": 6,
    cybersecurity: 3,
  });
  assert.deepEqual(Object.fromEntries(["cursorbench", "spreadsheetbench", "browsecomp", "mmmu-pro"].map((id) => [id, modelBenchmarks.find((benchmark) => benchmark.id === id)?.categoryId])), {
    cursorbench: "coding",
    spreadsheetbench: "agents-tools",
    browsecomp: "research-reasoning",
    "mmmu-pro": "multimodal-documents",
  });
  assert.equal(modelBenchmarks.filter((benchmark) => modelBenchmarkSearchText(benchmark).includes("coding & software engineering")).length, 10);
  assert.equal(modelBenchmarks.filter((benchmark) => modelBenchmarkSearchText(benchmark).includes("多模态与文档理解")).length, 6);
  assert.deepEqual(modelBenchmarks.filter((benchmark) => ["gdpval-aa-v2", "terminal-bench-2-1", "hle", "gpqa-diamond"].includes(benchmark.id)).map((benchmark) => benchmark.name), [
    "GDPval", "Terminal-Bench", "Humanity's Last Exam", "GPQA",
  ]);
  assert.ok(artificialAnalysisIndex.components.every((component) => ids.includes(component.benchmarkId)));

  for (const benchmark of modelBenchmarks) {
    assert.ok(benchmark.links.length > 0);
    assert.ok(benchmark.links.every((link) => link.url.startsWith("https://")));
    assert.ok(benchmark.creators.en.length > 0 && benchmark.creators.zh.length > 0);
    assert.ok(benchmark.summary.en.length > 0 && benchmark.summary.zh.length > 0);
    assert.ok(benchmark.questionCount.en.length > 0 && benchmark.questionCount.zh.length > 0);
    assert.ok(!Object.hasOwn(benchmark, "weight"));
  }
});

test("ships attributed official leaderboard snapshots for selected benchmark detail views", async () => {
  const { modelBenchmarks } = await modelBenchmarkDataModule();
  const benchmarksWithSnapshots = modelBenchmarks.filter((benchmark) => benchmark.leaderboardSnapshots?.length);

  assert.deepEqual(benchmarksWithSnapshots.map((benchmark) => benchmark.id), [
    "terminal-bench-2-1",
    "hle",
    "critpt",
    "agents-last-exam",
    "mcp-atlas",
    "deepswe",
    "frontierswe",
    "posttrainbench",
    "spreadsheetbench",
    "swe-bench-pro",
    "frontiercode",
  ]);

  for (const benchmark of benchmarksWithSnapshots) {
    assert.equal(benchmark.leaderboardSnapshots.length, 1);
    const snapshot = benchmark.leaderboardSnapshots[0];
    assert.ok(snapshot.sourceUrl.startsWith("https://"));
    assert.equal(snapshot.capturedAt, "2026-08-31");
    assert.match(snapshot.imagePath, /^\/benchmark-leaderboards\/[a-z0-9-]+\.jpg$/);
    assert.ok(snapshot.alt.en.length > 0 && snapshot.alt.zh.length > 0);
    assert.ok(snapshot.caption.en.length > 0 && snapshot.caption.zh.length > 0);

    const image = await readFile(new URL(`../public${snapshot.imagePath}`, import.meta.url));
    assert.deepEqual([...image.subarray(0, 3)], [255, 216, 255]);
    assert.ok(image.length > 40_000);
  }
});

test("retains public-task profiles for every open family and format archetypes for gated families", async () => {
  const { modelBenchmarks } = await modelBenchmarkDataModule();
  const { modelBenchmarkSamples, modelBenchmarkSampleContext } = await modelBenchmarkSamplesModule();
  const benchmarkIds = Object.keys(modelBenchmarkSamples);

  assert.deepEqual(Object.keys(modelBenchmarkSampleContext).sort(), benchmarkIds.toSorted());
  assert.ok(benchmarkIds.every((id) => modelBenchmarks.some((benchmark) => benchmark.id === id)));
  assert.equal(benchmarkIds.length, 35);
  assert.equal(Object.values(modelBenchmarkSamples).flat().length, 44);

  const profileIds = [];
  for (const benchmarkId of benchmarkIds) {
    const profiles = modelBenchmarkSamples[benchmarkId];
    assert.ok([1, 2].includes(profiles.length), `${benchmarkId} should have one or two profiles`);
    for (const profile of profiles) {
      profileIds.push(profile.id);
      assert.ok(profile.sourceUrl.startsWith("https://"));
      assert.equal(profile.capabilities.en.length, 3);
      assert.equal(profile.capabilities.zh.length, 3);
      assert.deepEqual(Object.keys(profile).sort(), [
        "capabilities", "evaluation", "expectedOutput", "id", "inputs", "objective", "sourceId", "sourceKind", "sourceLabel", "sourceUrl", "title",
      ].sort());
    }
  }
  assert.equal(new Set(profileIds).size, profileIds.length);
  assert.equal(benchmarkIds.filter((id) => modelBenchmarkSamples[id].length === 2).length, 9);
  assert.equal(benchmarkIds.filter((id) => modelBenchmarkSamples[id].length === 1).length, 26);
  assert.equal(benchmarkIds.filter((id) => modelBenchmarkSamples[id].some((profile) => profile.sourceKind === "public-task")).length, 33);
  assert.equal(Object.values(modelBenchmarkSamples).flat().filter((profile) => profile.sourceKind === "public-task").length, 40);

  for (const benchmarkId of ["hle", "gpqa-diamond"]) {
    assert.ok(modelBenchmarkSamples[benchmarkId].every((profile) => profile.sourceKind === "format-archetype" && profile.sourceId === null));
  }
  for (const benchmarkId of benchmarkIds.filter((id) => !["hle", "gpqa-diamond"].includes(id))) {
    assert.ok(modelBenchmarkSamples[benchmarkId].every((profile) => profile.sourceKind === "public-task" && profile.sourceId));
  }
});

test("records complete upstream filesystem metadata for Harbor sample tasks", async () => {
  const { modelBenchmarkTaskFilesystems, upstreamFilesystemEntryContentUrl, upstreamFilesystemEntryUrl } = await modelBenchmarkFilesystemsModule();
  assert.deepEqual(Object.keys(modelBenchmarkTaskFilesystems).sort(), ["deepswe-abs-module-cache", "terminal-financial-documents", "terminal-wal-recovery"]);

  const deepSwe = modelBenchmarkTaskFilesystems["deepswe-abs-module-cache"];
  const financial = modelBenchmarkTaskFilesystems["terminal-financial-documents"];
  const wal = modelBenchmarkTaskFilesystems["terminal-wal-recovery"];
  assert.equal(deepSwe.treeSha, "0b9fabbb63b9104d678fe965e1632f2dd9eaa2ea");
  assert.equal(deepSwe.verifiedAt, "2026-08-31");
  assert.equal(deepSwe.entries.filter((entry) => entry.kind === "file").length, 10);
  assert.equal(deepSwe.entries.filter((entry) => entry.kind === "directory").length, 3);
  assert.equal(deepSwe.entries.find((entry) => entry.path === "instruction.md")?.sizeBytes, 2624);
  assert.equal(financial.treeSha, "7131e4375048a0e408a8fb404b5f499d726b695b");
  assert.equal(financial.entries.filter((entry) => entry.kind === "file").length, 26);
  assert.equal(financial.entries.filter((entry) => entry.kind === "directory").length, 4);
  assert.equal(financial.entries.filter((entry) => entry.role === "input-artifact").length, 18);
  assert.equal(wal.entries.filter((entry) => entry.kind === "file").length, 10);
  assert.equal(wal.entries.filter((entry) => entry.kind === "directory").length, 3);

  for (const filesystem of Object.values(modelBenchmarkTaskFilesystems)) {
    assert.match(filesystem.verifiedAt, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(new Set(filesystem.entries.map((entry) => entry.path)).size, filesystem.entries.length);
    assert.ok(filesystem.entries.every((entry) => !entry.path.startsWith("/") && !entry.path.includes("..")));
    assert.ok(filesystem.entries.every((entry) => upstreamFilesystemEntryUrl(filesystem, entry).startsWith(`https://github.com/${filesystem.repository}/`)));
    assert.ok(filesystem.entries.every((entry) => upstreamFilesystemEntryContentUrl(filesystem, entry).startsWith(`https://raw.githubusercontent.com/${filesystem.repository}/${filesystem.treeSha}/`)));
    assert.ok(filesystem.entries.every((entry) => Object.keys(entry).sort().join(",") === "kind,path,role,sizeBytes"));
  }
});

test("maps every non-Harbor sample in its publisher-native record shape without embedding payloads", async () => {
  const { modelBenchmarkSamples } = await modelBenchmarkSamplesModule();
  const { modelBenchmarkTaskFilesystems } = await modelBenchmarkFilesystemsModule();
  const { modelBenchmarkNativeTaskRecords } = await modelBenchmarkNativeRecordsModule();
  const allSampleIds = Object.values(modelBenchmarkSamples).flat().map((sample) => sample.id);
  const expectedNativeIds = allSampleIds.filter((id) => !modelBenchmarkTaskFilesystems[id]);

  assert.deepEqual(Object.keys(modelBenchmarkNativeTaskRecords).sort(), expectedNativeIds.toSorted());
  assert.equal(Object.values(modelBenchmarkNativeTaskRecords).filter((record) => record.availability === "format-only").length, 4);

  for (const record of Object.values(modelBenchmarkNativeTaskRecords)) {
    assert.ok(record.fields.length >= 5);
    assert.ok(record.stages.length >= 3);
    assert.deepEqual(Object.keys(record).sort(), [
      "availability", "domain", "fields", "gradingContract", "outputContract", "publisherFormat", "sourceObject", "split", "stages",
    ].sort());
    for (const field of record.fields) {
      assert.deepEqual(Object.keys(field).sort(), ["name", "payload", "role", "summary"].sort());
      assert.ok(["cataloged-metadata", "publisher-only"].includes(field.payload));
      assert.ok(field.summary.en.length > 0 && field.summary.zh.length > 0);
    }
    for (const stage of record.stages) {
      assert.deepEqual(Object.keys(stage).sort(), ["label", "summary"].sort());
      assert.ok(stage.label.en.length > 0 && stage.label.zh.length > 0);
    }
  }
});

test("maps every non-Harbor task to an agent-input view", async () => {
  const { modelBenchmarkAgentViews } = await modelBenchmarkAgentViewsModule();
  const { modelBenchmarkNativeTaskRecords } = await modelBenchmarkNativeRecordsModule();

  assert.deepEqual(Object.keys(modelBenchmarkAgentViews).sort(), Object.keys(modelBenchmarkNativeTaskRecords).sort());
  assert.equal(Object.keys(modelBenchmarkAgentViews).length, 41);

  const tauViews = Object.entries(modelBenchmarkAgentViews).filter(([, view]) => view.kind === "tau-runtime");
  assert.deepEqual(tauViews.map(([sampleId]) => sampleId).sort(), ["tau-banking-card-selection", "tau-banking-credit-limit"]);

  for (const [, view] of tauViews) {
    assert.equal(view.repository, "sierra-research/tau2-bench");
    assert.equal(view.revision, "a2c024725189473d2d7cea3a5cfdbcc67478e41f");
    assert.equal(view.verifiedAt, "2026-08-31");
    assert.equal(view.promptSources.components.length, 3);
    assert.ok(view.toolGroups.length >= 2);
    assert.ok(view.runtimeInputs.length >= 3);
    assert.ok(view.hiddenInputs.length >= 3);

    const sources = [
      view.promptSources.agentRuntime,
      view.promptSources.policyTemplate,
      view.promptSources.retrievalRuntime,
      ...view.promptSources.components,
      view.taskDefinition,
    ];
    for (const source of sources) {
      assert.ok(source.rawUrl.startsWith(`https://raw.githubusercontent.com/${view.repository}/${view.revision}/`));
      assert.ok(source.sourceUrl.startsWith(`https://github.com/${view.repository}/blob/${view.revision}/`));
      assert.ok(source.path.length > 0 && source.label.length > 0);
    }
  }

  for (const [sampleId, view] of Object.entries(modelBenchmarkAgentViews)) {
    if (sampleId.startsWith("tau-banking-")) continue;
    assert.equal(view.kind, "publisher-contract");
    const record = modelBenchmarkNativeTaskRecords[sampleId];
    assert.equal(view.materials.length === 0, record.availability === "format-only");
    for (const material of view.materials) {
      assert.deepEqual(Object.keys(material).sort(), ["detail", "label", "origin", "path", "rawUrl", "sizeBytes", "sourceUrl"].filter((key) => Object.hasOwn(material, key)).sort());
      assert.ok(material.path.length > 0);
      assert.ok(material.sourceUrl.startsWith("https://"));
      assert.ok(material.detail.en.length > 0 && material.detail.zh.length > 0);
      if (material.rawUrl) assert.ok(material.rawUrl.startsWith("https://"));
    }
  }

  const concreteViews = Object.values(modelBenchmarkAgentViews).filter((view) => view.kind === "publisher-contract" && view.materials.length > 0);
  const concreteMaterials = concreteViews.flatMap((view) => view.materials);
  assert.equal(concreteViews.length, 35);
  assert.equal(concreteMaterials.length, 52);
  assert.deepEqual([...new Set(concreteMaterials.map((material) => material.origin))].sort(), [
    "environment", "open-web", "publisher-file", "publisher-record", "repository", "runtime-generated", "tool-access",
  ]);

  assert.match(modelBenchmarkAgentViews["tau-banking-card-selection"].taskDefinition.path, /task_001\.json$/);
  assert.match(modelBenchmarkAgentViews["tau-banking-credit-limit"].taskDefinition.path, /task_050\.json$/);
  const exploitGymMaterials = modelBenchmarkAgentViews["exploitgym-kernel-cve-2023-6111"].materials;
  assert.deepEqual(exploitGymMaterials.map((material) => material.path), ["README.md", "vulnerability.md", "run_vm.sh"]);
  assert.ok(exploitGymMaterials.every((material) => material.rawUrl.includes("e4123d043774623b2274e6bbe0155a423d631f0a")));
  assert.deepEqual(modelBenchmarkAgentViews["scicode-lennard-jones"].materials.map((material) => material.path), [
    "problem_id 51 / problem_background_main",
    "problem_id 51 / problem_io + required_dependencies",
  ]);
  assert.equal(modelBenchmarkAgentViews["browsecomp-publisher-example-1"].materials[0].origin, "open-web");
  assert.equal(modelBenchmarkAgentViews["osworld-fill-down-calc"].materials[0].origin, "environment");
  assert.equal(modelBenchmarkAgentViews["mcp-atlas-assaultcube-dates"].materials[0].origin, "tool-access");
  assert.equal(modelBenchmarkAgentViews["swe-bench-pro-nodebb-email-validation"].materials[1].origin, "repository");
  assert.match(modelBenchmarkAgentViews["nl2repo-aiofiles"].materials[0].rawUrl, /NL2RepoBench\/781a1da1ee41fb8edb0bed22f586d69111610edf\/test_files\/aiofiles\/start\.md$/);
  assert.match(modelBenchmarkAgentViews["mmmu-pro-clinical-emergency"].materials[0].rawUrl, /test_Clinical_Medicine_69_1\.png$/);
  assert.match(modelBenchmarkAgentViews["omnidocbench-newspaper-page"].materials[0].rawUrl, /newspaper_5e266dfd9c498cab274e12a7b4a75755_4\.jpg$/);
});

test("keeps agent-visible inputs separate from top-level evaluation", async () => {
  const source = await readFile(new URL("../app/model-benchmark-task-detail.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(source, /evaluationTab: "Evaluation"/);
  assert.match(source, /evaluationTab: "评测"/);
  assert.match(source, /id: "evaluation"/);
  assert.match(source, /<TaskEvaluation /);
  assert.match(source, /<TauEvaluationDetail /);
  assert.match(source, /<PublisherEvaluationDetail /);
  assert.match(source, /<HarborEvaluationArtifacts /);
  assert.match(source, /useState<TaskDetailTab>\("overview"\)/);
  assert.match(source, /\{ id: "overview", label: t\.overviewTab \}[\s\S]*id: "agent" as const/);
  assert.match(source, /taskFormat: "Task type"/);
  assert.match(source, /taskFormat: "任务类型"/);
  assert.doesNotMatch(source, /Input envelope|Hidden evaluation|executionTab|inputTab|hiddenTab/);
  assert.doesNotMatch(source, /publisher-agent-boundary|instructionFields/);
  assert.doesNotMatch(source, /Agent input contract|智能体输入约定|Publisher format|发布方格式/);
  assert.doesNotMatch(source, /responseInterface|agent-output-contract|agent-contract-columns/);
  assert.doesNotMatch(source, /model-task-head-meta|Evaluation belongs to the task record|评测属于任务记录/);
  assert.doesNotMatch(source, /agent-input-intro/);
  assert.doesNotMatch(styles, /model-task-head-meta|agent-input-intro|agent-input-section-tabs|publisher-agent-execution-panel|agent-input-runtime-panel|agent-output-contract|agent-contract-columns/);
  assert.doesNotMatch(styles, /publisher-agent-boundary/);
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
  assert.match(source, /benchmarks: "By Domain"/);
  assert.match(source, /byVendor: "By Vendor"/);
  assert.match(source, /modelBenchmarks: "Benchmark Catalog"/);
  assert.match(source, /benchmarks: "按领域"/);
  assert.match(source, /byVendor: "按供应商"/);
  assert.match(source, /modelBenchmarks: "Benchmark Catalog"/);
  assert.doesNotMatch(source, /Model benchmarks|模型基准/);
  assert.doesNotMatch(source, /Benchmark directions are grouped for navigation only/);
  assert.doesNotMatch(source, /基准分组仅用于浏览/);
  assert.match(source, /useState<PortalView>\(initialView\)/);
  assert.match(source, /initialView="model-benchmarks"/);
  assert.match(source, /href="\/model-benchmarks"/);
  assert.match(source, /BenchmarkOverview/);
  assert.match(source, /BenchmarkDetail/);
  assert.match(source, /<VendorHarborTasks categories=\{landscape\?\.categories \?\? \[\]\} downloadHref=[\s\S]*vendor=\{selectedVendor\} \/>[\s\S]*className="submission-history"/);
  assert.match(source, /category\.groups\.flatMap\(\(group\) => group\.records\)/);
  assert.match(source, /className="vendor-harbor-toolbar">[\s\S]*\{taskCount\} \{t\.harbor\}[\s\S]*\{t\.downloadAllHarbor\}/);
  assert.match(source, /className="vendor-harbor-category-header">[\s\S]*group\.category\.label\[language\]/);
  assert.match(source, /group\.records\.map\(\(\{ task \}\) => <TaskRow key=\{task\.id\} language=\{language\} task=\{task\} \/>/);
  assert.doesNotMatch(source, /vendorHarborNote|noHarborTasks/);
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
  assert.doesNotMatch(source, /value=\{catalog \? vendors\.length : undefined\}/);
  assert.match(source, /<Stat label=\{t\.vendors\} value=\{landscape\?\.vendorCount\} \/>/);
  assert.doesNotMatch(source, /<Stat label=\{t\.benchmarkCategories\}/);
  assert.doesNotMatch(source, /catalog\?\.totals\.submissions/);
  assert.doesNotMatch(source, /selectedBenchmark \? 1 : landscape\?\.benchmarkCount/);
  assert.doesNotMatch(source, /selectedBenchmark\.submissionCount/);
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

test("downloads every Harbor task from the distribution gateway across vendor submissions", async () => {
  const app = await worker();
  const { tarBytes } = await datasetArchiveModule();
  const submissions = [
    { id: "submission-new", date: "2026-08-20", label: "New sample", source: "Captured delivery", formats: ["harbor", "non_harbor"], sourceEvents: [], tasks: [
      task("task-terminal", "terminal-task", "task", "harbor", "artifact:terminal"),
      task("task-native", "native-task", "task", "non_harbor", "artifact:native"),
    ] },
    { id: "submission-old", date: "2026-08-10", label: "Old sample", source: "Captured delivery", formats: ["harbor"], sourceEvents: [], tasks: [
      task("task-coding", "coding-task", "task", "harbor", "artifact:coding"),
    ] },
  ];
  submissions[1].tasks[0].benchmark = { id: "deep-swe", displayName: "DeepSWE" };
  submissions[1].tasks[0].artifactId = null;
  const catalog = {
    generatedAt: "2026-08-21T00:00:00.000Z",
    vendors: [{ id: "vendor-1", name: "Vendor One", short: "V1", submissions }],
    totals: { vendors: 1, submissions: 2, tasks: 3, harborTasks: 2 },
  };
  const gatewayBytes = tarBytes([
    { path: "vendor-1/submission-new/terminal-task/instruction.md", bytes: new TextEncoder().encode("terminal instructions") },
    { path: "vendor-1/submission-new/terminal-task/task.toml", bytes: new TextEncoder().encode("terminal metadata") },
    { path: "vendor-1/submission-old/coding-task/instruction.md", bytes: new TextEncoder().encode("coding instructions") },
    { path: "vendor-1/submission-old/coding-task/task.toml", bytes: new TextEncoder().encode("coding metadata") },
  ]);
  const gatewayRequests = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const target = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(target);
    if (url.href === "https://case.example/v1/catalog") return Response.json(catalog);
    if (url.href === "https://gateway.example/archives") {
      gatewayRequests.push({
        method: init.method,
        authorization: new Headers(init.headers).get("authorization"),
        body: JSON.parse(init.body),
      });
      return new Response(gatewayBytes, { headers: { "content-type": "application/x-tar" } });
    }
    throw new Error(`Unexpected fetch: ${url.href}`);
  };

  try {
    const response = await app.fetch(
      new Request("http://localhost/api/vendors/vendor-1/harbor-download", { headers: { cookie: sessionCookie() } }),
      { ...authEnv, CASE_REGISTRY_URL: "https://case.example", CASE_REGISTRY_CATALOG_TOKEN: "catalog-test", HARBOR_TASK_GATEWAY_URL: "https://gateway.example", HARBOR_TASK_GATEWAY_TOKEN: "gateway-test", ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
      { waitUntil() {}, passThroughOnException() {} },
    );
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("x-case-task-count"), "2");
    assert.match(response.headers.get("content-disposition"), /Vendor-One-harbor-tasks\.tar/);
    const entries = tarEntries(new Uint8Array(await response.arrayBuffer()));
    assert.deepEqual([...entries.keys()], [
      "manifest.json",
      "vendor-1/submission-new/terminal-task/instruction.md",
      "vendor-1/submission-new/terminal-task/task.toml",
      "vendor-1/submission-old/coding-task/instruction.md",
      "vendor-1/submission-old/coding-task/task.toml",
    ]);
    const manifest = JSON.parse(new TextDecoder().decode(entries.get("manifest.json")));
    assert.equal(manifest.schemaVersion, "case.vendor-harbor-task-files.v1");
    assert.deepEqual(manifest.vendor, { id: "vendor-1", name: "Vendor One" });
    assert.deepEqual(manifest.selection, { kind: "all_active_vendor_harbor_tasks", source: "harbor-task-gateway", included: 2 });
    assert.deepEqual(manifest.tasks.map((entry) => entry.submission.id), ["submission-new", "submission-old"]);
    assert.deepEqual(manifest.tasks.map((entry) => entry.benchmark.id), ["terminal-bench", "deep-swe"]);
    assert.deepEqual(manifest.tasks.map((entry) => entry.bucketPrefix), ["vendor-1/submission-new/terminal-task", "vendor-1/submission-old/coding-task"]);
    assert.ok(manifest.tasks.every((entry) => entry.kind === "task" && entry.format === "harbor"));
    assert.deepEqual(gatewayRequests, [{
      method: "POST",
      authorization: "Bearer gateway-test",
      body: { roots: ["vendor-1/submission-new/terminal-task", "vendor-1/submission-old/coding-task"] },
    }]);
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
