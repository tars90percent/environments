import type { Pool, PoolClient } from "pg";
import type { ArtifactStore } from "./artifacts.js";

export type HarborStorageMoveInput = { vendorId: string; expectedStorageId: string; actor: string; reason: string };
export type HarborStorageFile = { path: string; sha256: string; sizeBytes: number };
type Move = { id: string; vendor_id: string; from_id: string; to_id: string; manifest: HarborStorageFile[]; switched_at: unknown; retired_at: unknown };
type Store = Pick<ArtifactStore, "listKeys" | "objectMetadata" | "copyVerified" | "verifyObject" | "deleteObject">;

export class HarborStorageRepository {
  constructor(private readonly pool: Pool) {}

  private async locked<T>(operation: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("SELECT pg_advisory_lock(hashtext('case_harbor_storage'))");
      return await operation(client);
    } finally {
      await client.query("SELECT pg_advisory_unlock(hashtext('case_harbor_storage'))").finally(() => client.release());
    }
  }

  async withPublicationLock<T>(operation: () => Promise<T>): Promise<T> {
    return this.locked(async (client) => {
      const pending = await client.query("SELECT id FROM registry_harbor_storage_moves WHERE retired_at IS NULL LIMIT 1");
      if (pending.rowCount) throw new Error(`Resume Harbor storage migration ${pending.rows[0].id} before publishing or pruning tasks`);
      return operation();
    });
  }

  async migrate(store: Store, input: HarborStorageMoveInput, progress?: (value: unknown) => void) {
    for (const key of ["vendorId", "expectedStorageId"] as const) {
      if (typeof input[key] !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input[key])) throw new Error(`${key} must be a lowercase hyphenated ID`);
    }
    if (!input.actor?.trim() || !input.reason?.trim()) throw new Error("Migration actor and reason are required");
    if (input.vendorId === input.expectedStorageId) throw new Error("Vendor storage already uses its canonical ID");
    return this.locked(async (client) => {
      const vendor = (await client.query<{ storage_id: string }>(
        "SELECT COALESCE(harbor_storage_id,id) AS storage_id FROM registry_vendors WHERE id=$1", [input.vendorId],
      )).rows[0];
      if (!vendor) throw new Error("Vendor not found");
      let move = (await client.query<Move>(
        "SELECT * FROM registry_harbor_storage_moves WHERE vendor_id=$1 AND from_id=$2 AND to_id=$1",
        [input.vendorId, input.expectedStorageId],
      )).rows[0];
      if (!move) {
        if (vendor.storage_id !== input.expectedStorageId) throw new Error("Vendor storage precondition changed");
        const pending = await client.query("SELECT id FROM registry_harbor_storage_moves WHERE retired_at IS NULL LIMIT 1");
        if (pending.rowCount) throw new Error("Another Harbor storage migration must finish first");
        const conflict = await client.query(
          "SELECT id FROM registry_vendors WHERE id<>$1 AND COALESCE(harbor_storage_id,id)=$1", [input.vendorId],
        );
        if (conflict.rowCount || (await store.listKeys(`${input.vendorId}/`)).length) throw new Error("Destination storage prefix is occupied");
        const keys = await store.listKeys(`${input.expectedStorageId}/`);
        if (!keys.length) throw new Error("Source storage prefix is empty");
        const manifest = await mapLimit(keys, 12, async (key) => {
          const path = key.slice(input.expectedStorageId.length + 1);
          if (!key.startsWith(`${input.expectedStorageId}/`) || path.split("/").length < 3 || path.split("/").some((part) => !part || part === "." || part === "..")) throw new Error("Invalid source task path");
          const meta = await store.objectMetadata(key);
          if (!meta?.sha256 || !/^[a-f0-9]{64}$/.test(meta.sha256) || meta.sizeBytes === null) throw new Error(`Missing source integrity metadata: ${key}`);
          return { path, sha256: meta.sha256, sizeBytes: meta.sizeBytes };
        });
        const paths = new Set(manifest.map((file) => file.path));
        for (const file of manifest) {
          if (!paths.has(file.path.split("/").slice(0, 2).join("/") + "/task.toml")) throw new Error("Source contains an incomplete task root");
        }
        move = (await client.query<Move>(
          `INSERT INTO registry_harbor_storage_moves(vendor_id,from_id,to_id,manifest,actor,reason)
           VALUES ($1,$2,$1,$3::jsonb,$4,$5) RETURNING *`,
          [input.vendorId,input.expectedStorageId,JSON.stringify(manifest),input.actor,input.reason],
        )).rows[0]!;
      }
      const current = move.switched_at ? move.to_id : move.from_id;
      if (vendor.storage_id !== current) throw new Error("Vendor storage no longer matches the recorded migration");
      const from = (file: HarborStorageFile) => `${move!.from_id}/${file.path}`;
      const to = (file: HarborStorageFile) => `${move!.to_id}/${file.path}`;
      const expectedSource = move.manifest.map(from).sort();
      const expectedTarget = move.manifest.map(to).sort();
      if (!move.switched_at) {
        assertKeys(await store.listKeys(`${move.from_id}/`), expectedSource, "Source inventory changed");
        let copied = 0;
        // Keep each task's completion marker absent until all payloads are verified.
        for (const marker of [false, true]) {
          await mapLimit(move.manifest.filter((file) => (file.path.split("/").length === 3 && file.path.endsWith("/task.toml")) === marker), 8, async (file) => {
            await store.copyVerified({ fromKey: from(file), toKey: to(file), sha256: file.sha256, sizeBytes: file.sizeBytes });
            copied++;
            if (copied % 100 === 0 || copied === move!.manifest.length) progress?.({ phase: "copied_and_verified", files: copied, total: move!.manifest.length });
          });
        }
        assertKeys(await store.listKeys(`${move.to_id}/`), expectedTarget, "Destination inventory differs");
        await assertSourceMetadata(store, move.manifest, from);
        await client.query("BEGIN");
        try {
          const switched = await client.query(
            "UPDATE registry_vendors SET harbor_storage_id=$1,updated_at=now() WHERE id=$1 AND COALESCE(harbor_storage_id,id)=$2 RETURNING id",
            [move.to_id,move.from_id],
          );
          if (!switched.rowCount) throw new Error("Vendor storage changed before cutover");
          move = (await client.query<Move>("UPDATE registry_harbor_storage_moves SET switched_at=now() WHERE id=$1 RETURNING *", [move.id])).rows[0]!;
          await client.query("COMMIT");
        } catch (error) { await client.query("ROLLBACK"); throw error; }
        progress?.({ phase: "mapping_switched", vendorId: move.vendor_id, storageId: move.to_id });
      }
      if (!move.retired_at) {
        // Replays verify the complete current copy before deleting any remaining old objects.
        assertKeys(await store.listKeys(`${move.to_id}/`), expectedTarget, "Destination inventory differs before retirement");
        await mapLimit(move.manifest, 8, (file) => store.verifyObject({ key: to(file), sha256: file.sha256, sizeBytes: file.sizeBytes }));
        const remaining = await store.listKeys(`${move.from_id}/`);
        if (remaining.some((key) => !expectedSource.includes(key))) throw new Error("Unexpected objects appeared in the old prefix");
        const oldFiles = move.manifest.filter((file) => remaining.includes(from(file)));
        await assertSourceMetadata(store, oldFiles, from);
        // Retire markers first, so an interrupted retirement never advertises complete old tasks.
        for (const marker of [true, false]) {
          await mapLimit(oldFiles.filter((file) => (file.path.split("/").length === 3 && file.path.endsWith("/task.toml")) === marker), 12,
            (file) => store.deleteObject(from(file)));
        }
        if ((await store.listKeys(`${move.from_id}/`)).length) throw new Error("Old prefix was not fully retired");
        move = (await client.query<Move>("UPDATE registry_harbor_storage_moves SET retired_at=now() WHERE id=$1 RETURNING *", [move.id])).rows[0]!;
      }
      return { migrationId: String(move.id), vendorId: move.vendor_id, previousStorageId: move.from_id, storageId: move.to_id,
        status: "completed", fileCount: move.manifest.length, sizeBytes: move.manifest.reduce((n,file)=>n+file.sizeBytes,0),
        taskCount: move.manifest.filter((file)=>file.path.split("/").length===3 && file.path.endsWith("/task.toml")).length,
        manifest: move.manifest };
    });
  }
}

function assertKeys(actual: string[], expected: string[], message: string) {
  if (JSON.stringify([...actual].sort()) !== JSON.stringify([...expected].sort())) throw new Error(message);
}
async function assertSourceMetadata(store: Store, files: HarborStorageFile[], key: (file: HarborStorageFile) => string) {
  await mapLimit(files, 12, async (file) => {
    const metadata = await store.objectMetadata(key(file));
    if (metadata?.sha256 !== file.sha256 || metadata.sizeBytes !== file.sizeBytes) throw new Error(`Source changed: ${key(file)}`);
  });
}
async function mapLimit<T,R>(values: T[], concurrency: number, run: (value:T)=>Promise<R>): Promise<R[]> {
  const results: R[] = new Array(values.length);
  let next = 0;
  // Await all workers even on error so no copy/delete escapes the storage lock.
  const workers = await Promise.allSettled(Array.from({length:Math.min(concurrency,values.length)},async()=>{
    while (next<values.length) { const index=next++; results[index]=await run(values[index]!); }
  }));
  const failed = workers.find((result): result is PromiseRejectedResult => result.status === "rejected");
  if (failed) throw failed.reason;
  return results;
}
