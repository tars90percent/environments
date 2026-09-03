import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import type { BenchmarkReferenceLanguage, ModelBenchmarkReference } from "./model-benchmark-data";
import {
  modelBenchmarkAgentViews,
  type PublisherAgentMaterial,
  type PublisherContractAgentView,
  type PublisherTaskPromptSource,
  type TauAgentRuntimeView,
} from "./model-benchmark-agent-views";
import {
  siblingModelBenchmarkSamples,
  type BenchmarkSampleTask,
} from "./model-benchmark-samples";
import {
  modelBenchmarkTaskFilesystems,
  upstreamFilesystemEntryContentUrl,
  upstreamFilesystemEntryUrl,
  type UpstreamTaskFilesystemEntry,
} from "./model-benchmark-filesystems";
import {
  modelBenchmarkNativeTaskRecords,
  type NativeTaskFieldRole,
  type NativeTaskRecord,
} from "./model-benchmark-native-records";

const copy = {
  en: {
    back: "Back to benchmark catalog",
    systemPromptTab: "System prompt",
    taskBriefTab: "Assignment",
    taskTab: "Task JSON",
    materialsTab: "Materials",
    recordTab: "Record",
    filesTab: "Files",
    taskContext: "Task contents",
    taskProfiles: "Tasks",
    taskNumber: "Task",
    openOriginal: "Publisher source",
    openUpstream: "Open upstream",
    selectFile: "Select a file.",
    previewSource: "Upstream file",
    loadingPreview: "Loading file…",
    previewError: "File unavailable.",
    binaryPreview: "Preview unavailable for this file type.",
    openRaw: "Open raw file",
    filesystem: "Files",
    repository: "Repository",
    snapshot: "Revision",
    verified: "Verified",
    files: "files",
    directories: "directories",
    nativeRecord: "Publisher record",
    recordFormat: "Format",
    recordDomain: "Domain",
    recordSplit: "Split",
    sourceObject: "Source object",
    sourceMap: "Fields",
    field: "Field",
    role: "Role",
    contains: "Contents",
    availability: "Availability",
    outputContract: "Output",
    gradingContract: "Grading",
    catalogedMetadata: "Cataloged",
    publisherOnly: "Upstream only",
    roles: {
      documentation: "Documentation",
      "task-instruction": "Instruction",
      "task-config": "Configuration",
      environment: "Environment",
      "input-artifact": "Input",
      "environment-helper": "Environment helper",
      "reference-solution": "Solution",
      verifier: "Verifier",
      repository: "Repository",
    },
    nativeRoles: {
      identity: "Identity",
      instruction: "Instruction",
      input: "Input",
      template: "Interface",
      reference: "Reference",
      grader: "Grader",
    },
  },
  zh: {
    back: "返回基准目录",
    systemPromptTab: "系统指令",
    taskBriefTab: "任务说明",
    taskTab: "任务 JSON",
    materialsTab: "材料",
    recordTab: "记录",
    filesTab: "文件",
    taskContext: "任务内容",
    taskProfiles: "任务",
    taskNumber: "任务",
    openOriginal: "发布方来源",
    openUpstream: "打开上游",
    selectFile: "选择文件。",
    previewSource: "上游文件",
    loadingPreview: "正在加载文件…",
    previewError: "文件不可用。",
    binaryPreview: "无法预览此文件类型。",
    openRaw: "打开原始文件",
    filesystem: "文件",
    repository: "代码仓库",
    snapshot: "版本",
    verified: "核验日期",
    files: "个文件",
    directories: "个目录",
    nativeRecord: "发布方记录",
    recordFormat: "格式",
    recordDomain: "领域",
    recordSplit: "数据集划分",
    sourceObject: "来源对象",
    sourceMap: "字段",
    field: "字段",
    role: "角色",
    contains: "内容",
    availability: "可用范围",
    outputContract: "输出",
    gradingContract: "评分",
    catalogedMetadata: "已记录",
    publisherOnly: "仅上游",
    roles: {
      documentation: "说明文档",
      "task-instruction": "任务指令",
      "task-config": "任务配置",
      environment: "运行环境",
      "input-artifact": "输入文件",
      "environment-helper": "环境辅助脚本",
      "reference-solution": "参考解法",
      verifier: "评分与测试",
      repository: "仓库元数据",
    },
    nativeRoles: {
      identity: "标识",
      instruction: "任务指令",
      input: "输入材料",
      template: "接口约定",
      reference: "参考材料",
      grader: "评分器",
    },
  },
} as const;

