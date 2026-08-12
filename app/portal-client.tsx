"use client";

import { useEffect, useMemo, useState } from "react";
import type { CatalogBatch, CatalogSnapshot, CatalogSourceEvent, CatalogSourceItem, CatalogTask, CatalogVendor, SourceFetchStatus, SourceParseStatus, WorkflowStatus } from "./catalog";

type Tab = "vendors" | "checks" | "criteria";

const criteria = [
  ["Comparable trajectories", "At least four complete trajectories per task from M3 and four from the declared frontier reference system, with model and harness metadata."],
  ["Reward baselines", "Repeated gold runs return 1 and repeated untouched runs return 0."],
  ["Public rebuild", "The Dockerfile rebuilds without a private base image or inaccessible dependency."],
  ["Gold solution", "A gold solution or task-appropriate golden deliverable is included."],
  ["Container-local execution", "Solution and test scripts run inside the environment without undeclared host data or variables."],
  ["Declared evaluation settings", "Pass-rate and turn-count targets are recorded before evaluation."],
  ["Portable format", "Harbor is preferred. Other formats remain visible when their source structure and mapping status are documented."],
];

const statusLabels: Record<WorkflowStatus, string> = {
  received: "Received",
  normalizing: "Normalizing",
  checking: "Checking",
  needs_vendor_fix: "Needs vendor fix",
  ready_for_research: "Ready for research",
  superseded: "Superseded",
  quarantined: "Quarantined",
};

const fetchLabels: Record<SourceFetchStatus, string> = {
  not_requested: "Not fetched",
  queued: "Fetch queued",
  fetching: "Fetching",
  snapshotted: "Snapshot saved",
  external_only: "External link",
  blocked: "Fetch blocked",
  failed: "Fetch failed",
};

const parseLabels: Record<SourceParseStatus, string> = {
  not_requested: "Not parsed",
  queued: "Parse queued",
  parsing: "Parsing",
  parsed: "Parsed",
  partial: "Partly parsed",
  blocked: "Parse blocked",
  failed: "Parse failed",
};

