import type { CatalogTask, CatalogVendor } from "../../catalog";
import { tarBytes, vendorHarborDatasetArchive, vendorHarborDatasetFilename, vendorHarborDatasetManifest } from "../../dataset-archive";

const vendor: CatalogVendor = {
  id: "preview-vendor",
  name: "Example Vendor",
  short: "EV",
  submissions: [
    previewSubmission("preview-submission", "2026-08-20", "August sample", [
      previewTask("preview-harbor", "harbor", "Repair cache invalidation", "terminal-bench", "Terminal-Bench"),
      previewTask("preview-swe", "swe", "Implement resumable repository migration", "deep-swe", "DeepSWE"),
      previewTask("preview-network", "network", "Add adaptive backend concurrency", "network-engineering", "Network Engineering"),
      previewTask("preview-browser", "browser", "Complete multi-store browser workflow", "browser-automation-ecommerce", "Browser Automation E-commerce"),
      previewTask("preview-security", "security", "Capture a protected service secret", "cybersecurity", "Cybersecurity"),
      previewTask("preview-math", "math", "Solve constrained polynomial count", "mathematical-reasoning", "Mathematical Reasoning"),
      previewTask("preview-cad", "cad", "Reconstruct a parametric CAD part", "cad-generation-and-understanding", "CAD Generation and Understanding"),
    ]),
  ],
};

export function GET() {
  if (process.env.NODE_ENV !== "development") return new Response("Not found", { status: 404 });
  const manifest = vendorHarborDatasetManifest(vendor);
  const encode = (value: string) => new TextEncoder().encode(value);
  const gatewayArchive = new Response(tarBytes(manifest.tasks.flatMap((task) => [
    { path: `${task.bucketPrefix}/instruction.md`, bytes: encode(`# ${task.title}\n`) },
    { path: `${task.bucketPrefix}/task.toml`, bytes: encode(`schema_version = "1.3"\n`) },
  ])), { headers: { "content-type": "application/x-tar" } });
  const archive = vendorHarborDatasetArchive(vendor, gatewayArchive);
  return new Response(archive, {
    headers: {
      "content-type": "application/x-tar",
      "content-disposition": `attachment; filename="${vendorHarborDatasetFilename(vendor)}"`,
      "cache-control": "no-store",
      "x-case-task-count": String(manifest.tasks.length),
    },
  });
}

function previewSubmission(id: string, date: string, label: string, tasks: CatalogTask[]) {
  return { id, date, label, source: "Captured vendor delivery", formats: ["harbor" as const], sourceEvents: [], tasks };
}

function previewTask(id: string, stableKey: string, title: string, benchmarkId: string, benchmarkName: string): CatalogTask {
  return {
    id,
    stableKey,
    title,
    summary: null,
    kind: "task",
    format: "harbor",
    benchmark: { id: benchmarkId, displayName: benchmarkName },
    gpuRequired: false,
    sourcePath: `tasks/${stableKey}`,
    artifactId: `artifact:preview:${stableKey}`,
    contentSha256: null,
    sourceItemIds: [],
    checks: {},
    attempts: {},
    findings: [],
  };
}
