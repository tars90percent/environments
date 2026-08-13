"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import type { CatalogBatch, CatalogSnapshot, CatalogSourceEvent, CatalogSourceItem, CatalogTask, CatalogVendor, SourceFetchStatus, SourceParseStatus, SubmissionReview, SubmissionReviewScope, SubmissionReviewSignal, WorkflowStatus } from "./catalog";

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
    sampleFiles: "个样本文件",
    declaredTasks: "个申报任务",
    noSamples: "尚无样本",
    noSubmissions: "CASE 尚未记录这家供应商的样本提交。原始联系与来源历史仍由 CASE 保留。",
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
    response: {
      title: "研究反馈",
      note: "反馈以本次提交为单位保存。若意见只针对部分任务类别，可以缩小范围。",
      interested: "有意采购完整数据集",
      needsRevision: "修改后再看",
      notInterested: "不感兴趣",
      commentOnly: "仅留言",
      wholeSubmission: "整次提交",
      selectedCategories: "指定任务类别",
      chooseCategories: "选择适用的任务类别",
      commentLabel: "说明",
      commentOptional: "表达采购兴趣时可选；其他反馈需要说明。",
      commentPlaceholder: "哪些地方有价值、缺少什么，或供应商需要修改什么？",
      submit: "提交反馈",
      submitting: "正在提交…",
      saved: "反馈已保存。",
      history: "已有反馈",
      none: "尚无研究员反馈",
      loadError: "暂时无法载入反馈。",
      submitError: "暂时无法保存反馈。",
      categoryRequired: "请至少选择一个任务类别。",
      commentRequired: "请补充说明。",
      scopedTo: "适用于",
      signals: { interested: "有意采购", needs_revision: "需要修改", not_interested: "不感兴趣", comment: "留言" },
    },
    delta: { retained: "保留", added: "新增", removed: "移除", changedFiles: "文件变化" },
    searchEmpty: { eyebrow: "搜索", title: "没有匹配的样本", body: "请尝试供应商、提交记录、类别或任务名称。" },
    loading: { eyebrow: "CASE 目录", title: "正在载入样本库…", body: "正在从 CASE 获取最新的供应商、提交记录、任务与核验记录。" },
    unavailable: { eyebrow: "CASE 目录", title: "样本库暂不可用", fallback: "暂时无法载入共享目录。", tail: "小环境不会展示缓存的供应商数据，因为它不是事实来源。" },
    checks: {
      none: "没有已记录的核验结果",
      pass: "通过",
      fail: "失败",
      blocked: "受阻",
      notRun: "未运行",
    },
    status: {
      unchecked: "未核验",
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
    sampleFiles: "sample files",
    declaredTasks: "declared tasks",
    noSamples: "no samples yet",
    noSubmissions: "CASE has not recorded a sample submission from this vendor yet. Its contact and source history is still retained by CASE.",
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
    response: {
      title: "Researcher response",
      note: "Responses are recorded at the submission level. Narrow the scope only when your feedback applies to particular task categories.",
      interested: "Interested in the full set",
      needsRevision: "Revisit after changes",
      notInterested: "Not interested",
      commentOnly: "Comment only",
      wholeSubmission: "Entire submission",
      selectedCategories: "Selected task categories",
      chooseCategories: "Choose the categories this applies to",
      commentLabel: "Comment",
      commentOptional: "Optional when signaling interest; required for every other response.",
      commentPlaceholder: "What is valuable, what is missing, or what should the vendor change?",
      submit: "Submit response",
      submitting: "Submitting…",
      saved: "Response saved.",
      history: "Recorded responses",
      none: "No researcher responses yet",
      loadError: "Responses could not be loaded right now.",
      submitError: "Your response could not be saved right now.",
      categoryRequired: "Select at least one task category.",
      commentRequired: "Add a comment for this response.",
      scopedTo: "Applies to",
      signals: { interested: "Interested", needs_revision: "Needs revision", not_interested: "Not interested", comment: "Comment" },
    },
    delta: { retained: "retained", added: "added", removed: "removed", changedFiles: "files differ" },
    searchEmpty: { eyebrow: "SEARCH", title: "No matching samples", body: "Try a vendor, submission, category, or task name." },
    loading: { eyebrow: "CASE CATALOG", title: "Loading registry…", body: "Fetching the current vendor, submission, task, and check records from CASE." },
    unavailable: { eyebrow: "CASE CATALOG", title: "Registry unavailable", fallback: "The shared catalog could not be loaded.", tail: "No cached vendor data is shown because 小环境 is not a source of truth." },
    checks: {
      none: "No check results recorded",
      pass: "pass",
      fail: "fail",
      blocked: "blocked",
      notRun: "not run",
    },
    status: {
      unchecked: "Unchecked",
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
  }

  function toggleBatch(batchId: string) {
    setExpandedBatches((current) => {
      const next = new Set(current);
      if (next.has(batchId)) next.delete(batchId); else next.add(batchId);
      return next;
    });
  }

  function toggleLanguage() {
    const next = language === "zh" ? "en" : "zh";
    setLanguage(next);
  }

  return <div className="app-shell">
    <header className="global-header">
      <a aria-label="小环境" className="wordmark" href="#top"><Image alt="" height={40} priority src="/favicon.png" width={40} /></a>
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
        {catalogState === "ready" && selectedVendor && <VendorView matchingVendors={matchingVendors} selectedVendor={selectedVendor} expandedBatches={expandedBatches} onSelect={selectVendor} onToggleBatch={toggleBatch} t={t} language={language} />}
        {catalogState === "ready" && !selectedVendor && <StateCard value={t.searchEmpty} />}
      </div>
    </main>
  </div>;
}

