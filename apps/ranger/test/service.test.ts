import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { State, chunkText, type Message } from "../src/state.js";
import { readConfig } from "../src/config.js";
import { Service } from "../src/service.js";
import { parseMessage } from "../src/gateway.js";

const message = (id = "om_one", text = "inspect existing jobs"): Message => ({id,chat:"oc_chat",replyTo:id,text,kind:"user"});
function fixture() {
  const dir = mkdtempSync(join(tmpdir(),"ranger-test-"));
  const path = join(dir,"state.sqlite");
  const config = readConfig({ALLOWED_USER_IDS:"ou_owner",RANGER_DATA_DIR:dir});
  const state = new State(path);
  return {dir,path,config,state,cleanup:() => rmSync(dir,{recursive:true,force:true})};
}

test("duplicate Feishu delivery cannot run the same request twice; replies survive restart",async () => {
  const f=fixture(); let runs=0;
  const service=new Service(f.config,f.state,async m => {runs++; f.state.finish(m,"done");},{reply:async () => {throw new Error("offline");}});
  service.receive(message()); service.receive(message());
  await service.work(); await service.work(); await service.deliver();
  assert.equal(runs,1);
  f.state.close();
  const reopened=new State(f.path);
  assert.equal(reopened.recover(),0);
  assert.equal(reopened.claim(),undefined);
  assert.equal(reopened.outgoing(Date.now()+400_000)?.text,"Working on it.");
  const row=reopened.outgoing(Date.now()+400_000)!; reopened.delivered(row.id);
  assert.equal(reopened.outgoing()?.text,"done");
  reopened.close(); f.cleanup();
});

test("interrupted turns retain their thread ID and receive a reconciliation turn",() => {
  const f=fixture(), m=message(); f.state.enqueue(m); f.state.claim();
  f.state.saveThread(m.chat,"thread-existing");
  f.state.close();
  const reopened=new State(f.path);
  assert.equal(reopened.recover(),1); assert.equal(reopened.recover(),0);
  assert.equal(reopened.thread(m.chat),"thread-existing");
  const recovery=reopened.claim()!;
  assert.equal(recovery.kind,"recovery"); assert.match(recovery.text,/reconcile existing external operations/);
  reopened.close(); f.cleanup();
});

test("status and stop remain responsive during a model turn",async () => {
  const f=fixture(); let started!:()=>void;
  const running=new Promise<void>(resolve=>started=resolve);
  const service=new Service(f.config,f.state,async (_m,signal) => {
    started(); await new Promise<void>((_,reject)=>signal.addEventListener("abort",()=>reject(new Error("stopped")),{once:true}));
  },{reply:async()=>{}});
  service.receive(message()); const work=service.work(); await running;
  service.receive(message("om_status","/status"));
  service.receive(message("om_stop","/stop"));
  await work;
  const texts=f.state.db.prepare("SELECT text FROM outbox").all().map(x=>String(x.text));
  assert(texts.some(x=>x.includes("Current turn in this chat: running")));
  assert(texts.some(x=>x.includes("does not cancel them")));
  f.state.close();f.cleanup();
});

test("/new resets conversation and cancels pending wakeups, retaining prior history",async()=>{
  const f=fixture();f.state.enqueue(message());f.state.claim();f.state.saveThread("oc_chat","old");f.state.finish(message());
  f.state.schedule("one","oc_chat","check",Date.now()+1000,Date.now()+10000);
  const service=new Service(f.config,f.state,async()=>assert.fail("no model needed"),{reply:async()=>{}});
  service.receive(message("om_new","/new"));await service.work();
  assert.equal(f.state.thread("oc_chat"),undefined);
  assert.equal(f.state.db.prepare("SELECT status FROM wakeups").get()?.status,"cancelled");
  assert.equal(f.state.db.prepare("SELECT status FROM inbox WHERE id='om_one'").get()?.status,"completed");
  f.state.close();f.cleanup();
});

test("inbound access fails closed for strangers, bots, groups, and malformed events",()=>{
  const e={type:"im.message.receive_v1",sender_type:"user",sender_id:"ou_owner",chat_type:"p2p",chat_id:"oc_chat",message_id:"om_one",content:"hello"};
  const allowed=new Set(["ou_owner"]);
  assert(parseMessage(e,allowed));
  for(const patch of [{sender_id:"ou_stranger"},{sender_type:"bot"},{chat_type:"group"},{content:12},{message_id:"../../oops"}]) assert.equal(parseMessage({...e,...patch},allowed),undefined);
  assert.throws(()=>readConfig({}),/ALLOWED_USER_IDS/);
});

test("reply chunks preserve Unicode and repeated outbox writes are deduplicated",()=>{
  const text="测试🛰️".repeat(3000);assert.equal(chunkText(text).join(""),text);
  const f=fixture(),m=message();f.state.enqueue(m);
  f.state.reply("same-event",m.replyTo,"done");f.state.reply("same-event",m.replyTo,"done");
  assert.equal(f.state.db.prepare("SELECT COUNT(*) AS n FROM outbox").get()?.n,1);
  f.state.close();f.cleanup();
});

test("restart reconciles an interrupted turn before a queued conversation reset",()=>{
  const f=fixture();f.state.enqueue(message());f.state.claim();f.state.saveThread("oc_chat","old");
  f.state.enqueue(message("om_new","/new"));f.state.recover();
  const recovery=f.state.claim()!;assert.equal(recovery.kind,"recovery");assert.equal(f.state.thread("oc_chat"),"old");
  f.state.finish(recovery);assert.equal(f.state.claim()?.text,"/new");
  f.state.close();f.cleanup();
});
