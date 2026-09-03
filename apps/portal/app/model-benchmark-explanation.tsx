"use client";

import type { ReactNode } from "react";
import {
  benchmarkReferenceCategories,
  type BenchmarkReferenceLanguage,
  type ModelBenchmarkReference,
} from "./model-benchmark-data";
import {
  modelBenchmarkExplanationVerifiedAt,
  type ModelBenchmarkExplanation,
} from "./model-benchmark-explanations";
import { featuredModelBenchmarkSamples } from "./model-benchmark-samples";

const copy = {
  en: {
    back: "Back to benchmark catalog",
    about: "Benchmark guide",
    current: "Current release",
    atGlance: "At a glance",
    items: "Distribution size",
    output: "What the model returns",
    scoring: "How it is scored",
    access: "Task access",
    domain: "What it is really testing",
    distribution: "What is in the distribution",
    difficulty: "Why it is difficult",
    time: "Time and interaction",
    failures: "Where models tend to stumble",
    interpretation: "How to read the result",
    primaryReading: "Primary reading",
    primaryReadingNote: "The explanation above is a synthesis of these publisher sources, checked on the date below—not a reproduction of their text.",
    checked: "Sources checked",
    samples: "Look at a task profile",
    samplesNote: "See the shape of a real public task, or a source-grounded format profile when the tasks are controlled.",
    openSample: "Open task profile",
    releaseHistory: "Release history",
    scoreBreak: "Scores not directly comparable",
    source: "Release source",
    accessLabels: {
      public: "Public tasks",
      "public-subset": "Public subset",
      gated: "Gated access",
      "public-tasks": "Public tasks · controlled grader",
      private: "Private task set",
    },
  },
  zh: {
    back: "返回 Benchmark Catalog",
    about: "基准指南",
    current: "当前版本",
    atGlance: "快速了解",
    items: "分布规模",
    output: "模型产出",
    scoring: "评分方式",
    access: "任务访问",
    domain: "它真正测试什么",
    distribution: "分布中包含什么",
    difficulty: "为什么困难",
    time: "时间与交互",
    failures: "模型常见失误",
    interpretation: "如何解读结果",
    primaryReading: "主要资料",
    primaryReadingNote: "以上说明是基于这些发布方资料、在下列日期核验后的综合转述，并非对原文的复刻。",
    checked: "资料核验于",
    samples: "查看任务画像",
    samplesNote: "查看真实公开任务的形态；若任务受控，则查看基于官方来源整理的格式画像。",
    openSample: "打开任务画像",
    releaseHistory: "版本历史",
    scoreBreak: "分数不可直接比较",
    source: "版本来源",
    accessLabels: {
      public: "公开任务",
      "public-subset": "公开子集",
      gated: "受控访问",
      "public-tasks": "公开任务 · 受控评分器",
      private: "私有任务集",
    },
  },
} as const;

