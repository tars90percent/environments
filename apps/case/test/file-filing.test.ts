import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import test from "node:test";
import { Pool } from "pg";
import { PostgresRegistry } from "../src/registry/postgres.js";
import { ArtifactStore } from "../src/registry/artifacts.js";
import { planFileFiling, migrateFiles, pruneOldFileCopies } from "../src/registry/file-migration.js";
import { readableFileKey } from "../src/registry/file-names.js";
import type { FilingArtifact } from "../src/registry/file-filing.js";
import { registryFileReferences } from "../src/registry/file-references.js";
import { parseAppendTasks, parseCaptureSubmission } from "../src/registry/validation.js";

const databaseUrl=process.env.CASE_REGISTRY_TEST_DATABASE_URL;

test("readable filing uses actual evidence dates and collision suffixes",()=>{
  const base:FilingArtifact={id:"old-a",reference:"file-1",kind:"source_snapshot",storageKey:"objects/sha256/aa/a",sha256:"a".repeat(64),createdAt:"2026-09-01T00:00:00Z",metadata:{originalName:"原始清单.xlsx"},names:[],contexts:[
    {vendorId:"vendor",submissionId:"older",date:"2026-07-28",label:"General",sourceDate:"2026-07-31",sourceKind:"spreadsheet"},
    {vendorId:"vendor",submissionId:"actual",date:"2026-07-31",label:"Long horizon",sourceDate:"2026-07-31",sourceKind:"spreadsheet"},
  ]};
  const plan=planFileFiling([base,{...base,id:"old-b",storageKey:"old/b"}]);
  assert.equal(plan.entries[0]!.toKey,"vendor/2026-07-31-long-horizon/原始清单.xlsx");
  assert.equal(plan.entries[1]!.toKey,"vendor/2026-07-31-long-horizon/原始清单 (2).xlsx");
  const correspondence=planFileFiling([{...base,contexts:[{vendorId:"andrew",date:"2026-08-05",sourceDate:"2026-08-14",sourceKind:"message"}]}]);
  assert.match(correspondence.entries[0]!.toKey,/andrew\/correspondence\/2026-08-14\//);
  const repeatedTask=planFileFiling([{...base,kind:"task_package",contexts:[
    {vendorId:"eigent",submissionId:"august",date:"2026-08-18",sourceDate:"2026-08-20",label:"First samples"},
    {vendorId:"eigent",submissionId:"september",date:"2026-09-04",sourceDate:"2026-09-04",label:"Repeated samples"},
  ]}]);
  assert.match(repeatedTask.entries[0]!.toKey,/eigent\/2026-08-18-first-samples\//);
  assert.doesNotMatch(readableFileKey("../original.zip",{vendorId:"../../vendor",date:"2026-09-07",label:"../samples"}),/\.\.\//);
});

test("storage copies original bytes and refuses an existing wrong destination",async()=>{
  const bytes=Buffer.from("Original immutable package");const sha256=createHash("sha256").update(bytes).digest("hex");
  const objects=new Map<string,Buffer>([["/fixture/old/package.zip",bytes]]);let copied=0;
  const server=createServer((req,res)=>{
    const key=decodeURIComponent(new URL(req.url!,"http://test").pathname);
    if(req.method==="PUT" && req.headers["x-amz-copy-source"]) {
      const source="/"+decodeURIComponent(String(req.headers["x-amz-copy-source"]));
      assert.deepEqual(objects.get(source),bytes);objects.set(key,Buffer.from(bytes));copied++;
      res.setHeader("content-type","application/xml");res.end('<CopyObjectResult><ETag>"copied"</ETag><LastModified>2026-09-07T00:00:00Z</LastModified></CopyObjectResult>');return;
    }
    const value=objects.get(key);if(!value){res.statusCode=404;res.end();return;}
    res.setHeader("content-length",value.length);res.setHeader("x-amz-meta-sha256",sha256);res.setHeader("etag",'"original"');res.end(req.method==="HEAD" ? undefined : value);
  });
  await new Promise<void>((resolve)=>server.listen(0,"127.0.0.1",resolve));
  try {
    const store=new ArtifactStore({endpoint:`http://127.0.0.1:${(server.address() as AddressInfo).port}`,region:"auto",bucket:"fixture",accessKeyId:"fixture",secretAccessKey:"fixture"});
    const input={fromKey:"old/package.zip",toKey:"vendor/2026-09-07-samples/原始.zip",sha256,sizeBytes:bytes.length};
    await store.copyVerified(input);await store.copyVerified(input);assert.equal(copied,1);assert.deepEqual(objects.get("/fixture/old/package.zip"),bytes);
    objects.set("/fixture/wrong",Buffer.from("wrong"));await assert.rejects(()=>store.copyVerified({...input,toKey:"wrong"}),/size does not match/);assert.equal(copied,1);
  }finally {await new Promise<void>((resolve)=>server.close(()=>resolve()));}
});

test("filing resumes after copy failure, preserves names/history, and merges only matching tasks",{skip:!databaseUrl},async()=>{
  const schema=`filing_${randomUUID().replaceAll("-","_")}`;const admin=new Pool({connectionString:databaseUrl});
  const scoped=new URL(databaseUrl!);scoped.searchParams.set("options",`-c search_path=${schema}`);
  const sql=new Pool({connectionString:scoped.toString()});const repository=new PostgresRegistry(scoped.toString());
  try{
    await admin.query(`CREATE SCHEMA "${schema}"`);await repository.initialize();
    const name=await repository.files.reserve("sample.zip",{vendorId:"vendor",date:"2026-08-01",label:"Samples"});
    const otherName=await repository.files.reserve("sample.zip",{vendorId:"vendor",date:"2026-08-01",label:"Samples"});
    assert.notEqual(name.reference,otherName.reference);
    const id="artifact:sha256:"+"a".repeat(64);
    await repository.registerArtifact({id,kind:"task_package",storageKey:"objects/sha256/aa/original",sha256:"a".repeat(64),sizeBytes:123,metadata:{originalName:"original.zip",provenance:"preserve"}});
    const before=await repository.getArtifact(id);const entry={artifactId:id,fromKey:before!.storageKey,toKey:"vendor/2026-08-01-samples/original.zip"};
    let fail=true;let copies=0;let verifies=0;let deletes=0;
    const store={async copyVerified(){copies++;if(fail)throw new Error("interrupted copy");},async verifyObject(){verifies++;},async deleteObject(){deletes++;}} as unknown as ArtifactStore;
    const input={entries:[entry],actor:"CASE",reason:"Readable locations"};
    await assert.rejects(()=>migrateFiles(repository,store,input),/interrupted/);assert.deepEqual(await repository.getArtifact(id),before);
    fail=false;await migrateFiles(repository,store,input);await migrateFiles(repository,store,input);assert.equal(copies,2);
    const after=await repository.getArtifact(id);assert.equal(after!.storageKey,entry.toKey);assert.deepEqual(after!.metadata,before!.metadata);
    assert.deepEqual(await repository.getArtifact(before!.reference!),after);assert.deepEqual(await repository.getArtifact(entry.toKey),after);
    assert.deepEqual(await registryFileReferences(repository,{artifactId:before!.reference},"input"),{artifactId:id});
    const move=(await repository.files.moves())[0]!;
    await repository.files.rollback(move.id,"CASE","Exercise verified rollback");
    assert.equal((await repository.getArtifact(entry.toKey))!.storageKey,before!.storageKey);
    await migrateFiles(repository,store,input);
    assert.equal((await repository.getArtifact(before!.reference!))!.storageKey,entry.toKey);
    assert.equal((await pruneOldFileCopies(repository,store)).retained,1);assert.equal(deletes,0);
    await sql.query("UPDATE registry_file_moves SET switched_at=now()-interval '25 hours'");await pruneOldFileCopies(repository,store);assert.equal(deletes,1);assert.equal(verifies,1);
    await pruneOldFileCopies(repository,store);assert.equal(deletes,1);
    const vendor={id:"vendor",name:"Vendor",short:"V",description:"Synthetic"};
    for(const [n,date] of [[1,"2026-08-01"],[2,"2026-09-01"]] as const){
      await repository.captureSubmission(parseCaptureSubmission({purpose:"sample_evaluation",vendor,submission:{id:`delivery-${n}`,date,label:`Delivery ${n}`,sourceLabel:"Fixture"},sources:[{sourceEvent:{id:`source-${n}`,channel:"upload",externalRef:`fixture://${n}`,receivedAt:`${date}T00:00:00Z`},items:[{id:`item-${n}`,kind:"task_package",displayName:"original.zip",artifactId:id,fetchStatus:"snapshotted",parseStatus:"parsed",mutable:false}]}],actor:"CASE"}));
      await repository.appendTasks(parseAppendTasks({submissionId:`delivery-${n}`,actor:"CASE",tasks:[{id:`version-${n}`,stableKey:`key-${n}`,title:"Repeated task",kind:"task",format:"harbor",benchmarkId:"unspecified",sourcePath:"task",artifactId:id,sourceItemIds:[`item-${n}`]}]}));
    }
    const inventory=await repository.files.inventory();assert.equal(inventory.find(a=>a.id===id)!.contexts.filter(c=>c.submissionId).length>1,true);
    const result=await repository.files.mergeTaskIdentities({targetTaskVersionId:"version-1",sourceTaskVersionId:"version-2",actor:"CASE",reason:"Same repeated package"}) as {merged:boolean};assert.equal(result.merged,true);
    assert.equal((await sql.query("SELECT count(DISTINCT task_id)::int AS n FROM registry_task_versions")).rows[0].n,1);
    assert.equal((await sql.query("SELECT count(*)::int AS n FROM registry_tasks")).rows[0].n,2);
    assert.equal((await repository.files.correctTaskFormat({taskId:"version-1",format:"non_harbor",actor:"CASE",reason:"Exact delivered root has manifest.toml and lacks task.toml"})).changed,true);
    assert.equal((await repository.getSampleTask("version-1"))!.format,"non_harbor");
    assert.equal((await sql.query("SELECT count(*)::int AS n FROM registry_status_events WHERE event_type='task.format_corrected' AND payload->'before'->>'formatKind'='harbor'")).rows[0].n,1);
    assert.equal((await repository.sampleCatalogSnapshot()).totals.tasks,2);
  }finally{await repository.close();await sql.end();await admin.query(`DROP SCHEMA "${schema}" CASCADE`);await admin.end();}
});
