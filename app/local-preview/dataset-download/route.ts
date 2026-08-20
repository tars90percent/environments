import { taskDatasetArchive, taskDatasetFilename, type DatasetSubmission } from "../../dataset-archive";
import { previewTaskPackage } from "../preview-task-package";

const submission: DatasetSubmission = {
  id: "preview-submission",
  date: "2026-08-20",
  label: "August environment sample",
  source: "Captured vendor delivery",
  formats: ["harbor"],
  categories: [{
    id: "software-repair",
    name: "Software repair",
    tasks: [
      previewTask("preview-task-version-1", "repair-cache-invalidation", "Repair cache invalidation across workers", "ready_for_research", { pass: 6, fail: 0, blocked: 0, notRun: 0 }),
      previewTask("preview-task-version-2", "audit-release-manifest", "Audit release manifest provenance", "needs_vendor_fix", { pass: 4, fail: 2, blocked: 0, notRun: 0 }),
    ],
  }, {
    id: "computer-use",
    name: "Computer use",
    tasks: [previewTask("preview-task-version-3", "compare-quarterly-reports", "Compare quarterly reports across sources", "checking", { pass: 3, fail: 0, blocked: 3, notRun: 0 })],
  }],
};

export function GET() {
  if (process.env.NODE_ENV !== "development") return new Response("Not found", { status: 404 });
  const archive = taskDatasetArchive(submission, async (task) => {
    const packageBytes = await previewTaskPackage(task.stableKey);
    if (!packageBytes) return new Response("Not found", { status: 404 });
    return new Response(packageBytes, { headers: { "content-length": String(packageBytes.byteLength), "content-type": "application/gzip" } });
  });
  return new Response(archive, {
    headers: {
      "content-type": "application/x-tar",
      "content-disposition": `attachment; filename="${taskDatasetFilename(submission)}"`,
      "cache-control": "no-store",
    },
  });
}

function previewTask(id: string, stableKey: string, title: string, workflowStatus: string, checks: { pass: number; fail: number; blocked: number; notRun: number }) {
  return { id, stableKey, title, sourcePath: `tasks/${stableKey}`, format: "harbor", artifactId: `artifact:preview:${stableKey}`, contentSha256: null, workflowStatus, checks };
}
