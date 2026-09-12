import { getPortalLanguage } from "../../../../portal-language-server";
import type { PageSearchParams } from "../../../../task-navigation";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { findModelBenchmark } from "../../../../model-benchmark-data";
import { modelBenchmarkSamples } from "../../../../model-benchmark-samples";
import PortalClient from "../../../../portal-client";
import { getPortalSession } from "../../../../feishu-auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Environment Resource Management",
  description: "Task-level structure, provenance, evaluation, and upstream filesystem metadata for a model benchmark sample.",
};

export default async function ModelBenchmarkTaskPage({ params, searchParams }: { searchParams: Promise<PageSearchParams>; params: Promise<{ benchmarkId: string; sampleId: string }> }) {
  const { benchmarkId, sampleId } = await params;
  const benchmark = findModelBenchmark(benchmarkId);
  const sample = benchmark ? modelBenchmarkSamples[benchmark.id]?.find((entry) => entry.id === sampleId) : undefined;
  if (!benchmark || !sample) notFound();

  const user = await getPortalSession();
  if (!user) redirect("/auth/login");
  return <PortalClient initialLanguage={await getPortalLanguage(await searchParams)} initialModelTask={{ benchmarkId: benchmark.id, sampleId }} initialView="model-task" user={{ name: user.name, avatarUrl: user.avatarUrl }} />;
}
