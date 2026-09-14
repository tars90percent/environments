import type { Pool } from "pg";

export type RenameVendorIdInput = {
  vendorId: string;
  newVendorId: string;
  actor: string;
  reason: string;
};

export type RenameVendorIdResult = {
  previousVendorId: string;
  vendorId: string;
  harborStorageId: string;
  renamed: boolean;
};

export function parseRenameVendorId(value: unknown): RenameVendorIdInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Vendor rename must be an object");
  const input = value as Record<string, unknown>;
  const fields = ["vendorId", "newVendorId", "actor", "reason"];
  if (Object.keys(input).some((key) => !fields.includes(key))) throw new Error("Unknown vendor rename field");
  for (const field of fields) {
    if (typeof input[field] !== "string" || !input[field].trim() || input[field] !== input[field].trim()) {
      throw new Error(`${field} must be a nonempty string without surrounding whitespace`);
    }
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.newVendorId as string) || (input.newVendorId as string).length > 160) {
    throw new Error("newVendorId must be a lowercase hyphenated ID of at most 160 characters");
  }
  if ((input.vendorId as string).length > 500 || (input.actor as string).length > 500 || (input.reason as string).length > 5000) {
    throw new Error("Vendor rename field is too long");
  }
  return input as RenameVendorIdInput;
}

export async function resolveVendorId(pool: Pool, id: string): Promise<string | null> {
  const result = await pool.query<{ id: string }>(
    `SELECT id FROM registry_vendors WHERE id = $1
     UNION ALL SELECT vendor_id AS id FROM registry_vendor_id_changes WHERE old_id = $1`, [id],
  );
  return result.rows[0]?.id ?? null;
}

export async function renameVendorId(pool: Pool, value: RenameVendorIdInput): Promise<RenameVendorIdResult> {
  const input = parseRenameVendorId(value);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Serialize identity changes with vendor creation so a retired ID cannot be reused.
    await client.query("LOCK TABLE registry_vendors IN SHARE ROW EXCLUSIVE MODE");
    const source = await client.query<{ id: string; harbor_storage_id: string | null }>(
      "SELECT id, harbor_storage_id FROM registry_vendors WHERE id = $1", [input.vendorId],
    );
    if (!source.rows[0]) {
      const previous = await client.query<{ vendor_id: string; harbor_storage_id: string | null }>(
        `SELECT change.vendor_id, vendor.harbor_storage_id FROM registry_vendor_id_changes change
         JOIN registry_vendors vendor ON vendor.id = change.vendor_id WHERE change.old_id = $1`, [input.vendorId],
      );
      if (previous.rows[0]?.vendor_id !== input.newVendorId) throw new Error(`Vendor ${input.vendorId} does not exist as a current ID`);
      await client.query("COMMIT");
      return { previousVendorId: input.vendorId, vendorId: input.newVendorId,
        harborStorageId: previous.rows[0].harbor_storage_id ?? input.newVendorId, renamed: false };
    }
    const harborStorageId = source.rows[0].harbor_storage_id ?? input.vendorId;
    if (input.vendorId === input.newVendorId) {
      await client.query("COMMIT");
      return { previousVendorId: input.vendorId, vendorId: input.newVendorId, harborStorageId, renamed: false };
    }
    const conflict = await client.query(
      `SELECT id FROM registry_vendors WHERE id = $1
       UNION ALL SELECT old_id AS id FROM registry_vendor_id_changes WHERE old_id = $1`, [input.newVendorId],
    );
    if (conflict.rowCount) throw new Error(`Vendor ID ${input.newVendorId} is already registered or retired`);

    // Foreign keys cascade; immutable submission/task IDs, file references and evidence stay intact.
    await client.query(
      `UPDATE registry_vendors SET id = $2, harbor_storage_id = COALESCE(harbor_storage_id, id), updated_at = now()
       WHERE id = $1`, [input.vendorId, input.newVendorId],
    );
    for (const table of ["registry_status_events", "registry_work_items"]) {
      await client.query(`UPDATE ${table} SET entity_id = $2 WHERE entity_type = 'vendor' AND entity_id = $1`,
        [input.vendorId, input.newVendorId]);
    }
    await client.query(
      `INSERT INTO registry_vendor_id_changes(old_id, new_id, vendor_id, actor, reason)
       VALUES ($1, $2, $2, $3, $4)`, [input.vendorId, input.newVendorId, input.actor, input.reason],
    );
    await client.query("COMMIT");
    return { previousVendorId: input.vendorId, vendorId: input.newVendorId, harborStorageId, renamed: true };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
