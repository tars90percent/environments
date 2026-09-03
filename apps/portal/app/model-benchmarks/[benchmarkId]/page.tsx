import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { findModelBenchmark } from "../../model-benchmark-data";
import { modelBenchmarkExplanations } from "../../model-benchmark-explanations";
import PortalClient from "../../portal-client";
import { getPortalSession } from "../../feishu-auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Environment Resource Management",
  description: "A source-grounded guide to a benchmark’s domain, distribution, difficulty, runtime, failure modes, and score interpretation.",
};

export default async function ModelBenchmarkExplanationRoute({ params }: { params: Promise<{ benchmarkId: string }> }) {
  const { benchmarkId } = await params;
  const benchmark = findModelBenchmark(benchmarkId);
  const explanation = benchmark ? modelBenchmarkExplanations[benchmark.id] : undefined;
  if (!benchmark || !explanation) notFound();

  const user = await getPortalSession();
  if (!user) redirect("/auth/login");
  return <PortalClient initialModelBenchmarkId={benchmark.id} initialModelExplanation={explanation} initialView="model-explanation" user={{ name: user.name, avatarUrl: user.avatarUrl }} />;
}
