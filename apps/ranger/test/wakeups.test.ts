import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm, readdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { State } from "../src/state.js";
import { chatKey } from "../src/agent.js";
import { parseWakeup, importWakeups } from "../src/wakeups.js";

test("generic file wakeups are durable, scoped to their chat, and dispatched once",async()=>{
  const dir=await mkdtemp(join(tmpdir(),"ranger-wake-"));const path=join(dir,"state.sqlite");
  const state=new State(path), chat="oc_one";
  state.enqueue({id:"om_one",chat,replyTo:"om_one",text:"monitor",kind:"user"});
  const first=state.claim()!;state.finish(first);
  const wake=join(dir,"conversations",chatKey(chat),"wakeups","0");await mkdir(wake,{recursive:true});
  const value={runAt:new Date(Date.now()-1000).toISOString(),expiresAt:new Date(Date.now()+60_000).toISOString(),prompt:"Read the existing operation state"};
  await writeFile(join(wake,"check.json"),JSON.stringify(value));
  await importWakeups(dir,state);assert.deepEqual(await readdir(wake),["check.json.accepted"]);
  state.close();const reopened=new State(path);
  await writeFile(join(wake,"check.json"),JSON.stringify(value));await importWakeups(dir,reopened);
  const m=reopened.claim()!;assert.equal(m.kind,"wakeup");assert.equal(m.chat,chat);reopened.finish(m);
  assert.equal(reopened.claim(),undefined);
  reopened.close();await rm(dir,{recursive:true,force:true});
});

test("invalid/expired wakeups are rejected without executing their contents",()=>{
  assert.throws(()=>parseWakeup({prompt:"do work",runAt:"bad",expiresAt:"bad"}));
  assert.throws(()=>parseWakeup({prompt:"do work",runAt:"2020-01-01",expiresAt:"2020-01-02"}));
  assert.throws(()=>parseWakeup({prompt:"",runAt:"2027-01-01",expiresAt:"2027-01-02"}));
});

test("reset ignores old unimported files and queued wakeups expire before execution",async()=>{
  const dir=await mkdtemp(join(tmpdir(),"ranger-reset-")), state=new State(join(dir,"state.sqlite")), chat="oc_one";
  state.enqueue({id:"om_one",chat,replyTo:"om_one",text:"monitor",kind:"user"});state.finish(state.claim()!);
  const wake=join(dir,"conversations",chatKey(chat),"wakeups","0");await mkdir(wake,{recursive:true});
  await writeFile(join(wake,"old.json"),JSON.stringify({runAt:new Date().toISOString(),expiresAt:new Date(Date.now()+60000).toISOString(),prompt:"old task"}));
  state.reset(chat);await importWakeups(dir,state);
  assert.equal(state.claim(),undefined);assert.deepEqual(await readdir(wake),["old.json"]);
  state.schedule("expired-in-queue",chat,"expired task",100,200);state.dispatchWakeups(150);
  assert.equal(state.claim(),undefined);
  state.close();await rm(dir,{recursive:true,force:true});
});

test("a database failure retains an unimported wakeup file for restart",async()=>{
  const dir=await mkdtemp(join(tmpdir(),"ranger-failure-")), state=new State(join(dir,"state.sqlite")), chat="oc_one";
  state.enqueue({id:"om_one",chat,replyTo:"om_one",text:"monitor",kind:"user"});state.finish(state.claim()!);
  const wake=join(dir,"conversations",chatKey(chat),"wakeups","0");await mkdir(wake,{recursive:true});
  await writeFile(join(wake,"retry.json"),JSON.stringify({runAt:new Date().toISOString(),expiresAt:new Date(Date.now()+60000).toISOString(),prompt:"check task"}));
  state.schedule=()=>{throw new Error("disk failure");};
  await assert.rejects(importWakeups(dir,state),/disk failure/);
  assert.deepEqual(await readdir(wake),["retry.json"]);
  state.close();await rm(dir,{recursive:true,force:true});
});
