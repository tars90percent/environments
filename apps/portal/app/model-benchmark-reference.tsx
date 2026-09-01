"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import {
  aggregateBenchmarks,
  artificialAnalysisIndex,
  benchmarkReferenceCategories,
  modelBenchmarks,
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
    benchmarks: "benchmarks",
    aggregateSection: "Composite indexes",
    constituents: "Benchmarks",
    items: "Size",
    runs: "Runs",
    repeats: "runs",
    oneRepeat: "run",
    currentVersion: "Release",
    noMatch: "No benchmarks match your search.",
    sampleProfiles: "task examples",
    oneSample: "task example",
    hideSamples: "Hide examples",
    taskExamples: "Task examples",
    officialLeaderboard: "Leaderboard",
    captured: "Captured",
    openLeaderboard: "Open leaderboard",
    publicTask: "Public task",
    formatArchetype: "Task format",
    sourceId: "Task ID",
    objective: "Task",
    inputs: "Inputs",
    expectedOutput: "Output",
    evaluation: "Scoring",
    capabilityPattern: "Skills tested",
    viewSource: "Official source",
    close: "Close",
    access: {
      public: "Open",
      "public-subset": "Public subset",
      gated: "Gated",
      "public-tasks": "Open tasks · gated grader",
      private: "Private",
    },
  },
  zh: {
    benchmarks: "个 Benchmark",
    aggregateSection: "综合指数",
    constituents: "Benchmarks",
    items: "规模",
    runs: "运行次数",
    repeats: "次",
    oneRepeat: "次",
    currentVersion: "版本",
    noMatch: "没有匹配的 Benchmark。",
    sampleProfiles: "个任务样例",
    oneSample: "个任务样例",
    hideSamples: "收起样例",
    taskExamples: "任务样例",
    officialLeaderboard: "排行榜",
    captured: "更新于",
    openLeaderboard: "打开排行榜",
    publicTask: "公开任务",
    formatArchetype: "Task 格式",
    sourceId: "Task ID",
    objective: "任务",
    inputs: "输入",
    expectedOutput: "输出",
    evaluation: "评分",
    capabilityPattern: "考察能力",
    viewSource: "官方来源",
    close: "关闭",
    access: {
      public: "公开",
      "public-subset": "公开子集",
      gated: "受限",
      "public-tasks": "公开任务 · Grader 受限",
      private: "私有",
    },
  },
} as const;

