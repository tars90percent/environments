"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import type { CatalogBatch, CatalogSnapshot, CatalogSourceEvent, CatalogSourceItem, CatalogTask, CatalogVendor, SourceFetchStatus, SourceParseStatus, WorkflowStatus } from "./catalog";

type Language = "zh" | "en";

export type PortalUser = {
  name: string;
  avatarUrl?: string;
};

const copy = {
  zh: {
    vendors: "供应商",
    search: "搜索供应商、提交记录、类别和任务",
    language: "EN",
    languageLabel: "Switch to English",
    accountLabel: "研究员账户",
    signOut: "退出登录",
    title: "环境与任务样本",
    stats: { vendors: "家供应商", submissions: "次提交", tasks: "个任务版本" },
    vendor: "供应商",
    submission: "次提交",
    submissions: "次提交",
    records: "条记录",
    taskRecords: "条任务记录",
    history: "提交记录",
    historyNote: "每次收到的交付，或 CASE 对持续维护来源进行的定期记录，都会作为一条带日期的提交记录保留。差异只描述内容变化，不代表研究质量。",
    newest: "最新在前",
    latest: "最新提交",
    taskCategories: "任务类别",
    category: "个类别",
    categories: "个类别",
    noTasks: "任务记录尚未标准化",
    originalSources: "原始来源",
    sourceNote: "保留实时链接，并在 CASE 已抓取时同时保留当时的副本。",
    sourceRecord: "条来源记录",
    sourceRecords: "条来源记录",
    noSource: "尚未关联原始来源",
    legacySource: "这条提交记录早于来源级接收流程，原始消息、链接和文件尚未挂接。",
    noLinks: "没有记录关联文件或链接。",
    senderUnknown: "未记录发送人",
    openOriginal: "打开原始记录",
    messageSnapshot: "下载消息快照",
    viewSource: "打开实时来源",
    downloadSnapshot: "下载留存副本",
    mutable: "可变来源",
    captured: "抓取于",
    delta: { retained: "保留", added: "新增", removed: "移除", changedFiles: "文件变化" },
    searchEmpty: { eyebrow: "搜索", title: "没有匹配的样本", body: "请尝试供应商、提交记录、类别或任务名称。" },
    loading: { eyebrow: "CASE 目录", title: "正在载入样本库…", body: "正在从 CASE 获取最新的供应商、提交记录、任务与核验记录。" },
    unavailable: { eyebrow: "CASE 目录", title: "样本库暂不可用", fallback: "暂时无法载入共享目录。", tail: "小环境不会展示缓存的供应商数据，因为它不是事实来源。" },
    checks: {
      eyebrow: "已记录证据",
      title: "确定性核验",
      note: "这里只显示 CASE 已记录的结果，不代表质量分数或接收决定。",
      none: "没有已记录的核验结果",
      pass: "通过",
      fail: "失败",
      blocked: "受阻",
      notRun: "未运行",
    },
    criteriaIntro: {
      eyebrow: "当前接收规范",
      title: "接收条件",
      note: "这些是目前明确规定的环境与任务接收条件，不是研究质量判断。",
      count: "7 项条件",
      boundary: "解释边界",
      p1: "记录只说明收到了什么、发生了哪些变化，以及哪些确定性核验有证据。",
      p2: "它不会判断任务是否困难、新颖、有用、设计良好或值得购买。这些判断由研究员完成。",
    },
    criteria: [
      ["可比较的轨迹", "每项任务至少包含 M3 和指定前沿参考系统各四条完整轨迹，并附模型与运行框架元数据。"],
      ["奖励基线", "重复运行金标准稳定返回 1，重复运行未修改环境稳定返回 0。"],
      ["公开依赖重建", "Dockerfile 无需私有基础镜像或不可访问的依赖即可重建。"],
      ["金标准解答", "包含金标准解答或与任务类型相适配的标准交付物。"],
      ["容器内执行", "解答和测试脚本可以在环境内部运行，不依赖未声明的宿主数据或变量。"],
      ["明确的评测设置", "评测前已记录通过率和轮次目标。"],
      ["可移植格式", "优先使用 Harbor。其他格式也可以保留，但必须记录其来源结构和映射状态。"],
    ],
    status: {
      received: "已接收",
      normalizing: "标准化中",
      checking: "核验中",
      needs_vendor_fix: "待供应商修复",
      ready_for_research: "可供研究",
      superseded: "已被替代",
      quarantined: "已隔离",
    },
    fetch: {
      not_requested: "未抓取",
      queued: "等待抓取",
      fetching: "抓取中",
      snapshotted: "快照已保存",
      external_only: "仅外部链接",
      blocked: "抓取受阻",
      failed: "抓取失败",
    },
    parse: {
      not_requested: "未解析",
      queued: "等待解析",
      parsing: "解析中",
      parsed: "已解析",
      partial: "部分解析",
      blocked: "解析受阻",
      failed: "解析失败",
    },
    role: { primary: "主要提交", supplement: "补充提交", correction: "修订", metadata: "元数据", other: "其他" },
  },
  en: {
    vendors: "Vendors",
    search: "Search vendors, submissions, categories, and tasks",
    language: "中",
    languageLabel: "切换至中文",
    accountLabel: "Researcher account",
    signOut: "Sign out",
    title: "Environment & Task Samples",
    stats: { vendors: "vendors", submissions: "submissions", tasks: "task versions" },
    vendor: "Vendor",
    submission: "submission",
    submissions: "submissions",
    records: "records",
    taskRecords: "task records",
    history: "Submission history",
    historyNote: "Each delivery—or dated observation CASE makes of a continuously maintained source—is retained as a submission record. Deltas describe content changes, never research quality.",
    newest: "Newest first",
    latest: "Latest submission",
    taskCategories: "Task categories",
    category: "category",
    categories: "categories",
    noTasks: "Task records not yet normalized",
    originalSources: "Original sources",
    sourceNote: "Live links are preserved alongside CASE's captured copies when available.",
    sourceRecord: "source record",
    sourceRecords: "source records",
    noSource: "No original source linked yet",
    legacySource: "This submission predates source-level intake. Its original message, links, and files have not yet been attached.",
    noLinks: "No linked files or URLs recorded.",
    senderUnknown: "Sender not recorded",
    openOriginal: "Open original record",
    messageSnapshot: "Download message snapshot",
    viewSource: "Open live source",
    downloadSnapshot: "Download captured copy",
    mutable: "mutable source",
    captured: "captured",
    delta: { retained: "retained", added: "added", removed: "removed", changedFiles: "files differ" },
    searchEmpty: { eyebrow: "SEARCH", title: "No matching samples", body: "Try a vendor, submission, category, or task name." },
    loading: { eyebrow: "CASE CATALOG", title: "Loading registry…", body: "Fetching the current vendor, submission, task, and check records from CASE." },
    unavailable: { eyebrow: "CASE CATALOG", title: "Registry unavailable", fallback: "The shared catalog could not be loaded.", tail: "No cached vendor data is shown because 小环境 is not a source of truth." },
    checks: {
      eyebrow: "RECORDED EVIDENCE",
      title: "Deterministic checks",
      note: "Only results recorded by CASE are shown. They are not quality scores or acceptance decisions.",
      none: "No check results recorded",
      pass: "pass",
      fail: "fail",
      blocked: "blocked",
      notRun: "not run",
    },
    criteriaIntro: {
      eyebrow: "CURRENT INTAKE CONTRACT",
      title: "Intake criteria",
      note: "These are the currently documented intake conditions, not judgments of research quality.",
      count: "7 criteria",
      boundary: "Interpretation boundary",
      p1: "A record says what was delivered, what changed, and which deterministic checks have evidence.",
      p2: "It does not say whether a task is difficult, novel, useful, well-designed, or worth purchasing. Researchers make those judgments.",
    },
    criteria: [
      ["Comparable trajectories", "At least four complete trajectories per task from M3 and four from the declared frontier reference system, with model and harness metadata."],
      ["Reward baselines", "Repeated gold runs return 1 and repeated untouched runs return 0."],
      ["Public rebuild", "The Dockerfile rebuilds without a private base image or inaccessible dependency."],
      ["Gold solution", "A gold solution or task-appropriate golden deliverable is included."],
      ["Container-local execution", "Solution and test scripts run inside the environment without undeclared host data or variables."],
      ["Declared evaluation settings", "Pass-rate and turn-count targets are recorded before evaluation."],
      ["Portable format", "Harbor is preferred. Other formats remain visible when their source structure and mapping status are documented."],
    ],
    status: {
      received: "Received",
      normalizing: "Normalizing",
      checking: "Checking",
      needs_vendor_fix: "Needs vendor fix",
      ready_for_research: "Ready for research",
      superseded: "Superseded",
      quarantined: "Quarantined",
    },
    fetch: {
      not_requested: "Not fetched",
      queued: "Fetch queued",
      fetching: "Fetching",
      snapshotted: "Snapshot saved",
      external_only: "External link",
      blocked: "Fetch blocked",
      failed: "Fetch failed",
    },
    parse: {
      not_requested: "Not parsed",
      queued: "Parse queued",
      parsing: "Parsing",
      parsed: "Parsed",
      partial: "Partly parsed",
      blocked: "Parse blocked",
      failed: "Parse failed",
    },
    role: { primary: "Primary", supplement: "Supplement", correction: "Correction", metadata: "Metadata", other: "Other" },
  },
};

