import { notFound } from "next/navigation";
import { modelBenchmarks } from "../../../../../model-benchmark-data";
import { modelBenchmarkSamples } from "../../../../../model-benchmark-samples";
import PortalClient from "../../../../../portal-client";

export default async function LocalModelBenchmarkTaskPreviewPage({ params }: { params: Promise<{ benchmarkId: string; sampleId: string }> }) {
  if (process.env.NODE_ENV !== "development") notFound();
  const { benchmarkId, sampleId } = await params;
  const benchmark = modelBenchmarks.find((entry) => entry.id === benchmarkId);
  const sample = modelBenchmarkSamples[benchmarkId]?.find((entry) => entry.id === sampleId);
  if (!benchmark || !sample) notFound();

  return <PortalClient initialModelTask={{ benchmarkId, sampleId }} initialView="model-task" localPreview user={{ name: "Researcher" }} />;
}