function VendorView({ matchingVendors, selectedVendor, expandedBatches, onSelect, onToggleBatch, t, language }: {
  matchingVendors: CatalogVendor[];
  selectedVendor: CatalogVendor;
  expandedBatches: Set<string>;
  onSelect(vendor: CatalogVendor): void;
  onToggleBatch(batchId: string): void;
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
          const sampleFiles = vendor.batches.reduce((sum, batch) => sum + (batch.taskCount === 0 ? batch.delta.changedFiles ?? 0 : 0), 0);
          const inventory = count > 0 ? `${count} ${t.records}` : sampleFiles > 0 ? `${sampleFiles} ${t.sampleFiles}` : t.noSamples;
          return <button className={selectedVendor.id === vendor.id ? "active" : ""} key={vendor.id} onClick={() => onSelect(vendor)} type="button"><span><strong>{vendor.name}</strong><small>{vendor.batches.length} {vendor.batches.length === 1 ? t.submission : t.submissions} · {inventory}</small></span></button>;
        })}
        {matchingVendors.length === 0 && <div className="sidebar-empty">{t.searchEmpty.title}</div>}
      </div>
    </aside>

    <section className="vendor-main" aria-labelledby="vendor-name">
      <header className="vendor-profile"><div><div className="vendor-kicker">{t.vendor}</div><h2 id="vendor-name">{selectedVendor.name}</h2><p>{selectedVendor.description}</p><div className="vendor-meta"><span>{selectedVendor.batches.length} {selectedVendor.batches.length === 1 ? t.submission : t.submissions}</span><span>{records} {t.taskRecords}</span>{selectedVendor.batches.length > 0 && <span>{selectedVendor.batches.at(-1)?.date} — {selectedVendor.batches[0]?.date}</span>}</div></div></header>
      <section className="submission-history" aria-labelledby="history-title">
        <div className="section-title"><div><h3 id="history-title">{t.history}</h3><p>{t.historyNote}</p></div><span>{t.newest}</span></div>
        <div className="batch-list">{selectedVendor.batches.length ? selectedVendor.batches.map((batch, index) => <BatchCard batch={batch} isExpanded={expandedBatches.has(batch.id)} isLatest={index === 0} key={batch.id} onToggle={() => onToggleBatch(batch.id)} t={t} language={language} />) : <div className="submission-empty">{t.noSubmissions}</div>}</div>
      </section>
    </section>
  </div>;
}

