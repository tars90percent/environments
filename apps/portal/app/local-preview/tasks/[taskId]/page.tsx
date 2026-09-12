import { notFound } from "next/navigation";
import PortalClient from "../../../portal-client";

export default async function PreviewVendorTaskPage({ params }: { params: Promise<{ taskId: string }> }) {
  if (process.env.NODE_ENV !== "development") notFound();
  const { taskId } = await params;
  return <PortalClient initialVendorTaskId={taskId} initialView="vendor-task" localPreview user={{ name: "Researcher" }} />;
}
