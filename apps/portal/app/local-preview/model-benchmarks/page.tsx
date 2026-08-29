import { notFound } from "next/navigation";
import { LocalModelBenchmarkPreview } from "../../portal-client";

export default function LocalModelBenchmarksPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <LocalModelBenchmarkPreview />;
}
