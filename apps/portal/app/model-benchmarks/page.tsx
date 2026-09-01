import type { Metadata } from "next";
import PortalClient from "../portal-client";
import { getPortalSession } from "../feishu-auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Environment Resource Management",
  description: "Benchmarks, task examples, official sources, and composite indexes.",
};

export default async function ModelBenchmarksPage() {
  const user = await getPortalSession();
  if (!user) redirect("/auth/login");
  return <PortalClient initialView="model-benchmarks" user={{ name: user.name, avatarUrl: user.avatarUrl }} />;
}