function BatchCard({ batch, isExpanded, isLatest, onToggle, t, language }: { batch: CatalogBatch; isExpanded: boolean; isLatest: boolean; onToggle(): void; t: UiCopy; language: Language }) {
  return <article className="batch-card">
    <button aria-expanded={isExpanded} className="batch-summary" onClick={onToggle} type="button">
      <span className="batch-date"><strong>{batch.date}</strong>{isLatest && <small>{t.latest}</small>}</span>
      <span className="batch-name"><strong>{batch.label}</strong><code>{batch.source}</code></span>
      <span className="batch-count"><strong>{batch.taskCount || batch.delta.changedFiles || batch.declaredTaskCount || 0}</strong><small>{batch.taskCount ? t.taskRecords : batch.delta.changedFiles ? t.sampleFiles : t.declaredTasks}</small></span>
      <span className="format-stack">{batch.formats.map((format) => <i key={format}>{format}</i>)}</span>
      <StatusBadge status={batch.workflowStatus} label={t.status[batch.workflowStatus]} />
      <span aria-hidden="true" className="disclosure">{isExpanded ? "▴" : "▾"}</span>
    </button>

    {isExpanded && <div className="batch-body">
      <div className="delta-block"><div className="delta-grid">{batch.delta.retained !== undefined && <span><strong>{batch.delta.retained}</strong><small>{t.delta.retained}</small></span>}<span><strong>{batch.delta.added}</strong><small>{t.delta.added}</small></span><span><strong>{batch.delta.removed}</strong><small>{t.delta.removed}</small></span>{batch.delta.changedFiles !== undefined && <span><strong>{batch.delta.changedFiles}</strong><small>{t.delta.changedFiles}</small></span>}</div><p>{batch.delta.note}</p></div>
      <div className="batch-section-head"><h4>{t.taskCategories}</h4><span>{batch.categories.length} {batch.categories.length === 1 ? t.category : t.categories}</span></div>
      <div className="category-table">{batch.categories.map((category) => <section key={category.id} className="category-row"><span className="category-count">{category.count}</span><span className="category-copy"><strong>{category.name}</strong><small>{category.description}</small></span><div className="task-list">{category.tasks.length ? category.tasks.map((task) => <TaskRow key={task.id} task={task} t={t} />) : <span className="empty-task-list">{t.noTasks}</span>}</div></section>)}</div>
      <SubmissionSources sourceEvents={batch.sourceEvents ?? []} t={t} language={language} />
      <SubmissionReviewPanel batch={batch} t={t} language={language} />
    </div>}
  </article>;
}

