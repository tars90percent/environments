import assert from "node:assert/strict";
import test from "node:test";
import { registryRole } from "../src/registry/api.js";
import type { SubmissionManifest } from "../src/registry/types.js";
import { parseSubmissionManifest, ValidationError } from "../src/registry/validation.js";

const manifest: SubmissionManifest = {
  vendor: { id: "vendor-one", name: "Vendor One", short: "V1", description: "A vendor.", aliases: [] },
  sourceEvent: {
    id: "source-one",
    channel: "workspace",
    externalRef: "workspace://sample-one",
    receivedAt: "2026-08-13T00:00:00.000Z",
  },
  batch: {
    id: "vendor-one-2026-08-13",
    date: "2026-08-13",
    label: "First sample",
    sourceLabel: "sample-one",
    taskCount: 1,
    formats: ["Harbor"],
    workflowStatus: "ready_for_research",
    catalogVisibility: "available",
    delta: { added: 1, removed: 0, note: "First observed submission." },
  },
  categories: [{ id: "vendor-one:systems", name: "Systems", description: "Systems tasks.", count: 1 }],
  tasks: [{
    id: "vendor-one-2026-08-13:task-one",
    stableKey: "task-one",
    title: "Task one",
    categoryId: "vendor-one:systems",
    format: "Harbor",
  }],
};

test("validates a complete immutable submission manifest", () => {
  const parsed = parseSubmissionManifest(manifest);
  assert.equal(parsed.batch.id, manifest.batch.id);
  assert.equal(parsed.tasks?.[0]?.categoryId, manifest.categories[0]?.id);
  assert.equal(parsed.sourceEvent.receivedAt, "2026-08-13T00:00:00.000Z");
  assert.throws(
    () => parseSubmissionManifest({ ...manifest, tasks: [{ ...manifest.tasks?.[0], categoryId: "missing" }] }),
    ValidationError,
  );
});

test("protects catalog reads separately from CASE writes", () => {
  const catalogToken = "catalog-token-with-at-least-32-characters";
  const adminToken = "admin-token-with-at-least-32-characters!!";
  assert.equal(registryRole(undefined, catalogToken, adminToken), null);
  assert.equal(registryRole("Bearer wrong", catalogToken, adminToken), null);
  assert.equal(registryRole(`Bearer ${catalogToken}`, catalogToken, adminToken), "catalog");
  assert.equal(registryRole(`Bearer ${adminToken}`, catalogToken, adminToken), "admin");
});
