import { getPortalLanguage } from "../portal-language-server";
import type { PageSearchParams } from "../task-navigation";
import type { Metadata } from "next";
import PortalClient from "../portal-client";
import { getPortalSession } from "../feishu-auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Environment Resource Management",
  description: "Benchmarks, task examples, official sources, and composite indexes.",
};

export default async function ModelBenchmarksPage({ searchParams }: { searchParams: Promise<PageSearchParams> }) {
  const user = await getPortalSession();
  if (!user) redirect("/auth/login");
  return <PortalClient initialLanguage={await getPortalLanguage(await searchParams)} initialView="model-benchmarks" user={{ name: user.name, avatarUrl: user.avatarUrl }} />;
}
