import { readTaskListLocation, type PageSearchParams } from "../../../task-navigation";
import { notFound } from "next/navigation";
import PortalClient from "../../../portal-client";

export default async function PreviewVendorTaskPage({ params, searchParams }: { params: Promise<{ taskId: string }>; searchParams: Promise<PageSearchParams> }) {
  if (process.env.NODE_ENV !== "development") notFound();
  // Vinext preserves percent-encoding in page params; decode before building API URLs.
  const taskId = decodeURIComponent((await params).taskId);
  const returnTo = (await searchParams).returnTo;
  const origin = readTaskListLocation(typeof returnTo === "string" ? returnTo : null, true);
  return <PortalClient initialTaskOrigin={origin} initialVendorTaskId={taskId} initialView="vendor-task" localPreview user={{ name: "Researcher" }} />;
}
