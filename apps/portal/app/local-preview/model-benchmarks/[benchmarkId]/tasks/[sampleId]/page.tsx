import { notFound } from "next/navigation";
import { findModelBenchmark } from "../../../../../model-benchmark-data";
import { modelBenchmarkSamples } from "../../../../../model-benchmark-samples";
import PortalClient from "../../../../../portal-client";

export default async function LocalModelBenchmarkTaskPreviewPage({ params }: { params: Promise<{ benchmarkId: string; sampleId: string }> }) {
  if (process.env.NODE_ENV !== "development") notFound();
  const { benchmarkId, sampleId } = await params;
  const benchmark = findModelBenchmark(benchmarkId);
  const sample = benchmark ? modelBenchmarkSamples[benchmark.id]?.find((entry) => entry.id === sampleId) : undefined;
  if (!benchmark || !sample) notFound();

  return <PortalClient initialModelTask={{ benchmarkId: benchmark.id, sampleId }} initialView="model-task" localPreview user={{ name: "Researcher" }} />;
}