export function ModelBenchmarkTaskDetail({ benchmark, language, localPreview, sample }: {
  benchmark: ModelBenchmarkReference;
  language: BenchmarkReferenceLanguage;
  localPreview: boolean;
  sample: BenchmarkSampleTask;
}) {
  const t = copy[language];
  const filesystem = modelBenchmarkTaskFilesystems[sample.id];
  const nativeRecord = modelBenchmarkNativeTaskRecords[sample.id];
  const agentView = modelBenchmarkAgentViews[sample.id];
  const siblingSamples = siblingModelBenchmarkSamples(benchmark, sample);
  const backHref = localPreview ? "/local-preview/model-benchmarks" : "/model-benchmarks";
  const tabs: Array<{ id: TaskDetailTab; label: string }> = filesystem
    ? [{ id: "files", label: t.filesTab }]
    : agentView?.kind === "tau-runtime"
      ? [{ id: "prompt", label: t.systemPromptTab }, { id: "task", label: t.taskTab }]
      : [
        ...(agentView?.promptSource ? [{ id: "prompt" as const, label: t.taskBriefTab }] : []),
        ...(agentView?.materials.length ? [{ id: "materials" as const, label: t.materialsTab }] : []),
        ...(nativeRecord ? [{ id: "record" as const, label: t.recordTab }] : []),
      ];
  const [activeTab, setActiveTab] = useState<TaskDetailTab>(tabs[0]?.id ?? "record");

  return <article className="model-task-detail">
    <header className="model-task-browser-head">
      <a className="model-task-back" href={backHref}><span aria-hidden>←</span>{t.back}</a>
      <div className="model-task-breadcrumb"><span>{benchmark.name}</span>{sample.versionId ? <><span aria-hidden>/</span><span>{sample.versionId}</span></> : null}<span aria-hidden>/</span><code>{sample.sourceId ?? sample.id}</code></div>
      <div className="model-task-title-row">
        <div>
          <h1>{sample.title[language]}</h1>
          <p>{sample.objective[language]}</p>
        </div>
        <a className="model-task-primary-link" href={sample.sourceUrl} rel="noreferrer" target="_blank"><span>{sample.sourceLabel[language]}</span><strong>{t.openOriginal} ↗</strong></a>
      </div>
      {siblingSamples.length > 1 ? <nav aria-label={t.taskProfiles} className="model-task-profile-switcher">
        <span>{t.taskProfiles}</span>
        <div>{siblingSamples.map((entry, index) => <a
          aria-current={entry.id === sample.id ? "page" : undefined}
          className={entry.id === sample.id ? "active" : ""}
          href={`${localPreview ? "/local-preview" : ""}/model-benchmarks/${benchmark.id}/tasks/${entry.id}`}
          key={entry.id}
        ><small>{t.taskNumber} {index + 1}</small><strong>{entry.title[language]}</strong></a>)}</div>
      </nav> : null}
    </header>

    {tabs.length > 1 ? <div aria-label={t.taskContext} className="model-task-tabs" role="tablist">
      {tabs.map((tab) => <button
        aria-controls={`model-task-panel-${tab.id}`}
        aria-selected={activeTab === tab.id}
        className={activeTab === tab.id ? "active" : ""}
        key={tab.id}
        onClick={() => setActiveTab(tab.id)}
        role="tab"
        type="button"
      >{tab.label}</button>)}
    </div> : null}

    <div className={`model-task-panel${tabs.length === 1 ? " single" : ""}`} id={`model-task-panel-${activeTab}`} role="tabpanel">
      {activeTab === "prompt" && agentView?.kind === "tau-runtime" ? <TauAgentInputView language={language} view={agentView} /> : null}
      {activeTab === "prompt" && agentView?.kind === "publisher-contract" && agentView.promptSource ? <PublisherTaskPromptView language={language} source={agentView.promptSource} /> : null}
      {activeTab === "task" && agentView?.kind === "tau-runtime" ? <TauTaskDefinitionView language={language} view={agentView} /> : null}
      {activeTab === "materials" && agentView?.kind === "publisher-contract" ? <PublisherAgentInputView language={language} view={agentView} /> : null}
      {activeTab === "record" && nativeRecord ? <NativeTaskRecordSection language={language} record={nativeRecord} sourceUrl={sample.sourceUrl} /> : null}
      {activeTab === "files" && filesystem ? <FilesystemBrowser filesystem={filesystem} language={language} /> : null}
    </div>
  </article>;
}

type TaskDetailTab = "files" | "materials" | "prompt" | "record" | "task";

const agentViewCopy = {
  en: {
    prompt: "System prompt",
    configuration: "alltools",
    loading: "Loading and composing publisher prompt sources…",
    error: "The publisher sources could not be loaded or composed.",
    sourceFiles: "Prompt sources",
    openSource: "Open source",
    toolsTitle: "Tools",
    taskDefinition: "Task definition",
    loadingTask: "Loading task JSON…",
    taskError: "The task JSON could not be loaded.",
    rawTask: "Open raw task",
  },
  zh: {
    prompt: "系统指令",
    configuration: "alltools",
    loading: "正在加载并组合发布方指令来源…",
    error: "无法加载或组合发布方指令来源。",
    sourceFiles: "指令来源",
    openSource: "打开来源",
    toolsTitle: "工具",
    taskDefinition: "任务定义",
    loadingTask: "正在加载任务 JSON…",
    taskError: "无法加载任务 JSON。",
    rawTask: "打开原始任务",
  },
} as const;

