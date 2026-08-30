import type { CSSProperties } from "react";
import type { BenchmarkReferenceLanguage, ModelBenchmarkReference } from "./model-benchmark-data";
import {
  modelBenchmarkSampleContext,
  type BenchmarkSampleTask,
  type BenchmarkSampleTaskFormat,
} from "./model-benchmark-samples";
import {
  modelBenchmarkTaskFilesystems,
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
    back: "Back to model benchmarks",
    provenance: "Published task provenance",
    provenanceNote: "The original material remains in the publisher's language. This catalog describes the task; it does not translate or duplicate the prompt, answer, attachments, or package.",
    sourceId: "Source ID",
    originalLanguage: "Original language",
    taskFormat: "Task format",
    benchmarkVersion: "Benchmark version",
    openOriginal: "Open original task at source",
    anatomy: "Task anatomy",
    anatomyNote: "A descriptive map of what the task asks the model to consume, produce, and satisfy.",
    objective: "Objective",
    inputs: "Inputs",
    expectedOutput: "Expected output",
    evaluation: "Evaluation",
    capabilities: "Capability pattern",
    filesystem: "Harbor task filesystem",
    filesystemNote: "Complete upstream package tree at the recorded Git snapshot. Paths, roles, and sizes are metadata; file contents remain on GitHub.",
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
    back: "返回模型基准",
    provenance: "发布方任务来源",
    provenanceNote: "原始材料保持发布方语言。本目录仅用中文描述任务，不翻译或复制题面、答案、附件及任务包。",
    sourceId: "来源 ID",
    originalLanguage: "原始语言",
    taskFormat: "任务格式",
    benchmarkVersion: "基准版本",
    openOriginal: "在原始来源中打开任务",
    anatomy: "任务结构解析",
    anatomyNote: "描述模型需要读取什么、产出什么，以及满足何种评分条件。",
    objective: "任务目标",
    inputs: "输入信息",
    expectedOutput: "预期输出",
    evaluation: "评分方式",
    capabilities: "能力模式",
    filesystem: "Harbor 任务文件系统",
    filesystemNote: "记录 Git 树快照中的完整上游任务包结构。这里只保存路径、角色与大小，文件内容仍在 GitHub。",
    repository: "代码仓库",
    snapshot: "Git 树快照",
    verified: "核验日期",
    files: "个文件",
    directories: "个目录",
    totalSize: "文件总大小",
    openRoot: "打开任务根目录",
    nativeRecord: "发布方原生任务记录",
    nativeRecordNote: "按照发布方实际使用的结构解析任务：记录字段、外链输入、执行路径、输出约定及评分约定。",
    formatBoundary: "受保护基准",
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
  const backHref = localPreview ? "/local-preview/model-benchmarks" : "/model-benchmarks";

  return <article className="model-task-detail">
    <a className="model-task-back" href={backHref}><span aria-hidden>←</span>{t.back}</a>

    <section className="model-task-source-card">
      <div className="model-task-section-index">01</div>
      <div className="model-task-source-copy">
        <span>{t.provenance}</span>
        <h2>{benchmark.name}</h2>
        <p>{t.provenanceNote}</p>
      </div>
      <dl className="model-task-source-facts">
        <div><dt>{t.sourceId}</dt><dd><code>{sample.sourceId ?? "—"}</code></dd></div>
        <div><dt>{t.originalLanguage}</dt><dd>{context.originalLanguage}</dd></div>
        <div><dt>{t.taskFormat}</dt><dd>{formatLabel(context.format, language)}</dd></div>
        <div><dt>{t.benchmarkVersion}</dt><dd>{benchmark.version ?? "—"}</dd></div>
      </dl>
      <a className="model-task-primary-link" href={sample.sourceUrl} rel="noreferrer" target="_blank"><span>{sample.sourceLabel[language]}</span><strong>{t.openOriginal} ↗</strong></a>
    </section>

    <section className="model-task-anatomy" id="task-anatomy">
      <header className="model-task-section-head">
        <div className="model-task-section-index">02</div>
        <div><h2>{t.anatomy}</h2><p>{t.anatomyNote}</p></div>
      </header>
      <div className="model-task-anatomy-grid">
        <TaskAnatomyBlock index="A" label={t.objective} value={sample.objective[language]} />
        <TaskAnatomyBlock index="B" label={t.inputs} value={sample.inputs[language]} />
        <TaskAnatomyBlock index="C" label={t.expectedOutput} value={sample.expectedOutput[language]} />
        <TaskAnatomyBlock index="D" label={t.evaluation} value={sample.evaluation[language]} />
      </div>
      <div className="model-task-capability-strip"><span>{t.capabilities}</span><div>{sample.capabilities[language].map((capability) => <i key={capability}>{capability}</i>)}</div></div>
    </section>

    {filesystem ? <section className="model-task-filesystem" id="task-filesystem">
      <header className="model-task-section-head">
        <div className="model-task-section-index">03</div>
        <div><h2>{t.filesystem}</h2><p>{t.filesystemNote}</p></div>
      </header>
      <div className="filesystem-meta">
        <div><span>{t.repository}</span><strong>{filesystem.repository}</strong></div>
        <div><span>{t.snapshot}</span><code>{filesystem.treeSha.slice(0, 12)}</code></div>
        <div><span>{t.verified}</span><strong>{filesystem.verifiedAt}</strong></div>
      </div>
      <div className="filesystem-summary">
        <span><strong>{filesystem.entries.filter((entry) => entry.kind === "file").length}</strong>{t.files}</span>
        <span><strong>{filesystem.entries.filter((entry) => entry.kind === "directory").length}</strong>{t.directories}</span>
        <span><strong>{formatBytes(filesystem.entries.reduce((total, entry) => total + (entry.sizeBytes ?? 0), 0))}</strong>{t.totalSize}</span>
        <a href={filesystem.rootUrl} rel="noreferrer" target="_blank">{t.openRoot} ↗</a>
      </div>
      <div className="filesystem-tree" role="tree" aria-label={t.filesystem}>
        <a aria-expanded="true" aria-level={1} aria-selected="false" className="filesystem-root" href={filesystem.rootUrl} rel="noreferrer" role="treeitem" target="_blank"><span aria-hidden>⌂</span><code>/{filesystem.repositoryPath.split("/").at(-1)}</code><strong>Harbor task root</strong></a>
        {filesystem.entries.map((entry) => <FilesystemEntry entry={entry} filesystem={filesystem} key={entry.path} language={language} />)}
      </div>
    </section> : nativeRecord ? <NativeTaskRecordSection language={language} record={nativeRecord} sourceUrl={sample.sourceUrl} /> : null}
  </article>;
}

