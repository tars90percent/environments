import { notFound } from "next/navigation";
import PortalClient from "../../../portal-client";

export default async function PreviewVendorTaskPage({ params }: { params: Promise<{ taskId: string }> }) {
  if (process.env.NODE_ENV !== "development") notFound();
  // Vinext preserves percent-encoding in page params; decode before building API URLs.
  const taskId = decodeURIComponent((await params).taskId);
  return <PortalClient initialVendorTaskId={taskId} initialView="vendor-task" localPreview user={{ name: "Researcher" }} />;
}
