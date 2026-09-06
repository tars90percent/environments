import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";

test("download manifests preserve identity and paths without duplicate checksums", async () => {
  const built = await build({ entryPoints: [new URL("../app/dataset-archive.ts", import.meta.url).pathname], bundle: true, format: "esm", platform: "node", write: false });
  const { taskDatasetManifest, vendorHarborDatasetManifest } = await import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text).toString("base64")}`);
  const task = { id: "sample-task", stableKey: "sample-task", title: "Sample task", kind: "task", format: "harbor", benchmark: { id: "unspecified", displayName: "Unspecified" }, sourcePath: "delivery/tasks/sample-task", artifactId: "file-17", contentSha256: "a".repeat(64), gpuRequired: false, checks: {}, findings: [] };
  const submission = { id: "september-samples", date: "2026-09-07", label: "September samples", source: "Vendor", formats: ["harbor"], tasks: [task] };
  const manifest = taskDatasetManifest(submission);
  assert.equal(manifest.tasks[0].artifactId, "file-17");
  assert.equal(manifest.tasks[0].taskId, task.id);
  assert.equal(manifest.tasks[0].sourcePath, task.sourcePath);
  assert.equal("contentSha256" in manifest.tasks[0], false);
  const vendorManifest = vendorHarborDatasetManifest({ id: "vendor-a", name: "Vendor A", submissions: [submission] });
  assert.equal(vendorManifest.tasks[0].bucketPrefix, "vendor-a/september-samples/sample-task");
  assert.equal(vendorManifest.tasks[0].submission.id, submission.id);
  assert.equal("contentSha256" in vendorManifest.tasks[0], false);
});
