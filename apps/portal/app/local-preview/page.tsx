import { notFound } from "next/navigation";
import { LocalDownloadPreview } from "../portal-client";

export default function LocalPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <LocalDownloadPreview />;
}
