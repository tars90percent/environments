import PortalClient from "./portal-client";
import { getPortalSession } from "./feishu-auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getPortalSession();
  if (!user) redirect("/auth/login");
  return <PortalClient user={{ name: user.name, avatarUrl: user.avatarUrl }} />;
}
