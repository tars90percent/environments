import { redirect } from "next/navigation";
import { getPortalSession } from "../../feishu-auth";
import PortalClient from "../../portal-client";

export const dynamic = "force-dynamic";

export default async function VendorTaskPage({ params }: { params: Promise<{ taskId: string }> }) {
  const user = await getPortalSession();
  if (!user) redirect("/auth/login");
  // Vinext preserves percent-encoding in page params; decode before building API URLs.
  const taskId = decodeURIComponent((await params).taskId);
  return <PortalClient initialVendorTaskId={taskId} initialView="vendor-task" user={{ name: user.name, avatarUrl: user.avatarUrl ?? undefined }} />;
}