const publisherAgentCopy = {
  en: {
    providedMaterial: "Materials",
    materialCount: "items",
    noMaterial: "No public material is available for this task.",
    publisherFile: "Publisher file",
    publisherRecord: "Publisher record",
    runtimeGenerated: "Generated at runtime",
    repository: "Repository checkout",
    environment: "Agent environment",
    toolAccess: "Tool access",
    openWeb: "Open web",
    openMaterial: "Open upstream",
    materialUnavailable: "Open the publisher record to inspect this material.",
    taskPrompt: "Assignment",
    loadingPrompt: "Loading the publisher prompt…",
    promptError: "The publisher prompt could not be loaded.",
    openDataset: "Publisher source",
  },
  zh: {
    providedMaterial: "材料",
    materialCount: "项",
    noMaterial: "该任务没有公开材料。",
    publisherFile: "发布方文件",
    publisherRecord: "发布方记录",
    runtimeGenerated: "运行时生成",
    repository: "代码仓库检出",
    environment: "智能体环境",
    toolAccess: "工具访问",
    openWeb: "开放网络",
    openMaterial: "打开上游来源",
    materialUnavailable: "在发布方记录中查看此材料。",
    taskPrompt: "任务说明",
    loadingPrompt: "正在加载发布方任务说明…",
    promptError: "无法加载发布方任务说明。",
    openDataset: "发布方来源",
  },
} as const;

type AgentViewLoadState =
  | { status: "loading" }
  | { status: "ready"; systemPrompt: string }
  | { status: "error" };

function TauAgentInputView({ language, view }: {
  language: BenchmarkReferenceLanguage;
  view: TauAgentRuntimeView;
}) {
  const t = agentViewCopy[language];
  const [loadState, setLoadState] = useState<AgentViewLoadState>({ status: "loading" });
  const promptSources = [
    view.promptSources.agentRuntime,
    view.promptSources.policyTemplate,
    view.promptSources.retrievalRuntime,
    ...view.promptSources.components,
  ];

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const sources = [
          view.promptSources.agentRuntime,
          view.promptSources.policyTemplate,
          view.promptSources.retrievalRuntime,
          ...view.promptSources.components,
        ];
        const contents = await Promise.all(sources.map(async (source) => {
          const response = await fetch(source.rawUrl, { cache: "force-cache", signal: controller.signal });
          if (!response.ok) throw new Error(`Publisher returned ${response.status} for ${source.path}`);
          return response.text();
        }));
        const [agentRuntime, policyTemplate, retrievalRuntime, ...componentContents] = contents;
        const systemPrompt = composeTauAgentSystemPrompt(
          agentRuntime,
          policyTemplate,
          retrievalRuntime,
          view.promptSources.components.map((component, index) => ({ placeholder: component.placeholder, text: componentContents[index] ?? "" })),
        );
        if (!controller.signal.aborted) setLoadState({ status: "ready", systemPrompt });
      } catch {
        if (!controller.signal.aborted) setLoadState({ status: "error" });
      }
    })();
    return () => controller.abort();
  }, [view]);

  return <section className="agent-input-view">
    <div className="agent-input-prompt-panel">
      <header><div><span>{t.configuration}</span><h3>{t.prompt}</h3></div><a href={view.promptSources.agentRuntime.sourceUrl} rel="noreferrer" target="_blank">{t.openSource} ↗</a></header>
      {loadState.status === "loading" ? <div className="agent-input-state"><span className="task-file-preview-spinner" /><p>{t.loading}</p></div> : null}
      {loadState.status === "error" ? <div className="agent-input-state"><strong>{t.error}</strong></div> : null}
      {loadState.status === "ready" ? <pre><code>{loadState.systemPrompt}</code></pre> : null}
      <footer><strong>{t.sourceFiles}</strong><div>{promptSources.map((source) => <a href={source.sourceUrl} key={source.path} rel="noreferrer" target="_blank"><code>{source.path}</code><span>↗</span></a>)}</div></footer>
    </div>

    <section className="tau-agent-tools"><header><h3>{t.toolsTitle}</h3></header>{view.toolGroups.map((group) => <div className="agent-tool-group" key={group.label.en}><strong>{group.label[language]}</strong><div>{group.tools.map((tool) => <code key={tool}>{tool}</code>)}</div></div>)}</section>
  </section>;
}

function PublisherAgentInputView({ language, view }: {
  language: BenchmarkReferenceLanguage;
  view: PublisherContractAgentView;
}) {
  return <section className="agent-input-view publisher-agent-view">
    <PublisherMaterialBrowser language={language} materials={view.materials} />
  </section>;
}

type PublisherPromptState =
  | { status: "loading" }
  | { status: "ready"; sections: PublisherPromptSection[] }
  | { status: "error" };

type PublisherPromptSection = {
  field: string;
  preformatted: boolean;
  text: string;
};

type PublisherRowsResponse = {
  rows?: Array<{
    row?: Record<string, unknown>;
    row_idx?: unknown;
  }>;
};

function matchesPublisherIdentity(record: Record<string, unknown>, identity: Record<string, string | number>) {
  return Object.entries(identity).every(([field, expected]) => record[field] === expected);
}

function findPublisherRecord(value: unknown, identity: Record<string, string | number>): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object") return undefined;
  if (!Array.isArray(value) && matchesPublisherIdentity(value as Record<string, unknown>, identity)) return value as Record<string, unknown>;
  for (const child of Array.isArray(value) ? value : Object.values(value)) {
    const match = findPublisherRecord(child, identity);
    if (match) return match;
  }
  return undefined;
}

