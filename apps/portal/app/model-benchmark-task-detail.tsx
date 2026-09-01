import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import type { BenchmarkReferenceLanguage, ModelBenchmarkReference } from "./model-benchmark-data";
import {
  modelBenchmarkAgentViews,
  type ModelBenchmarkAgentView,
  type PublisherAgentMaterial,
  type PublisherContractAgentView,
  type TauAgentRuntimeView,
} from "./model-benchmark-agent-views";
import {
  modelBenchmarkSampleContext,
  type BenchmarkSampleTask,
  type BenchmarkSampleTaskFormat,
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
    overviewTab: "Overview",
    agentTab: "Agent view",
    evaluationTab: "Evaluation",
    recordTab: "Publisher record",
    filesTab: "Prompt & files",
    provenanceTab: "Provenance",
    taskBrief: "Task brief",
    taskBriefNote: "A compact description of the work, its inputs, and expected deliverable.",
    taskContext: "Task context",
    benchmark: "Benchmark",
    source: "Source",
    path: "Path",
    role: "Role",
    kind: "Kind",
    size: "Size",
    file: "File",
    directory: "Directory",
    openUpstream: "Open upstream",
    selectFile: "Select a file to preview it.",
    previewSource: "Publisher-hosted preview",
    previewSourceNote: "Loaded directly from the pinned upstream revision. The catalog does not proxy or store this file.",
    loadingPreview: "Loading file from the publisher…",
    previewError: "This file could not be loaded from the publisher.",
    binaryPreview: "This binary format cannot be rendered in the browser preview.",
    openRaw: "Open raw file",
    field: "Field",
    contains: "Contains",
    availability: "Availability",
    provenance: "Published task provenance",
    provenanceNote: "The original material remains publisher-hosted and in the publisher's language. This catalog stores descriptive metadata; file previews load directly from the pinned publisher revision.",
    sourceId: "Source ID",
    originalLanguage: "Original language",
    taskFormat: "Task type",
    benchmarkVersion: "Benchmark version",
    openOriginal: "Open publisher source",
    anatomy: "Task anatomy",
    anatomyNote: "A descriptive map of what the task asks the model to consume, produce, and satisfy.",
    objective: "Objective",
    inputs: "Inputs",
    expectedOutput: "Expected output",
    evaluation: "Evaluation",
    capabilities: "Capability pattern",
    filesystem: "Harbor task filesystem",
    filesystemNote: "Complete upstream package tree at the recorded Git snapshot. Select a file to preview its publisher-hosted contents.",
    repository: "Repository",
    snapshot: "Tree snapshot",
    verified: "Verified",
    files: "files",
    directories: "directories",
    totalSize: "total file size",
    openRoot: "Open task root",
    nativeRecord: "Publisher-native task record",
    nativeRecordNote: "The task is mapped in the structure used by its publisher: record fields, linked inputs, execution path, output contract, and grading contract.",
    formatBoundary: "Protected benchmark",
    formatBoundaryNote: "Only the publisher's documented record shape is shown. No gated item, option, answer, rationale, or attachment is reproduced.",
    publicBoundary: "Source-linked profile",
    publicBoundaryNote: "Field names and task structure are recorded here. The English prompt, answer, rubric, tests, and linked file contents stay at the publisher source.",
    recordFormat: "Record format",
    recordDomain: "Domain",
    recordSplit: "Split",
    sourceObject: "Source object",
    sourceMap: "Source record map",
    sourceMapNote: "Every publisher field that participates in the task, with its role and the material it carries.",
    taskFlow: "Task execution path",
    taskFlowNote: "How the original record becomes a scored response or deliverable.",
    outputContract: "Output contract",
    gradingContract: "Grading contract",
    catalogedMetadata: "Cataloged metadata",
    publisherOnly: "Payload stays upstream",
    openEntry: "Open upstream",
    formats: {
      "file-deliverable": "File deliverable",
      "agent-simulation": "Agent simulation",
      desktop: "Desktop interaction",
      "web-research": "Web research",
      "interactive-game": "Interactive game",
      harbor: "Harbor task",
      "repository-engineering": "Repository engineering",
      "program-reconstruction": "Program reconstruction",
      "model-training": "Model training",
      spreadsheet: "Spreadsheet editing",
      "scientific-code": "Scientific code",
      "long-context-qa": "Long-context Q&A",
      "open-qa": "Open-answer Q&A",
      "visual-qa": "Visual Q&A",
      "document-parsing": "Document parsing",
      cybersecurity: "Cybersecurity",
      "format-archetype": "Format archetype",
    },
    roles: {
      documentation: "Documentation",
      "task-instruction": "Task instruction",
      "task-config": "Task configuration",
      environment: "Environment",
      "input-artifact": "Input artifact",
      "environment-helper": "Environment helper",
      "reference-solution": "Reference solution",
      verifier: "Verifier",
      repository: "Repository metadata",
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
    back: "返回 Benchmark Catalog",
    overviewTab: "概览",
    agentTab: "智能体视角",
    evaluationTab: "评测",
    recordTab: "发布方记录",
    filesTab: "题面与文件",
    provenanceTab: "来源",
    taskBrief: "任务简报",
    taskBriefNote: "简洁说明任务内容、输入及预期交付物。",
    taskContext: "任务上下文",
    benchmark: "Benchmark",
    source: "来源",
    path: "路径",
    role: "角色",
    kind: "类型",
    size: "大小",
    file: "文件",
    directory: "目录",
    openUpstream: "打开上游文件",
    selectFile: "选择文件以预览内容。",
    previewSource: "发布方托管的预览",
    previewSourceNote: "内容直接从已固定版本的上游仓库加载，本目录不代理或存储该文件。",
    loadingPreview: "正在从发布方加载文件…",
    previewError: "无法从发布方加载此文件。",
    binaryPreview: "浏览器预览无法呈现这种二进制格式。",
    openRaw: "打开原始文件",
    field: "字段",
    contains: "承载内容",
    availability: "可用范围",
    provenance: "发布方任务来源",
    provenanceNote: "原始材料仍由发布方托管并保持发布方语言。本目录只保存描述性元数据；文件预览直接从已固定版本的发布方仓库加载。",
    sourceId: "来源 ID",
    originalLanguage: "原始语言",
    taskFormat: "任务类型",
    benchmarkVersion: "Benchmark 版本",
    openOriginal: "打开发布方来源",
    anatomy: "任务结构解析",
    anatomyNote: "描述模型需要读取什么、产出什么，以及满足何种评分条件。",
    objective: "任务目标",
    inputs: "输入信息",
    expectedOutput: "预期输出",
    evaluation: "评分方式",
    capabilities: "能力模式",
    filesystem: "Harbor 任务文件系统",
    filesystemNote: "记录 Git 树快照中的完整上游任务包结构。选择文件即可预览发布方托管的内容。",
    repository: "代码仓库",
    snapshot: "Git 树快照",
    verified: "核验日期",
    files: "个文件",
    directories: "个目录",
    totalSize: "文件总大小",
    openRoot: "打开任务根目录",
    nativeRecord: "发布方原生任务记录",
    nativeRecordNote: "按照发布方实际使用的结构解析任务：记录字段、外链输入、执行路径、输出约定及评分约定。",
    formatBoundary: "受限 Benchmark",
    formatBoundaryNote: "仅展示发布方公开说明的记录结构，不复现任何受控题目、选项、答案、解析或附件。",
    publicBoundary: "来源链接式画像",
    publicBoundaryNote: "这里只记录字段名与任务结构；英文题面、答案、评分细则、测试及外链文件内容均保留在发布方源站。",
    recordFormat: "记录格式",
    recordDomain: "领域",
    recordSplit: "数据集划分",
    sourceObject: "来源对象",
    sourceMap: "来源记录字段图",
    sourceMapNote: "列出参与任务的每个发布方字段、字段角色及其承载的材料。",
    taskFlow: "任务执行路径",
    taskFlowNote: "展示原始记录如何转化为可评分的回答或交付物。",
    outputContract: "输出约定",
    gradingContract: "评分约定",
    catalogedMetadata: "已记录元数据",
    publisherOnly: "内容保留在上游",
    openEntry: "打开上游文件",
    formats: {
      "file-deliverable": "文件交付任务",
      "agent-simulation": "智能体模拟",
      desktop: "桌面交互",
      "web-research": "网络研究",
      "interactive-game": "交互式游戏",
      harbor: "Harbor 任务",
      "repository-engineering": "代码仓库工程",
      "program-reconstruction": "程序重建",
      "model-training": "模型训练",
      spreadsheet: "电子表格编辑",
      "scientific-code": "科学代码",
      "long-context-qa": "长上下文问答",
      "open-qa": "开放式问答",
      "visual-qa": "视觉问答",
      "document-parsing": "文档解析",
      cybersecurity: "网络安全",
      "format-archetype": "任务格式画像",
    },
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
  const context = modelBenchmarkSampleContext[benchmark.id];
  const filesystem = modelBenchmarkTaskFilesystems[sample.id];
  const nativeRecord = modelBenchmarkNativeTaskRecords[sample.id];
  const agentView = modelBenchmarkAgentViews[sample.id];
  const backHref = localPreview ? "/local-preview/model-benchmarks" : "/model-benchmarks";
  const [activeTab, setActiveTab] = useState<TaskDetailTab>("overview");
  const tabs: Array<{ id: TaskDetailTab; label: string }> = [
    { id: "overview", label: t.overviewTab },
    ...(agentView ? [{ id: "agent" as const, label: t.agentTab }] : []),
    ...(nativeRecord ? [{ id: "record" as const, label: t.recordTab }] : []),
    ...(filesystem ? [{ id: "files" as const, label: t.filesTab }] : []),
    { id: "evaluation", label: t.evaluationTab },
    { id: "provenance", label: t.provenanceTab },
  ];

  return <article className="model-task-detail">
    <header className="model-task-browser-head">
      <a className="model-task-back" href={backHref}><span aria-hidden>←</span>{t.back}</a>
      <div className="model-task-breadcrumb"><span>{benchmark.name}</span><span aria-hidden>/</span><code>{sample.sourceId ?? sample.id}</code></div>
      <div className="model-task-title-row">
        <div>
          <h1>{sample.title[language]}</h1>
          <p>{sample.objective[language]}</p>
        </div>
        <a className="model-task-primary-link" href={sample.sourceUrl} rel="noreferrer" target="_blank"><span>{sample.sourceLabel[language]}</span><strong>{t.openOriginal} ↗</strong></a>
      </div>
    </header>

    <div aria-label={t.taskContext} className="model-task-tabs" role="tablist">
      {tabs.map((tab) => <button
        aria-controls={`model-task-panel-${tab.id}`}
        aria-selected={activeTab === tab.id}
        className={activeTab === tab.id ? "active" : ""}
        key={tab.id}
        onClick={() => setActiveTab(tab.id)}
        role="tab"
        type="button"
      >{tab.label}</button>)}
    </div>

    <div className="model-task-panel" id={`model-task-panel-${activeTab}`} role="tabpanel">
      {activeTab === "agent" && agentView?.kind === "tau-runtime" ? <TauAgentInputView language={language} view={agentView} /> : null}
      {activeTab === "agent" && agentView?.kind === "publisher-contract" ? <PublisherAgentInputView language={language} sample={sample} view={agentView} /> : null}
      {activeTab === "overview" ? <TaskOverview language={language} sample={sample} /> : null}
      {activeTab === "record" && nativeRecord ? <NativeTaskRecordSection language={language} record={nativeRecord} sourceUrl={sample.sourceUrl} /> : null}
      {activeTab === "files" && filesystem ? <FilesystemBrowser filesystem={filesystem} language={language} /> : null}
      {activeTab === "evaluation" ? <TaskEvaluation agentView={agentView} filesystem={filesystem} language={language} nativeRecord={nativeRecord} sample={sample} /> : null}
      {activeTab === "provenance" ? <TaskProvenance benchmark={benchmark} context={context} language={language} sample={sample} /> : null}
    </div>
  </article>;
}

type TaskDetailTab = "agent" | "evaluation" | "overview" | "record" | "files" | "provenance";

const agentViewCopy = {
  en: {
    prompt: "System prompt",
    runtime: "Runtime inputs",
    hidden: "Hidden task state",
    defaultRuntime: "Default retrieval configuration: alltools",
    promptNote: "This text is sent in the system role. Tool schemas are supplied separately with the model request.",
    loading: "Loading and composing publisher prompt sources…",
    error: "The publisher sources could not be loaded or composed.",
    sourceFiles: "Prompt sources",
    openSource: "Open source",
    toolsTitle: "Tool payload",
    toolsNote: "These tools are available through the default banking knowledge configuration; their typed schemas travel outside the text prompt.",
    hiddenTitle: "Orchestrator-only task definition",
    hiddenNote: "The JSON below drives the simulator and grader. It is not pasted into the evaluated agent's context.",
    rawTask: "Open raw task",
  },
  zh: {
    prompt: "系统提示",
    runtime: "运行时输入",
    hidden: "隐藏任务状态",
    defaultRuntime: "默认检索配置：alltools",
    promptNote: "该文本以 system 角色发送。工具 schema 随模型请求单独提供。",
    loading: "正在加载并组合发布方提示源…",
    error: "无法加载或组合发布方提示源。",
    sourceFiles: "提示来源",
    openSource: "打开来源",
    toolsTitle: "工具载荷",
    toolsNote: "这些工具由默认 banking knowledge 配置提供；其类型化 schema 位于文本提示之外。",
    hiddenTitle: "仅编排器可见的任务定义",
    hiddenNote: "下方 JSON 用于驱动模拟器和评分器，不会粘贴进受测智能体的上下文。",
    rawTask: "打开原始任务",
  },
} as const;

const publisherAgentCopy = {
  en: {
    instruction: "Task instruction",
    instructionRole: "TASK / USER",
    summaryBoundary: "Catalog description — not prompt text",
    providedMaterial: "Provided material",
    providedMaterialNote: "The concrete files, records, environments, or external access available to the evaluated agent.",
    materialCount: "items",
    noMaterial: "No benchmark item or attached material is publicly available for this task.",
    publisherFile: "Publisher file",
    publisherRecord: "Publisher record",
    runtimeGenerated: "Generated at runtime",
    repository: "Repository checkout",
    environment: "Agent environment",
    toolAccess: "Tool access",
    openWeb: "Open web",
    openMaterial: "Open upstream",
    materialUnavailable: "This material is represented by the linked publisher record and is not directly previewable here.",
    noSeparateField: "No separate field is documented here.",
    payloadUpstream: "Payload at publisher",
    metadataHere: "Metadata cataloged",
    hiddenTitle: "State withheld from the evaluated agent",
    hiddenNote: "Identity, reference, and grader fields belong to orchestration or evaluation unless the publisher explicitly includes them in the visible instruction.",
    identity: "Orchestration metadata",
    reference: "Reference state",
    grader: "Grader inputs",
    notVisible: "Not agent-visible",
    gradingContract: "Scoring contract",
  },
  zh: {
    instruction: "任务指令",
    instructionRole: "TASK / USER",
    summaryBoundary: "目录描述，并非原始题面",
    providedMaterial: "提供的材料",
    providedMaterialNote: "受测智能体实际可用的文件、记录、环境或外部访问。",
    materialCount: "项",
    noMaterial: "该任务没有公开 Benchmark 条目或随附材料。",
    publisherFile: "发布方文件",
    publisherRecord: "发布方记录",
    runtimeGenerated: "运行时生成",
    repository: "代码仓库检出",
    environment: "智能体环境",
    toolAccess: "工具访问",
    openWeb: "开放网络",
    openMaterial: "打开上游来源",
    materialUnavailable: "该材料由所链接的发布方记录表示，无法在此直接预览。",
    noSeparateField: "此处未说明独立字段。",
    payloadUpstream: "内容保留在发布方",
    metadataHere: "已记录元数据",
    hiddenTitle: "不向受测智能体公开的状态",
    hiddenNote: "标识、参考答案与评分器字段属于编排或评测状态，除非发布方明确将其包含在可见指令中。",
    identity: "编排元数据",
    reference: "参考状态",
    grader: "评分器输入",
    notVisible: "智能体不可见",
    gradingContract: "评分约定",
  },
} as const;

const taskEvaluationCopy = {
  en: {
    eyebrow: "Evaluation contract",
    title: "How this task is evaluated",
    verifierArtifacts: "Verifier artifacts",
    verifierNote: "Publisher-hosted files that implement the task's checks.",
    noVerifier: "No separate verifier artifact is listed for this task.",
    openVerifier: "Open upstream",
    loading: "Loading the publisher's task definition…",
    error: "The publisher task definition could not be loaded.",
  },
  zh: {
    eyebrow: "评测约定",
    title: "该任务如何评测",
    verifierArtifacts: "评分器文件",
    verifierNote: "实现任务检查逻辑的发布方托管文件。",
    noVerifier: "该任务没有单独列出的评分器文件。",
    openVerifier: "打开上游文件",
    loading: "正在加载发布方任务定义…",
    error: "无法加载发布方任务定义。",
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
      <header><div><span>{t.defaultRuntime}</span><h3>{t.prompt}</h3><p>{t.promptNote}</p></div><a href={view.promptSources.agentRuntime.sourceUrl} rel="noreferrer" target="_blank">{t.openSource} ↗</a></header>
      {loadState.status === "loading" ? <div className="agent-input-state"><span className="task-file-preview-spinner" /><p>{t.loading}</p></div> : null}
      {loadState.status === "error" ? <div className="agent-input-state"><strong>{t.error}</strong></div> : null}
      {loadState.status === "ready" ? <pre><code>{loadState.systemPrompt}</code></pre> : null}
      <footer><strong>{t.sourceFiles}</strong><div>{promptSources.map((source) => <a href={source.sourceUrl} key={source.path} rel="noreferrer" target="_blank"><code>{source.path}</code><span>↗</span></a>)}</div></footer>
    </div>

    <div className="tau-agent-visible-inputs">
      <section><header><h3>{t.runtime}</h3></header><ul className="agent-runtime-inputs">{view.runtimeInputs.map((input) => <li key={input.en}>{input[language]}</li>)}</ul></section>
      <aside><header><h3>{t.toolsTitle}</h3><p>{t.toolsNote}</p></header>{view.toolGroups.map((group) => <div className="agent-tool-group" key={group.label.en}><strong>{group.label[language]}</strong><div>{group.tools.map((tool) => <code key={tool}>{tool}</code>)}</div></div>)}</aside>
    </div>
  </section>;
}

function PublisherAgentInputView({ language, sample, view }: {
  language: BenchmarkReferenceLanguage;
  sample: BenchmarkSampleTask;
  view: PublisherContractAgentView;
}) {
  const t = publisherAgentCopy[language];

  return <section className="agent-input-view publisher-agent-view">
    <div className="publisher-agent-input-panel">
      <section className="agent-message-contract">
        <header><span>{t.instructionRole}</span><div><h3>{t.instruction}</h3><p>{t.summaryBoundary}</p></div></header>
        <p className="agent-message-summary">{sample.objective[language]}</p>
      </section>

      <PublisherMaterialBrowser language={language} materials={view.materials} />
    </div>
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
    <header><div><h3>{t.providedMaterial}</h3><p>{t.providedMaterialNote}</p></div><span>{materials.length} {t.materialCount}</span></header>
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
  const [preview, setPreview] = useState<FilePreviewState>(material.rawUrl && previewKind !== "image" && previewKind !== "binary" ? { status: "loading" } : { status: "ready" });

  useEffect(() => {
    const controller = new AbortController();
    let objectUrl: string | undefined;
    if (!material.rawUrl || previewKind === "image" || previewKind === "binary") return () => controller.abort();
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
      {preview.status === "ready" && material.rawUrl && previewKind === "pdf" && preview.objectUrl ? <iframe src={`${preview.objectUrl}#view=FitH`} title={material.label[language]} /> : null}
      {preview.status === "ready" && (!material.rawUrl || previewKind === "binary") ? <div className="task-file-preview-state"><strong>{material.label[language]}</strong><p>{material.detail[language]}</p><a href={material.sourceUrl} rel="noreferrer" target="_blank">{material.rawUrl ? general.openRaw : t.openMaterial} ↗</a>{!material.rawUrl ? <small>{t.materialUnavailable}</small> : null}</div> : null}
    </div>
    <footer className="task-file-preview-note"><span aria-hidden>↗</span><p>{general.previewSourceNote}</p></footer>
  </section>;
}

function AgentContractFieldList({ emptyLabel, fields, language, metadataLabel, upstreamLabel }: {
  emptyLabel: string;
  fields: NativeTaskRecord["fields"];
  language: BenchmarkReferenceLanguage;
  metadataLabel?: string;
  upstreamLabel?: string;
}) {
  if (fields.length === 0) return <p className="agent-contract-empty">{emptyLabel}</p>;
  return <dl className="agent-contract-fields">{fields.map((field) => <div key={`${field.role}:${field.name}`}><dt><code>{field.name}</code>{metadataLabel && upstreamLabel ? <span>{field.payload === "cataloged-metadata" ? metadataLabel : upstreamLabel}</span> : null}</dt><dd>{field.summary[language]}</dd></div>)}</dl>;
}

function TaskEvaluation({ agentView, filesystem, language, nativeRecord, sample }: {
  agentView: ModelBenchmarkAgentView | undefined;
  filesystem: NonNullable<(typeof modelBenchmarkTaskFilesystems)[string]> | undefined;
  language: BenchmarkReferenceLanguage;
  nativeRecord: NativeTaskRecord | undefined;
  sample: BenchmarkSampleTask;
}) {
  const t = taskEvaluationCopy[language];
  return <section className="task-evaluation-panel">
    <header className="task-evaluation-overview"><span>{t.eyebrow}</span><h2>{t.title}</h2><p>{sample.evaluation[language]}</p></header>
    {agentView?.kind === "tau-runtime" ? <TauEvaluationDetail language={language} view={agentView} /> : null}
    {agentView?.kind === "publisher-contract" && nativeRecord ? <PublisherEvaluationDetail language={language} record={nativeRecord} /> : null}
    {filesystem ? <HarborEvaluationArtifacts filesystem={filesystem} language={language} /> : null}
  </section>;
}

type TauTaskDefinitionState =
  | { status: "loading" }
  | { status: "ready"; taskDefinition: string }
  | { status: "error" };

function TauEvaluationDetail({ language, view }: {
  language: BenchmarkReferenceLanguage;
  view: TauAgentRuntimeView;
}) {
  const t = agentViewCopy[language];
  const evaluationCopy = taskEvaluationCopy[language];
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

  return <div className="agent-input-hidden-panel tau-evaluation-detail">
    <header><div><span>{t.hidden}</span><h3>{t.hiddenTitle}</h3><p>{t.hiddenNote}</p></div><a href={view.taskDefinition.rawUrl} rel="noreferrer" target="_blank">{t.rawTask} ↗</a></header>
    <ul>{view.hiddenInputs.map((input) => <li key={input.en}>{input[language]}</li>)}</ul>
    {loadState.status === "loading" ? <div className="agent-input-state"><span className="task-file-preview-spinner" /><p>{evaluationCopy.loading}</p></div> : null}
    {loadState.status === "error" ? <div className="agent-input-state"><strong>{evaluationCopy.error}</strong></div> : null}
    {loadState.status === "ready" ? <pre><code>{loadState.taskDefinition}</code></pre> : null}
  </div>;
}

function PublisherEvaluationDetail({ language, record }: {
  language: BenchmarkReferenceLanguage;
  record: NativeTaskRecord;
}) {
  const t = publisherAgentCopy[language];
  const hiddenGroups: Array<{ label: string; role: NativeTaskFieldRole }> = [
    { label: t.identity, role: "identity" },
    { label: t.reference, role: "reference" },
    { label: t.grader, role: "grader" },
  ];
  return <div className="publisher-agent-hidden-panel">
    <header><div><span>{t.notVisible}</span><h3>{t.hiddenTitle}</h3><p>{t.hiddenNote}</p></div></header>
    <div className="publisher-hidden-groups">{hiddenGroups.map((group) => <section key={group.role}><header><h4>{group.label}</h4></header><AgentContractFieldList emptyLabel={t.noSeparateField} fields={record.fields.filter((item) => item.role === group.role)} language={language} metadataLabel={t.metadataHere} upstreamLabel={t.payloadUpstream} /></section>)}</div>
    <div className="publisher-grading-contract"><span>{t.gradingContract}</span><p>{record.gradingContract[language]}</p></div>
  </div>;
}

function HarborEvaluationArtifacts({ filesystem, language }: {
  filesystem: NonNullable<(typeof modelBenchmarkTaskFilesystems)[string]>;
  language: BenchmarkReferenceLanguage;
}) {
  const t = taskEvaluationCopy[language];
  const verifierEntries = filesystem.entries.filter((entry) => entry.kind === "file" && entry.role === "verifier");
  return <section className="harbor-evaluation-artifacts"><header><h3>{t.verifierArtifacts}</h3><p>{t.verifierNote}</p></header>{verifierEntries.length > 0 ? <ul>{verifierEntries.map((entry) => <li key={entry.path}><code>{entry.path}</code><a href={upstreamFilesystemEntryUrl(filesystem, entry)} rel="noreferrer" target="_blank">{t.openVerifier} ↗</a></li>)}</ul> : <p>{t.noVerifier}</p>}</section>;
}

function TaskOverview({ language, sample }: {
  language: BenchmarkReferenceLanguage;
  sample: BenchmarkSampleTask;
}) {
  const t = copy[language];
  return <section className="task-overview-panel">
    <header><h2>{t.taskBrief}</h2><p>{t.taskBriefNote}</p></header>
    <dl className="task-brief-rows">
      <div><dt>{t.inputs}</dt><dd>{sample.inputs[language]}</dd></div>
      <div><dt>{t.expectedOutput}</dt><dd>{sample.expectedOutput[language]}</dd></div>
    </dl>
    <aside className="task-capability-list"><span>{t.capabilities}</span><ul>{sample.capabilities[language].map((capability) => <li key={capability}>{capability}</li>)}</ul></aside>
  </section>;
}

function TaskProvenance({ benchmark, context, language, sample }: {
  benchmark: ModelBenchmarkReference;
  context: (typeof modelBenchmarkSampleContext)[string];
  language: BenchmarkReferenceLanguage;
  sample: BenchmarkSampleTask;
}) {
  const t = copy[language];
  return <section className="task-provenance-panel">
    <header><h2>{t.provenance}</h2><p>{t.provenanceNote}</p></header>
    <dl className="task-provenance-rows">
      <div><dt>{t.benchmark}</dt><dd>{benchmark.name}</dd></div>
      <div><dt>{t.sourceId}</dt><dd><code>{sample.sourceId ?? "—"}</code></dd></div>
      <div><dt>{t.taskFormat}</dt><dd>{formatLabel(context.format, language)}</dd></div>
      <div><dt>{t.originalLanguage}</dt><dd>{context.originalLanguage}</dd></div>
      <div><dt>{t.benchmarkVersion}</dt><dd>{benchmark.version ?? "—"}</dd></div>
      <div><dt>{t.source}</dt><dd>{sample.sourceLabel[language]}</dd></div>
    </dl>
    <a className="task-upstream-action" href={sample.sourceUrl} rel="noreferrer" target="_blank">{t.openOriginal}<span aria-hidden>↗</span></a>
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
  const [preview, setPreview] = useState<FilePreviewState>(previewKind === "image" || previewKind === "binary" ? { status: "ready" } : { status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    let objectUrl: string | undefined;

    if (previewKind === "image" || previewKind === "binary") {
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
      {preview.status === "ready" && previewKind === "pdf" && preview.objectUrl ? <iframe src={`${preview.objectUrl}#view=FitH`} title={entry.path} /> : null}
      {preview.status === "ready" && previewKind === "binary" ? <div className="task-file-preview-state"><strong>{t.binaryPreview}</strong><a href={contentUrl} rel="noreferrer" target="_blank">{t.openRaw} ↗</a></div> : null}
    </div>
    <footer className="task-file-preview-note"><span aria-hidden>↗</span><p>{t.previewSourceNote}</p></footer>
  </>;
}

function NativeTaskRecordSection({ language, record, sourceUrl }: {
  language: BenchmarkReferenceLanguage;
  record: NativeTaskRecord;
  sourceUrl: string;
}) {
  const t = copy[language];
  const formatOnly = record.availability === "format-only";
  return <section className="native-record-panel">
    <header className="native-record-intro">
      <div><h2>{t.nativeRecord}</h2><p>{t.nativeRecordNote}</p></div>
      <a href={sourceUrl} rel="noreferrer" target="_blank">{t.openOriginal} ↗</a>
    </header>

    <div className={`native-record-boundary ${formatOnly ? "protected" : "public"}`}>
      <strong>{formatOnly ? t.formatBoundary : t.publicBoundary}</strong><p>{formatOnly ? t.formatBoundaryNote : t.publicBoundaryNote}</p>
    </div>

    <dl className="native-record-facts">
      <div><dt>{t.recordFormat}</dt><dd>{record.publisherFormat[language]}</dd></div>
      <div><dt>{t.recordDomain}</dt><dd>{record.domain[language]}</dd></div>
      <div><dt>{t.recordSplit}</dt><dd>{record.split[language]}</dd></div>
      <div><dt>{t.sourceObject}</dt><dd>{record.sourceObject[language]}</dd></div>
    </dl>

    <section className="native-record-section">
      <header><h3>{t.sourceMap}</h3><p>{t.sourceMapNote}</p></header>
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

    <div className="native-record-lower">
      <section className="native-record-section"><header><h3>{t.taskFlow}</h3><p>{t.taskFlowNote}</p></header><ol className="native-task-flow">
        {record.stages.map((item, index) => <li key={item.label.en}><span>{String(index + 1).padStart(2, "0")}</span><div><h4>{item.label[language]}</h4><p>{item.summary[language]}</p></div></li>)}
      </ol></section>
      <dl className="native-contract-list">
        <div><dt>{t.outputContract}</dt><dd>{record.outputContract[language]}</dd></div>
        <div><dt>{t.gradingContract}</dt><dd>{record.gradingContract[language]}</dd></div>
      </dl>
    </div>
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

function formatLabel(format: BenchmarkSampleTaskFormat, language: BenchmarkReferenceLanguage): string {
  return copy[language].formats[format];
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

function filePreviewKind(path: string): "binary" | "image" | "pdf" | "text" {
  if (/\.(jpg|jpeg|png|gif|webp)$/i.test(path)) return "image";
  if (/\.pdf$/i.test(path)) return "pdf";
  if (/\.(db|encrypted)$/i.test(path)) return "binary";
  return "text";
}

function fileIcon(path: string): string {
  if (/\.(jpg|jpeg|png)$/i.test(path)) return "▧";
  if (/\.pdf$/i.test(path)) return "▤";
  if (/\.(py|sh)$/i.test(path)) return "⌘";
  if (/\.(db|encrypted)$/i.test(path)) return "◫";
  return "·";
}