type UiCopy = (typeof copy)[Language];

export default function PortalClient({ user }: { user: PortalUser }) {
  const [catalog, setCatalog] = useState<CatalogSnapshot | null>(null);
  const [catalogState, setCatalogState] = useState<"loading" | "ready" | "unavailable">("loading");
  const [unavailableReason, setUnavailableReason] = useState<string>();
  const [language, setLanguage] = useState<Language>("zh");
  const [selectedVendorId, setSelectedVendorId] = useState("");
  const [query, setQuery] = useState("");
  const [expandedBatches, setExpandedBatches] = useState<Set<string>>(new Set());
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const vendors = useMemo(() => catalog?.vendors ?? [], [catalog]);
  const t = copy[language];

  useEffect(() => {
    document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
  }, [language]);

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
    setExpandedBatches(new Set());
    setExpandedTasks(new Set());
  }

  function toggleBatch(batchId: string) {
    setExpandedBatches((current) => {
      const next = new Set(current);
      if (next.has(batchId)) next.delete(batchId); else next.add(batchId);
      return next;
    });
  }

  function toggleTask(taskId: string) {
    setExpandedTasks((current) => {
      const next = new Set(current);
      if (next.has(taskId)) next.delete(taskId); else next.add(taskId);
      return next;
    });
  }

  function toggleLanguage() {
    const next = language === "zh" ? "en" : "zh";
    setLanguage(next);
  }

  return <div className="app-shell">
    <header className="global-header">
      <a className="wordmark" href="#top"><strong>小环境</strong></a>
      <div className="header-tools">
        <label className="global-search"><span aria-hidden="true">⌕</span><input aria-label={t.search} onChange={(event) => setQuery(event.target.value)} placeholder={t.search} value={query} /></label>
        <button aria-label={t.languageLabel} className="language-switch" onClick={toggleLanguage} type="button">{t.language}</button>
        <details className="account-menu">
          <summary aria-label={t.accountLabel} className="avatar">
            {user.avatarUrl ? <Image alt="" height={38} src={user.avatarUrl} unoptimized width={38} /> : user.name.slice(0, 1).toUpperCase()}
          </summary>
          <div className="account-popover"><strong>{user.name}</strong><a href="/auth/logout">{t.signOut}</a></div>
        </details>
      </div>
    </header>

    <main id="top">
      <section className="registry-header">
        <h1>{t.title}</h1>
        <div className="registry-stats">
          <span><strong>{catalog?.totals.vendors ?? "—"}</strong>{t.stats.vendors}</span>
          <span><strong>{catalog?.totals.batches ?? "—"}</strong>{t.stats.submissions}</span>
          <span><strong>{catalog?.totals.taskVersions ?? "—"}</strong>{t.stats.tasks}</span>
        </div>
      </section>

      <div className="page-body">
        {catalogState === "loading" && <StateCard value={t.loading} />}
        {catalogState === "unavailable" && <StateCard value={{ ...t.unavailable, body: `${unavailableReason ?? t.unavailable.fallback} ${t.unavailable.tail}` }} />}
        {catalogState === "ready" && selectedVendor && <VendorView matchingVendors={matchingVendors} selectedVendor={selectedVendor} expandedBatches={expandedBatches} expandedTasks={expandedTasks} onSelect={selectVendor} onToggleBatch={toggleBatch} onToggleTask={toggleTask} t={t} language={language} />}
        {catalogState === "ready" && !selectedVendor && <StateCard value={t.searchEmpty} />}
      </div>
    </main>
  </div>;
}

