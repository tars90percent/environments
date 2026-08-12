"use client";

import { useEffect, useMemo, useState } from "react";

type Result = "pass" | "fail" | "missing" | "not-run";
type PackageFormat = "harbor" | "mapped" | "source";
type Tab = "tasks" | "checks" | "files" | "criteria";

type Check = {
  name: string;
  result: Result;
  observation: string;
  evidence: string;
};

type Task = {
  id: string;
  title: string;
  format: PackageFormat;
  build: Result;
  untouched: string;
  gold: string;
  goldResult: Result;
  m3Runs: number;
  referenceRuns: number;
  targetDeclared: boolean;
  verifiedAt: string;
  digest: string;
  checks: Check[];
  files: { path: string; state: Result }[];
};

type TaskSeed = Pick<Task, "id" | "title" | "format" | "verifiedAt" | "digest"> & {
  goldResult?: Result;
  m3Runs?: number;
  referenceRuns?: number;
  targetDeclared?: boolean;
};

const taskSeeds: TaskSeed[] = [
  { id: "kf-01", title: "Shared-memory fusion", format: "harbor", verifiedAt: "Aug 10, 16:42", digest: "sha256:5c81…aa19" },
  { id: "kf-02", title: "Sparse attention kernel", format: "harbor", verifiedAt: "Aug 10, 16:39", digest: "sha256:92e4…d72b" },
  { id: "kf-03", title: "Flash decode path", format: "harbor", verifiedAt: "Aug 10, 16:36", digest: "sha256:61d0…f430" },
  { id: "kf-04", title: "Paged KV allocation", format: "mapped", verifiedAt: "Aug 10, 16:30", digest: "sha256:a40f…11c2" },
  { id: "kf-05", title: "Warp-specialized GEMM", format: "harbor", verifiedAt: "Aug 10, 16:22", digest: "sha256:d93e…4c07" },
  { id: "kf-06", title: "Build graph repair", format: "harbor", targetDeclared: false, verifiedAt: "Aug 10, 16:18", digest: "sha256:b1bd…874f" },
  { id: "kf-07", title: "Fused reduction timeout", format: "harbor", goldResult: "fail", verifiedAt: "Aug 10, 16:14", digest: "sha256:4e80…ce31" },
  { id: "kf-08", title: "ABI mismatch recovery", format: "harbor", verifiedAt: "Aug 10, 16:09", digest: "sha256:8bd7…9a62" },
  { id: "kf-09", title: "Multi-GPU launch config", format: "harbor", verifiedAt: "Aug 10, 16:05", digest: "sha256:091f…72dd" },
  { id: "kf-10", title: "Reference parity check", format: "mapped", verifiedAt: "Aug 10, 15:58", digest: "sha256:e214…090c" },
  { id: "kf-11", title: "Race-condition trace", format: "harbor", verifiedAt: "Aug 10, 15:51", digest: "sha256:09be…fa20" },
  { id: "kf-12", title: "Numerical drift isolation", format: "harbor", verifiedAt: "Aug 10, 15:47", digest: "sha256:3182…42ae" },
  { id: "kf-13", title: "Scheduler state migration", format: "harbor", m3Runs: 2, verifiedAt: "Aug 10, 15:39", digest: "sha256:7cb0…a113" },
  { id: "kf-14", title: "Duplicate fusion variant", format: "source", targetDeclared: false, verifiedAt: "Aug 10, 15:31", digest: "sha256:aa74…6ef1" },
];