function publisherPromptSections(record: Record<string, unknown>, fields: string[]): PublisherPromptSection[] {
  return fields.flatMap((field) => {
    const value = record[field];
    if (typeof value === "string" && value.trim()) return [{ field, preformatted: false, text: value.trim() }];
    if (value !== undefined && value !== null) return [{ field, preformatted: true, text: JSON.stringify(value, null, 2) }];
    return [];
  });
}

function parsePublisherCsv(text: string): Array<Record<string, string>> {
  const rows: string[][] = [];
  let cell = "";
  let quoted = false;
  let row: string[] = [];
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  const headers = rows.shift() ?? [];
  return rows.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
}

function parsePublisherPythonTask(text: string, exampleId: string | number): Record<string, unknown> | undefined {
  const marker = new RegExp(`["']example_id["']\\s*:\\s*${String(exampleId).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
  const markerIndex = text.search(marker);
  if (markerIndex < 0) return undefined;
  const blockStart = Math.max(0, text.lastIndexOf("\ndef ", markerIndex));
  const nextFunction = text.indexOf("\ndef ", markerIndex + 1);
  const block = text.slice(blockStart, nextFunction < 0 ? text.length : nextFunction);
  const userMessage = block.match(/["']role["']\s*:\s*["']user["'][\s\S]*?["']content["']\s*:\s*\(([\s\S]*?)\)\s*,\s*\n\s*\}/)?.[1];
  if (!userMessage) return undefined;
  const literals = userMessage.match(/"(?:\\.|[^"\\])*"/g) ?? [];
  const user = literals.map((literal) => JSON.parse(literal) as string).join("");
  return user ? { example_id: exampleId, user } : undefined;
}

function PublisherTaskPromptView({ language, source }: {
  language: BenchmarkReferenceLanguage;
  source: PublisherTaskPromptSource;
}) {
  const t = publisherAgentCopy[language];
  const [state, setState] = useState<PublisherPromptState>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        let sections: PublisherPromptSection[] = [];
        if (source.kind === "dataset-row") {
          const response = await fetch(source.rowUrl, { cache: "force-cache", signal: controller.signal });
          if (!response.ok) throw new Error(`The publisher row request failed with ${response.status}`);
          const payload = await response.json() as PublisherRowsResponse;
          const result = payload.rows?.[0];
          const row = result?.row;
          const identityMatches = row && matchesPublisherIdentity(row, source.identity);
          sections = row ? publisherPromptSections(row, source.instructionFields) : [];
          if (result?.row_idx !== source.rowIndex || !identityMatches) throw new Error("The publisher row did not match the expected task");
        } else {
          const response = await fetch(source.rawUrl, { cache: "force-cache", signal: controller.signal });
          if (!response.ok) throw new Error(`The publisher file request failed with ${response.status}`);
          const text = await response.text();
          if (source.fileFormat === "text") {
            sections = [{ field: source.instructionFields[0] ?? "instruction", preformatted: true, text: text.trim() }];
          } else {
            const payload = source.fileFormat === "jsonl"
              ? text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line) as unknown)
              : source.fileFormat === "csv"
                ? parsePublisherCsv(text)
                : source.fileFormat === "python-task"
                  ? parsePublisherPythonTask(text, source.identity.example_id ?? "")
                  : JSON.parse(text) as unknown;
            const record = findPublisherRecord(payload, source.identity);
            sections = record ? publisherPromptSections(record, source.instructionFields) : [];
          }
        }
        if (sections.length !== source.instructionFields.length) throw new Error("The publisher source did not contain the expected task instructions");
        if (!controller.signal.aborted) setState({ sections, status: "ready" });
      } catch {
        if (!controller.signal.aborted) setState({ status: "error" });
      }
    })();
    return () => controller.abort();
  }, [source]);

  return <section className="publisher-task-prompt">
    <header><div><span>{source.sourceLabel[language]}</span><h3>{t.taskPrompt}</h3></div><a href={source.sourceUrl} rel="noreferrer" target="_blank">{t.openDataset} ↗</a></header>
    {state.status === "loading" ? <div className="agent-input-state"><span className="task-file-preview-spinner" /><p>{t.loadingPrompt}</p></div> : null}
    {state.status === "error" ? <div className="agent-input-state"><strong>{t.promptError}</strong><a href={source.sourceUrl} rel="noreferrer" target="_blank">{t.openDataset} ↗</a></div> : null}
    {state.status === "ready" ? <div className="publisher-task-prompt-body">{state.sections.map((section) => <section className="publisher-task-prompt-section" key={section.field}>{state.sections.length > 1 ? <code>{section.field}</code> : null}{section.preformatted ? <pre><code>{section.text}</code></pre> : section.text.split(/\n{2,}/).map((paragraph, index) => <p key={`${section.field}-${index}`}>{paragraph}</p>)}</section>)}</div> : null}
  </section>;
}

function PublisherMaterialBrowser({ language, materials }: {
  language: BenchmarkReferenceLanguage;
  materials: PublisherAgentMaterial[];
}) {
  const t = publisherAgentCopy[language];
  const [selectedPath, setSelectedPath] = useState(materials[0]?.path ?? "");
  const selected = materials.find((material) => material.path === selectedPath) ?? materials[0];
  const hasPreviewableMaterial = materials.some((material) => Boolean(material.rawUrl));

  return <section className="publisher-material-browser">
    <header><h3>{t.providedMaterial}</h3><span>{materials.length} {t.materialCount}</span></header>
    {!hasPreviewableMaterial && materials.length > 0 ? <div className="publisher-material-records">{materials.map((material) => <article className="publisher-material-record" key={material.path}><span aria-hidden>{fileIcon(material.path)}</span><div><code>{material.path}</code><small>{materialOriginLabel(material.origin, language)}</small><p>{material.detail[language]}</p></div><a href={material.sourceUrl} rel="noreferrer" target="_blank">{t.openMaterial} ↗</a></article>)}</div> : null}
    {selected && hasPreviewableMaterial ? <div className="publisher-material-layout">
      <nav aria-label={t.providedMaterial} className="publisher-material-list">{materials.map((material) => <button className={selected.path === material.path ? "selected" : ""} key={material.path} onClick={() => setSelectedPath(material.path)} type="button"><span aria-hidden>{fileIcon(material.path)}</span><span><code>{material.path}</code><small>{materialOriginLabel(material.origin, language)}</small></span>{material.sizeBytes === undefined ? null : <small>{formatBytes(material.sizeBytes)}</small>}</button>)}</nav>
      <AgentMaterialPreview language={language} material={selected} />
    </div> : null}
    {!selected ? <p className="publisher-material-empty">{t.noMaterial}</p> : null}
  </section>;
}

function AgentMaterialPreview({ language, material }: {
  language: BenchmarkReferenceLanguage;
  material: PublisherAgentMaterial;
}) {
  const general = copy[language];
  const t = publisherAgentCopy[language];
  const previewKind = material.rawUrl ? filePreviewKind(material.path) : "binary";
  const [preview, setPreview] = useState<FilePreviewState>(material.rawUrl && previewKind !== "image" && previewKind !== "office" && previewKind !== "binary" ? { status: "loading" } : { status: "ready" });

  useEffect(() => {
    const controller = new AbortController();
    let objectUrl: string | undefined;
    if (!material.rawUrl || previewKind === "image" || previewKind === "office" || previewKind === "binary") return () => controller.abort();
    void (async () => {
      try {
        const response = await fetch(material.rawUrl, { cache: "force-cache", signal: controller.signal });
        if (!response.ok) throw new Error(`Publisher returned ${response.status}`);
        if (previewKind === "pdf") {
          objectUrl = URL.createObjectURL(await response.blob());
          setPreview({ objectUrl, status: "ready" });
        } else {
          setPreview({ status: "ready", text: await response.text() });
        }
      } catch {
        if (!controller.signal.aborted) setPreview({ status: "error" });
      }
    })();
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [material.rawUrl, previewKind]);

  return <section className="task-file-preview publisher-material-preview">
    <header className="task-file-preview-bar">
      <div className="task-file-preview-path"><span aria-hidden>{fileIcon(material.path)}</span><div><small>{materialOriginLabel(material.origin, language)}</small><code>{material.path}</code></div></div>
      <div className="task-file-preview-facts">{material.sizeBytes === undefined ? null : <span>{formatBytes(material.sizeBytes)}</span>}</div>
      <nav aria-label={t.providedMaterial} className="task-file-preview-actions">{material.rawUrl ? <a href={material.rawUrl} rel="noreferrer" target="_blank">{general.openRaw} ↗</a> : null}<a href={material.sourceUrl} rel="noreferrer" target="_blank">{t.openMaterial} ↗</a></nav>
    </header>
    <p className="publisher-material-description">{material.detail[language]}</p>
    <div aria-busy={preview.status === "loading"} className={`task-file-preview-content ${previewKind}`}>
      {preview.status === "loading" ? <div className="task-file-preview-state"><span className="task-file-preview-spinner" /><p>{general.loadingPreview}</p></div> : null}
      {preview.status === "error" ? <div className="task-file-preview-state"><strong>{general.previewError}</strong><a href={material.sourceUrl} rel="noreferrer" target="_blank">{t.openMaterial} ↗</a></div> : null}
      {preview.status === "ready" && material.rawUrl && previewKind === "text" ? <pre><code>{preview.text}</code></pre> : null}
      {/* eslint-disable-next-line @next/next/no-img-element -- Upstream task images are publisher-hosted and must not be proxied. */}
      {preview.status === "ready" && material.rawUrl && previewKind === "image" ? <img alt={material.label[language]} src={material.rawUrl} /> : null}
      {preview.status === "ready" && material.rawUrl && previewKind === "office" ? <iframe allowFullScreen loading="lazy" src={officeViewerUrl(material.rawUrl)} title={material.label[language]} /> : null}
      {preview.status === "ready" && material.rawUrl && previewKind === "pdf" && preview.objectUrl ? <iframe src={`${preview.objectUrl}#view=FitH`} title={material.label[language]} /> : null}
      {preview.status === "ready" && (!material.rawUrl || previewKind === "binary") ? <div className="task-file-preview-state"><strong>{material.label[language]}</strong><p>{material.detail[language]}</p><a href={material.sourceUrl} rel="noreferrer" target="_blank">{material.rawUrl ? general.openRaw : t.openMaterial} ↗</a>{!material.rawUrl ? <small>{t.materialUnavailable}</small> : null}</div> : null}
    </div>
  </section>;
}

type TauTaskDefinitionState =
  | { status: "loading" }
  | { status: "ready"; taskDefinition: string }
  | { status: "error" };

function TauTaskDefinitionView({ language, view }: {
  language: BenchmarkReferenceLanguage;
  view: TauAgentRuntimeView;
}) {
  const t = agentViewCopy[language];
  const [loadState, setLoadState] = useState<TauTaskDefinitionState>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(view.taskDefinition.rawUrl, { cache: "force-cache", signal: controller.signal });
        if (!response.ok) throw new Error(`Publisher returned ${response.status}`);
        const taskDefinition = JSON.stringify(JSON.parse(await response.text()), null, 2);
        if (!controller.signal.aborted) setLoadState({ status: "ready", taskDefinition });
      } catch {
        if (!controller.signal.aborted) setLoadState({ status: "error" });
      }
    })();
    return () => controller.abort();
  }, [view]);

  return <section className="tau-task-definition">
    <header><div><h3>{t.taskDefinition}</h3><code>{view.taskDefinition.path}</code></div><a href={view.taskDefinition.rawUrl} rel="noreferrer" target="_blank">{t.rawTask} ↗</a></header>
    {loadState.status === "loading" ? <div className="agent-input-state"><span className="task-file-preview-spinner" /><p>{t.loadingTask}</p></div> : null}
    {loadState.status === "error" ? <div className="agent-input-state"><strong>{t.taskError}</strong></div> : null}
    {loadState.status === "ready" ? <pre><code>{loadState.taskDefinition}</code></pre> : null}
  </section>;
}

