"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import type {
  CatalogSnapshot,
  CatalogSourceEvent,
  CatalogSubmission,
  CatalogTask,
  CatalogVendor,
  HarborCheckPhase,
} from "./catalog";

type Language = "zh" | "en";

export type PortalUser = {
  name: string;
  avatarUrl?: string;
};

const text = {
  en: {
    eyebrow: "CASE registry",
    title: "Environment & Task Samples",
    search: "Search vendors, submissions, or tasks",
    vendors: "Vendors",
    submissions: "Submissions",
    tasks: "Tasks",
    harbor: "Harbor tasks",
    vendor: "Vendor",
    history: "Submission history",
    historyNote: "Each dated delivery is retained with its original source and any clearly parsed tasks or traces.",
    newest: "Newest first",
    latest: "Latest submission",
    taskRecords: "tasks",
    noTasks: "No individual tasks or traces were clearly identified in this submission.",
    sources: "Original delivery",
    arrived: "Arrived",
    sender: "Sender",
    open: "Open source",
    download: "Download copy",
    dataset: "Download tasks",
    datasetNote: "Download the exact task or trace artifacts retained for this submission.",
    taskDownload: "Download",
    task: "Task",
    trace: "Trace",
    nonHarbor: "Non-Harbor",
    findings: "Findings",
    unset: "—",
    attempted: "Tried",
    notAttempted: "Not attempted",
    loading: "Loading CASE records…",
    unavailable: "CASE records are unavailable. The portal does not keep a separate copy.",
    noMatch: "No matching records.",
    signOut: "Sign out",
  },
  zh: {
    eyebrow: "CASE 样本库",
    title: "环境与任务样本",
    search: "搜索供应商、提交记录或任务",
    vendors: "供应商",
    submissions: "提交记录",
    tasks: "任务",
    harbor: "Harbor 任务",
    vendor: "供应商",
    history: "提交记录",
    historyNote: "每次带日期的交付都与原始来源及明确解析出的任务或轨迹一起保留。",
    newest: "最新在前",
    latest: "最新提交",
    taskRecords: "个任务",
    noTasks: "这次提交中没有明确识别出的独立任务或轨迹。",
    sources: "原始交付",
    arrived: "到达时间",
    sender: "发送人",
    open: "打开来源",
    download: "下载留存副本",
    dataset: "下载任务",
    datasetNote: "下载这次提交中保留的精确任务或轨迹文件。",
    taskDownload: "下载",
    task: "任务",
    trace: "轨迹",
    nonHarbor: "非 Harbor",
    findings: "发现",
    unset: "—",
    attempted: "已尝试",
    notAttempted: "未尝试",
    loading: "正在载入 CASE 记录…",
    unavailable: "CASE 记录暂不可用。小环境不保存另一份副本。",
    noMatch: "没有匹配的记录。",
    signOut: "退出登录",
  },
} as const;

const phaseLabels: Record<HarborCheckPhase, string> = {
  environment: "Environment",
  oracle: "Oracle",
  nop: "Nop",
};