function buildTask(seed: TaskSeed): Task {
  const goldResult = seed.goldResult ?? "pass";
  const m3Runs = seed.m3Runs ?? 4;
  const referenceRuns = seed.referenceRuns ?? 4;
  const targetDeclared = seed.targetDeclared ?? true;
  const formatCheck: Check = seed.format === "harbor"
    ? { name: "Harbor package", result: "pass", observation: "task.toml validates", evidence: "harbor validate · exit 0" }
    : seed.format === "mapped"
      ? { name: "Format mapping", result: "pass", observation: "Source package mapped to Harbor fields", evidence: "harbor-map.yaml" }
      : { name: "Format mapping", result: "missing", observation: "Source package retained; no Harbor mapping yet", evidence: "No mapping artifact" };

  const checks: Check[] = [
    formatCheck,
    { name: "Required files", result: "pass", observation: "Instruction, environment, gold solution, and tests found", evidence: "package inventory" },
    { name: "Clean container build", result: "pass", observation: "Built from a clean cache", evidence: `${seed.digest} · exit 0` },
    { name: "Public rebuild inputs", result: "pass", observation: "No private image or registry reference detected", evidence: "Dockerfile dependency scan" },
    { name: "Solution in container", result: "pass", observation: "Gold solution script completed inside the task image", evidence: "solution/solve.sh · exit 0" },
    { name: "Tests in container", result: "pass", observation: "Test script completed without host data or variables", evidence: "tests/test.sh · exit 0" },
    { name: "Untouched baseline", result: "pass", observation: "Five clean runs returned 0", evidence: "0 · 0 · 0 · 0 · 0" },
    {
      name: "Gold baseline",
      result: goldResult,
      observation: goldResult === "pass" ? "Five clean runs returned 1" : "Two of five clean runs did not return 1",
      evidence: goldResult === "pass" ? "1 · 1 · 1 · 1 · 1" : "1 · 0 · 1 · 1 · 0",
    },
    {
      name: "M3 trajectories",
      result: m3Runs >= 4 ? "pass" : "missing",
      observation: `${m3Runs} complete trajectories attached`,
      evidence: "m3-2026-08-04 · claude-code@2.1.8",
    },
    {
      name: "Reference trajectories",
      result: referenceRuns >= 4 ? "pass" : "missing",
      observation: `${referenceRuns} complete trajectories attached`,
      evidence: "gpt-5.6-sol-medium · codex@0.42.0",
    },
    {
      name: "Evaluation targets",
      result: targetDeclared ? "pass" : "missing",
      observation: targetDeclared ? "Pass-rate and turn-count targets declared before runs" : "No dated target declaration attached",
      evidence: targetDeclared ? "evaluation-plan.yaml" : "No evidence file",
    },
  ];

  const manifest = seed.format === "harbor" ? "task.toml" : "source-manifest.json";
  const files = [
    { path: manifest, state: "pass" as Result },
    ...(seed.format === "mapped" ? [{ path: "harbor-map.yaml", state: "pass" as Result }] : []),
    { path: "instruction.md", state: "pass" as Result },
    { path: "environment/Dockerfile", state: "pass" as Result },
    { path: "solution/solve.sh", state: "pass" as Result },
    { path: "tests/test.sh", state: "pass" as Result },
    { path: "evaluation-plan.yaml", state: targetDeclared ? "pass" as Result : "missing" as Result },
    { path: "runs/manifest.jsonl", state: m3Runs >= 4 && referenceRuns >= 4 ? "pass" as Result : "missing" as Result },
  ];

  return {
    ...seed,
    build: "pass",
    untouched: "5/5 → 0",
    gold: goldResult === "pass" ? "5/5 → 1" : "3/5 → 1",
    goldResult,
    m3Runs,
    referenceRuns,
    targetDeclared,
    checks,
    files,
  };
}

const tasks = taskSeeds.map(buildTask);

const criteria = [
  ["Comparable trajectories", "At least four complete trajectories per task from M3 and four from the declared frontier reference system. Record exact model, harness, version, reward, and turn count."],
  ["Reward baselines", "Repeated gold runs return 1. Repeated untouched runs return 0."],
  ["Public rebuild", "The delivered Dockerfile rebuilds without a private base image or inaccessible dependency."],
  ["Gold solution", "A gold solution is included in the delivered task package."],
  ["Container-local execution", "Solution and test scripts run inside the container without private host data or undeclared environment variables."],
  ["Declared evaluation settings", "Pass-rate and turn-count targets are recorded before delivery and evaluation."],
  ["Portable format", "Harbor is preferred and must run directly with its CLI. Pre-Harbor packages remain visible when their source structure and any mapping are documented."],
];

const formatLabels: Record<PackageFormat, string> = {
  harbor: "Harbor",
  mapped: "Mapped",
  source: "Source",
};

function ResultBadge({ result, children }: { result: Result; children?: React.ReactNode }) {
  return <span className={`result result-${result}`}><i aria-hidden="true" />{children ?? result.replace("-", " ")}</span>;
}

function FormatBadge({ format }: { format: PackageFormat }) {
  return <span className={`format format-${format}`}>{formatLabels[format]}</span>;
}