function FilesystemBrowser({ filesystem, language }: {
  filesystem: NonNullable<(typeof modelBenchmarkTaskFilesystems)[string]>;
  language: BenchmarkReferenceLanguage;
}) {
  const t = copy[language];
  const initialEntry = filesystem.entries.find((entry) => entry.path === "instruction.md") ?? filesystem.entries.find((entry) => entry.kind === "file") ?? filesystem.entries[0];
  const [selectedPath, setSelectedPath] = useState(initialEntry?.path ?? "");
  const [expandedDirectories, setExpandedDirectories] = useState<Set<string>>(new Set());
  const selectedEntry = filesystem.entries.find((entry) => entry.path === selectedPath) ?? initialEntry;
  const selectedFile = selectedEntry?.kind === "file" ? selectedEntry : undefined;
  const visibleEntries = filesystem.entries.filter((entry) => entryAncestors(entry.path).every((ancestor) => expandedDirectories.has(ancestor)));
  const fileCount = filesystem.entries.filter((entry) => entry.kind === "file").length;
  const directoryCount = filesystem.entries.filter((entry) => entry.kind === "directory").length;
  const totalSize = filesystem.entries.reduce((total, entry) => total + (entry.sizeBytes ?? 0), 0);

  function selectEntry(entry: UpstreamTaskFilesystemEntry) {
    if (entry.kind === "directory") {
      setExpandedDirectories((current) => {
        const next = new Set(current);
        if (next.has(entry.path)) next.delete(entry.path);
        else next.add(entry.path);
        return next;
      });
      return;
    }
    setSelectedPath(entry.path);
  }

  return <section className="task-files-panel">
    <header className="task-files-meta">
      <div><span>{t.repository}</span><strong>{filesystem.repository}</strong></div>
      <div><span>{t.snapshot}</span><code>{filesystem.treeSha.slice(0, 12)}</code></div>
      <div><span>{t.verified}</span><strong>{filesystem.verifiedAt}</strong></div>
      <div><span>{t.filesystem}</span><strong>{fileCount} {t.files} · {directoryCount} {t.directories} · {formatBytes(totalSize)}</strong></div>
    </header>
    <div className="task-file-browser">
      <aside aria-label={t.filesystem} className="task-file-tree">
        <div className="task-file-tree-root"><span aria-hidden>⌂</span><code>{filesystem.repositoryPath.split("/").at(-1)}</code></div>
        <div role="tree">
          {visibleEntries.map((entry) => {
            const depth = entry.path.split("/").length - 1;
            const expanded = entry.kind === "directory" && expandedDirectories.has(entry.path);
            const style = { "--tree-indent": `${12 + depth * 18}px` } as CSSProperties;
            return <button
              aria-expanded={entry.kind === "directory" ? expanded : undefined}
              aria-level={depth + 2}
              aria-selected={selectedEntry?.path === entry.path}
              className={selectedEntry?.path === entry.path ? "selected" : ""}
              key={entry.path}
              onClick={() => selectEntry(entry)}
              role="treeitem"
              style={style}
              type="button"
            >
              <span aria-hidden>{entry.kind === "directory" ? (expanded ? "▾" : "›") : fileIcon(entry.path)}</span>
              <code>{entry.path.split("/").at(-1)}{entry.kind === "directory" ? "/" : ""}</code>
              <small>{entry.sizeBytes === null ? "" : formatBytes(entry.sizeBytes)}</small>
            </button>;
          })}
        </div>
      </aside>
      <div className="task-file-preview">
        {selectedFile ? <FilePreview entry={selectedFile} filesystem={filesystem} key={selectedFile.path} language={language} /> : <p>{t.selectFile}</p>}
      </div>
    </div>
  </section>;
}

