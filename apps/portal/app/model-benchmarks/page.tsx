import type { Metadata } from "next";
import PortalClient from "../portal-client";
import { getPortalSession } from "../feishu-auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Model Benchmark Reference — 小环境",
  description: "Standalone model benchmark families with official sources and sample task profiles, plus separate aggregate-index compositions and weights.",
};

export default async function ModelBenchmarksPage() {
  const user = await getPortalSession();
  if (!user) redirect("/auth/login");
  return <PortalClient initialView="model-benchmarks" user={{ name: user.name, avatarUrl: user.avatarUrl }} />;
}
