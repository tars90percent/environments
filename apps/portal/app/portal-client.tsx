"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import type {
  CatalogSnapshot,
  CatalogSubmission,
  CatalogTask,
  CatalogVendor,
  HarborCheckPhase,
} from "./catalog";
import { originalSubmissionArtifacts } from "./original-submission";
import { displayArchivePath } from "./archive-path";
import {
  benchmarkCategoryDefinitions,
  buildBenchmarkLandscape,
  type BenchmarkCategoryGroup,
  type BenchmarkGroup,
  type HarborTaskContext,
} from "./benchmark-landscape";

type Language = "zh" | "en";
type PortalView = "benchmarks" | "vendors";

export type PortalUser = {
  name: string;
  avatarUrl?: string;
};

const text = {
  en: {
    eyebrow: "CASE registry",
    title: "Environment & Task Samples",
    search: "Search vendors, submissions, or tasks",
    benchmarks: "Benchmarks",
    benchmarkDirections: "Benchmark directions",
    benchmarkCategories: "Benchmark groups",
    landscapeTitle: "RL task landscape",
    landscapeIntro: "See the Harbor tasks vendors are offering, organized by the benchmark distributions they target.",
    viewTasks: "View tasks",
    backToLandscape: "Back to benchmark landscape",
    offeredBy: "Offered by",
    across: "across",
    benchmarkTasks: "Matching Harbor tasks",
    benchmarkTaskNote: "The exact registered tasks targeting this benchmark direction, grouped by vendor.",
    openVendor: "Open vendor record",
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
    sources: "Original vendor files",
    originalNote: "Exact inbound vendor files retained before parsing.",
    arrived: "Received",
    sender: "Sender",
    downloadOne: "Download original file",
    noOriginalFile: "No inbound vendor file can be identified conclusively from the retained provenance.",
    directCaseImport: "Direct CASE import",
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
    benchmarks: "基准",
    benchmarkDirections: "基准方向",
    benchmarkCategories: "基准分组",
    landscapeTitle: "RL 任务全景",
    landscapeIntro: "按目标基准分布查看各供应商提供的 Harbor 任务。",
    viewTasks: "查看任务",
    backToLandscape: "返回基准全景",
    offeredBy: "来自",
    across: "分布于",
    benchmarkTasks: "匹配的 Harbor 任务",
    benchmarkTaskNote: "按供应商分组展示面向此基准方向的准确注册任务。",
    openVendor: "查看供应商记录",
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
    sources: "供应商原始文件",
    originalNote: "解析前留存的供应商原始文件。",
    arrived: "接收时间",
    sender: "发送人",
    downloadOne: "下载原始文件",
    noOriginalFile: "现有溯源信息不足以明确识别原始传入的供应商文件。",
    directCaseImport: "直接导入 CASE",
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
  const [view, setView] = useState<PortalView>("benchmarks");
  const [query, setQuery] = useState("");
  const [selectedBenchmarkId, setSelectedBenchmarkId] = useState<string | null>(null);
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
  const landscape = useMemo(() => catalog ? buildBenchmarkLandscape(catalog) : null, [catalog]);
  const matchingBenchmarkGroups = useMemo(() => {
    if (!landscape) return [];
    const normalized = query.trim().toLowerCase();
    if (!normalized) return landscape.groups;
    return landscape.groups.filter((group) => benchmarkGroupSearchText(group, language).includes(normalized));
  }, [landscape, language, query]);
  const matchingBenchmarkCategories = useMemo(() => {
    if (!landscape) return [];
    const matchingIds = new Set(matchingBenchmarkGroups.map((group) => group.id));
    return landscape.categories.map((category) => ({
      ...category,
      groups: category.groups.filter((group) => matchingIds.has(group.id)),
    })).map((category) => ({
      ...category,
      benchmarkCount: category.groups.length,
      taskCount: category.groups.reduce((sum, group) => sum + group.taskCount, 0),
    })).filter((category) => category.benchmarkCount > 0);
  }, [landscape, matchingBenchmarkGroups]);
  const selectedBenchmark = landscape?.groups.find((group) => group.id === selectedBenchmarkId) ?? null;
  const matchingBenchmarkRecords = useMemo(() => {
    if (!selectedBenchmark) return [];
    const normalized = query.trim().toLowerCase();
    if (!normalized) return selectedBenchmark.records;
    return selectedBenchmark.records.filter((record) => benchmarkRecordSearchText(record).includes(normalized));
  }, [query, selectedBenchmark]);
  const matchingVendors = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return vendors;
    return vendors.filter((vendor) => vendorSearchText(vendor).includes(normalized));
  }, [query, vendors]);
  const selectedVendor = matchingVendors.find((vendor) => vendor.id === selectedVendorId) ?? matchingVendors[0];
  const selectedBenchmarkCategory = landscape?.categories.find((category) => category.id === selectedBenchmark?.categoryId);
  const headerTitle = view === "benchmarks" ? selectedBenchmark?.displayName ?? t.landscapeTitle : t.title;
  const headerIntro = view === "benchmarks" ? selectedBenchmark
    ? `${selectedBenchmark.taskCount} ${t.taskRecords} · ${selectedBenchmark.vendorCount} ${t.vendors.toLowerCase()}`
    : t.landscapeIntro
    : null;

  function showBenchmarks() {
    setView("benchmarks");
    setSelectedBenchmarkId(null);
    setQuery("");
    scrollToTop();
  }

  function showVendors(vendorId?: string) {
    setView("vendors");
    setSelectedBenchmarkId(null);
    setQuery("");
    if (vendorId) setSelectedVendorId(vendorId);
    scrollToTop();
  }

  return <div className="app-shell">
    <header className="global-header">
      <a aria-label={t.landscapeTitle} className="wordmark" href="#top" onClick={showBenchmarks}><Image alt="" height={40} priority src="/octopus-icon.png" width={40} /></a>
      <nav aria-label={t.title} className="market-switch">
        <button className={view === "benchmarks" ? "active" : ""} onClick={showBenchmarks} type="button">{t.benchmarks}</button>
        <button className={view === "vendors" ? "active" : ""} onClick={() => showVendors()} type="button">{t.vendors}</button>
      </nav>
      <div className="header-tools">
        <label className="global-search"><span aria-hidden>⌕</span><input aria-label={t.search} onChange={(event) => setQuery(event.target.value)} placeholder={t.search} value={query} /></label>
        <button className="language-switch" onClick={() => setLanguage(language === "zh" ? "en" : "zh")} type="button">{language === "zh" ? "EN" : "中"}</button>
        <details className="account-menu"><summary className="avatar">{user.avatarUrl ? <Image alt="" height={38} src={user.avatarUrl} unoptimized width={38} /> : user.name.slice(0, 1).toUpperCase()}</summary><div className="account-popover"><strong>{user.name}</strong><a href="/auth/logout">{t.signOut}</a></div></details>
      </div>
    </header>

    <main id="top">
    <section className="registry-header">
      {view === "benchmarks" && selectedBenchmark && <button className="landscape-back registry-back" onClick={showBenchmarks} type="button"><span aria-hidden>←</span>{t.backToLandscape}</button>}
      <div className="eyebrow">{view === "benchmarks" && selectedBenchmarkCategory ? selectedBenchmarkCategory.label[language] : t.eyebrow}</div>
      <h1>{headerTitle}</h1>
      {headerIntro && <p className="registry-intro">{headerIntro}</p>}
      <div className="registry-stats">
        {view === "benchmarks" ? <>
          <Stat label={t.harbor} value={selectedBenchmark?.taskCount ?? landscape?.taskCount} />
          <Stat label={t.benchmarkDirections} value={selectedBenchmark ? 1 : landscape?.benchmarkCount} />
          <Stat label={t.vendors} value={selectedBenchmark?.vendorCount ?? landscape?.vendorCount} />
          {selectedBenchmark && <Stat label={t.submissions} value={selectedBenchmark.submissionCount} />}
          {!selectedBenchmark && <Stat label={t.benchmarkCategories} value={landscape?.categories.length} />}
        </> : <>
          <Stat label={t.vendors} value={catalog ? vendors.length : undefined} />
          <Stat label={t.submissions} value={catalog?.totals.submissions} />
          <Stat label={t.harbor} value={catalog?.totals.harborTasks} />
        </>}
      </div>
    </section>

    <div className="page-body">
    {state === "loading" && <StateCard>{t.loading}</StateCard>}
    {state === "unavailable" && <StateCard>{t.unavailable}</StateCard>}
    {state === "ready" && view === "benchmarks" && landscape && !selectedBenchmark && <BenchmarkOverview categories={matchingBenchmarkCategories} language={language} onSelect={(benchmarkId) => { setSelectedBenchmarkId(benchmarkId); setQuery(""); scrollToTop(); }} totalTasks={landscape.taskCount} />}
    {state === "ready" && view === "benchmarks" && selectedBenchmark && <BenchmarkDetail language={language} onOpenVendor={showVendors} records={matchingBenchmarkRecords} />}
    {state === "ready" && view === "vendors" && !selectedVendor && <StateCard>{t.noMatch}</StateCard>}
    {state === "ready" && view === "vendors" && selectedVendor && <div className="portal-grid">
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

function BenchmarkOverview({ categories, language, onSelect, totalTasks }: { categories: BenchmarkCategoryGroup[]; language: Language; onSelect: (benchmarkId: string) => void; totalTasks: number }) {
  const t = text[language];
  if (categories.length === 0) return <StateCard>{t.noMatch}</StateCard>;
  return <div className="benchmark-landscape">
    <div className="benchmark-category-list">{categories.map((category, index) => <section className="benchmark-category" key={category.id}>
      <header className="benchmark-category-header">
        <div className="category-index">{String(index + 1).padStart(2, "0")}</div>
        <div><h2>{category.label[language]}</h2><p>{category.description[language]}</p></div>
        <div className="category-totals"><strong>{category.taskCount}</strong><span>{t.harbor}</span><small>{category.benchmarkCount} {countLabel(category.benchmarkCount, language, "benchmark direction", t.benchmarkDirections.toLowerCase())}</small></div>
      </header>
      <div className="benchmark-card-grid">{category.groups.map((group) => <BenchmarkCard group={group} key={group.id} language={language} onSelect={onSelect} totalTasks={totalTasks} />)}</div>
    </section>)}</div>
  </div>;
}

function BenchmarkCard({ group, language, onSelect, totalTasks }: { group: BenchmarkGroup; language: Language; onSelect: (benchmarkId: string) => void; totalTasks: number }) {
  const t = text[language];
  const share = totalTasks ? Math.max((group.taskCount / totalTasks) * 100, 1.5) : 0;
  return <button aria-label={`${group.displayName}: ${group.taskCount} ${t.harbor}`} className="benchmark-card" onClick={() => onSelect(group.id)} type="button">
    <span className="benchmark-card-top"><code>{group.id}</code><span aria-hidden>↗</span></span>
    <strong>{group.displayName}</strong>
    <span className="benchmark-card-meta"><b>{group.taskCount}</b> {countLabel(group.taskCount, language, "task", t.taskRecords)} · {group.vendorCount} {countLabel(group.vendorCount, language, "vendor", t.vendors.toLowerCase())}</span>
    <span aria-hidden className="benchmark-share"><i style={{ width: `${share}%` }} /></span>
    <span className="benchmark-card-action">{t.viewTasks}</span>
  </button>;
}

function countLabel(count: number, language: Language, englishSingular: string, pluralOrChinese: string) {
  return language === "en" && count === 1 ? englishSingular : pluralOrChinese;
}

function BenchmarkDetail({ language, onOpenVendor, records }: { language: Language; onOpenVendor: (vendorId: string) => void; records: HarborTaskContext[] }) {
  const t = text[language];
  const vendorGroups = groupRecordsByVendor(records);
  return <div className="benchmark-detail">
    <section className="benchmark-task-section">
      <div className="section-title"><div><h3>{t.benchmarkTasks}</h3><p>{t.benchmarkTaskNote}</p></div><span>{records.length} {t.taskRecords}</span></div>
      {vendorGroups.length === 0 ? <StateCard>{t.noMatch}</StateCard> : <div className="benchmark-vendor-list">{vendorGroups.map(({ vendor, records: vendorRecords }) => <section className="benchmark-vendor-group" key={vendor.id}>
        <header><button onClick={() => onOpenVendor(vendor.id)} type="button"><span><small>{t.offeredBy}</small><strong>{vendor.name}</strong></span><span>{vendorRecords.length} {t.taskRecords}<b aria-hidden>→</b></span></button></header>
        <div className="task-list">{vendorRecords.map((record) => <TaskRow contextLabel={`${record.submission.label} · ${formatDate(record.submission.date, language)}`} hideBenchmark key={record.task.id} language={language} task={record.task} />)}</div>
      </section>)}</div>}
    </section>
  </div>;
}

function groupRecordsByVendor(records: HarborTaskContext[]): Array<{ vendor: CatalogVendor; records: HarborTaskContext[] }> {
  const groups = new Map<string, { vendor: CatalogVendor; records: HarborTaskContext[] }>();
  for (const record of records) {
    const group = groups.get(record.vendor.id) ?? { vendor: record.vendor, records: [] };
    group.records.push(record);
    groups.set(record.vendor.id, group);
  }
  return [...groups.values()].sort((left, right) => right.records.length - left.records.length || left.vendor.name.localeCompare(right.vendor.name));
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
      <span className="batch-name"><strong>{submission.label}</strong><code>{friendlySubmissionSource(submission, language)}</code></span>
      <span className="batch-count"><strong>{submission.tasks.length} {t.taskRecords}</strong><small>{harborTaskCount} {t.harbor}</small></span>
      <span className="disclosure">▾</span>
    </summary>
    <div className="batch-body">
      <section className="dataset-access"><div className="dataset-copy"><span>CASE DATASET</span><h4>{t.tasks}</h4><p>{submission.tasks.length ? t.datasetNote : t.noTasks}</p></div><div className="dataset-metrics"><span><strong>{submission.tasks.length}</strong><small>{t.taskRecords}</small></span><span><strong>{submission.tasks.filter((task) => task.format === "harbor").length}</strong><small>{t.harbor}</small></span></div>{submission.tasks.some((task) => task.artifactId) && <a href={datasetHref}>{t.dataset}</a>}</section>
      <div className="batch-section-head"><h4>{t.tasks}</h4><span>{submission.tasks.length} {t.taskRecords}</span></div>
      <div className="task-list">{submission.tasks.length === 0 ? <p className="empty-task-list">{t.noTasks}</p> : submission.tasks.map((task) => <TaskRow key={task.id} language={language} task={task} />)}</div>
      <OriginalSubmissionPanel language={language} submission={submission} />
    </div>
  </details>;
}

function OriginalSubmissionPanel({ submission, language }: { submission: CatalogSubmission; language: Language }) {
  const t = text[language];
  const artifacts = originalSubmissionArtifacts(submission);
  const knownBytes = artifacts.map((artifact) => artifact.sizeBytes).filter((size): size is number => typeof size === "number" && Number.isFinite(size) && size >= 0);
  const size = knownBytes.length === artifacts.length && artifacts.length ? formatBytes(knownBytes.reduce((sum, value) => sum + value), language) : null;
  return <section className="original-submission"><div className="batch-section-head"><h4>{t.sources}</h4><span>{artifacts.length}</span></div><div className="original-card">
    <div className="original-copy"><strong>{fileCount(artifacts.length, language)}{size ? ` · ${size}` : ""}</strong><p>{t.originalNote}</p><div className="original-provenance">{submission.sourceEvents.map((event) => <span key={event.id}>{friendlyChannel(event.channel, language)} · {formatTimestamp(event.receivedAt, language)}{event.sender ? ` · ${event.sender}` : ""}</span>)}</div></div>
    <div className={`original-actions${artifacts.length > 1 ? " multiple" : ""}`}>{artifacts.map((artifact) => <a
      aria-label={`${t.downloadOne}: ${artifact.displayName}`}
      className={artifacts.length === 1 ? "primary" : undefined}
      href={`/api/artifacts/${encodeURIComponent(artifact.artifactId)}/download`}
      key={artifact.artifactId}
      title={artifact.displayName}
    >{artifacts.length === 1 ? t.downloadOne : <><span>{artifact.displayName}</span>{artifact.sizeBytes !== null && <small>{formatBytes(artifact.sizeBytes, language)}</small>}</>}</a>)}</div>
    {artifacts.length === 0 && <p className="original-empty">{t.noOriginalFile}</p>}
  </div></section>;
}

function TaskRow({ task, language, contextLabel, hideBenchmark = false }: { task: CatalogTask; language: Language; contextLabel?: string; hideBenchmark?: boolean }) {
  const t = text[language];
  return <article className="task-record">
    <div className="task-row">
    <div className="task-main">
      <h5>{task.title}</h5>
      <div className="task-meta">
        {contextLabel && <span>{contextLabel}</span>}
        {!hideBenchmark && task.benchmark.id !== "unspecified" && <span>{task.benchmark.displayName}</span>}
        <span>{task.format === "harbor" ? "Harbor" : t.nonHarbor}</span>
        {task.kind === "trace" && <span>{t.trace}</span>}
        {task.sourcePath && <code>{displayArchivePath(task.sourcePath)}</code>}
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
  return [vendor.name, vendor.short, ...vendor.submissions.flatMap((submission) => [submission.label, submission.source, ...submission.tasks.flatMap((task) => [task.title, task.stableKey, task.benchmark.displayName, task.sourcePath ? displayArchivePath(task.sourcePath) : ""])])].join(" ").toLowerCase();
}

function benchmarkGroupSearchText(group: BenchmarkGroup, language: Language): string {
  const category = benchmarkCategoryDefinitions.find((definition) => definition.id === group.categoryId);
  return [
    group.id,
    group.displayName,
    category?.label[language],
    category?.label.en,
    category?.label.zh,
    ...group.records.flatMap((record) => [
      record.vendor.name,
      record.vendor.short,
      record.submission.label,
      record.task.title,
      record.task.stableKey,
      record.task.summary ?? "",
    ]),
  ].join(" ").toLowerCase();
}

function benchmarkRecordSearchText(record: HarborTaskContext): string {
  return [
    record.vendor.name,
    record.vendor.short,
    record.submission.label,
    record.task.title,
    record.task.stableKey,
    record.task.summary ?? "",
    record.task.sourcePath ? displayArchivePath(record.task.sourcePath) : "",
  ].join(" ").toLowerCase();
}

function scrollToTop() {
  window.requestAnimationFrame(() => document.getElementById("top")?.scrollIntoView({ behavior: "smooth", block: "start" }));
}

function friendlySubmissionSource(submission: CatalogSubmission, language: Language): string {
  const channel = submission.sourceEvents[0]?.channel;
  if (channel === "workspace" || channel === "upload" || /local (folder )?handoff/i.test(submission.source)) return text[language].directCaseImport;
  return friendlyChannel(channel ?? submission.source, language);
}

function friendlyChannel(channel: string, language: Language): string {
  const normalized = channel.trim().toLowerCase();
  if (normalized === "workspace" || normalized === "upload") return text[language].directCaseImport;
  if (normalized === "email" || normalized === "mail") return language === "zh" ? "邮件" : "Email";
  if (normalized === "website") return language === "zh" ? "网站" : "Website";
  if (normalized === "vendor_portal") return language === "zh" ? "供应商门户" : "Vendor portal";
  if (normalized === "feishu") return "Feishu";
  if (normalized === "slack") return "Slack";
  return channel;
}

function fileCount(count: number, language: Language): string {
  if (language === "zh") return `${count} 个原始文件`;
  return `${count} original ${count === 1 ? "file" : "files"}`;
}

function formatBytes(bytes: number, language: Language): string {
  return new Intl.NumberFormat(language === "zh" ? "zh-CN" : "en", { style: "unit", unit: bytes < 1024 ? "byte" : bytes < 1024 ** 2 ? "kilobyte" : "megabyte", unitDisplay: "short", maximumFractionDigits: bytes < 1024 ? 0 : 1 }).format(bytes < 1024 ? bytes : bytes < 1024 ** 2 ? bytes / 1024 : bytes / 1024 ** 2);
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
  sourceEvents: [{ id: "preview-source", channel: "upload", externalRef: "", sender: "Vendor", receivedAt: "2026-08-20T09:30:00.000Z", rawArtifactId: "artifact:preview:raw", rawArtifact: { id: "artifact:preview:raw", kind: "source_payload", contentSha256: "0".repeat(64), sizeBytes: 5242880, contentType: "application/zip", originalName: "original-payload.zip" }, items: [{ id: "preview-file", kind: "archive", displayName: "original-payload.zip", locator: null, mediaType: "application/zip", artifactId: "artifact:preview:raw", artifactKind: "source_payload", contentSha256: "0".repeat(64), sizeBytes: 5242880 }] }],
  tasks: [
    previewHarborTask("preview-harbor", "Repair cache invalidation", "terminal-bench", "Terminal-Bench", { artifactId: "artifact:preview:task", checks: { environment: previewCheck("environment", "pass"), nop: previewCheck("nop", "fail") }, attempts: { oracle: previewAttempt("oracle", "inconclusive") }, findings: [{ id: "finding:nop", phase: "nop", checkRunId: "check:nop", finding: "Nop received score 1." }] }),
    previewHarborTask("preview-swe", "Implement resumable repository migration", "deep-swe", "DeepSWE"),
    previewHarborTask("preview-network", "Add adaptive backend concurrency", "network-engineering", "Network Engineering"),
    previewHarborTask("preview-browser", "Complete multi-store browser workflow", "browser-automation-ecommerce", "Browser Automation E-commerce"),
    previewHarborTask("preview-security", "Capture a protected service secret", "cybersecurity", "Cybersecurity"),
    previewHarborTask("preview-math", "Solve constrained polynomial count", "mathematical-reasoning", "Mathematical Reasoning"),
    previewHarborTask("preview-cad", "Reconstruct a parametric CAD part", "cad-generation-and-understanding", "CAD Generation and Understanding"),
    { id: "preview-trace", stableKey: "browser-trace", title: "Browser workflow trace", summary: null, kind: "trace", format: "non_harbor", benchmark: { id: "unspecified", displayName: "Unspecified" }, sourcePath: "traces/session.jsonl", artifactId: "artifact:preview:trace", contentSha256: null, sourceItemIds: ["preview-file"], checks: {}, attempts: {}, findings: [] },
  ],
};

const previewSecondSubmission: CatalogSubmission = {
  id: "preview-submission-two",
  date: "2026-08-18",
  label: "Terminal and coding sample",
  source: "Captured vendor delivery",
  formats: ["harbor"],
  sourceEvents: [],
  tasks: [
    previewHarborTask("preview-terminal-two", "Rebuild a damaged package index", "terminal-bench", "Terminal-Bench"),
    previewHarborTask("preview-swe-two", "Repair cross-service event ordering", "deep-swe", "DeepSWE"),
  ],
};

function previewHarborTask(id: string, title: string, benchmarkId: string, benchmarkName: string, overrides: Partial<CatalogTask> = {}): CatalogTask {
  return {
    id,
    stableKey: id.replace(/^preview-/, ""),
    title,
    summary: null,
    kind: "task",
    format: "harbor",
    benchmark: { id: benchmarkId, displayName: benchmarkName },
    sourcePath: `tasks/${id.replace(/^preview-/, "")}`,
    artifactId: null,
    contentSha256: null,
    sourceItemIds: [],
    checks: {},
    attempts: {},
    findings: [],
    ...overrides,
  };
}

function previewCheck(phase: HarborCheckPhase, outcome: "pass" | "fail") {
  return { id: `check:${phase}`, phase, outcome, summary: `${phase} ${outcome}`, score: phase === "oracle" ? 1 : phase === "nop" ? 1 : null, completedAt: "2026-08-20T10:00:00.000Z" };
}

function previewAttempt(phase: HarborCheckPhase, status: "blocked" | "inconclusive") {
  return { id: `attempt:${phase}`, phase, status, summary: `${phase} was attempted but did not produce a conclusive result`, completedAt: "2026-08-20T10:00:00.000Z" };
}

export function LocalDownloadPreview() {
  const previewCatalog: CatalogSnapshot = {
    generatedAt: "2026-08-20T10:00:00.000Z",
    vendors: [
      { id: "preview-vendor", name: "Example Vendor", short: "EV", submissions: [previewSubmission] },
      { id: "preview-vendor-two", name: "Second Vendor", short: "SV", submissions: [previewSecondSubmission] },
    ],
    totals: { vendors: 2, submissions: 2, tasks: 10, harborTasks: 9 },
  };
  return <PortalClient initialCatalog={previewCatalog} localPreview user={{ name: "Researcher" }} />;
}
