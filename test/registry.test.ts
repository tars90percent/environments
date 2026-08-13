import assert from "node:assert/strict";
import test from "node:test";
import { registryRole } from "../src/registry/api.js";
import { contentAddressedStorageKey } from "../src/registry/artifacts.js";
import type { SourceEnvelopeInput, SubmissionManifest } from "../src/registry/types.js";
import { parseSourceEnvelope, parseSubmissionManifest, parseSubmissionReview, parseVendorEvent, ValidationError } from "../src/registry/validation.js";

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
  const reviewToken = "review-token-with-at-least-32-characters!";
  const adminToken = "admin-token-with-at-least-32-characters!!";
  assert.equal(registryRole(undefined, catalogToken, reviewToken, adminToken), null);
  assert.equal(registryRole("Bearer wrong", catalogToken, reviewToken, adminToken), null);
  assert.equal(registryRole(`Bearer ${catalogToken}`, catalogToken, reviewToken, adminToken), "catalog");
  assert.equal(registryRole(`Bearer ${reviewToken}`, catalogToken, reviewToken, adminToken), "review");
  assert.equal(registryRole(`Bearer ${adminToken}`, catalogToken, reviewToken, adminToken), "admin");
});

test("validates append-only submission reviews and category scope", () => {
  const review = {
    id: "review-one",
    batchId: manifest.batch.id,
    signal: "not_interested",
    scope: "categories",
    categoryIds: [manifest.categories[0]?.id],
    reviewer: { openId: "ou_researcher", tenantKey: "tenant_one", name: "Researcher One" },
    comment: "The systems tasks are too shallow for the target use case.",
  };
  assert.equal(parseSubmissionReview(review).signal, "not_interested");
  assert.throws(() => parseSubmissionReview({ ...review, categoryIds: [] }), ValidationError);
  assert.throws(() => parseSubmissionReview({ ...review, signal: "needs_revision", comment: "" }), ValidationError);
  assert.throws(() => parseSubmissionReview({ ...review, scope: "submission", categoryIds: [manifest.categories[0]?.id] }), ValidationError);
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

test("validates append-only vendor and procurement events", () => {
  const event = {
    id: "vendor-one:purchase-authorized:2026-08-13",
    vendorId: "vendor-one",
    kind: "commercial",
    eventType: "purchase_authorized",
    summary: "Researcher authorized a ten-task starter order.",
    actor: "Researcher One",
    occurredAt: "2026-08-13T00:00:00.000Z",
    sourceEventIds: ["feishu-message-one"],
    batchIds: [],
    metadata: { quantity: 10, currency: "USD" },
  };
  assert.equal(parseVendorEvent(event).eventType, "purchase_authorized");
  assert.throws(() => parseVendorEvent({ ...event, sourceEventIds: ["same", "same"] }), ValidationError);
  assert.throws(() => parseVendorEvent({ ...event, kind: "quality_score" }), ValidationError);
});

test("uses deterministic content-addressed object keys", () => {
  const sha256 = "a".repeat(64);
  assert.equal(contentAddressedStorageKey(sha256), `objects/sha256/aa/${sha256}`);
  assert.throws(() => contentAddressedStorageKey("not-a-sha"));
});