function SubmissionReviewPanel({ batch, t, language }: { batch: CatalogBatch; t: UiCopy; language: Language }) {
  const [reviews, setReviews] = useState<SubmissionReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [signal, setSignal] = useState<SubmissionReviewSignal>("interested");
  const [scope, setScope] = useState<SubmissionReviewScope>("submission");
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<{ kind: "error" | "success"; text: string }>();

  useEffect(() => {
    let active = true;
    void fetch(`/api/submissions/${encodeURIComponent(batch.id)}/reviews`, { headers: { accept: "application/json" }, cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        return await response.json() as { reviews: SubmissionReview[] };
      })
      .then((payload) => { if (active) setReviews(payload.reviews); })
      .catch(() => { if (active) setNotice({ kind: "error", text: t.response.loadError }); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [batch.id, t.response.loadError]);

  function toggleCategory(categoryId: string) {
    setCategoryIds((current) => current.includes(categoryId) ? current.filter((id) => id !== categoryId) : [...current, categoryId]);
  }

  async function submitReview() {
    setNotice(undefined);
    if (scope === "categories" && !categoryIds.length) {
      setNotice({ kind: "error", text: t.response.categoryRequired });
      return;
    }
    if (signal !== "interested" && !comment.trim()) {
      setNotice({ kind: "error", text: t.response.commentRequired });
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch(`/api/submissions/${encodeURIComponent(batch.id)}/reviews`, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ signal, scope, categoryIds: scope === "categories" ? categoryIds : [], comment: comment.trim() }),
      });
      const payload = await response.json() as { review?: SubmissionReview; message?: string };
      if (!response.ok || !payload.review) throw new Error(payload.message);
      setReviews((current) => [payload.review!, ...current]);
      setComment("");
      setNotice({ kind: "success", text: t.response.saved });
    } catch {
      setNotice({ kind: "error", text: t.response.submitError });
    } finally {
      setSubmitting(false);
    }
  }

  return <section className="review-panel" aria-labelledby={`review-${batch.id}`}>
    <div className="review-heading">
      <div><h4 id={`review-${batch.id}`}>{t.response.title}</h4><p>{t.response.note}</p></div>
      <span>{loading ? "…" : `${reviews.length}`}</span>
    </div>
    <div className="review-form">
      <div className="signal-options" role="group" aria-label={t.response.title}>
        {([
          ["interested", t.response.interested],
          ["needs_revision", t.response.needsRevision],
          ["not_interested", t.response.notInterested],
          ["comment", t.response.commentOnly],
        ] as const).map(([value, label]) => <button aria-pressed={signal === value} className={signal === value ? "active" : ""} key={value} onClick={() => setSignal(value)} type="button">{label}</button>)}
      </div>
      <div className="scope-options" role="group" aria-label={t.response.scopedTo}>
        <button aria-pressed={scope === "submission"} className={scope === "submission" ? "active" : ""} onClick={() => setScope("submission")} type="button">{t.response.wholeSubmission}</button>
        <button aria-pressed={scope === "categories"} className={scope === "categories" ? "active" : ""} onClick={() => setScope("categories")} type="button">{t.response.selectedCategories}</button>
      </div>
      {scope === "categories" && <fieldset className="category-options"><legend>{t.response.chooseCategories}</legend>{batch.categories.map((category) => <label key={category.id}><input checked={categoryIds.includes(category.id)} onChange={() => toggleCategory(category.id)} type="checkbox" /><span>{category.name}</span></label>)}</fieldset>}
      <div className="review-comment"><span><strong>{t.response.commentLabel}</strong><small>{t.response.commentOptional}</small></span><textarea aria-label={t.response.commentLabel} maxLength={5000} onChange={(event) => setComment(event.target.value)} placeholder={t.response.commentPlaceholder} rows={3} value={comment} /></div>
      <div className="review-submit"><button disabled={submitting} onClick={() => void submitReview()} type="button">{submitting ? t.response.submitting : t.response.submit}</button>{notice && <span className={notice.kind}>{notice.text}</span>}</div>
    </div>
    <div className="review-history">
      <div className="review-history-head"><strong>{t.response.history}</strong></div>
      {!loading && !reviews.length && <p className="review-empty">{t.response.none}</p>}
      {reviews.map((review) => {
        const categoryNames = batch.categories.filter((category) => review.categoryIds.includes(category.id)).map((category) => category.name);
        return <article className="review-record" key={review.id}>
          <header><span className={`review-signal signal-${review.signal}`}>{t.response.signals[review.signal]}</span><strong>{review.reviewer.name}</strong><time>{formatTimestamp(review.createdAt, language)}</time></header>
          {review.scope === "categories" && <small>{t.response.scopedTo}: {categoryNames.join(", ")}</small>}
          {review.comment && <p>{review.comment}</p>}
        </article>;
      })}
    </div>
  </section>;
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

function TaskRow({ task, t }: { task: CatalogTask; t: UiCopy }) {
  const checks = task.checks.pass + task.checks.fail + task.checks.blocked + task.checks.notRun;
  return <div className="task-row"><span><strong>{task.title}</strong><small>{task.format}{task.summary ? ` · ${task.summary}` : ""}</small></span><span className="task-checks">{checks ? `${task.checks.pass} ${t.checks.pass} · ${task.checks.fail} ${t.checks.fail} · ${task.checks.blocked} ${t.checks.blocked}` : t.checks.none}</span><StatusBadge status={task.workflowStatus} label={t.status[task.workflowStatus]} /></div>;
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