function NativeTaskRecordSection({ language, record, sourceUrl }: {
  language: BenchmarkReferenceLanguage;
  record: NativeTaskRecord;
  sourceUrl: string;
}) {
  const t = copy[language];
  const formatOnly = record.availability === "format-only";
  return <section className="model-task-native-record" id="task-native-record">
    <header className="model-task-section-head">
      <div className="model-task-section-index">03</div>
      <div><h2>{t.nativeRecord}</h2><p>{t.nativeRecordNote}</p></div>
    </header>

    <div className={`native-record-boundary ${formatOnly ? "protected" : "public"}`}>
      <span aria-hidden>{formatOnly ? "◇" : "◎"}</span>
      <div><strong>{formatOnly ? t.formatBoundary : t.publicBoundary}</strong><p>{formatOnly ? t.formatBoundaryNote : t.publicBoundaryNote}</p></div>
      <a href={sourceUrl} rel="noreferrer" target="_blank">{t.openOriginal} ↗</a>
    </div>

    <dl className="native-record-facts">
      <div><dt>{t.recordFormat}</dt><dd>{record.publisherFormat[language]}</dd></div>
      <div><dt>{t.recordDomain}</dt><dd>{record.domain[language]}</dd></div>
      <div><dt>{t.recordSplit}</dt><dd>{record.split[language]}</dd></div>
      <div><dt>{t.sourceObject}</dt><dd>{record.sourceObject[language]}</dd></div>
    </dl>

    <div className="native-record-subhead"><div><h3>{t.sourceMap}</h3><p>{t.sourceMapNote}</p></div><span>{record.fields.length.toString().padStart(2, "0")}</span></div>
    <div className="native-field-grid">
      {record.fields.map((item) => <article key={item.name}>
        <header><code>{item.name}</code><span>{nativeRoleLabel(item.role, language)}</span></header>
        <p>{item.summary[language]}</p>
        <footer className={item.payload === "cataloged-metadata" ? "cataloged" : "upstream"}><i aria-hidden />{item.payload === "cataloged-metadata" ? t.catalogedMetadata : t.publisherOnly}</footer>
      </article>)}
    </div>

    <div className="native-record-subhead flow"><div><h3>{t.taskFlow}</h3><p>{t.taskFlowNote}</p></div><span>{record.stages.length.toString().padStart(2, "0")}</span></div>
    <ol className="native-task-flow">
      {record.stages.map((item, index) => <li key={item.label.en}>
        <span>{String(index + 1).padStart(2, "0")}</span>
        <div><h4>{item.label[language]}</h4><p>{item.summary[language]}</p></div>
      </li>)}
    </ol>

    <div className="native-contract-grid">
      <article><span>OUT</span><div><h3>{t.outputContract}</h3><p>{record.outputContract[language]}</p></div></article>
      <article><span>✓</span><div><h3>{t.gradingContract}</h3><p>{record.gradingContract[language]}</p></div></article>
    </div>
  </section>;
}

