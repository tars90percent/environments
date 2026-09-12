import { taskListPageLocation, type PageSearchParams } from "./task-navigation";
import PortalClient from "./portal-client";
import { getPortalSession } from "./feishu-auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<PageSearchParams> }) {
  const user = await getPortalSession();
  if (!user) redirect("/auth/login");
  return <PortalClient initialListLocation={taskListPageLocation(await searchParams)} user={{ name: user.name, avatarUrl: user.avatarUrl }} />;
}
