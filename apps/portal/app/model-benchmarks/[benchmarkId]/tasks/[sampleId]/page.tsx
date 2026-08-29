import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { artificialAnalysisIndex } from "../../../../model-benchmark-data";
import { modelBenchmarkSamples } from "../../../../model-benchmark-samples";
import PortalClient from "../../../../portal-client";
import { getPortalSession } from "../../../../feishu-auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sample Task Analysis — 小环境",
  description: "Task-level structure, provenance, evaluation, and upstream filesystem metadata for a model benchmark sample.",
};

export default async function ModelBenchmarkTaskPage({ params }: { params: Promise<{ benchmarkId: string; sampleId: string }> }) {
  const { benchmarkId, sampleId } = await params;
  const benchmark = artificialAnalysisIndex.benchmarks.find((entry) => entry.id === benchmarkId);
  const sample = modelBenchmarkSamples[benchmarkId]?.find((entry) => entry.id === sampleId);
  if (!benchmark || !sample) notFound();

  const user = await getPortalSession();
  if (!user) redirect("/auth/login");
  return <PortalClient initialModelTask={{ benchmarkId, sampleId }} initialView="model-task" user={{ name: user.name, avatarUrl: user.avatarUrl }} />;
}