function VendorView({ matchingVendors, selectedVendor, expandedBatches, expandedTasks, onSelect, onToggleBatch, onToggleTask, t, language }: {
  matchingVendors: CatalogVendor[];
  selectedVendor: CatalogVendor;
  expandedBatches: Set<string>;
  expandedTasks: Set<string>;
  onSelect(vendor: CatalogVendor): void;
  onToggleBatch(batchId: string): void;
  onToggleTask(taskId: string): void;
  t: UiCopy;
  language: Language;
}) {
  const records = selectedVendor.batches.reduce((sum, batch) => sum + batch.taskCount, 0);
  return <div className="portal-grid">
    <aside className="vendor-sidebar" aria-label={t.vendors}>
      <div className="sidebar-head"><strong>{t.vendors}</strong><span>{matchingVendors.length}</span></div>
      <div className="vendor-list">
        {matchingVendors.map((vendor) => {
          const count = vendor.batches.reduce((sum, batch) => sum + batch.taskCount, 0);
          return <button className={selectedVendor.id === vendor.id ? "active" : ""} key={vendor.id} onClick={() => onSelect(vendor)} type="button"><span><strong>{vendor.name}</strong><small>{vendor.batches.length} {vendor.batches.length === 1 ? t.submission : t.submissions} · {count} {t.records}</small></span></button>;
        })}
        {matchingVendors.length === 0 && <div className="sidebar-empty">{t.searchEmpty.title}</div>}
      </div>
    </aside>

    <section className="vendor-main" aria-labelledby="vendor-name">
      <header className="vendor-profile"><div><div className="vendor-kicker">{t.vendor}</div><h2 id="vendor-name">{selectedVendor.name}</h2><p>{selectedVendor.description}</p><div className="vendor-meta"><span>{selectedVendor.batches.length} {selectedVendor.batches.length === 1 ? t.submission : t.submissions}</span><span>{records} {t.taskRecords}</span><span>{selectedVendor.batches.at(-1)?.date} — {selectedVendor.batches[0]?.date}</span></div></div></header>
      <section className="submission-history" aria-labelledby="history-title">
        <div className="section-title"><div><h3 id="history-title">{t.history}</h3><p>{t.historyNote}</p></div><span>{t.newest}</span></div>
        <div className="batch-list">{selectedVendor.batches.map((batch, index) => <BatchCard batch={batch} expandedTasks={expandedTasks} isExpanded={expandedBatches.has(batch.id)} isLatest={index === 0} key={batch.id} onToggle={() => onToggleBatch(batch.id)} onToggleTask={onToggleTask} t={t} language={language} />)}</div>
      </section>
    </section>
  </div>;
}

