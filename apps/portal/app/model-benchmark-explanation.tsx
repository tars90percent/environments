"use client";

import { featuredModelBenchmarkSamples } from "./model-benchmark-samples";
import { localizedHref } from "./portal-language";
import type { BenchmarkReferenceLanguage, ModelBenchmarkReference } from "./model-benchmark-data";
import { modelBenchmarkExplanationVerifiedAt, type ModelBenchmarkExplanation } from "./model-benchmark-explanations";

export function ModelBenchmarkExplanationPage({ benchmark, explanation, language, localPreview }: {
  benchmark: ModelBenchmarkReference;
  explanation: ModelBenchmarkExplanation;
  language: BenchmarkReferenceLanguage;
  localPreview: boolean;
}) {
  const samples = featuredModelBenchmarkSamples(benchmark);
  const verifiedAt = explanation.verifiedAt ?? modelBenchmarkExplanationVerifiedAt;
  return <article className="benchmark-article">
    <a className="model-task-back" href={localizedHref(`${localPreview ? "/local-preview" : ""}/model-benchmarks`, language)}>
      <span aria-hidden>←</span>{language === "zh" ? "返回基准目录" : "Back to benchmark catalog"}
    </a>
    <h1>{benchmark.name}</h1>
    <p className="benchmark-article-byline">{benchmark.publisher}{benchmark.version ? ` · ${benchmark.version}` : ""}</p>
    <div className="benchmark-article-copy">{explanation.paragraphs.map((paragraph, index) => <p key={index}>{paragraph[language]}</p>)}</div>
    {samples.length > 0 ? <a className="benchmark-article-tasks" href={localizedHref(`${localPreview ? "/local-preview" : ""}/model-benchmarks/${benchmark.id}/tasks/${samples[0].id}`, language)}>
      {language === "zh" ? "查看任务画像" : "Explore task profiles"}<span aria-hidden>→</span>
    </a> : null}
    <footer className="benchmark-article-sources">
      <span>{language === "zh" ? "来源" : "Sources"}</span>
      {explanation.sourceUrls.map((url) => <a href={url} key={url} rel="noreferrer" target="_blank">{sourceLabel(url, language)}</a>)}
      <small>{language === "zh" ? "资料核验于" : "Sources checked"} <time dateTime={verifiedAt}>{verifiedAt}</time></small>
    </footer>
  </article>;
}

function sourceLabel(url: string, language: BenchmarkReferenceLanguage) {
  if (url.includes("arxiv.org")) return language === "zh" ? "论文" : "Paper";
  if (url.includes("/methodology/")) return language === "zh" ? "评测方法" : "Methodology";
  if (url.includes("/articles/") || url.includes("/releases/") || url.includes("/blog/") || url.includes("/news/")) return language === "zh" ? "发布说明" : "Release notes";
  if (url.includes("github.com")) return language === "zh" ? "官方仓库" : "Repository";
  if (url.includes("huggingface.co")) return language === "zh" ? "数据集" : "Dataset";
  return new URL(url).hostname.replace(/^www\./, "");
}
