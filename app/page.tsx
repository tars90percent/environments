import PortalClient from "./portal-client";
import { getPortalSession } from "./feishu-auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

type HomeProps = {
  searchParams?: Promise<{ preview?: string }>;
};

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;
  const localDemandPreview = process.env.NODE_ENV !== "production"
    && params?.preview === "demand-board";
  const user = localDemandPreview ? null : await getPortalSession();
  if (!user && !localDemandPreview) redirect("/auth/login");

  return <PortalClient
    initialView={localDemandPreview ? "demand" : "supply"}
    localPreview={localDemandPreview}
    user={user ? { name: user.name, avatarUrl: user.avatarUrl } : { name: "Local preview" }}
  />;
}
