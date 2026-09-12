import { taskListPageLocation, type PageSearchParams } from "../task-navigation";
import { notFound } from "next/navigation";
import { LocalDownloadPreview } from "../portal-client";

export default async function LocalPreviewPage({ searchParams }: { searchParams: Promise<PageSearchParams> }) {
  if (process.env.NODE_ENV !== "development") notFound();
  return <LocalDownloadPreview initialListLocation={taskListPageLocation(await searchParams, true)} />;
}