export function ModelBenchmarkExplanationPage({ benchmark, explanation, language, localPreview }: {
  benchmark: ModelBenchmarkReference;
  explanation: ModelBenchmarkExplanation;
  language: BenchmarkReferenceLanguage;
  localPreview: boolean;
}) {
  const t = copy[language];
  const category = benchmarkReferenceCategories.find((entry) => entry.id === benchmark.categoryId);
  const samples = featuredModelBenchmarkSamples(benchmark);
  const basePath = localPreview ? "/local-preview" : "";

  return <article className="model-explanation">
    <header className="model-explanation-hero">
      <a className="model-task-back" href={`${basePath}/model-benchmarks`}><span aria-hidden>←</span>{t.back}</a>
      <div className="model-explanation-kicker"><span>{t.about}</span><i aria-hidden />{category?.label[language]}</div>
      <div className="model-explanation-title-row">
        <div>
          <h1>{benchmark.name}</h1>
          <p>{benchmark.summary[language]}</p>
        </div>
        {benchmark.version ? <div className="model-explanation-release"><span>{t.current}</span><strong>{benchmark.version}</strong>{benchmark.versionNote ? <p>{benchmark.versionNote[language]}</p> : null}</div> : null}
      </div>
    </header>

    <section className="model-explanation-glance" aria-labelledby="benchmark-glance-title">
      <h2 id="benchmark-glance-title">{t.atGlance}</h2>
      <dl>
        <div><dt>{t.items}</dt><dd>{benchmark.questionCount[language]}</dd></div>
        <div><dt>{t.output}</dt><dd>{benchmark.responseType?.[language] ?? "—"}</dd></div>
        <div><dt>{t.scoring}</dt><dd>{benchmark.scoring?.[language] ?? "—"}</dd></div>
        <div><dt>{t.access}</dt><dd>{benchmark.access ? t.accessLabels[benchmark.access] : "—"}</dd></div>
      </dl>
    </section>

    <div className="model-explanation-body">
      <section className="model-explanation-main">
        <ExplanationSection index="01" title={t.domain}><p>{explanation.orientation[language]}</p></ExplanationSection>
        <ExplanationSection index="02" title={t.distribution}><p>{explanation.distribution[language]}</p></ExplanationSection>
        <ExplanationSection index="03" title={t.difficulty}><p>{explanation.difficulty[language]}</p></ExplanationSection>
        <ExplanationSection index="04" title={t.time}><p>{explanation.time[language]}</p></ExplanationSection>
        <ExplanationSection index="05" title={t.failures}>
          <ul>{explanation.failureModes[language].map((mode) => <li key={mode}>{mode}</li>)}</ul>
        </ExplanationSection>
        <ExplanationSection index="06" title={t.interpretation}><p>{explanation.interpretation[language]}</p></ExplanationSection>
      </section>

      <aside className="model-explanation-aside">
        {samples.length > 0 ? <section className="model-explanation-samples">
          <span>{t.samples}</span>
          <p>{t.samplesNote}</p>
          <div>{samples.map((sample) => <a href={`${basePath}/model-benchmarks/${benchmark.id}/tasks/${sample.id}`} key={sample.id}>
            <small>{sample.versionId ?? benchmark.version}</small><strong>{sample.title[language]}</strong><em>{t.openSample} →</em>
          </a>)}</div>
        </section> : null}

        {benchmark.versions && benchmark.versions.length > 1 ? <section className="model-explanation-versions">
          <span>{t.releaseHistory}</span>
          <ol>{benchmark.versions.map((version) => <li className={version.id === benchmark.currentVersionId ? "current" : ""} key={version.id}>
            <div><strong>{version.label}</strong><small>{version.questionCount[language]}</small></div>
            <p>{version.note[language]}</p>
            <footer>{version.comparableToPrevious === false ? <span>{t.scoreBreak}</span> : null}<a href={version.sourceUrl} rel="noreferrer" target="_blank">{t.source} ↗</a></footer>
          </li>)}</ol>
        </section> : null}

        <section className="model-explanation-sources">
          <span>{t.primaryReading}</span>
          <p>{t.primaryReadingNote}</p>
          <ul>{explanation.sourceUrls.map((url) => <li key={url}><a href={url} rel="noreferrer" target="_blank"><strong>{sourceLabel(url, language)}</strong><small>{sourceHost(url)}</small><i aria-hidden>↗</i></a></li>)}</ul>
          <footer><span>{t.checked}</span><time dateTime={modelBenchmarkExplanationVerifiedAt}>{modelBenchmarkExplanationVerifiedAt}</time></footer>
        </section>
      </aside>
    </div>
  </article>;
}

function ExplanationSection({ children, index, title }: { children: ReactNode; index: string; title: string }) {
  return <section className="model-explanation-section"><header><span>{index}</span><h2>{title}</h2></header><div>{children}</div></section>;
}

function sourceLabel(url: string, language: BenchmarkReferenceLanguage) {
  if (url.includes("arxiv.org")) return language === "zh" ? "研究论文" : "Research paper";
  if (url.includes("/releases/") || url.includes("/blog/") || url.includes("/news/")) return language === "zh" ? "发布说明" : "Release notes";
  if (url.includes("github.com")) return language === "zh" ? "官方仓库" : "Official repository";
  if (url.includes("huggingface.co")) return language === "zh" ? "官方数据集" : "Official dataset";
  return language === "zh" ? "官方项目页面" : "Official project page";
}

function sourceHost(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
