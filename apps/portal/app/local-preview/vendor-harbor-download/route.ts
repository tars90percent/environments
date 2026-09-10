import type { CatalogTask, CatalogVendor } from "../../catalog";
import { strToU8, zipSync } from "fflate";
import { benchmarkHarborDatasetFilename, benchmarkHarborDatasetManifest, vendorHarborDatasetFilename, vendorHarborDatasetManifest } from "../../dataset-archive";
import { buildBenchmarkLandscape } from "../../benchmark-landscape";

const vendor: CatalogVendor = {
  id: "preview-vendor",
  name: "Example Vendor",
  short: "EV",
  hasTimeline: false,
  interactions: [],
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

function previewArchive(request: Request) {
  const params = new URL(request.url).searchParams;
  const benchmarkId = params.get("benchmark");
  const scope = params.get("scope") ?? "all";
  if (scope !== "all" && scope !== "shortlisted") return null;
  if (benchmarkId === null) return { manifest: vendorHarborDatasetManifest(vendor), filename: vendorHarborDatasetFilename(vendor) };
  const benchmark = buildBenchmarkLandscape({ generatedAt: "2026-08-20T00:00:00.000Z", vendors: [vendor], totals: { vendors: 1, submissions: 1, tasks: 7, harborTasks: 7 } }, params.get("capability") || undefined).groups.find((group) => group.id === benchmarkId);
  if (!benchmark || (scope === "shortlisted" && !benchmark.shortlist?.records.length)) return null;
  return { manifest: benchmarkHarborDatasetManifest(benchmark, scope), filename: benchmarkHarborDatasetFilename(benchmark, scope) };
}

export function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") return new Response("Not found", { status: 404 });
  const archive = previewArchive(request);
  if (!archive) return new Response("Not found", { status: 404 });
  const { manifest, filename } = archive;
  const downloadUrl = new URL(request.url);
  downloadUrl.searchParams.set("download", "1");
  return Response.json({
    status: "ready",
    cacheHit: true,
    downloadUrl: `${downloadUrl.pathname}${downloadUrl.search}`,
    filename,
    taskCount: manifest.tasks.length,
  }, { headers: { "cache-control": "no-store" } });
}

export function GET(request: Request) {
  if (process.env.NODE_ENV !== "development" || new URL(request.url).searchParams.get("download") !== "1") return new Response("Not found", { status: 404 });
  const archive = previewArchive(request);
  if (!archive) return new Response("Not found", { status: 404 });
  const { manifest, filename } = archive;
  const files: Record<string, Uint8Array> = {
    "manifest.json": strToU8(`${JSON.stringify(manifest, null, 2)}\n`),
  };
  for (const task of manifest.tasks) {
    files[`${task.bucketPrefix}/instruction.md`] = strToU8(`# ${task.title}\n`);
    files[`${task.bucketPrefix}/task.toml`] = strToU8(`schema_version = "1.3"\n`);
  }
  return new Response(zipSync(files, { level: 6 }), {
    headers: {
      "content-type": "application/zip",
      "content-disposition": `attachment; filename="${filename}"`,
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
