"use client";

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
  featuredModelBenchmarkSamples,
  modelBenchmarkSampleSearchText,
} from "./model-benchmark-samples";

const copy = {
  en: {
    benchmarks: "Benchmarks",
    aggregateSection: "Aggregate benchmarks",
    aggregateNote: "Composite scores are listed separately, with their constituent evaluations and weights linked back to the standalone benchmark families above.",
    constituents: "constituents",
    weight: "weight",
    creators: "Created by",
    items: "Items",
    runs: "Runs",
    tools: "Tools",
    repeats: "repeats",
    oneRepeat: "repeat",
    toolUse: "Tool use",
    noToolUse: "No external tools",
    currentVersion: "Version / release",
    releaseHistory: "Release history",
    currentRelease: "Current",
    scoresNotComparable: "Not directly comparable",
    releaseSource: "Source",
    versionChanges: {
      initial: "Initial set",
      maintenance: "Maintenance",
      expansion: "Expansion",
      "major-revision": "Major revision",
      replacement: "New task set",
      pruning: "Pruned revision",
    },
    noMatch: "No benchmark metadata matches this search.",
    sampleProfiles: "Sample task profiles",
    exploreSamples: "Explore task profiles",
    hideSamples: "Hide task analysis",
    insideBenchmark: "Inside the benchmark",
    publicSampleNote: "Source-linked, paraphrased task profiles. Prompts, reference answers, attachments, and task packages remain with their publishers.",
    gatedSampleNote: "Access terms restrict the underlying questions, so these profiles describe official task formats without reproducing benchmark items.",
    officialLeaderboard: "Official leaderboard snapshot",
    leaderboardNote: "A time-stamped view from the benchmark's official site. Rankings may have changed since capture.",
    captured: "Captured",
    openLeaderboard: "Open live leaderboard",
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
      private: "Private task set",
    },
  },
  zh: {
    benchmarks: "Benchmarks",
    aggregateSection: "综合基准",
    aggregateNote: "综合分数单独列出，并展示其组成评测及权重，同时链接回上方独立基准家族。",
    constituents: "项组成评测",
    weight: "权重",
    creators: "创建机构",
    items: "题目 / 任务",
    runs: "运行",
    tools: "工具",
    repeats: "次重复",
    oneRepeat: "次重复",
    toolUse: "使用工具",
    noToolUse: "不使用外部工具",
    currentVersion: "版本 / 发布",
    releaseHistory: "版本历史",
    currentRelease: "当前版本",
    scoresNotComparable: "分数不可直接比较",
    releaseSource: "来源",
    versionChanges: {
      initial: "首个版本",
      maintenance: "维护更新",
      expansion: "扩展更新",
      "major-revision": "重大更新",
      replacement: "全新任务集",
      pruning: "精编修订",
    },
    noMatch: "没有匹配搜索条件的基准元数据。",
    sampleProfiles: "样例任务画像",
    exploreSamples: "查看任务画像",
    hideSamples: "收起任务解析",
    insideBenchmark: "深入基准任务",
    publicSampleNote: "带来源链接的转述性任务画像。提示、参考答案、附件及任务包仍由原发布方保存。",
    gatedSampleNote: "由于访问条款限制底层问题，此处仅依据官方说明展示任务格式，不复现任何基准题目。",
    officialLeaderboard: "官方排行榜截图",
    leaderboardNote: "来自基准官方站点的带时间戳视图；排名可能已在截图后发生变化。",
    captured: "截图日期",
    openLeaderboard: "打开实时排行榜",
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
      private: "私有任务集",
    },
  },
} as const;

export function ModelBenchmarkReferencePage({ language, localPreview, query }: { language: BenchmarkReferenceLanguage; localPreview: boolean; query: string }) {
  const t = copy[language];
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

  return <div className="model-reference">
    <section className="benchmark-catalog-intro" aria-labelledby="benchmark-catalog-title">
      <h2 id="benchmark-catalog-title">{modelBenchmarks.length} {t.benchmarks}</h2>
    </section>

    {visible.length === 0 && visibleAggregates.length === 0 ? <div className="state-card">{t.noMatch}</div> : null}
    {visible.length > 0 ? <div className="model-reference-groups">
      {benchmarkReferenceCategories.map((category, index) => {
        const benchmarks = visible.filter((benchmark) => benchmark.categoryId === category.id);
        if (!benchmarks.length) return null;
        return <section className="model-reference-group" key={category.id}>
          <header>
            <div className="category-index">{String(index + 1).padStart(2, "0")}</div>
            <div className="model-reference-group-heading">
              <div><h2>{category.label[language]}</h2><span>{benchmarks.length} {t.benchmarks}</span></div>
              <p>{category.description[language]}</p>
            </div>
          </header>
          <div className="model-benchmark-grid">{benchmarks.map((benchmark) => <ModelBenchmarkCard
            benchmark={benchmark}
            key={benchmark.id}
            language={language}
            localPreview={localPreview}
          />)}</div>
        </section>;
      })}
    </div> : null}

    {visibleAggregates.length > 0 ? <section className="aggregate-benchmark-section" aria-labelledby="aggregate-benchmarks-title">
      <header>
        <span>Σ</span>
        <div><h2 id="aggregate-benchmarks-title">{t.aggregateSection}</h2><p>{t.aggregateNote}</p></div>
      </header>
      <div className="aggregate-benchmark-list">
        {visibleAggregates.map((aggregate) => <AggregateBenchmarkCard aggregate={aggregate} key={aggregate.id} language={language} />)}
      </div>
    </section> : null}
  </div>;
}

