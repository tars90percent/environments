"use client";

import { useEffect, useState } from "react";
import {
  artificialAnalysisIndex,
  modelBenchmarkSearchText,
  type BenchmarkReferenceAccess,
  type BenchmarkReferenceLanguage,
  type ModelBenchmarkReference,
} from "./model-benchmark-data";
import {
  modelBenchmarkSamples,
  modelBenchmarkSampleSearchText,
  modelBenchmarkSampleContext,
  type BenchmarkSampleTask,
} from "./model-benchmark-samples";

const copy = {
  en: {
    composition: "Index composition",
    compositionNote: "Weights shown below sum to the complete Intelligence Index score.",
    evaluations: "evaluations",
    weight: "of index",
    items: "Items",
    runs: "Runs",
    tools: "Tools",
    repeats: "repeats",
    oneRepeat: "repeat",
    toolUse: "Tool use",
    noToolUse: "No external tools",
    currentVersion: "Current version",
    sourceNote: "Curated metadata, paraphrased sample profiles, and official pointers. Benchmark task payloads are not copied into CASE storage.",
    noMatch: "No benchmark metadata matches this search.",
    sampleProfiles: "Sample task profiles",
    exploreSamples: "Explore 2 sample tasks",
    hideSamples: "Hide task analysis",
    insideBenchmark: "Inside the benchmark",
    publicSampleNote: "Two source-linked, paraphrased task profiles. Prompts, reference answers, attachments, and task packages remain with their publishers.",
    gatedSampleNote: "Access terms restrict the underlying questions, so these profiles describe two official task formats without reproducing benchmark items.",
    publicTask: "Public task",
    formatArchetype: "Format only",
    sourceId: "Source ID",
    objective: "Objective",
    inputs: "Inputs",
    expectedOutput: "Expected output",
    evaluation: "Evaluation",
    capabilityPattern: "Capability pattern",
    viewSource: "View official source",
    close: "Close analysis",
    access: {
      public: "Public tasks",
      "public-subset": "Public subset",
      gated: "Gated access",
      "public-tasks": "Public tasks · controlled grader",
    },
  },
  zh: {
    composition: "指数构成",
    compositionNote: "下列权重合计为完整 Intelligence Index 分数。",
    evaluations: "项评测",
    weight: "指数权重",
    items: "题目 / 任务",
    runs: "运行",
    tools: "工具",
    repeats: "次重复",
    oneRepeat: "次重复",
    toolUse: "使用工具",
    noToolUse: "不使用外部工具",
    currentVersion: "当前版本",
    sourceNote: "仅保留整理后的元数据、转述性样例画像与官方指针，不将基准任务内容复制到 CASE 存储。",
    noMatch: "没有匹配搜索条件的基准元数据。",
    sampleProfiles: "样例任务画像",
    exploreSamples: "查看 2 项样例任务",
    hideSamples: "收起任务解析",
    insideBenchmark: "深入基准任务",
    publicSampleNote: "两项带来源链接的转述性任务画像。提示、参考答案、附件及任务包仍由原发布方保存。",
    gatedSampleNote: "由于访问条款限制底层问题，此处仅依据官方说明展示两种任务格式，不复现任何基准题目。",
    publicTask: "公开任务",
    formatArchetype: "仅格式说明",
    sourceId: "来源 ID",
    objective: "任务目标",
    inputs: "输入信息",
    expectedOutput: "预期输出",
    evaluation: "评分方式",
    capabilityPattern: "能力模式",
    viewSource: "查看官方来源",
    close: "关闭解析",
    access: {
      public: "公开任务",
      "public-subset": "公开子集",
      gated: "受控访问",
      "public-tasks": "公开任务 · 受控评分器",
    },
  },
} as const;

