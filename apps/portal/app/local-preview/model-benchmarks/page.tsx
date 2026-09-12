import { getPortalLanguage } from "../../portal-language-server";
import type { PageSearchParams } from "../../task-navigation";
import { notFound } from "next/navigation";
import { LocalModelBenchmarkPreview } from "../../portal-client";

export default async function LocalModelBenchmarksPreviewPage({ searchParams }: { searchParams: Promise<PageSearchParams> }) {
  if (process.env.NODE_ENV !== "development") notFound();
  return <LocalModelBenchmarkPreview initialLanguage={await getPortalLanguage(await searchParams)} />;
}
