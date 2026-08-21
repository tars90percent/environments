"use client";

import Image from "next/image";
import { useEffect, useMemo, useState, type FormEvent } from "react";
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
    upload: "Upload submission",
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
    noSubmissions: "No submissions recorded.",
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
    loading: "Loading CASE records…",
    unavailable: "CASE records are unavailable. The portal does not keep a separate copy.",
    noMatch: "No matching records.",
    signOut: "Sign out",
    uploadForm: {
      title: "Upload a vendor submission",
      note: "The original file and arrival details will be preserved in CASE.",
      vendor: "Vendor",
      label: "Submission label",
      file: "Original file",
      comment: "Arrival note (optional)",
      commentPlaceholder: "Where this came from or any capture context",
      choose: "Choose a file or archive, up to 250 MB",
      submit: "Preserve submission",
      hashing: "Checking file…",
      uploading: "Preserving submission…",
      saved: "Submission preserved.",
      error: "The submission could not be preserved.",
      required: "Choose a vendor, label, and file.",
      close: "Close",
    },
  },
  zh: {
    eyebrow: "CASE 样本库",
    title: "环境与任务样本",
    search: "搜索供应商、提交记录或任务",
    upload: "上传提交",
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
    noSubmissions: "尚无提交记录。",
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
    loading: "正在载入 CASE 记录…",
    unavailable: "CASE 记录暂不可用。小环境不保存另一份副本。",
    noMatch: "没有匹配的记录。",
    signOut: "退出登录",
    uploadForm: {
      title: "上传供应商提交",
      note: "原始文件及其到达信息会原样保存在 CASE。",
      vendor: "供应商",
      label: "提交名称",
      file: "原始文件",
      comment: "到达说明（可选）",
      commentPlaceholder: "来源或与接收有关的背景",
      choose: "选择文件或压缩包，最大 250 MB",
      submit: "保存提交",
      hashing: "正在校验文件…",
      uploading: "正在保存提交…",
      saved: "提交已保存。",
      error: "暂时无法保存这次提交。",
      required: "请选择供应商、填写名称并选择文件。",
      close: "关闭",
    },
  },
} as const;

const phaseLabels: Record<HarborCheckPhase, string> = {
  build: "Build",
  boot: "Boot",
  oracle: "Oracle",
  nop: "Nop",
};