function BatchCard({ batch, expandedTasks, isExpanded, isLatest, onToggle, onToggleTask, t, language }: { batch: CatalogBatch; expandedTasks: Set<string>; isExpanded: boolean; isLatest: boolean; onToggle(): void; onToggleTask(taskId: string): void; t: UiCopy; language: Language }) {
  return <article className="batch-card">
    <button aria-expanded={isExpanded} className="batch-summary" onClick={onToggle} type="button">
      <span className="batch-date"><strong>{batch.date}</strong>{isLatest && <small>{t.latest}</small>}</span>
      <span className="batch-name"><strong>{batch.label}</strong><code>{batch.source}</code></span>
      <span className="batch-count"><strong>{batch.taskCount}</strong><small>{t.taskRecords}</small></span>
      <span className="format-stack">{batch.formats.map((format) => <i key={format}>{format}</i>)}</span>
      <StatusBadge status={batch.workflowStatus} label={t.status[batch.workflowStatus]} />
      <span className="disclosure">{isExpanded ? "−" : "+"}</span>
    </button>

    {isExpanded && <div className="batch-body">
      <div className="delta-block"><div className="delta-grid">{batch.delta.retained !== undefined && <span><strong>{batch.delta.retained}</strong><small>{t.delta.retained}</small></span>}<span><strong>{batch.delta.added}</strong><small>{t.delta.added}</small></span><span><strong>{batch.delta.removed}</strong><small>{t.delta.removed}</small></span>{batch.delta.changedFiles !== undefined && <span><strong>{batch.delta.changedFiles}</strong><small>{t.delta.changedFiles}</small></span>}</div><p>{batch.delta.note}</p></div>
      <div className="batch-section-head"><h4>{t.taskCategories}</h4><span>{batch.categories.length} {batch.categories.length === 1 ? t.category : t.categories}</span></div>
      <div className="category-table">{batch.categories.map((category) => <section key={category.id} className="category-row"><span className="category-count">{category.count}</span><span className="category-copy"><strong>{category.name}</strong><small>{category.description}</small></span><div className="task-list">{category.tasks.length ? category.tasks.map((task) => <TaskRow isExpanded={expandedTasks.has(task.id)} key={task.id} onToggle={() => onToggleTask(task.id)} task={task} t={t} />) : <span className="empty-task-list">{t.noTasks}</span>}</div></section>)}</div>
      <SubmissionSources sourceEvents={batch.sourceEvents ?? []} t={t} language={language} />
    </div>}
  </article>;
}

