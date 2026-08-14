import type { CatalogProcurementSummary, ProcurementCommitment, ProcurementStage, VendorEvent } from "./types.js";

export const PROCUREMENT_EVENT_KINDS = ["commercial", "delivery", "acceptance", "payment"] as const;

const STAGE_ALIASES: Record<string, ProcurementStage> = {
  accepted: "accepted",
  acceptance_completed: "accepted",
  commercial: "commercial",
  contract_signed: "contracted",
  contracted: "contracted",
  declined: "closed",
  delivered: "delivered",
  delivery_received: "delivered",
  delivery_started: "delivering",
  delivering: "delivering",
  in_delivery: "delivering",
  negotiation_closed: "closed",
  negotiation_started: "negotiating",
  negotiating: "negotiating",
  no_purchase: "closed",
  not_pursuing: "closed",
  order_placed: "ordered",
  ordered: "ordered",
  paid: "paid",
  payment_completed: "paid",
  po_issued: "ordered",
  purchase_authorized: "authorized",
  purchase_declined: "closed",
  purchase_ordered: "ordered",
  quote_received: "negotiating",
  quote_under_negotiation: "negotiating",
};

export function procurementSummaryFromEvent(event: VendorEvent): CatalogProcurementSummary {
  const stage = procurementStage(event);
  return {
    stage,
    summary: event.summary,
    amountApprox: approximateAmount(event.metadata),
    commitment: procurementCommitment(stage),
    occurredAt: event.occurredAt,
    actor: event.actor,
    evidenceEventId: event.id,
    evidenceSourceCount: event.sourceEventIds.length,
    retrospective: event.metadata.retrospective === true,
  };
}

function procurementStage(event: VendorEvent): ProcurementStage {
  const purchaseStatus = normalizedString(event.metadata.purchaseStatus);
  const eventType = normalizedString(event.eventType);
  return (purchaseStatus && STAGE_ALIASES[purchaseStatus])
    || (eventType && STAGE_ALIASES[eventType])
    || "commercial";
}

function procurementCommitment(stage: ProcurementStage): ProcurementCommitment {
  if (stage === "negotiating" || stage === "closed") return "none";
  if (stage === "authorized") return "authorized";
  if (stage === "contracted") return "contracted";
  if (["ordered", "delivering", "delivered", "accepted", "paid"].includes(stage)) return "ordered";
  return "unknown";
}

function approximateAmount(metadata: Record<string, unknown>): CatalogProcurementSummary["amountApprox"] {
  const value = [metadata.quotedAmountApprox, metadata.amountApprox, metadata.quotedAmount]
    .find((candidate) => typeof candidate === "number" && Number.isFinite(candidate) && candidate > 0);
  const currency = typeof metadata.currency === "string" ? metadata.currency.trim().toUpperCase() : "";
  return typeof value === "number" && /^[A-Z]{3}$/.test(currency) ? { currency, value } : null;
}

function normalizedString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim().toLowerCase().replaceAll("-", "_").replaceAll(" ", "_") : null;
}
