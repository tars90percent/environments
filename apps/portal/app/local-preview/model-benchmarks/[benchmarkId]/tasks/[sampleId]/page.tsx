import { getPortalLanguage } from "../../../../../portal-language-server";
import type { PageSearchParams } from "../../../../../task-navigation";
import { notFound } from "next/navigation";
import { findModelBenchmark } from "../../../../../model-benchmark-data";
import { modelBenchmarkSamples } from "../../../../../model-benchmark-samples";
import PortalClient from "../../../../../portal-client";

export default async function LocalModelBenchmarkTaskPreviewPage({ params, searchParams }: { searchParams: Promise<PageSearchParams>; params: Promise<{ benchmarkId: string; sampleId: string }> }) {
  if (process.env.NODE_ENV !== "development") notFound();
  const { benchmarkId, sampleId } = await params;
  const benchmark = findModelBenchmark(benchmarkId);
  const sample = benchmark ? modelBenchmarkSamples[benchmark.id]?.find((entry) => entry.id === sampleId) : undefined;
  if (!benchmark || !sample) notFound();

  return <PortalClient initialLanguage={await getPortalLanguage(await searchParams)} initialModelTask={{ benchmarkId: benchmark.id, sampleId }} initialView="model-task" localPreview user={{ name: "Researcher" }} />;
}