function SubmissionSources({ sourceEvents, t, language }: { sourceEvents: CatalogSourceEvent[]; t: UiCopy; language: Language }) {
  if (!sourceEvents.length) return <><div className="batch-section-head"><h4>{t.originalSources}</h4><span>{t.noSource}</span></div><div className="source-empty">{t.legacySource}</div></>;
  return <>
    <div className="batch-section-head"><h4>{t.originalSources}</h4><span>{sourceEvents.length} {sourceEvents.length === 1 ? t.sourceRecord : t.sourceRecords}</span></div>
    <p className="source-note">{t.sourceNote}</p>
    <div className="source-events">{sourceEvents.map((event) => <SourceEvent key={event.id} event={event} t={t} language={language} />)}</div>
  </>;
}

function SourceEvent({ event, t, language }: { event: CatalogSourceEvent; t: UiCopy; language: Language }) {
  const originalUrl = safeExternalUrl(event.externalRef);
  return <section className="source-event">
    <header className="source-event-head">
      <span className="source-channel">{event.role ? t.role[event.role] : event.channel.replace("_", " ")}</span>
      <span><strong>{event.sender ?? t.senderUnknown}</strong><small>{formatTimestamp(event.receivedAt, language)}</small>{originalUrl && <code className="source-locator" title={originalUrl}>{formatSourceLocator(originalUrl)}</code>}</span>
      <span className="source-actions">{originalUrl && <a href={originalUrl} rel="noreferrer" target="_blank">{t.openOriginal}</a>}{event.rawArtifactId && <a href={`/api/artifacts/${encodeURIComponent(event.rawArtifactId)}/download`}>{t.messageSnapshot}</a>}</span>
    </header>
    <div className="source-items">{event.items.length ? event.items.map((item) => <SourceItem key={item.id} item={item} t={t} language={language} />) : <div className="source-empty">{t.noLinks}</div>}</div>
  </section>;
}