export default function PortalClient({ user, initialCatalog, localPreview = false }: { user: PortalUser; initialCatalog?: CatalogSnapshot; localPreview?: boolean }) {
  const [catalog, setCatalog] = useState<CatalogSnapshot | null>(initialCatalog ?? null);
  const [state, setState] = useState<"loading" | "ready" | "unavailable">(initialCatalog ? "ready" : "loading");
  const [language, setLanguage] = useState<Language>("zh");
  const [query, setQuery] = useState("");
  const [selectedVendorId, setSelectedVendorId] = useState(initialCatalog?.vendors.find((vendor) => vendor.submissions.length > 0)?.id ?? "");
  const t = text[language];

  useEffect(() => {
    document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
  }, [language]);

  useEffect(() => {
    if (initialCatalog) return;
    let active = true;
    void fetch("/api/catalog", { cache: "no-store", headers: { accept: "application/json" } })
      .then(async (response) => {
        if (!response.ok) throw new Error(String(response.status));
        return await response.json() as CatalogSnapshot;
      })
      .then((snapshot) => {
        if (!active) return;
        setCatalog(snapshot);
        const visibleVendors = snapshot.vendors.filter((vendor) => vendor.submissions.length > 0);
        setSelectedVendorId((current) => visibleVendors.some((vendor) => vendor.id === current)
          ? current
          : visibleVendors[0]?.id ?? "");
        setState("ready");
      })
      .catch(() => { if (active) setState("unavailable"); });
    return () => { active = false; };
  }, [initialCatalog]);

  const vendors = useMemo(() => (catalog?.vendors ?? []).filter((vendor) => vendor.submissions.length > 0), [catalog]);
  const matchingVendors = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return vendors;
    return vendors.filter((vendor) => vendorSearchText(vendor).includes(normalized));
  }, [query, vendors]);
  const selectedVendor = matchingVendors.find((vendor) => vendor.id === selectedVendorId) ?? matchingVendors[0];

  return <div className="app-shell">
    <header className="global-header">
      <a aria-label={t.title} className="wordmark" href="#top"><Image alt="" height={40} priority src="/octopus-icon.png" width={40} /></a>
      <nav className="market-switch"><button className="active" type="button">{t.title}</button></nav>
      <div className="header-tools">
        <label className="global-search"><span aria-hidden>⌕</span><input aria-label={t.search} onChange={(event) => setQuery(event.target.value)} placeholder={t.search} value={query} /></label>
        <button className="language-switch" onClick={() => setLanguage(language === "zh" ? "en" : "zh")} type="button">{language === "zh" ? "EN" : "中"}</button>
        <details className="account-menu"><summary className="avatar">{user.avatarUrl ? <Image alt="" height={38} src={user.avatarUrl} unoptimized width={38} /> : user.name.slice(0, 1).toUpperCase()}</summary><div className="account-popover"><strong>{user.name}</strong><a href="/auth/logout">{t.signOut}</a></div></details>
      </div>
    </header>

    <main id="top">
    <section className="registry-header">
      <div className="eyebrow">{t.eyebrow}</div>
      <h1>{t.title}</h1>
      <div className="registry-stats">
        <Stat label={t.vendors} value={catalog ? vendors.length : undefined} />
        <Stat label={t.submissions} value={catalog?.totals.submissions} />
        <Stat label={t.tasks} value={catalog?.totals.tasks} />
        <Stat label={t.harbor} value={catalog?.totals.harborTasks} />
      </div>
    </section>

    <div className="page-body">
    {state === "loading" && <StateCard>{t.loading}</StateCard>}
    {state === "unavailable" && <StateCard>{t.unavailable}</StateCard>}
    {state === "ready" && !selectedVendor && <StateCard>{t.noMatch}</StateCard>}
    {state === "ready" && selectedVendor && <div className="portal-grid">
      <aside className="vendor-sidebar" aria-label={t.vendors}>
        <div className="sidebar-head"><strong>{t.vendors}</strong><span>{matchingVendors.length}</span></div>
        <div className="vendor-list">{matchingVendors.map((vendor) => <button className={vendor.id === selectedVendor.id ? "active" : ""} key={vendor.id} onClick={() => setSelectedVendorId(vendor.id)} type="button"><span><strong>{vendor.name}</strong><small>{vendor.submissions.length} {t.submissions.toLowerCase()} · {vendor.submissions.reduce((sum, submission) => sum + submission.tasks.length, 0)} {t.taskRecords}</small></span></button>)}</div>
      </aside>
      <section className="vendor-main">
        <header className="vendor-profile"><div className="vendor-kicker">{t.vendor}</div><h2>{selectedVendor.name}</h2><div className="vendor-meta"><span>{selectedVendor.submissions.length} {t.submissions.toLowerCase()}</span><span>{selectedVendor.submissions.reduce((sum, submission) => sum + submission.tasks.length, 0)} {t.taskRecords}</span></div></header>
        <section className="submission-history"><div className="section-title"><div><h3>{t.history}</h3><p>{t.historyNote}</p></div><span>{t.newest}</span></div>
        <div className="batch-list">{selectedVendor.submissions.map((submission, index) => <SubmissionCard datasetHref={localPreview ? "/local-preview/dataset-download" : `/api/submissions/${encodeURIComponent(submission.id)}/dataset-download`} key={submission.id} language={language} latest={index === 0} open={index === 0} submission={submission} />)}</div></section>
      </section>
    </div>}
    </div>
    </main>

  </div>;
}

function Stat({ label, value }: { label: string; value?: number }) {
  return <span><strong>{value ?? "—"}</strong>{label}</span>;
}

