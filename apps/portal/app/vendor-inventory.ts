import type { CatalogVendor, CatalogVendorInteraction } from "./catalog";

// Inventory is a dated, direction-specific claim in CASE's existing timeline.
// Titles summarize availability/capacity; summaries retain supporting evidence.
export function latestVendorInventory(vendor: CatalogVendor, benchmarkId: string): CatalogVendorInteraction | undefined {
  return vendor.interactions
    .filter((entry) => entry.eventType === `inventory_reported:${benchmarkId}`)
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt) || b.id.localeCompare(a.id))[0];
}