export function ModelBenchmarkReferencePage({ language, localPreview, query }: { language: BenchmarkReferenceLanguage; localPreview: boolean; query: string }) {
  const t = copy[language];
  const [expandedBenchmarkId, setExpandedBenchmarkId] = useState<string | null>(null);
  const normalizedQuery = query.trim().toLowerCase();
  const visible = normalizedQuery
    ? artificialAnalysisIndex.benchmarks.filter((benchmark) => `${modelBenchmarkSearchText(benchmark)} ${modelBenchmarkSampleSearchText(benchmark.id)}`.includes(normalizedQuery))
    : artificialAnalysisIndex.benchmarks;

  useEffect(() => {
    if (!expandedBenchmarkId) return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(`task-analysis-${expandedBenchmarkId}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [expandedBenchmarkId]);

  return <div className="model-reference">
    <section className="index-composition" aria-labelledby="index-composition-title">
      <div className="index-composition-copy">
        <div><span>{t.composition}</span><h2 id="index-composition-title">{artificialAnalysisIndex.name}</h2></div>
        <p>{t.compositionNote}</p>
      </div>
      <div className="weight-band" role="img" aria-label={artificialAnalysisIndex.categories.map((category) => `${category.label[language]} ${category.weight}%`).join(", ")}>
        {artificialAnalysisIndex.categories.map((category) => <span className={`weight-segment ${category.id}`} key={category.id} style={{ width: `${category.weight}%` }}>
          <strong>{category.weight}%</strong><small>{category.label[language]}</small>
        </span>)}
      </div>
      <div className="reference-source-note"><span aria-hidden>↗</span><p>{t.sourceNote}</p><div><a href={artificialAnalysisIndex.methodologyUrl} rel="noreferrer" target="_blank">Methodology</a><a href={artificialAnalysisIndex.evaluationUrl} rel="noreferrer" target="_blank">Leaderboard</a><a href={artificialAnalysisIndex.changelogUrl} rel="noreferrer" target="_blank">Changelog</a></div></div>
    </section>

    {visible.length === 0 ? <div className="state-card">{t.noMatch}</div> : <div className="model-reference-groups">
      {artificialAnalysisIndex.categories.map((category, index) => {
        const benchmarks = visible.filter((benchmark) => benchmark.categoryId === category.id);
        if (!benchmarks.length) return null;
        return <section className="model-reference-group" key={category.id}>
          <header>
            <div className="category-index">{String(index + 1).padStart(2, "0")}</div>
            <div><h2>{category.label[language]}</h2><p>{category.description[language]}</p></div>
            <div className="model-reference-group-total"><strong>{category.weight}%</strong><span>{t.weight}</span><small>{benchmarks.length} {t.evaluations}</small></div>
          </header>
          <div className="model-benchmark-grid">{benchmarks.map((benchmark) => <ModelBenchmarkCard
            benchmark={benchmark}
            expanded={expandedBenchmarkId === benchmark.id}
            key={benchmark.id}
            language={language}
            onToggleSamples={() => setExpandedBenchmarkId((current) => current === benchmark.id ? null : benchmark.id)}
          />)}</div>
          {benchmarks.map((benchmark) => expandedBenchmarkId === benchmark.id
            ? <BenchmarkTaskAnalysis benchmark={benchmark} key={`${benchmark.id}-analysis`} language={language} localPreview={localPreview} onClose={() => setExpandedBenchmarkId(null)} />
            : null)}
        </section>;
      })}
    </div>}
  </div>;
}

function ModelBenchmarkCard({ benchmark, expanded, language, onToggleSamples }: {
  benchmark: ModelBenchmarkReference;
  expanded: boolean;
  language: BenchmarkReferenceLanguage;
  onToggleSamples: () => void;
}) {
  const t = copy[language];
  return <article className="model-benchmark-card">
    <div className="model-benchmark-card-head">
      <div className="model-benchmark-weight"><strong>{benchmark.weight}%</strong><span>{t.weight}</span></div>
      <AccessBadge access={benchmark.access} language={language} />
    </div>
    <div className="model-benchmark-identity"><span>{benchmark.publisher}</span><h3>{benchmark.name}</h3><p>{benchmark.summary[language]}</p></div>
    <div className="model-benchmark-version"><span>{t.currentVersion}</span><strong>{benchmark.version}</strong><p>{benchmark.versionNote[language]}</p></div>
    <dl className="model-benchmark-facts">
      <div><dt>{t.items}</dt><dd><strong>{benchmark.questionCount[language]}</strong><span>{benchmark.responseType[language]}</span></dd></div>
      <div><dt>{t.runs}</dt><dd><strong>{benchmark.repeats} {benchmark.repeats === 1 ? t.oneRepeat : t.repeats}</strong><span>{benchmark.scoring[language]}</span></dd></div>
      <div><dt>{t.tools}</dt><dd><strong>{benchmark.toolUse ? t.toolUse : t.noToolUse}</strong></dd></div>
    </dl>
    <button
      aria-controls={`task-analysis-${benchmark.id}`}
      aria-expanded={expanded}
      className={`benchmark-sample-trigger${expanded ? " active" : ""}`}
      onClick={onToggleSamples}
      type="button"
    >
      <span className="benchmark-sample-trigger-mark" aria-hidden><i /><i /></span>
      <span><small>{t.sampleProfiles}</small><strong>{expanded ? t.hideSamples : t.exploreSamples}</strong></span>
      <span className="benchmark-sample-trigger-arrow" aria-hidden>{expanded ? "×" : "↘"}</span>
    </button>
    <div className="model-benchmark-links">{benchmark.links.map((link) => <a href={link.url} key={link.url} rel="noreferrer" target="_blank">{link.label[language]}<span aria-hidden>↗</span></a>)}</div>
  </article>;
}

function BenchmarkTaskAnalysis({ benchmark, language, localPreview, onClose }: {
  benchmark: ModelBenchmarkReference;
  language: BenchmarkReferenceLanguage;
  localPreview: boolean;
  onClose: () => void;
}) {
  const t = copy[language];
  const samples = modelBenchmarkSamples[benchmark.id] ?? [];
  const formatOnly = samples.every((sample) => sample.sourceKind === "format-archetype");

  return <section className="benchmark-task-analysis" id={`task-analysis-${benchmark.id}`} aria-labelledby={`task-analysis-title-${benchmark.id}`}>
    <div className="benchmark-task-analysis-head">
      <div>
        <span>{t.sampleProfiles} · {benchmark.name}</span>
        <h3 id={`task-analysis-title-${benchmark.id}`}>{t.insideBenchmark}</h3>
        <p>{formatOnly ? t.gatedSampleNote : t.publicSampleNote}</p>
      </div>
      <button onClick={onClose} type="button"><span aria-hidden>×</span>{t.close}</button>
    </div>
    <div className="benchmark-task-profiles">
      {samples.map((sample, index) => <BenchmarkTaskProfile benchmarkId={benchmark.id} index={index} key={sample.id} language={language} localPreview={localPreview} sample={sample} />)}
    </div>
  </section>;
}

function BenchmarkTaskProfile({ benchmarkId, index, language, localPreview, sample }: {
  benchmarkId: string;
  index: number;
  language: BenchmarkReferenceLanguage;
  localPreview: boolean;
  sample: BenchmarkSampleTask;
}) {
  const t = copy[language];
  const harborTask = modelBenchmarkSampleContext[benchmarkId]?.format === "harbor";
  const kindLabel = harborTask ? (language === "zh" ? "Harbor 任务" : "Harbor task") : sample.sourceKind === "public-task" ? t.publicTask : t.formatArchetype;
  return <article className="benchmark-task-profile">
    <div className="benchmark-task-profile-head">
      <span className="benchmark-task-profile-number">{String(index + 1).padStart(2, "0")}</span>
      <span className={`benchmark-task-profile-kind ${sample.sourceKind}${harborTask ? " harbor-format" : ""}`}>{kindLabel}</span>
    </div>
    <h4>{sample.title[language]}</h4>
    {sample.sourceId ? <div className="benchmark-task-source-id"><span>{t.sourceId}</span><code>{sample.sourceId}</code></div> : null}
    <div className="benchmark-task-objective"><span>{t.objective}</span><p>{sample.objective[language]}</p></div>
    <dl className="benchmark-task-breakdown">
      <div><dt>{t.inputs}</dt><dd>{sample.inputs[language]}</dd></div>
      <div><dt>{t.expectedOutput}</dt><dd>{sample.expectedOutput[language]}</dd></div>
      <div><dt>{t.evaluation}</dt><dd>{sample.evaluation[language]}</dd></div>
    </dl>
    <div className="benchmark-task-capabilities"><span>{t.capabilityPattern}</span><div>{sample.capabilities[language].map((capability) => <i key={capability}>{capability}</i>)}</div></div>
    <div className="benchmark-task-actions">
      <a className="benchmark-task-detail-link" href={`${localPreview ? "/local-preview" : ""}/model-benchmarks/${benchmarkId}/tasks/${sample.id}`}>{harborTask ? (language === "zh" ? "查看任务与完整文件系统" : "View task & full filesystem") : (language === "zh" ? "查看完整任务解析" : "Open full task view")}<span aria-hidden>→</span></a>
      <a className="benchmark-task-source-link" href={sample.sourceUrl} rel="noreferrer" target="_blank"><span>{sample.sourceLabel[language]}</span><strong>{t.viewSource} ↗</strong></a>
    </div>
  </article>;
}

function AccessBadge({ access, language }: { access: BenchmarkReferenceAccess; language: BenchmarkReferenceLanguage }) {
  return <span className={`reference-access ${access}`}><i aria-hidden />{copy[language].access[access]}</span>;
}
