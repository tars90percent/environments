import { taskDatasetArchive, taskDatasetFilename, type DatasetSubmission } from "../../dataset-archive";
import { previewTaskPackage } from "../preview-task-package";

const submission: DatasetSubmission = {
  id: "preview-submission",
  date: "2026-08-20",
  label: "August environment sample",
  source: "Captured vendor delivery",
  formats: ["harbor", "non_harbor"],
  tasks: [
    previewTask("preview-harbor", "repair-cache", "Repair cache invalidation"),
    previewTrace(),
  ],
};

export function GET() {
  if (process.env.NODE_ENV !== "development") return new Response("Not found", { status: 404 });
  const archive = taskDatasetArchive(submission, async (task) => {
    const artifactBytes = task.kind === "trace"
      ? new TextEncoder().encode('{"event":"browser_open","url":"https://example.test"}\n')
      : new Uint8Array(await previewTaskPackage(task.stableKey) ?? new ArrayBuffer(0));
    if (!artifactBytes.byteLength) return new Response("Not found", { status: 404 });
    return new Response(artifactBytes, { headers: { "content-length": String(artifactBytes.byteLength), "content-type": "application/octet-stream" } });
  });
  return new Response(archive, {
    headers: {
      "content-type": "application/x-tar",
      "content-disposition": `attachment; filename="${taskDatasetFilename(submission)}"`,
      "cache-control": "no-store",
    },
  });
}

function previewTask(id: string, stableKey: string, title: string) {
  return { id, stableKey, title, summary: null, kind: "task" as const, sourcePath: `tasks/${stableKey}`, format: "harbor" as const, benchmark: { id: "terminal-bench", displayName: "Terminal-Bench" }, artifactId: `artifact:preview:${stableKey}`, contentSha256: null, checks: {}, findings: [] };
}

function previewTrace() {
  return { id: "preview-trace", stableKey: "browser-trace", title: "Browser workflow trace", summary: null, kind: "trace" as const, sourcePath: "traces/session.jsonl", format: "non_harbor" as const, benchmark: { id: "unspecified", displayName: "Unspecified" }, artifactId: "artifact:preview:browser-trace", contentSha256: null, checks: {}, findings: [] };
}