function SourceItem({ item, t, language }: { item: CatalogSourceItem; t: UiCopy; language: Language }) {
  const originalUrl = safeExternalUrl(item.locator);
  const captured = item.capturedAt ? ` · ${t.captured} ${formatTimestamp(item.capturedAt, language)}` : "";
  return <div className="source-item">
    <span className="source-kind">{item.kind.replace("_", " ")}</span>
    <span className="source-name"><strong>{item.displayName}</strong><small>{t.fetch[item.fetchStatus as SourceFetchStatus]} · {t.parse[item.parseStatus as SourceParseStatus]}{item.mutable ? ` · ${t.mutable}` : ""}{captured}</small>{originalUrl && <code className="source-locator" title={originalUrl}>{formatSourceLocator(originalUrl)}</code>}</span>
    <span className="source-actions">{originalUrl && <a href={originalUrl} rel="noreferrer" target="_blank">{t.viewSource}</a>}{item.artifactId && <a href={`/api/artifacts/${encodeURIComponent(item.artifactId)}/download`}>{t.downloadSnapshot}</a>}</span>
  </div>;
}

function TaskRow({ task, isExpanded, onToggle, t }: { task: CatalogTask; isExpanded: boolean; onToggle(): void; t: UiCopy }) {
  const checks = task.checks.pass + task.checks.fail + task.checks.blocked + task.checks.notRun;
  return <article className={`task-card${isExpanded ? " expanded" : ""}`}>
    <button aria-expanded={isExpanded} className="task-row" onClick={onToggle} type="button"><span><strong>{task.title}</strong><small>{task.format}{task.summary ? ` · ${task.summary}` : ""}</small></span><span className="task-checks">{checks ? `${task.checks.pass} ${t.checks.pass} · ${task.checks.fail} ${t.checks.fail} · ${task.checks.blocked} ${t.checks.blocked}` : t.checks.none}</span><StatusBadge status={task.workflowStatus} label={t.status[task.workflowStatus]} /><span className="task-disclosure">{isExpanded ? "−" : "+"}</span></button>
    {isExpanded && <div className="task-details">
      <section className="task-evidence"><p className="detail-kicker">{t.checks.eyebrow}</p><h5>{t.checks.title}</h5><p>{t.checks.note}</p><div className="check-counts"><span><strong>{task.checks.pass}</strong>{t.checks.pass}</span><span><strong>{task.checks.fail}</strong>{t.checks.fail}</span><span><strong>{task.checks.blocked}</strong>{t.checks.blocked}</span><span><strong>{task.checks.notRun}</strong>{t.checks.notRun}</span></div></section>
      <section className="task-criteria"><p className="detail-kicker">{t.criteriaIntro.eyebrow}</p><h5>{t.criteriaIntro.title}</h5><p>{t.criteriaIntro.note}</p><ol>{t.criteria.map(([title, text], index) => <li key={title}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{title}</strong><small>{text}</small></div></li>)}</ol></section>
    </div>}
  </article>;
}

function StatusBadge({ status, label }: { status: WorkflowStatus; label: string }) {
  return <span className={`status-badge status-${status}`}>{label}</span>;
}

function StateCard({ value }: { value: { eyebrow: string; title: string; body: string } }) {
  return <section className="state-card"><p className="eyebrow">{value.eyebrow}</p><h2>{value.title}</h2><p>{value.body}</p></section>;
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

function formatTimestamp(value: string, language: Language) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? value : new Intl.DateTimeFormat(language === "zh" ? "zh-CN" : "en", { dateStyle: "medium", timeStyle: "short" }).format(parsed);
}

function formatSourceLocator(value: string) {
  const url = new URL(value);
  const path = `${url.pathname}${url.search}`;
  return `${url.hostname}${path === "/" ? "" : path}`;
}
