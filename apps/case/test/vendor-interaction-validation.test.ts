import assert from "node:assert/strict";
import test from "node:test";
import { parseVendorInteraction, ValidationError } from "../src/registry/validation.js";

const fixture = {
  id: "interaction:vendor-one:delivery:2026-08-01",
  vendorId: "vendor-one",
  kind: "delivery",
  eventType: "starter_delivery_received",
  title: "Starter delivery received",
  summary: "The vendor delivered the agreed starter set.",
  channel: "file_delivery",
  evidence: "direct",
  visibility: "portal",
  occurredAt: "2026-08-01T00:00:00.000Z",
  sourceEventIds: ["source-one"],
  submissionIds: [],
  actor: "TARS",
} as const;

test("validates portal-safe vendor interactions", () => {
  assert.deepEqual(parseVendorInteraction(fixture), fixture);
});

test("requires explicit channel, evidence, visibility, and narrative fields", () => {
  for (const field of ["title", "summary", "channel", "evidence", "visibility"] as const) {
    assert.throws(() => parseVendorInteraction({ ...fixture, [field]: "" }), ValidationError);
  }
});

test("rejects unsupported interaction fields and classifications", () => {
  assert.throws(() => parseVendorInteraction({ ...fixture, externalRef: "https://private.example/message" }), ValidationError);
  assert.throws(() => parseVendorInteraction({ ...fixture, channel: "discord" }), ValidationError);
  assert.throws(() => parseVendorInteraction({ ...fixture, evidence: "rumor" }), ValidationError);
  assert.throws(() => parseVendorInteraction({ ...fixture, visibility: "public" }), ValidationError);
});
