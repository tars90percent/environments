import { notFound } from "next/navigation";
import { findModelBenchmark } from "../../../model-benchmark-data";
import { modelBenchmarkExplanations } from "../../../model-benchmark-explanations";
import PortalClient from "../../../portal-client";

export default async function LocalModelBenchmarkExplanationRoute({ params }: { params: Promise<{ benchmarkId: string }> }) {
  if (process.env.NODE_ENV !== "development") notFound();
  const { benchmarkId } = await params;
  const benchmark = findModelBenchmark(benchmarkId);
  const explanation = benchmark ? modelBenchmarkExplanations[benchmark.id] : undefined;
  if (!benchmark || !explanation) notFound();

  return <PortalClient initialModelBenchmarkId={benchmark.id} initialModelExplanation={explanation} initialView="model-explanation" localPreview user={{ name: "Researcher" }} />;
}