export default function PortalClient({ user, initialCatalog, localPreview = false }: { user: PortalUser; initialCatalog?: CatalogSnapshot; localPreview?: boolean }) {
  const [catalog, setCatalog] = useState<CatalogSnapshot | null>(initialCatalog ?? null);
  const [state, setState] = useState<"loading" | "ready" | "unavailable">(initialCatalog ? "ready" : "loading");
  const [language, setLanguage] = useState<Language>("zh");
  const [query, setQuery] = useState("");
  const [selectedVendorId, setSelectedVendorId] = useState(initialCatalog?.vendors.find((vendor) => vendor.submissions.length)?.id ?? initialCatalog?.vendors[0]?.id ?? "");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [revision, setRevision] = useState(0);
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
        setSelectedVendorId((current) => snapshot.vendors.some((vendor) => vendor.id === current)
          ? current
          : snapshot.vendors.find((vendor) => vendor.submissions.length)?.id ?? snapshot.vendors[0]?.id ?? "");
        setState("ready");
      })
      .catch(() => { if (active) setState("unavailable"); });
    return () => { active = false; };
  }, [initialCatalog, revision]);

  const vendors = useMemo(() => catalog?.vendors ?? [], [catalog]);
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
        <button className="upload-trigger" onClick={() => setUploadOpen(true)} type="button">{t.upload}</button>
        <button className="language-switch" onClick={() => setLanguage(language === "zh" ? "en" : "zh")} type="button">{language === "zh" ? "EN" : "中"}</button>
        <details className="account-menu"><summary className="avatar">{user.avatarUrl ? <Image alt="" height={38} src={user.avatarUrl} unoptimized width={38} /> : user.name.slice(0, 1).toUpperCase()}</summary><div className="account-popover"><strong>{user.name}</strong><a href="/auth/logout">{t.signOut}</a></div></details>
      </div>
    </header>

    <main id="top">
    <section className="registry-header">
      <div className="eyebrow">{t.eyebrow}</div>
      <h1>{t.title}</h1>
      <div className="registry-stats">
        <Stat label={t.vendors} value={catalog?.totals.vendors} />
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
        {selectedVendor.submissions.length === 0 && <div className="submission-empty">{t.noSubmissions}</div>}
        <div className="batch-list">{selectedVendor.submissions.map((submission, index) => <SubmissionCard datasetHref={localPreview ? "/local-preview/dataset-download" : `/api/submissions/${encodeURIComponent(submission.id)}/dataset-download`} key={submission.id} language={language} latest={index === 0} open={index === 0} submission={submission} />)}</div></section>
      </section>
    </div>}
    </div>
    </main>

    {uploadOpen && <UploadDialog onClose={() => setUploadOpen(false)} onUploaded={(vendorId) => { setSelectedVendorId(vendorId); setRevision((value) => value + 1); }} t={t} vendors={vendors} />}
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
      {task.format === "harbor" ? <div className="checks">{(["build", "boot", "oracle", "nop"] as HarborCheckPhase[]).map((phase) => {
        const check = task.checks[phase];
        const outcome = check?.outcome ?? "unset";
        const mark = outcome === "pass" ? "✓" : outcome === "fail" ? "×" : t.unset;
        return <span aria-label={`${phaseLabels[phase]}: ${outcome}`} className={`check ${outcome}`} key={phase} title={check?.summary}>
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

function UploadDialog({ vendors, onClose, onUploaded, t }: { vendors: CatalogVendor[]; onClose(): void; onUploaded(vendorId: string): void; t: typeof text.en | typeof text.zh }) {
  const [vendorId, setVendorId] = useState(vendors[0]?.id ?? "");
  const [label, setLabel] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "hashing" | "uploading" | "saved" | "error">("idle");
  const [message, setMessage] = useState("");
  const busy = status === "hashing" || status === "uploading";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!vendorId || !label.trim() || !file) { setStatus("error"); setMessage(t.uploadForm.required); return; }
    if (file.size > 250 * 1024 * 1024) { setStatus("error"); setMessage(t.uploadForm.choose); return; }
    try {
      setStatus("hashing"); setMessage(t.uploadForm.hashing);
      const sha256 = await sha256File(file);
      setStatus("uploading"); setMessage(t.uploadForm.uploading);
      const response = await fetch("/api/uploads", {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": file.type || "application/octet-stream",
          "x-case-upload-id": crypto.randomUUID(),
          "x-case-vendor-id": vendorId,
          "x-case-upload-label": encodeURIComponent(label.trim()),
          ...(note.trim() ? { "x-case-upload-note": encodeURIComponent(note.trim()) } : {}),
          "x-case-file-name": encodeURIComponent(file.name),
          "x-case-file-size": String(file.size),
          "x-case-file-sha256": sha256,
        },
        body: file,
      });
      if (!response.ok) throw new Error(t.uploadForm.error);
      setStatus("saved"); setMessage(t.uploadForm.saved); onUploaded(vendorId);
    } catch { setStatus("error"); setMessage(t.uploadForm.error); }
  }

  return <div className="upload-backdrop"><section aria-modal="true" className="upload-dialog" role="dialog">
    <header><div><h2>{t.uploadForm.title}</h2><p>{t.uploadForm.note}</p></div><button aria-label={t.uploadForm.close} onClick={onClose} type="button">×</button></header>
    <form onSubmit={submit}>
      <label><span>{t.uploadForm.vendor}</span><select disabled={busy} onChange={(event) => setVendorId(event.target.value)} value={vendorId}>{vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}</select></label>
      <label><span>{t.uploadForm.label}</span><input disabled={busy} maxLength={300} onChange={(event) => setLabel(event.target.value)} value={label} /></label>
      <label><span>{t.uploadForm.file}</span><input disabled={busy} onChange={(event) => setFile(event.target.files?.[0] ?? null)} type="file" /><small>{file ? `${file.name} · ${formatBytes(file.size)}` : t.uploadForm.choose}</small></label>
      <label><span>{t.uploadForm.comment}</span><textarea disabled={busy} maxLength={5000} onChange={(event) => setNote(event.target.value)} placeholder={t.uploadForm.commentPlaceholder} rows={3} value={note} /></label>
      <footer><button className="primary" disabled={busy || status === "saved" || !vendors.length} type="submit">{busy ? t.uploadForm.uploading : t.uploadForm.submit}</button>{message && <span className={status}>{message}</span>}</footer>
    </form>
  </section></div>;
}

async function sha256File(file: File): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
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

function formatBytes(value: number): string {
  return value < 1024 * 1024 ? `${Math.max(1, Math.round(value / 1024))} KB` : `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

const previewSubmission: CatalogSubmission = {
  id: "preview-submission",
  date: "2026-08-20",
  label: "August sample",
  source: "Captured vendor delivery",
  formats: ["harbor", "non_harbor"],
  sourceEvents: [{ id: "preview-source", channel: "upload", externalRef: "", sender: "Vendor", receivedAt: "2026-08-20T09:30:00.000Z", rawArtifactId: "artifact:preview:raw", items: [{ id: "preview-file", kind: "archive", displayName: "original-payload.zip", locator: null, artifactId: "artifact:preview:raw", contentSha256: null }] }],
  tasks: [
    { id: "preview-harbor", stableKey: "repair-cache", title: "Repair cache invalidation", summary: null, kind: "task", format: "harbor", sourcePath: "tasks/repair-cache", artifactId: "artifact:preview:task", contentSha256: null, sourceItemIds: ["preview-file"], checks: { build: previewCheck("build", "pass"), boot: previewCheck("boot", "pass"), oracle: previewCheck("oracle", "pass"), nop: previewCheck("nop", "fail") }, findings: [{ id: "finding:nop", phase: "nop", checkRunId: "check:nop", finding: "Nop received score 1." }] },
    { id: "preview-trace", stableKey: "browser-trace", title: "Browser workflow trace", summary: null, kind: "trace", format: "non_harbor", sourcePath: "traces/session.jsonl", artifactId: "artifact:preview:trace", contentSha256: null, sourceItemIds: ["preview-file"], checks: {}, findings: [] },
  ],
};

function previewCheck(phase: HarborCheckPhase, outcome: "pass" | "fail") {
  return { id: `check:${phase}`, phase, outcome, summary: `${phase} ${outcome}`, score: phase === "oracle" ? 1 : phase === "nop" ? 1 : null, completedAt: "2026-08-20T10:00:00.000Z" };
}

export function LocalDownloadPreview() {
  const previewCatalog: CatalogSnapshot = {
    generatedAt: "2026-08-20T10:00:00.000Z",
    vendors: [{ id: "preview-vendor", name: "Example Vendor", short: "EV", submissions: [previewSubmission] }],
    totals: { vendors: 1, submissions: 1, tasks: 2, harborTasks: 1 },
  };
  return <PortalClient initialCatalog={previewCatalog} localPreview user={{ name: "Researcher" }} />;
}