type FilePreviewState =
  | { status: "loading" }
  | { status: "ready"; objectUrl?: string; text?: string }
  | { status: "error" };

function FilePreview({ entry, filesystem, language }: {
  entry: UpstreamTaskFilesystemEntry;
  filesystem: NonNullable<(typeof modelBenchmarkTaskFilesystems)[string]>;
  language: BenchmarkReferenceLanguage;
}) {
  const t = copy[language];
  const contentUrl = upstreamFilesystemEntryContentUrl(filesystem, entry);
  const previewKind = filePreviewKind(entry.path);
  const [preview, setPreview] = useState<FilePreviewState>(previewKind === "image" || previewKind === "office" || previewKind === "binary" ? { status: "ready" } : { status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    let objectUrl: string | undefined;

    if (previewKind === "image" || previewKind === "office" || previewKind === "binary") {
      return () => controller.abort();
    }

    void (async () => {
      try {
        const response = await fetch(contentUrl, { cache: "force-cache", signal: controller.signal });
        if (!response.ok) throw new Error(`Publisher returned ${response.status}`);
        if (previewKind === "pdf") {
          objectUrl = URL.createObjectURL(await response.blob());
          setPreview({ objectUrl, status: "ready" });
        } else {
          setPreview({ status: "ready", text: await response.text() });
        }
      } catch {
        if (!controller.signal.aborted) setPreview({ status: "error" });
      }
    })();

    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [contentUrl, previewKind]);

  return <>
    <header className="task-file-preview-bar">
      <div className="task-file-preview-path">
        <span aria-hidden>{fileIcon(entry.path)}</span>
        <div><small>{t.previewSource}</small><code>{entry.path}</code></div>
      </div>
      <div className="task-file-preview-facts">
        <span>{t.roles[entry.role]}</span>
        <span>{entry.sizeBytes === null ? "—" : formatBytes(entry.sizeBytes)}</span>
      </div>
      <nav aria-label={t.previewSource} className="task-file-preview-actions">
        <a href={contentUrl} rel="noreferrer" target="_blank">{t.openRaw} ↗</a>
        <a href={upstreamFilesystemEntryUrl(filesystem, entry)} rel="noreferrer" target="_blank">{t.openUpstream} ↗</a>
      </nav>
    </header>
    <div aria-busy={preview.status === "loading"} className={`task-file-preview-content ${previewKind}`}>
      {preview.status === "loading" ? <div className="task-file-preview-state"><span className="task-file-preview-spinner" /><p>{t.loadingPreview}</p></div> : null}
      {preview.status === "error" ? <div className="task-file-preview-state"><strong>{t.previewError}</strong><a href={contentUrl} rel="noreferrer" target="_blank">{t.openRaw} ↗</a></div> : null}
      {preview.status === "ready" && previewKind === "text" ? <pre><code>{preview.text}</code></pre> : null}
      {/* eslint-disable-next-line @next/next/no-img-element -- Upstream task images are publisher-hosted and must not be proxied. */}
      {preview.status === "ready" && previewKind === "image" ? <img alt={entry.path} src={contentUrl} /> : null}
      {preview.status === "ready" && previewKind === "office" ? <iframe allowFullScreen loading="lazy" src={officeViewerUrl(contentUrl)} title={entry.path} /> : null}
      {preview.status === "ready" && previewKind === "pdf" && preview.objectUrl ? <iframe src={`${preview.objectUrl}#view=FitH`} title={entry.path} /> : null}
      {preview.status === "ready" && previewKind === "binary" ? <div className="task-file-preview-state"><strong>{t.binaryPreview}</strong><a href={contentUrl} rel="noreferrer" target="_blank">{t.openRaw} ↗</a></div> : null}
    </div>
  </>;
}

function NativeTaskRecordSection({ language, record, sourceUrl }: {
  language: BenchmarkReferenceLanguage;
  record: NativeTaskRecord;
  sourceUrl: string;
}) {
  const t = copy[language];
  return <section className="native-record-panel">
    <header className="native-record-intro">
      <h2>{t.nativeRecord}</h2>
      <a href={sourceUrl} rel="noreferrer" target="_blank">{t.openOriginal} ↗</a>
    </header>

    <dl className="native-record-facts">
      <div><dt>{t.recordFormat}</dt><dd>{record.publisherFormat[language]}</dd></div>
      <div><dt>{t.recordDomain}</dt><dd>{record.domain[language]}</dd></div>
      <div><dt>{t.recordSplit}</dt><dd>{record.split[language]}</dd></div>
      <div><dt>{t.sourceObject}</dt><dd>{record.sourceObject[language]}</dd></div>
    </dl>

    <section className="native-record-section">
      <header><h3>{t.sourceMap}</h3></header>
      <div className="native-field-table-wrap"><table className="native-field-table">
        <thead><tr><th>{t.field}</th><th>{t.role}</th><th>{t.contains}</th><th>{t.availability}</th></tr></thead>
        <tbody>{record.fields.map((item) => <tr key={item.name}>
          <td><code>{item.name}</code></td>
          <td>{nativeRoleLabel(item.role, language)}</td>
          <td>{item.summary[language]}</td>
          <td><span className={item.payload === "cataloged-metadata" ? "cataloged" : "upstream"}>{item.payload === "cataloged-metadata" ? t.catalogedMetadata : t.publisherOnly}</span></td>
        </tr>)}</tbody>
      </table></div>
    </section>

    <dl className="native-contract-list">
      <div><dt>{t.outputContract}</dt><dd>{record.outputContract[language]}</dd></div>
      <div><dt>{t.gradingContract}</dt><dd>{record.gradingContract[language]}</dd></div>
    </dl>
  </section>;
}

function entryAncestors(path: string): string[] {
  const parts = path.split("/");
  return parts.slice(0, -1).map((_, index) => parts.slice(0, index + 1).join("/"));
}

function composeTauAgentSystemPrompt(
  agentRuntime: string,
  policyTemplate: string,
  retrievalRuntime: string,
  components: Array<{ placeholder: string; text: string }>,
): string {
  const agentInstruction = extractPythonTripleString(agentRuntime, "AGENT_INSTRUCTION");
  const systemTemplate = extractPythonTripleString(agentRuntime, "SYSTEM_PROMPT");
  let policy = policyTemplate;
  for (const component of components) {
    policy = policy.replaceAll(`{{component:${component.placeholder}}}`, component.text.trim());
  }
  policy = policy.replaceAll("{{all_tools_dense_instructions}}", extractTauDenseInstructions(retrievalRuntime));
  const prompt = systemTemplate
    .replaceAll("{agent_instruction}", agentInstruction)
    .replaceAll("{domain_policy}", policy.trim())
    .trim();
  if (!prompt || prompt.includes("{{") || prompt.includes("{agent_instruction}") || prompt.includes("{domain_policy}")) {
    throw new Error("Publisher prompt templates did not compose completely");
  }
  return prompt;
}

function extractPythonTripleString(source: string, name: string): string {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(new RegExp(`${escapedName}\\s*=\\s*(?:"""([\\s\\S]*?)"""|'''([\\s\\S]*?)''')`));
  const value = match?.[1] ?? match?.[2];
  if (!value) throw new Error(`Publisher source is missing ${name}`);
  return value.trim();
}

function extractTauDenseInstructions(source: string): string {
  const functionBlock = source.match(/def format_all_tools_dense_instructions[\s\S]*?\n\n# -{5,}/)?.[0];
  const model = source.match(/DEFAULT_DENSE_EMBEDDING_MODEL_OPENAI\s*=\s*"([^"]+)"/)?.[1];
  const provider = functionBlock?.match(/if embedder_type == "openai":[\s\S]*?provider = "([^"]+)"/)?.[1];
  const returnBlock = functionBlock?.match(/return \(\s*([\s\S]*?)\n\s*\)/)?.[1];
  const fragments = returnBlock ? [...returnBlock.matchAll(/f"((?:\\.|[^"\\])*)"/g)].map((match) => JSON.parse(`"${match[1]}"`)).join("") : "";
  if (!model || !provider || !fragments) throw new Error("Publisher retrieval prompt builder could not be parsed");
  return fragments.replaceAll("{provider}", provider).replaceAll("{model}", model);
}