function ModelBenchmarkCard({ benchmark, language, localPreview }: {
  benchmark: ModelBenchmarkReference;
  language: BenchmarkReferenceLanguage;
  localPreview: boolean;
}) {
  const t = copy[language];
  const samples = featuredModelBenchmarkSamples(benchmark);
  return <article className="model-benchmark-card" id={`benchmark-${benchmark.id}`}>
    <div className="model-benchmark-card-head">
      {benchmark.access ? <AccessBadge access={benchmark.access} language={language} /> : null}
    </div>
    <div className="model-benchmark-identity"><span>{benchmark.publisher}</span><h3>{benchmark.name}</h3><p>{benchmark.summary[language]}</p></div>
    <div className="model-benchmark-creators"><span>{t.creators}</span><p>{benchmark.publisher}</p></div>
    {benchmark.version ? <div className="model-benchmark-version"><span>{t.currentVersion}</span><strong>{benchmark.version}</strong>{benchmark.versionNote ? <p>{benchmark.versionNote[language]}</p> : null}</div> : null}
    {benchmark.versions && benchmark.versions.length > 1 ? <details className="model-benchmark-history">
      <summary><span>{t.releaseHistory}</span><strong>{benchmark.versions.length}</strong></summary>
      <ol>{benchmark.versions.map((version) => <li className={version.id === benchmark.currentVersionId ? "current" : ""} key={version.id}>
        <div><strong>{version.label}</strong><span>{t.versionChanges[version.change]}</span>{version.id === benchmark.currentVersionId ? <em>{t.currentRelease}</em> : null}</div>
        <p>{version.note[language]}</p>
        <footer><span>{version.questionCount[language]}</span>{version.comparableToPrevious === false ? <span>{t.scoresNotComparable}</span> : null}<a href={version.sourceUrl} rel="noreferrer" target="_blank">{t.releaseSource} ↗</a></footer>
      </li>)}</ol>
    </details> : null}
    <dl className="model-benchmark-facts">
      <div><dt>{t.items}</dt><dd><strong>{benchmark.questionCount[language]}</strong>{benchmark.responseType ? <span>{benchmark.responseType[language]}</span> : null}</dd></div>
      {benchmark.repeats !== undefined ? <div><dt>{t.runs}</dt><dd><strong>{benchmark.repeats} {benchmark.repeats === 1 ? t.oneRepeat : t.repeats}</strong>{benchmark.scoring ? <span>{benchmark.scoring[language]}</span> : null}</dd></div> : null}
    </dl>
    {samples.length > 0 ? <a
      className="benchmark-sample-trigger"
      href={`${localPreview ? "/local-preview" : ""}/model-benchmarks/${benchmark.id}/tasks/${samples[0].id}`}
    >
      <span className="benchmark-sample-trigger-mark" aria-hidden><i /><i /></span>
      <span><small>{samples[0].versionId ? `${samples[0].versionId} · ` : ""}{samples.length} {t.sampleProfiles}</small><strong>{t.exploreSamples}</strong></span>
      <span className="benchmark-sample-trigger-arrow" aria-hidden>→</span>
    </a> : null}
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
        <a href={`#benchmark-${component.benchmarkId}`}><span>{component.evaluationName}</span><small>{modelBenchmarks.find((benchmark) => benchmark.id === component.benchmarkId)?.name}{component.benchmarkVersion ? ` · ${component.benchmarkVersion}` : ""}</small></a>
        <strong>{component.weight}%</strong>
      </li>)}
    </ol>
    <footer>{aggregate.links.map((link) => <a href={link.url} key={link.url} rel="noreferrer" target="_blank">{link.label[language]}<span aria-hidden>↗</span></a>)}</footer>
  </article>;
}

function AccessBadge({ access, language }: { access: BenchmarkReferenceAccess; language: BenchmarkReferenceLanguage }) {
  return <span className={`reference-access ${access}`}><i aria-hidden />{copy[language].access[access]}</span>;
}
