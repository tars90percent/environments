import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';

const result = await build({ entryPoints: [new URL('../app/vendor-inventory.ts', import.meta.url).pathname], bundle: true, format: 'esm', platform: 'node', write: false });
const { latestVendorInventory } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);

test('inventory uses the latest dated claim for the exact direction without discarding history', () => {
  const older = { id: 'old', eventType: 'inventory_reported:tb', occurredAt: '2026-09-03T00:00:00Z', title: '100 available' };
  const newer = { id: 'new', eventType: 'inventory_reported:tb', occurredAt: '2026-09-04T00:00:00Z', title: 'Inventory not confirmed' };
  const science = { id: 'science', eventType: 'inventory_reported:science', occurredAt: '2026-09-05T00:00:00Z', title: '500 available' };
  const unrelated = { id: 'other', eventType: 'samples_delivered', occurredAt: '2026-09-06T00:00:00Z' };
  const vendor = { interactions: [older, science, newer, unrelated] };
  assert.equal(latestVendorInventory(vendor, 'tb'), newer);
  assert.equal(latestVendorInventory(vendor, 'science'), science);
  assert.equal(latestVendorInventory(vendor, 'missing'), undefined);
  assert.deepEqual(vendor.interactions, [older, science, newer, unrelated]);
});
