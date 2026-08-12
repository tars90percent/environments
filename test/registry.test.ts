import assert from "node:assert/strict";
import test from "node:test";
import { registryRole } from "../src/registry/api.js";
import { contentAddressedStorageKey } from "../src/registry/artifacts.js";
import type { SourceEnvelopeInput, SubmissionManifest } from "../src/registry/types.js";
import { parseSourceEnvelope, parseSubmissionManifest, ValidationError } from "../src/registry/validation.js";

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

test("validates recursive source envelopes and their derivation links", () => {
  const envelope: SourceEnvelopeInput = {
    vendor: manifest.vendor,
    sourceEvent: {
      id: "feishu-message-one",
      channel: "feishu",
      externalRef: "feishu://message/one",
      receivedAt: "2026-08-13T00:00:00.000Z",
    },
    items: [
      {
        id: "source-message-one",
        kind: "message",
        displayName: "Inbound vendor message",
        locator: "feishu://message/one",
        fetchStatus: "snapshotted",
        parseStatus: "parsed",
        mutable: false,
      },
      {
        id: "source-sheet-one",
        kind: "spreadsheet",
        displayName: "Task index",
        locator: "https://docs.google.com/spreadsheets/d/example/edit",
        fetchStatus: "queued",
        parseStatus: "not_requested",
        mutable: true,
      },
    ],
    relations: [{ fromItemId: "source-message-one", toItemId: "source-sheet-one", relation: "links_to", position: 0 }],
  };
  assert.equal(parseSourceEnvelope(envelope).relations?.[0]?.relation, "links_to");
  assert.throws(
    () => parseSourceEnvelope({ ...envelope, relations: [{ fromItemId: "source-message-one", toItemId: "missing", relation: "links_to" }] }),
    ValidationError,
  );
});

test("uses deterministic content-addressed object keys", () => {
  const sha256 = "a".repeat(64);
  assert.equal(contentAddressedStorageKey(sha256), `objects/sha256/aa/${sha256}`);
  assert.throws(() => contentAddressedStorageKey("not-a-sha"));
});