function TaskAnatomyBlock({ index, label, value }: { index: string; label: string; value: string }) {
  return <article><span>{index}</span><div><h3>{label}</h3><p>{value}</p></div></article>;
}

function FilesystemEntry({ entry, filesystem, language }: {
  entry: UpstreamTaskFilesystemEntry;
  filesystem: NonNullable<(typeof modelBenchmarkTaskFilesystems)[string]>;
  language: BenchmarkReferenceLanguage;
}) {
  const t = copy[language];
  const depth = entry.path.split("/").length - 1;
  const name = entry.path.split("/").at(-1);
  const style = { "--tree-indent": `${12 + depth * 22}px` } as CSSProperties;
  return <a
    aria-expanded={entry.kind === "directory" ? "true" : undefined}
    aria-level={depth + 2}
    aria-selected="false"
    className={`filesystem-entry ${entry.kind}`}
    href={upstreamFilesystemEntryUrl(filesystem, entry)}
    rel="noreferrer"
    role="treeitem"
    style={style}
    target="_blank"
    title={`${t.openEntry}: ${entry.path}`}
  >
    <span className="filesystem-entry-icon" aria-hidden>{entry.kind === "directory" ? "▾" : fileIcon(entry.path)}</span>
    <code>{name}{entry.kind === "directory" ? "/" : ""}</code>
    <span className="filesystem-entry-role">{t.roles[entry.role]}</span>
    <span className="filesystem-entry-size">{entry.sizeBytes === null ? "—" : formatBytes(entry.sizeBytes)}</span>
    <span className="filesystem-entry-open" aria-hidden>↗</span>
  </a>;
}

function formatLabel(format: BenchmarkSampleTaskFormat, language: BenchmarkReferenceLanguage): string {
  return copy[language].formats[format];
}

function nativeRoleLabel(role: NativeTaskFieldRole, language: BenchmarkReferenceLanguage): string {
  return copy[language].nativeRoles[role];
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

function fileIcon(path: string): string {
  if (/\.(jpg|jpeg|png)$/i.test(path)) return "▧";
  if (/\.pdf$/i.test(path)) return "▤";
  if (/\.(py|sh)$/i.test(path)) return "⌘";
  if (/\.(db|encrypted)$/i.test(path)) return "◫";
  return "·";
}