function nativeRoleLabel(role: NativeTaskFieldRole, language: BenchmarkReferenceLanguage): string {
  return copy[language].nativeRoles[role];
}

function materialOriginLabel(origin: PublisherAgentMaterial["origin"], language: BenchmarkReferenceLanguage): string {
  const t = publisherAgentCopy[language];
  if (origin === "publisher-file") return t.publisherFile;
  if (origin === "runtime-generated") return t.runtimeGenerated;
  if (origin === "repository") return t.repository;
  if (origin === "environment") return t.environment;
  if (origin === "tool-access") return t.toolAccess;
  if (origin === "open-web") return t.openWeb;
  return t.publisherRecord;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

function filePreviewKind(path: string): "binary" | "image" | "office" | "pdf" | "text" {
  if (/\.(jpg|jpeg|png|gif|webp)$/i.test(path)) return "image";
  if (/\.pdf$/i.test(path)) return "pdf";
  if (/\.(docx|pptx|xlsx)$/i.test(path)) return "office";
  if (/\.(db|encrypted)$/i.test(path)) return "binary";
  return "text";
}

function officeViewerUrl(sourceUrl: string): string {
  return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(sourceUrl)}&wdStartOn=1`;
}

function fileIcon(path: string): string {
  if (/\.(jpg|jpeg|png)$/i.test(path)) return "▧";
  if (/\.pdf$/i.test(path)) return "▤";
  if (/\.(py|sh)$/i.test(path)) return "⌘";
  if (/\.(db|encrypted)$/i.test(path)) return "◫";
  return "·";
}