export default function Home() {
  const [tab, setTab] = useState<Tab>("tasks");
  const [query, setQuery] = useState("");
  const [format, setFormat] = useState<"all" | PackageFormat>("all");
  const [exceptionsOnly, setExceptionsOnly] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setSelectedTask(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const filteredTasks = useMemo(() => tasks.filter((task) => {
    const matchesQuery = `${task.id} ${task.title}`.toLowerCase().includes(query.toLowerCase());
    const matchesFormat = format === "all" || task.format === format;
    const hasException = task.checks.some((check) => check.result !== "pass");
    return matchesQuery && matchesFormat && (!exceptionsOnly || hasException);
  }), [query, format, exceptionsOnly]);

  const totals = useMemo(() => ({
    harbor: tasks.filter((task) => task.format === "harbor").length,
    builds: tasks.filter((task) => task.build === "pass").length,
    gold: tasks.filter((task) => task.goldResult === "pass").length,
    rollouts: tasks.reduce((sum, task) => sum + task.m3Runs + task.referenceRuns, 0),
  }), []);

  return (
    <div className="app-shell">
      <div className="demo-notice">Prototype registry · synthetic records · no external systems connected</div>

      <header className="global-header">
        <a className="wordmark" href="#top" onClick={() => setTab("tasks")}>
          <span>E</span><strong>TARS Environments</strong>
        </a>
        <label className="global-search">
          <span aria-hidden="true">⌕</span>
          <input aria-label="Search tasks" onChange={(event) => setQuery(event.target.value)} placeholder="Search tasks" value={query} />
        </label>
        <nav aria-label="Global navigation">
          <button onClick={() => setTab("criteria")} type="button">Criteria</button>
          <span className="avatar" aria-label="TARS">T</span>
        </nav>
      </header>

      <main id="top">
        <section className="repo-header">
          <div className="breadcrumbs"><a href="#top">environments</a><span>/</span><strong>atlas-kernel-pack</strong></div>
          <div className="repo-title-row">
            <div>
              <h1>atlas-kernel-pack <span>snapshot</span></h1>
              <p>Deterministic package and execution evidence for a synthetic kernel-task cohort.</p>
            </div>
            <div className="snapshot-meta"><span>Revision</span><code>8d5c1a7</code><span>Verified</span><strong>Aug 10, 2026</strong></div>
          </div>
          <div className="scope-note"><strong>Scope:</strong> this registry records what was delivered and what checks ran. It does not rate task quality or recommend a research decision.</div>
          <nav className="repo-tabs" aria-label="Repository sections">
            {(["tasks", "checks", "files", "criteria"] as Tab[]).map((item) => (
              <button className={tab === item ? "active" : ""} key={item} onClick={() => setTab(item)} type="button">
                {item[0].toUpperCase() + item.slice(1)}
                {item === "tasks" && <span>{tasks.length}</span>}
              </button>
            ))}
          </nav>
        </section>

        <div className="page-body">
          {tab === "tasks" && (
            <section aria-labelledby="tasks-heading">
              <div className="summary-grid">
                <Summary label="Tasks" value={String(tasks.length)} detail={`${totals.harbor} Harbor-native`} />
                <Summary label="Clean builds" value={`${totals.builds}/${tasks.length}`} detail="from empty cache" />
                <Summary label="Gold baseline" value={`${totals.gold}/${tasks.length}`} detail="all repeated runs = 1" />
                <Summary label="Attached rollouts" value={String(totals.rollouts)} detail="M3 + reference" />
              </div>

              <div className="section-heading">
                <div><h2 id="tasks-heading">Tasks</h2><p>Select a row to inspect files, checks, and run metadata.</p></div>
                <span>{filteredTasks.length} shown</span>
              </div>

              <div className="filters-bar">
                <label><span>Format</span><select onChange={(event) => setFormat(event.target.value as "all" | PackageFormat)} value={format}><option value="all">All formats</option><option value="harbor">Harbor</option><option value="mapped">Mapped</option><option value="source">Source</option></select></label>
                <button aria-pressed={exceptionsOnly} className={exceptionsOnly ? "active" : ""} onClick={() => setExceptionsOnly((value) => !value)} type="button">Checks with exceptions</button>
                {(query || format !== "all" || exceptionsOnly) && <button className="clear-filter" onClick={() => { setQuery(""); setFormat("all"); setExceptionsOnly(false); }} type="button">Clear filters</button>}
              </div>

              <div className="table-card">
                <div className="task-table task-table-head" role="row">
                  <span>Task</span><span>Format</span><span>Build</span><span>Untouched</span><span>Gold</span><span>Trajectories</span><span>Verified</span><span />
                </div>
                {filteredTasks.map((task) => (
                  <button className="task-table task-row" key={task.id} onClick={() => setSelectedTask(task)} type="button">
                    <span className="task-name"><strong>{task.id}</strong><small>{task.title}</small></span>
                    <span><FormatBadge format={task.format} /></span>
                    <span><ResultBadge result={task.build}>Pass</ResultBadge></span>
                    <code>{task.untouched}</code>
                    <span><ResultBadge result={task.goldResult}>{task.gold}</ResultBadge></span>
                    <span className={task.m3Runs < 4 || task.referenceRuns < 4 ? "cell-exception" : ""}>{task.m3Runs} M3 · {task.referenceRuns} ref</span>
                    <span className="verified-date">{task.verifiedAt}</span>
                    <span className="row-arrow">›</span>
                  </button>
                ))}
                {filteredTasks.length === 0 && <div className="empty-state"><strong>No matching tasks</strong><span>Change the search or format filter.</span></div>}
              </div>
            </section>
          )}

          {tab === "checks" && <ChecksView />}
          {tab === "files" && <FilesView onOpenTask={() => setSelectedTask(tasks[0])} />}
          {tab === "criteria" && <CriteriaView />}
        </div>
      </main>

      {selectedTask && <TaskPanel task={selectedTask} onClose={() => setSelectedTask(null)} />}
    </div>
  );
}

function Summary({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="summary-item"><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>;
}

function ChecksView() {
  const rows = [
    ["Required package files", "14 / 14", "Package inventory", "instruction, environment, solution, tests"],
    ["Clean container build", "14 / 14", "Build logs", "empty cache; pinned source revision"],
    ["Public rebuild inputs", "14 / 14", "Dependency scan", "no private image or registry reference"],
    ["Solution runs in container", "14 / 14", "Execution logs", "solution script exits successfully"],
    ["Tests run in container", "14 / 14", "Execution logs", "no host-only data or variables detected"],
    ["Untouched repeatedly returns 0", "14 / 14", "70 clean runs", "five runs per task"],
    ["Gold repeatedly returns 1", "13 / 14", "70 clean runs", "kf-07 returned 1 in three of five runs"],
    ["M3 trajectories attached", "13 / 14", "54 trajectories", "minimum four per task; kf-13 has two"],
    ["Reference trajectories attached", "14 / 14", "56 trajectories", "minimum four per task"],
    ["Evaluation targets declared", "12 / 14", "Plan manifests", "kf-06 and kf-14 have no dated plan"],
    ["Harbor package or mapping", "13 / 14", "Format validation", "kf-14 remains in source format"],
  ];
  return <section aria-labelledby="checks-title">
    <div className="content-title"><div><p className="eyebrow">COHORT SNAPSHOT</p><h2 id="checks-title">Deterministic checks</h2><p>Counts summarize recorded executions. They are not a quality score.</p></div><code>checks-2026-08-10.json</code></div>
    <div className="checks-card">
      <div className="checks-row checks-head"><span>Check</span><span>Observed</span><span>Evidence</span><span>Method</span></div>
      {rows.map(([name, observed, evidence, method]) => <div className="checks-row" key={name}><strong>{name}</strong><span className={observed.startsWith("14 / 14") ? "observed-complete" : "observed-exception"}>{observed}</span><code>{evidence}</code><span>{method}</span></div>)}
    </div>
  </section>;
}

function FilesView({ onOpenTask }: { onOpenTask: () => void }) {
  const files = [
    ["README.md", "4.2 KB", "Cohort scope and reproduction notes"],
    ["dataset.yaml", "1.8 KB", "Task index and source revisions"],
    ["evaluation-plan.yaml", "2.1 KB", "Declared models, harnesses, pass-rate and turn targets"],
    ["checks-2026-08-10.json", "18.4 KB", "Machine-readable deterministic check results"],
    ["runs/manifest.jsonl", "61.7 KB", "Per-run model, harness, reward, turns, and artifact paths"],
    ["tasks/", "14 tasks", "Harbor packages and documented source-format packages"],
  ];
  return <section aria-labelledby="files-title">
    <div className="content-title"><div><p className="eyebrow">REVISION 8D5C1A7</p><h2 id="files-title">Files</h2><p>A compact inventory of the evidence snapshot.</p></div><span className="branch-pill">main</span></div>
    <div className="file-card">
      <div className="file-card-head"><span>atlas-kernel-pack</span><code>8d5c1a7</code></div>
      {files.map(([name, size, description]) => <button key={name} onClick={name === "tasks/" ? onOpenTask : undefined} type="button"><span className="file-icon">{name.endsWith("/") ? "▣" : "□"}</span><strong>{name}</strong><span>{description}</span><small>{size}</small></button>)}
    </div>
    <article className="readme-card"><div className="readme-head"><span>README.md</span></div><div className="readme-body"><h2>Atlas kernel environment snapshot</h2><p>This snapshot exists to make the delivered packages and their execution records inspectable. It records format, files, clean builds, baseline rewards, trajectories, and declared evaluation settings.</p><h3>Non-goals</h3><p>It does not classify learning signal, rank tasks, estimate usefulness, or recommend purchase. Those judgments belong to the receiving researcher.</p></div></article>
  </section>;
}

function CriteriaView() {
  return <section aria-labelledby="criteria-title">
    <div className="content-title"><div><p className="eyebrow">CURRENT INTAKE CONTRACT</p><h2 id="criteria-title">Documented criteria</h2><p>Only the conditions currently specified for environment and task intake are listed here.</p></div><span className="criteria-count">7 criteria</span></div>
    <div className="criteria-layout">
      <ol className="criteria-list">
        {criteria.map(([title, text], index) => <li key={title}><span>{String(index + 1).padStart(2, "0")}</span><div><h3>{title}</h3><p>{text}</p></div></li>)}
      </ol>
      <aside className="criteria-aside"><strong>Interpretation boundary</strong><p>A passing record means the check produced the stated result. It does not mean a task is difficult, useful, novel, correctly scoped for a research program, or worth purchasing.</p><p>Research judgment is deliberately not encoded in this portal.</p></aside>
    </div>
  </section>;
}

function TaskPanel({ task, onClose }: { task: Task; onClose: () => void }) {
  return <div className="panel-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()} role="presentation">
    <aside aria-label={`${task.id} evidence`} className="task-panel">
      <header>
        <div><span className="panel-path">tasks / {task.id}</span><h2>{task.title}</h2><div><FormatBadge format={task.format} /><code>{task.digest}</code></div></div>
        <button aria-label="Close task details" onClick={onClose} type="button">×</button>
      </header>

      <section className="panel-section"><div className="panel-section-head"><h3>Files</h3><span>{task.files.filter((file) => file.state === "pass").length} present</span></div><div className="mini-files">{task.files.map((file) => <div key={file.path}><span>□</span><code>{file.path}</code><ResultBadge result={file.state}>{file.state === "pass" ? "Present" : "Missing"}</ResultBadge></div>)}</div></section>

      <section className="panel-section"><div className="panel-section-head"><h3>Checks</h3><span>verified {task.verifiedAt}</span></div><div className="task-checks">{task.checks.map((check) => <div key={check.name}><ResultBadge result={check.result}>{check.result === "pass" ? "Pass" : check.result === "fail" ? "Failed" : "Missing"}</ResultBadge><span><strong>{check.name}</strong><small>{check.observation}</small></span><code>{check.evidence}</code></div>)}</div></section>

      <section className="panel-section"><div className="panel-section-head"><h3>Rollout bundle</h3><span>{task.m3Runs + task.referenceRuns} runs</span></div><div className="run-table"><div><strong>System</strong><strong>Harness</strong><strong>Runs</strong><strong>Record</strong></div><div><span>M3</span><code>claude-code@2.1.8</code><span>{task.m3Runs}</span><code>runs/m3.jsonl</code></div><div><span>Reference</span><code>codex@0.42.0</code><span>{task.referenceRuns}</span><code>runs/reference.jsonl</code></div></div></section>

      <footer><span>No research judgment recorded</span><button onClick={onClose} type="button">Close</button></footer>
    </aside>
  </div>;
}