function plural(count: number, singular: string, pluralForm = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

export default function PortalClient() {
  const [catalog, setCatalog] = useState<CatalogSnapshot | null>(null);
  const [catalogState, setCatalogState] = useState<"loading" | "ready" | "unavailable">("loading");
  const [unavailableReason, setUnavailableReason] = useState<string>();
  const vendors = useMemo(() => catalog?.vendors ?? [], [catalog]);
  const [tab, setTab] = useState<Tab>("vendors");
  const [selectedVendorId, setSelectedVendorId] = useState("");
  const [query, setQuery] = useState("");
  const [expandedBatches, setExpandedBatches] = useState<Set<string>>(new Set());

  useEffect(() => {
    let active = true;
    void fetch("/api/catalog", { headers: { accept: "application/json" }, cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(response.status === 503 ? "CASE catalog connection is not configured." : `CASE catalog returned ${response.status}.`);
        return await response.json() as CatalogSnapshot;
      })
      .then((snapshot) => {
        if (!active) return;
        setCatalog(snapshot);
        setSelectedVendorId(snapshot.vendors[0]?.id ?? "");
        setExpandedBatches(new Set());
        setCatalogState("ready");
      })
      .catch((error: unknown) => {
        if (!active) return;
        setUnavailableReason(error instanceof Error ? error.message : "CASE catalog is temporarily unavailable.");
        setCatalogState("unavailable");
      });
    return () => { active = false; };
  }, []);

  const matchingVendors = useMemo(() => vendors.filter((vendor) => {
    const haystack = [vendor.name, vendor.description, ...vendor.batches.flatMap((batch) => [batch.label, batch.source, ...batch.categories.flatMap((category) => [category.name, ...category.tasks.map((task) => task.title)])])].join(" ").toLowerCase();
    return haystack.includes(query.toLowerCase());
  }), [query, vendors]);

  const selectedVendor = query
    ? matchingVendors.find((vendor) => vendor.id === selectedVendorId) ?? matchingVendors[0]
    : vendors.find((vendor) => vendor.id === selectedVendorId) ?? vendors[0];

  function selectVendor(vendor: CatalogVendor) {
    setSelectedVendorId(vendor.id);
    setTab("vendors");
    setExpandedBatches(new Set());
  }

  function toggleBatch(batchId: string) {
    setExpandedBatches((current) => {
      const next = new Set(current);
      if (next.has(batchId)) next.delete(batchId); else next.add(batchId);
      return next;
    });
  }

  return <div className="app-shell">
    <div className="demo-notice">Read-only CASE catalog · submission history and recorded checks · research judgment stays with researchers</div>
    <header className="global-header">
      <a className="wordmark" href="#top" onClick={() => setTab("vendors")}><span>小</span><strong>小环境</strong></a>
      <label className="global-search"><span aria-hidden="true">⌕</span><input aria-label="Search vendors, batches, categories, and tasks" onChange={(event) => setQuery(event.target.value)} placeholder="Search vendors, batches, categories, and tasks" value={query} /></label>
      <nav aria-label="Global navigation"><button onClick={() => setTab("criteria")} type="button">Criteria</button><span className="avatar" aria-label="Researcher profile">R</span></nav>
    </header>

    <main id="top">
      <section className="registry-header">
        <div><p className="eyebrow">RL ENVIRONMENT SUBMISSIONS</p><h1>Vendor sample registry</h1><p>Browse what CASE received, how vendors revised it, and which deterministic checks have recorded evidence.</p></div>
        <div className="registry-stats"><span><strong>{catalog?.totals.vendors ?? "—"}</strong> vendors</span><span><strong>{catalog?.totals.batches ?? "—"}</strong> batches</span><span><strong>{catalog?.totals.taskVersions ?? "—"}</strong> task versions</span></div>
        <nav className="repo-tabs" aria-label="Registry sections">
          {(["vendors", "checks", "criteria"] as Tab[]).map((item) => <button className={tab === item ? "active" : ""} key={item} onClick={() => setTab(item)} type="button">{item[0].toUpperCase() + item.slice(1)}{item === "vendors" && <span>{catalogState === "loading" ? "…" : vendors.length}</span>}</button>)}
        </nav>
      </section>

      <div className="page-body">
        {catalogState === "loading" && <Loading />}
        {catalogState === "unavailable" && <Unavailable reason={unavailableReason} />}
        {catalogState === "ready" && tab === "vendors" && selectedVendor && <VendorView matchingVendors={matchingVendors} selectedVendor={selectedVendor} expandedBatches={expandedBatches} onSelect={selectVendor} onToggle={toggleBatch} />}
        {catalogState === "ready" && tab === "vendors" && !selectedVendor && <section className="unavailable"><p className="eyebrow">SEARCH</p><h2>No matching samples</h2><p>Try a vendor, batch, category, or task name.</p></section>}
        {catalogState === "ready" && catalog && tab === "checks" && <ChecksView catalog={catalog} />}
        {tab === "criteria" && <CriteriaView />}
      </div>
    </main>
  </div>;
}

function VendorView({ matchingVendors, selectedVendor, expandedBatches, onSelect, onToggle }: {
  matchingVendors: CatalogVendor[];
  selectedVendor: CatalogVendor;
  expandedBatches: Set<string>;
  onSelect(vendor: CatalogVendor): void;
  onToggle(batchId: string): void;
}) {
  const records = selectedVendor.batches.reduce((sum, batch) => sum + batch.taskCount, 0);
  return <div className="portal-grid">
    <aside className="vendor-sidebar" aria-label="Vendors">
      <div className="sidebar-head"><strong>Vendors</strong><span>{matchingVendors.length}</span></div>
      <div className="vendor-list">
        {matchingVendors.map((vendor) => {
          const count = vendor.batches.reduce((sum, batch) => sum + batch.taskCount, 0);
          return <button className={selectedVendor.id === vendor.id ? "active" : ""} key={vendor.id} onClick={() => onSelect(vendor)} type="button"><span className="vendor-mark">{vendor.short}</span><span><strong>{vendor.name}</strong><small>{plural(vendor.batches.length, "batch", "batches")} · {count} records</small></span></button>;
        })}
        {matchingVendors.length === 0 && <div className="sidebar-empty">No matching vendors</div>}
      </div>
    </aside>

    <section className="vendor-main" aria-labelledby="vendor-name">
      <header className="vendor-profile"><span className="vendor-mark large">{selectedVendor.short}</span><div><div className="vendor-kicker">Vendor</div><h2 id="vendor-name">{selectedVendor.name}</h2><p>{selectedVendor.description}</p><div className="vendor-meta"><span>{plural(selectedVendor.batches.length, "submission batch", "submission batches")}</span><span>{records} task records</span><span>{selectedVendor.batches.at(-1)?.date} — {selectedVendor.batches[0]?.date}</span></div></div></header>
      <section className="submission-history" aria-labelledby="history-title">
        <div className="section-title"><div><h3 id="history-title">Submission history</h3><p>Every received batch remains separate. Deltas describe package changes, never research quality.</p></div><span>Newest first</span></div>
        <div className="batch-list">{selectedVendor.batches.map((batch, index) => <BatchCard batch={batch} isExpanded={expandedBatches.has(batch.id)} isLatest={index === 0} key={batch.id} onToggle={() => onToggle(batch.id)} />)}</div>
      </section>
    </section>
  </div>;
}

function BatchCard({ batch, isExpanded, isLatest, onToggle }: { batch: CatalogBatch; isExpanded: boolean; isLatest: boolean; onToggle(): void }) {
  return <article className="batch-card">
    <button aria-expanded={isExpanded} className="batch-summary" onClick={onToggle} type="button">
      <span className="batch-date"><strong>{batch.date}</strong>{isLatest && <small>Latest submission</small>}</span>
      <span className="batch-name"><strong>{batch.label}</strong><code>{batch.source}</code></span>
      <span className="batch-count"><strong>{batch.taskCount}</strong><small>task records</small></span>
      <span className="format-stack">{batch.formats.map((format) => <i key={format}>{format}</i>)}</span>
      <StatusBadge status={batch.workflowStatus} />
      <span className="disclosure">{isExpanded ? "−" : "+"}</span>
    </button>

    {isExpanded && <div className="batch-body">
      <div className="delta-block"><div className="delta-grid">{batch.delta.retained !== undefined && <span><strong>{batch.delta.retained}</strong><small>retained</small></span>}<span><strong>{batch.delta.added}</strong><small>added</small></span><span><strong>{batch.delta.removed}</strong><small>removed</small></span>{batch.delta.changedFiles !== undefined && <span><strong>{batch.delta.changedFiles}</strong><small>files differ</small></span>}</div><p>{batch.delta.note}</p></div>
      <div className="batch-section-head"><h4>Task categories</h4><span>{plural(batch.categories.length, "category", "categories")}</span></div>
      <div className="category-table">{batch.categories.map((category) => <section key={category.id} className="category-row"><span className="category-count">{category.count}</span><span className="category-copy"><strong>{category.name}</strong><small>{category.description}</small></span><div className="task-list">{category.tasks.length ? category.tasks.map((task) => <TaskRow key={task.id} task={task} />) : <span className="empty-task-list">Task records not yet normalized</span>}</div></section>)}</div>
      <SubmissionSources sourceEvents={batch.sourceEvents ?? []} />
    </div>}
  </article>;
}

function SubmissionSources({ sourceEvents }: { sourceEvents: CatalogSourceEvent[] }) {
  if (!sourceEvents.length) return <><div className="batch-section-head"><h4>Original payload</h4><span>No source snapshot linked yet</span></div><div className="source-empty">This batch predates source-level intake. Its original message, links, and files have not yet been attached.</div></>;
  return <>
    <div className="batch-section-head"><h4>Original payload</h4><span>{plural(sourceEvents.length, "intake event")}</span></div>
    <div className="source-events">{sourceEvents.map((event) => <SourceEvent key={event.id} event={event} />)}</div>
  </>;
}

function SourceEvent({ event }: { event: CatalogSourceEvent }) {
  const originalUrl = safeExternalUrl(event.externalRef);
  return <section className="source-event">
    <header className="source-event-head">
      <span className="source-channel">{event.role ?? event.channel.replace("_", " ")}</span>
      <span><strong>{event.sender ?? "Sender not recorded"}</strong><small>{formatTimestamp(event.receivedAt)}</small></span>
      <span className="source-actions">{originalUrl && <a href={originalUrl} rel="noreferrer" target="_blank">Open original</a>}{event.rawArtifactId && <a href={`/api/artifacts/${encodeURIComponent(event.rawArtifactId)}/download`}>Message snapshot</a>}</span>
    </header>
    <div className="source-items">{event.items.length ? event.items.map((item) => <SourceItem key={item.id} item={item} />) : <div className="source-empty">No linked files or URLs recorded.</div>}</div>
  </section>;
}

function SourceItem({ item }: { item: CatalogSourceItem }) {
  const originalUrl = safeExternalUrl(item.locator);
  const captured = item.capturedAt ? ` · captured ${formatTimestamp(item.capturedAt)}` : "";
  return <div className="source-item">
    <span className="source-kind">{item.kind.replace("_", " ")}</span>
    <span className="source-name"><strong>{item.displayName}</strong><small>{fetchLabels[item.fetchStatus]} · {parseLabels[item.parseStatus]}{item.mutable ? " · mutable source" : ""}{captured}</small></span>
    <span className="source-actions">{originalUrl && <a href={originalUrl} rel="noreferrer" target="_blank">View source</a>}{item.artifactId && <a href={`/api/artifacts/${encodeURIComponent(item.artifactId)}/download`}>Download snapshot</a>}</span>
  </div>;
}

function safeExternalUrl(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

function formatTimestamp(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? value : parsed.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function TaskRow({ task }: { task: CatalogTask }) {
  const checks = task.checks.pass + task.checks.fail + task.checks.blocked + task.checks.notRun;
  return <div className="task-row"><span><strong>{task.title}</strong><small>{task.format}{task.summary ? ` · ${task.summary}` : ""}</small></span><span className="task-checks">{checks ? <>{task.checks.pass} pass · {task.checks.fail} fail · {task.checks.blocked} blocked</> : "No checks recorded"}</span><StatusBadge status={task.workflowStatus} /></div>;
}

function ChecksView({ catalog }: { catalog: CatalogSnapshot }) {
  const rows = catalog.vendors.flatMap((vendor) => vendor.batches.map((batch) => {
    const tasks = batch.categories.flatMap((category) => category.tasks);
    return { vendor: vendor.name, batch, checks: sumChecks(tasks) };
  }));
  return <section aria-labelledby="checks-title"><div className="content-title"><div><p className="eyebrow">RECORDED EVIDENCE</p><h2 id="checks-title">Deterministic check coverage</h2><p>Counts reflect completed CASE records. They are not quality scores or acceptance decisions.</p></div><code>CASE · {new Date(catalog.generatedAt).toLocaleString()}</code></div><div className="checks-card batch-index"><div className="checks-row checks-head"><span>Vendor</span><span>Batch</span><span>Tasks</span><span>Status</span><span>Check results</span></div>{rows.map(({ vendor, batch, checks }) => <div className="checks-row" key={batch.id}><strong>{vendor}</strong><span><b>{batch.date}</b><small>{batch.label}</small></span><span>{batch.taskCount}</span><StatusBadge status={batch.workflowStatus} /><span>{checks.total ? `${checks.pass} pass · ${checks.fail} fail · ${checks.blocked} blocked · ${checks.notRun} not run` : "No check results recorded"}</span></div>)}</div></section>;
}

function sumChecks(tasks: CatalogTask[]) {
  const value = tasks.reduce((sum, task) => ({ pass: sum.pass + task.checks.pass, fail: sum.fail + task.checks.fail, blocked: sum.blocked + task.checks.blocked, notRun: sum.notRun + task.checks.notRun }), { pass: 0, fail: 0, blocked: 0, notRun: 0 });
  return { ...value, total: value.pass + value.fail + value.blocked + value.notRun };
}

function StatusBadge({ status }: { status: WorkflowStatus }) {
  return <span className={`status-badge status-${status}`}>{statusLabels[status]}</span>;
}

function Unavailable({ reason }: { reason?: string }) {
  return <section className="unavailable"><p className="eyebrow">CASE CATALOG</p><h2>Registry unavailable</h2><p>{reason ?? "The shared catalog could not be loaded."} No cached vendor data is shown because 小环境 is not a source of truth.</p></section>;
}

function Loading() {
  return <section className="unavailable"><p className="eyebrow">CASE CATALOG</p><h2>Loading registry…</h2><p>Fetching the current vendor, batch, task, and check records from CASE.</p></section>;
}

function CriteriaView() {
  return <section aria-labelledby="criteria-title"><div className="content-title"><div><p className="eyebrow">CURRENT INTAKE CONTRACT</p><h2 id="criteria-title">Documented criteria</h2><p>Only the conditions currently specified for environment and task intake are listed here.</p></div><span className="criteria-count">7 criteria</span></div><div className="criteria-layout"><ol className="criteria-list">{criteria.map(([title, text], index) => <li key={title}><span>{String(index + 1).padStart(2, "0")}</span><div><h3>{title}</h3><p>{text}</p></div></li>)}</ol><aside className="criteria-aside"><strong>Interpretation boundary</strong><p>A record says what was delivered, what changed, and which deterministic checks have evidence.</p><p>It does not say whether a task is difficult, novel, useful, well-designed, or worth purchasing. Researchers make those judgments.</p></aside></div></section>;
}
