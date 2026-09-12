import { getPortalLanguage } from "../../portal-language-server";
import { readTaskListLocation, type PageSearchParams } from "../../task-navigation";
import { redirect } from "next/navigation";
import { getPortalSession } from "../../feishu-auth";
import PortalClient from "../../portal-client";

export const dynamic = "force-dynamic";

export default async function VendorTaskPage({ params, searchParams }: { params: Promise<{ taskId: string }>; searchParams: Promise<PageSearchParams> }) {
  const user = await getPortalSession();
  if (!user) redirect("/auth/login");
  // Vinext preserves percent-encoding in page params; decode before building API URLs.
  const taskId = decodeURIComponent((await params).taskId);
  const search = await searchParams;
  const returnTo = search.returnTo;
  const origin = readTaskListLocation(typeof returnTo === "string" ? returnTo : null, false);
  return <PortalClient initialLanguage={await getPortalLanguage({ ...search, lang: search.lang ?? origin?.language })} initialTaskOrigin={origin} initialVendorTaskId={taskId} initialView="vendor-task" user={{ name: user.name, avatarUrl: user.avatarUrl ?? undefined }} />;
}