export function ModelBenchmarkReferencePage({ language, localPreview, query }: { language: BenchmarkReferenceLanguage; localPreview: boolean; query: string }) {
  const t = copy[language];
  const [expandedBenchmarkId, setExpandedBenchmarkId] = useState<string | null>(null);
  const normalizedQuery = query.trim().toLowerCase();
  const visible = normalizedQuery
    ? modelBenchmarks.filter((benchmark) => `${modelBenchmarkSearchText(benchmark)} ${modelBenchmarkSampleSearchText(benchmark.id)}`.includes(normalizedQuery))
    : modelBenchmarks;
  const visibleAggregates = normalizedQuery
    ? aggregateBenchmarks.filter((aggregate) => [
      aggregate.name,
      aggregate.publisher,
      aggregate.version,
      aggregate.summary.en,
      aggregate.summary.zh,
      ...aggregate.components.flatMap((component) => [component.evaluationName, modelBenchmarks.find((benchmark) => benchmark.id === component.benchmarkId)?.name ?? ""]),
    ].join(" ").toLowerCase().includes(normalizedQuery))
    : aggregateBenchmarks;

  useEffect(() => {
    if (!expandedBenchmarkId) return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(`task-analysis-${expandedBenchmarkId}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [expandedBenchmarkId]);

  return <div className="model-reference">
    {visible.length === 0 && visibleAggregates.length === 0 ? <div className="state-card">{t.noMatch}</div> : null}
    {visible.length > 0 ? <div className="model-reference-groups">
      {benchmarkReferenceCategories.map((category) => {
        const benchmarks = visible.filter((benchmark) => benchmark.categoryId === category.id);
        if (!benchmarks.length) return null;
        return <section className="model-reference-group" key={category.id}>
          <header>
            <h2>{category.label[language]}</h2>
            <div className="model-reference-group-total"><strong>{benchmarks.length}</strong><span>{t.benchmarks}</span></div>
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
    </div> : null}

    {visibleAggregates.length > 0 ? <section className="aggregate-benchmark-section" aria-labelledby="aggregate-benchmarks-title">
      <header>
        <h2 id="aggregate-benchmarks-title">{t.aggregateSection}</h2>
      </header>
      <div className="aggregate-benchmark-list">
        {visibleAggregates.map((aggregate) => <AggregateBenchmarkCard aggregate={aggregate} key={aggregate.id} language={language} />)}
      </div>
    </section> : null}
  </div>;
}

function ModelBenchmarkCard({ benchmark, expanded, language, onToggleSamples }: {
  benchmark: ModelBenchmarkReference;
  expanded: boolean;
  language: BenchmarkReferenceLanguage;
  onToggleSamples: () => void;
}) {
  const t = copy[language];
  const samples = modelBenchmarkSamples[benchmark.id] ?? [];
  return <article className="model-benchmark-card" id={`benchmark-${benchmark.id}`}>
    <div className="model-benchmark-card-head">
      <span>{benchmark.publisher}</span>
      {benchmark.access ? <AccessBadge access={benchmark.access} language={language} /> : null}
    </div>
    <div className="model-benchmark-identity"><h3>{benchmark.name}</h3>{benchmark.aliases?.length ? <div className="benchmark-aliases">{benchmark.aliases.map((alias) => <i key={alias}>{alias}</i>)}</div> : null}<p>{benchmark.summary[language]}</p></div>
    <dl className="model-benchmark-facts">
      <div><dt>{t.items}</dt><dd><strong>{benchmark.questionCount[language]}</strong>{benchmark.responseType ? <span>{benchmark.responseType[language]}</span> : null}</dd></div>
      {benchmark.version ? <div><dt>{t.currentVersion}</dt><dd><strong>{benchmark.version}</strong></dd></div> : null}
      {benchmark.repeats !== undefined ? <div><dt>{t.runs}</dt><dd><strong>{benchmark.repeats} {benchmark.repeats === 1 ? t.oneRepeat : t.repeats}</strong>{benchmark.scoring ? <span>{benchmark.scoring[language]}</span> : null}</dd></div> : null}
    </dl>
    {samples.length > 0 ? <button
      aria-controls={`task-analysis-${benchmark.id}`}
      aria-expanded={expanded}
      className={`benchmark-sample-trigger${expanded ? " active" : ""}`}
      onClick={onToggleSamples}
      type="button"
    >
      <span className="benchmark-sample-trigger-mark" aria-hidden><i /><i /></span>
      <strong>{expanded ? t.hideSamples : `${samples.length} ${samples.length === 1 ? t.oneSample : t.sampleProfiles}`}</strong>
      <span className="benchmark-sample-trigger-arrow" aria-hidden>{expanded ? "×" : "↘"}</span>
    </button> : null}
    <div className="model-benchmark-links">{benchmark.links.map((link) => <a href={link.url} key={link.url} rel="noreferrer" target="_blank">{link.label[language]}<span aria-hidden>↗</span></a>)}</div>
  </article>;
}

function AggregateBenchmarkCard({ aggregate, language }: {
  aggregate: typeof artificialAnalysisIndex;
  language: BenchmarkReferenceLanguage;
}) {
  const t = copy[language];
  return <article className="aggregate-benchmark-card">
    <header>
      <div><span>{aggregate.publisher}</span><h3>{aggregate.name}</h3><p>{aggregate.summary[language]}</p></div>
      <dl><div><dt>{t.currentVersion}</dt><dd>v{aggregate.version}</dd></div><div><dt>{t.constituents}</dt><dd>{aggregate.components.length}</dd></div></dl>
    </header>
    <div className="aggregate-weight-band" aria-label={aggregate.components.map((component) => `${component.evaluationName} ${component.weight}%`).join(", ")} role="img">
      {aggregate.components.map((component) => <span key={component.evaluationName} style={{ width: `${component.weight}%` }} title={`${component.evaluationName} · ${component.weight}%`} />)}
    </div>
    <ol className="aggregate-components">
      {aggregate.components.map((component) => <li key={component.evaluationName}>
        <a href={`#benchmark-${component.benchmarkId}`}><span>{component.evaluationName}</span><small>{modelBenchmarks.find((benchmark) => benchmark.id === component.benchmarkId)?.name}</small></a>
        <strong>{component.weight}%</strong>
      </li>)}
    </ol>
    <footer>{aggregate.links.map((link) => <a href={link.url} key={link.url} rel="noreferrer" target="_blank">{link.label[language]}<span aria-hidden>↗</span></a>)}</footer>
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
  const leaderboardSnapshots = benchmark.leaderboardSnapshots ?? [];

  return <section className="benchmark-task-analysis" id={`task-analysis-${benchmark.id}`} aria-labelledby={`task-analysis-title-${benchmark.id}`}>
    <div className="benchmark-task-analysis-head">
      <div>
        <h3 id={`task-analysis-title-${benchmark.id}`}>{benchmark.name} · {t.taskExamples}</h3>
      </div>
      <button onClick={onClose} type="button"><span aria-hidden>×</span>{t.close}</button>
    </div>
    {leaderboardSnapshots.length ? <div className="benchmark-leaderboard-gallery" aria-label={`${benchmark.name} · ${t.officialLeaderboard}`}>
      {leaderboardSnapshots.map((snapshot) => <figure className="benchmark-leaderboard-figure" key={snapshot.imagePath}>
        <header>
          <div><span>{t.officialLeaderboard}</span><p>{snapshot.caption[language]}</p></div>
          <a href={snapshot.sourceUrl} rel="noreferrer" target="_blank">{t.openLeaderboard}<span aria-hidden>↗</span></a>
        </header>
        <a className="benchmark-leaderboard-image" href={snapshot.sourceUrl} rel="noreferrer" target="_blank">
          <Image alt={snapshot.alt[language]} height={720} loading="lazy" sizes="(max-width: 520px) calc(100vw - 68px), (max-width: 1100px) calc(100vw - 120px), 1040px" src={snapshot.imagePath} width={1280} />
        </a>
        <figcaption><span>{t.captured}: {snapshot.capturedAt}</span></figcaption>
      </figure>)}
    </div> : null}
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
