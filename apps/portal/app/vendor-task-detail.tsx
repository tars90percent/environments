import { useEffect, useState } from "react";
import type { CatalogTask } from "./catalog";
import type { UpstreamTaskFilesystemEntry } from "./model-benchmark-filesystems";
import { TaskFileBrowser } from "./model-benchmark-task-detail";
import { displayArchivePath } from "./archive-path";

export type VendorTaskDetailData = {
  task: CatalogTask;
  vendor: { id: string; name: string };
  submission: { id: string; label: string; date: string };
  entries: UpstreamTaskFilesystemEntry[];
  available: boolean;
};

export function VendorTaskDetail({ taskId, language, onBack, localPreview = false }: {
  taskId: string;
  language: "zh" | "en";
  onBack: (vendorId?: string) => void;
  localPreview?: boolean;
}) {
  const zh = language === "zh";
  const [data, setData] = useState<VendorTaskDetailData | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const base = `${localPreview ? "/local-preview" : "/api"}/tasks/${encodeURIComponent(taskId)}`;
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`${base}/files`, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Task unavailable");
        const value = await response.json() as VendorTaskDetailData;
        if (!controller.signal.aborted) setData(value);
      }).catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [base, retry]);

  return <article className="model-task-detail vendor-task-detail">
    <header className="model-task-browser-head">
      <button className="model-task-back" onClick={() => localPreview ? window.location.assign("/local-preview") : onBack(data?.vendor.id)} type="button">← {zh ? "返回供应商任务" : "Back to vendor tasks"}</button>
      {data ? <>
        <div className="model-task-breadcrumb"><span>{data.vendor.name}</span><span>/</span><span>{data.submission.label}</span><span>/</span><code>{data.task.title}</code></div>
        <div className="model-task-title-row">
          <div><h1>{data.task.title}</h1>{data.task.summary ? <p>{data.task.summary}</p> : null}</div>
          {data.task.artifactId ? <a className="model-task-primary-link" href={`/api/artifacts/${encodeURIComponent(data.task.artifactId)}/download`}><span>Harbor</span><strong>{zh ? "下载任务包" : "Download task package"} ↓</strong></a> : null}
        </div>
        <dl className="vendor-task-facts">
          <div><dt>{zh ? "供应商" : "Vendor"}</dt><dd>{data.vendor.name}</dd></div>
          <div><dt>{zh ? "提交批次" : "Submission"}</dt><dd>{data.submission.label} · {data.submission.date}</dd></div>
          <div><dt>{zh ? "任务来源路径" : "Source path"}</dt><dd><code>{data.task.sourcePath ? displayArchivePath(data.task.sourcePath) : "—"}</code></dd></div>
          <div><dt>{zh ? "文件" : "Files"}</dt><dd>{data.entries.filter((entry) => entry.kind === "file").length}</dd></div>
        </dl>
        <details className="vendor-task-provenance"><summary>{zh ? "来源与版本" : "Provenance and version"}</summary><dl>
          <div><dt>{zh ? "任务记录" : "Task record"}</dt><dd><code>{data.task.id}</code></dd></div>
          <div><dt>{zh ? "提交记录" : "Submission record"}</dt><dd><code>{data.submission.id}</code></dd></div>
          {data.task.contentSha256 ? <div><dt>SHA-256</dt><dd><code>{data.task.contentSha256}</code></dd></div> : null}
        </dl><p>{zh ? "文件来自该提交批次的 Harbor 分发副本；下载任务包可获取 CASE 保存的原始任务文件。" : "Files come from this submission’s Harbor distribution mirror. The task package download retrieves the original task artifact retained by CASE."}</p></details>
      </> : null}
    </header>
    {!data && !error ? <div className="task-file-preview-state" role="status"><span className="task-file-preview-spinner" /><p>{zh ? "正在加载任务文件…" : "Loading task files…"}</p></div> : null}
    {error ? <div className="task-file-preview-state" role="alert"><p>{zh ? "任务文件暂不可用。" : "Task files are currently unavailable."}</p><button type="button" onClick={() => { setError(false); setRetry((value) => value + 1); }}>{zh ? "重试" : "Retry"}</button></div> : null}
    {data ? <div className="model-task-panel single">
      {!data.available ? <p className="vendor-task-unavailable">{zh ? "该任务的分发文件缺失或尚不完整。" : "The distribution files for this task are missing or incomplete."}</p> : null}
      {data.entries.length ? <TaskFileBrowser entries={data.entries} rootName={data.task.title} language={language} privateFiles contentUrl={(entry) => `${base}/file?path=${encodeURIComponent(entry.path)}`} /> : null}
    </div> : null}
  </article>;
}
