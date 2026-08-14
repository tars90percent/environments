import assert from "node:assert/strict";
import test from "node:test";
import { procurementSummaryFromEvent } from "../src/registry/procurement-summary.js";
import type { VendorEvent } from "../src/registry/types.js";

test("derives a compact negotiating summary from a quote event", () => {
  const summary = procurementSummaryFromEvent(event({
    eventType: "quote_under_negotiation",
    metadata: {
      currency: "usd",
      quotedAmountApprox: 100_000,
      purchaseStatus: "negotiating",
      retrospective: true,
    },
  }));

  assert.deepEqual(summary, {
    stage: "negotiating",
    summary: "A roughly USD 100,000 initial quote is under negotiation; no purchase decision is recorded.",
    amountApprox: { currency: "USD", value: 100_000 },
    commitment: "none",
    occurredAt: "2026-08-04T11:09:00.000Z",
    actor: "MiniMax procurement",
    evidenceEventId: "designarena:quote-under-negotiation:2026-08-04",
    evidenceSourceCount: 1,
    retrospective: true,
  });
});

test("normalizes later procurement stages without inventing an amount", () => {
  const authorized = procurementSummaryFromEvent(event({
    eventType: "purchase_authorized",
    metadata: { currency: "USD", quotedAmountApprox: -1 },
  }));
  assert.equal(authorized.stage, "authorized");
  assert.equal(authorized.commitment, "authorized");
  assert.equal(authorized.amountApprox, null);

  const delivered = procurementSummaryFromEvent(event({ kind: "delivery", eventType: "unmapped_delivery_event" }));
  assert.equal(delivered.stage, "commercial");
  assert.equal(delivered.commitment, "unknown");
});

function event(overrides: Partial<VendorEvent>): VendorEvent {
  return {
    id: "designarena:quote-under-negotiation:2026-08-04",
    vendorId: "designarena",
    kind: "commercial",
    eventType: "quote_under_negotiation",
    summary: "A roughly USD 100,000 initial quote is under negotiation; no purchase decision is recorded.",
    actor: "MiniMax procurement",
    occurredAt: "2026-08-04T11:09:00.000Z",
    sourceEventIds: ["source:designarena:feishu:purchase-chat"],
    batchIds: ["designarena-2026-07-24-samples"],
    metadata: {},
    createdAt: "2026-08-13T17:00:00.000Z",
    ...overrides,
  };
}