function StateCard({ children }: { children: string }) {
  return <div className="state-card">{children}</div>;
}

function SubmissionCard({ submission, open, latest, language, datasetHref }: { submission: CatalogSubmission; open: boolean; latest: boolean; language: Language; datasetHref: string }) {
  const t = text[language];
  const harborTaskCount = submission.tasks.filter((task) => task.format === "harbor").length;
  return <details className="batch-card" open={open}>
    <summary className="batch-summary">
      <span className="batch-date"><strong>{formatDate(submission.date, language)}</strong>{latest && <small>{t.latest}</small>}</span>
      <span className="batch-name"><strong>{submission.label}</strong><code>{submission.source}</code></span>
      <span className="batch-count"><strong>{submission.tasks.length} {t.taskRecords}</strong><small>{harborTaskCount} {t.harbor}</small></span>
      <span className="disclosure">▾</span>
    </summary>
    <div className="batch-body">
      <section className="dataset-access"><div className="dataset-copy"><span>CASE DATASET</span><h4>{t.tasks}</h4><p>{submission.tasks.length ? t.datasetNote : t.noTasks}</p></div><div className="dataset-metrics"><span><strong>{submission.tasks.length}</strong><small>{t.taskRecords}</small></span><span><strong>{submission.tasks.filter((task) => task.format === "harbor").length}</strong><small>{t.harbor}</small></span></div>{submission.tasks.some((task) => task.artifactId) && <a href={datasetHref}>{t.dataset}</a>}</section>
      <div className="batch-section-head"><h4>{t.tasks}</h4><span>{submission.tasks.length} {t.taskRecords}</span></div>
      <div className="task-list">{submission.tasks.length === 0 ? <p className="empty-task-list">{t.noTasks}</p> : submission.tasks.map((task) => <TaskRow key={task.id} language={language} task={task} />)}</div>
      <SourcePanel events={submission.sourceEvents} language={language} />
    </div>
  </details>;
}

function SourcePanel({ events, language }: { events: CatalogSourceEvent[]; language: Language }) {
  const t = text[language];
  return <section className="source-block"><div className="batch-section-head"><h4>{t.sources}</h4><span>{events.length}</span></div><div className="source-events">{events.map((event) => <div className="source-event" key={event.id}>
    <div className="source-event-head"><span className="source-channel">{event.channel}</span><span className="source-name"><strong>{t.arrived}: {formatTimestamp(event.receivedAt, language)}</strong><small>{event.sender ? `${t.sender}: ${event.sender}` : t.sender}</small></span><span className="source-actions">{safeExternalUrl(event.externalRef) && <a href={safeExternalUrl(event.externalRef)!} rel="noreferrer" target="_blank">{t.open}</a>}{event.rawArtifactId && <a href={`/api/artifacts/${encodeURIComponent(event.rawArtifactId)}/download`}>{t.download}</a>}</span></div>
    <div className="source-items">{event.items.map((item) => <div className="source-item" key={item.id}><span className="source-kind">{item.kind}</span><span className="source-name"><strong>{item.displayName}</strong>{item.locator && <small>{item.locator}</small>}</span><span className="source-actions">{item.artifactId && <a aria-label={`${t.download}: ${item.displayName}`} href={`/api/artifacts/${encodeURIComponent(item.artifactId)}/download`}>{t.download}</a>}</span></div>)}</div>
  </div>)}</div></section>;
}

