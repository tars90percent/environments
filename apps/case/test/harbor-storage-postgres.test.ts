import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import test from "node:test";
import { Pool } from "pg";
import { PostgresRegistry } from "../src/registry/postgres.js";

const databaseUrl = process.env.CASE_REGISTRY_TEST_DATABASE_URL;
test("Harbor storage migration resumes copies and retirement, blocks publications, and preserves registry identities", { skip: !databaseUrl }, async () => {
  const schema = `case_harbor_move_${randomUUID().replaceAll("-", "_")}`;
  const admin = new Pool({ connectionString: databaseUrl });
  let repository: PostgresRegistry | undefined;
  try {
    await admin.query(`CREATE SCHEMA "${schema}"`);
    const url = new URL(databaseUrl!); url.searchParams.set("options", `-csearch_path=${schema}`);
    repository = new PostgresRegistry(url.toString()); await repository.initialize();
    await repository.captureSubmission({
      vendor: { id: "old-vendor", name: "Vendor", short: "Vendor", description: "Fixture" },
      submission: { id: "delivery", date: "2026-09-14", label: "Sample", sourceLabel: "Email", formats: [] },
      artifacts: [], actor: "test",
      sources: [{ sourceEvent: { id: "email", channel: "email", externalRef: "email://fixture", receivedAt: "2026-09-14T00:00:00Z" },
        items: [{ id: "message", kind: "message", displayName: "Delivery message", locator: "email://fixture", fetchStatus: "external_only", parseStatus: "not_requested", mutable: false }] }],
    });
    await repository.renameVendorId({ vendorId: "old-vendor", newVendorId: "vendor", actor: "test", reason: "Company ID" });
    const before = await repository.sampleCatalogSnapshot();
    const objects = new Map<string, Buffer>([
      ["old-vendor/delivery/task/instruction.md", Buffer.from("Instructions")],
      ["old-vendor/delivery/task/tests/test.sh", Buffer.from("Verifier")],
      ["old-vendor/delivery/task/task.toml", Buffer.from("Manifest")],
    ]);
    const original = new Map(objects);
    const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
    let failCopy = true; let failDelete = true;
    const events: string[] = [];
    const store = {
      async listKeys(prefix: string) { return [...objects.keys()].filter((key)=>key.startsWith(prefix)).sort(); },
      async objectMetadata(key: string) { const body=objects.get(key); return body ? {sha256:sha(body),sizeBytes:body.length} : null; },
      async verifyObject(input: { key:string; sha256:string; sizeBytes?:number }) {
        const body=objects.get(input.key); assert.ok(body); assert.equal(sha(body),input.sha256); assert.equal(body.length,input.sizeBytes);
      },
      async copyVerified(input: { fromKey:string; toKey:string; sha256:string; sizeBytes?:number }) {
        if (failCopy && input.fromKey.endsWith("test.sh")) throw new Error("simulated copy interruption");
        const body=objects.get(input.fromKey); assert.ok(body); objects.set(input.toKey,Buffer.from(body));
        await this.verifyObject({key:input.toKey,sha256:input.sha256,sizeBytes:input.sizeBytes}); events.push(`copy:${input.toKey}`);
      },
      async deleteObject(key:string) {
        if (failDelete && key.endsWith("instruction.md")) throw new Error("simulated retirement interruption");
        objects.delete(key); events.push(`delete:${key}`);
      },
    };
    const input={vendorId:"vendor",expectedStorageId:"old-vendor",actor:"test",reason:"Canonical storage folder"};
    await assert.rejects(()=>repository!.harborStorage.migrate(store,input),/copy interruption/);
    assert.equal((await repository.sampleCatalogSnapshot()).vendors[0]?.harborStorageId,"old-vendor");
    assert.equal(objects.has("vendor/delivery/task/task.toml"),false);
    await assert.rejects(()=>repository!.harborStorage.withPublicationLock(async()=>{throw new Error("must not publish");}),/Resume Harbor storage migration/);
    failCopy=false;
    await assert.rejects(()=>repository!.harborStorage.migrate(store,input),/retirement interruption/);
    assert.equal((await repository.sampleCatalogSnapshot()).vendors[0]?.harborStorageId,"vendor");
    assert.equal(objects.has("old-vendor/delivery/task/task.toml"),false);
    failDelete=false;
    const result=await repository.harborStorage.migrate(store,input);
    assert.equal(result.taskCount,1); assert.equal(result.fileCount,3);
    assert.deepEqual(await store.listKeys("old-vendor/"),[]);
    for (const [key,body] of original) assert.deepEqual(objects.get(key.replace(/^old-vendor\//,"vendor/")),body);
    const after=await repository.sampleCatalogSnapshot();
    assert.deepEqual(after.totals,before.totals);
    assert.deepEqual(after.vendors[0],{...before.vendors[0],harborStorageId:"vendor"});
    assert.deepEqual(await repository.harborStorage.migrate(store,input),result);
    assert.equal(await repository.harborStorage.withPublicationLock(async()=>"allowed"),"allowed");
    assert.ok(events.indexOf("copy:vendor/delivery/task/task.toml")>events.indexOf("copy:vendor/delivery/task/tests/test.sh"));
    assert.ok(events.indexOf("delete:old-vendor/delivery/task/task.toml")<events.indexOf("delete:old-vendor/delivery/task/instruction.md"));
  } finally {
    await repository?.close(); await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); await admin.end();
  }
});