function TaskRow({ task, language }: { task: CatalogTask; language: Language }) {
  const t = text[language];
  return <article className="task-record">
    <div className="task-row">
    <div className="task-main">
      <h5>{task.title}</h5>
      <div className="task-meta">
        <span>{task.format === "harbor" ? "Harbor" : t.nonHarbor}</span>
        {task.kind === "trace" && <span>{t.trace}</span>}
        {task.sourcePath && <code>{task.sourcePath}</code>}
      </div>
      {task.summary && <p>{task.summary}</p>}
    </div>
    <div className="task-checks">
      {task.format === "harbor" ? <div className="checks">{(["environment", "oracle", "nop"] as HarborCheckPhase[]).map((phase) => {
        const check = task.checks[phase];
        const attempt = task.attempts?.[phase];
        const state = check?.outcome ?? (attempt ? "attempted" : "unset");
        const mark = state === "pass" ? "✓" : state === "fail" ? "×" : state === "attempted" ? t.attempted : t.unset;
        const accessibleState = check?.outcome ?? attempt?.status ?? t.notAttempted;
        return <span aria-label={`${phaseLabels[phase]}: ${accessibleState}`} className={`check ${state}`} key={phase} title={check?.summary ?? attempt?.summary ?? t.notAttempted}>
          <span className="check-label">{phaseLabels[phase]}</span>
          <span aria-hidden className="check-mark">{mark}</span>
        </span>;
      })}</div> : null}
    </div>
    <div className="task-actions">{task.artifactId && <a href={`/api/artifacts/${encodeURIComponent(task.artifactId)}/download`}>{t.taskDownload}</a>}</div>
    </div>
    {task.findings.length > 0 && <div className="task-findings"><div className="finding-title">{t.findings}</div><div className="task-finding-list">{task.findings.map((finding) => <div className="task-finding" key={finding.id}><strong>{phaseLabels[finding.phase]}</strong><p>{finding.finding}</p></div>)}</div></div>}
  </article>;
}

function vendorSearchText(vendor: CatalogVendor): string {
  return [vendor.name, vendor.short, ...vendor.submissions.flatMap((submission) => [submission.label, submission.source, ...submission.tasks.flatMap((task) => [task.title, task.stableKey, task.sourcePath ?? ""])])].join(" ").toLowerCase();
}

function safeExternalUrl(value: string | null): string | null {
  if (!value) return null;
  try { const url = new URL(value); return url.protocol === "https:" || url.protocol === "http:" ? url.href : null; } catch { return null; }
}

function formatDate(value: string, language: Language): string {
  return new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}

function formatTimestamp(value: string, language: Language): string {
  return new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Shanghai",
  }).format(new Date(value));
}

const previewSubmission: CatalogSubmission = {
  id: "preview-submission",
  date: "2026-08-20",
  label: "August sample",
  source: "Captured vendor delivery",
  formats: ["harbor", "non_harbor"],
  sourceEvents: [{ id: "preview-source", channel: "upload", externalRef: "", sender: "Vendor", receivedAt: "2026-08-20T09:30:00.000Z", rawArtifactId: "artifact:preview:raw", items: [{ id: "preview-file", kind: "archive", displayName: "original-payload.zip", locator: null, artifactId: "artifact:preview:raw", contentSha256: null }] }],
  tasks: [
    { id: "preview-harbor", stableKey: "repair-cache", title: "Repair cache invalidation", summary: null, kind: "task", format: "harbor", sourcePath: "tasks/repair-cache", artifactId: "artifact:preview:task", contentSha256: null, sourceItemIds: ["preview-file"], checks: { environment: previewCheck("environment", "pass"), nop: previewCheck("nop", "fail") }, attempts: { oracle: previewAttempt("oracle", "inconclusive") }, findings: [{ id: "finding:nop", phase: "nop", checkRunId: "check:nop", finding: "Nop received score 1." }] },
    { id: "preview-trace", stableKey: "browser-trace", title: "Browser workflow trace", summary: null, kind: "trace", format: "non_harbor", sourcePath: "traces/session.jsonl", artifactId: "artifact:preview:trace", contentSha256: null, sourceItemIds: ["preview-file"], checks: {}, attempts: {}, findings: [] },
  ],
};

function previewCheck(phase: HarborCheckPhase, outcome: "pass" | "fail") {
  return { id: `check:${phase}`, phase, outcome, summary: `${phase} ${outcome}`, score: phase === "oracle" ? 1 : phase === "nop" ? 1 : null, completedAt: "2026-08-20T10:00:00.000Z" };
}

function previewAttempt(phase: HarborCheckPhase, status: "blocked" | "inconclusive") {
  return { id: `attempt:${phase}`, phase, status, summary: `${phase} was attempted but did not produce a conclusive result`, completedAt: "2026-08-20T10:00:00.000Z" };
}

export function LocalDownloadPreview() {
  const previewCatalog: CatalogSnapshot = {
    generatedAt: "2026-08-20T10:00:00.000Z",
    vendors: [{ id: "preview-vendor", name: "Example Vendor", short: "EV", submissions: [previewSubmission] }],
    totals: { vendors: 1, submissions: 1, tasks: 2, harborTasks: 1 },
  };
  return <PortalClient initialCatalog={previewCatalog} localPreview user={{ name: "Researcher" }} />;
}
