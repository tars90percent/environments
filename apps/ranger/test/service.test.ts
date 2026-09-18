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

test("reasoning commands persist globally, reject invalid values, and deduplicate deliveries",async()=>{
  const f=fixture();let runs=0,closed=false;
  const service=new Service(f.config,f.state,async()=>{runs++;},{reply:async()=>{}});
  try {
    service.receive(message("om_show","/reasoning"));
    assert.match(f.state.outgoing()!.text,/Reasoning: high/);
    service.receive(message("om_max"," /reasoning MAX \n"));
    service.receive({...message("om_low","/reasoning low"),chat:"oc_other"});
    service.receive(message("om_max","/reasoning max"));
    for (const [i,text] of ["/reasoning medium","/reasoning max extra"].entries()) service.receive(message(`om_bad_${i}`,text));
    await service.work();
    assert.equal(runs,0);assert.equal(f.state.reasoningEffort(f.config.effort),"low");
    service.receive(message("om_new","/new"));await service.work();
    assert.equal(f.state.reasoningEffort(f.config.effort),"low");
    const texts=f.state.db.prepare("SELECT text FROM outbox").all().map(x=>String(x.text));
    assert.equal(texts.filter(x=>x.startsWith("Invalid reasoning level.")).length,2);
    f.state.close();closed=true;
    const reopened=new State(f.path);
    try {assert.equal(reopened.reasoningEffort("off"),"low");assert.equal(reopened.claim(),undefined);}
    finally {reopened.close();}
  } finally {if (!closed) f.state.close();f.cleanup();}
});

test("reasoning changes during a turn apply to the next turn, including follow-ups",async()=>{
  const f=fixture();let started!:()=>void,release!:()=>void;
  const running=new Promise<void>(resolve=>started=resolve);
  const blocked=new Promise<void>(resolve=>release=resolve);
  const efforts:string[]=[];
  const service=new Service(f.config,f.state,async(m,signal,effort)=>{
    efforts.push(effort);
    if (efforts.length===1) {started();await blocked;assert.equal(signal.aborted,false);}
    f.state.finish(m);
  },{reply:async()=>{}});
  try {
    service.receive(message());const work=service.work();await running;
    service.receive(message("om_max","/reasoning max"));
    service.receive(message("om_status","/status"));
    const texts=f.state.db.prepare("SELECT text FROM outbox").all().map(x=>String(x.text));
    assert(texts.some(x=>x.includes("Reasoning: max (all conversations)") && x.includes("Active turn reasoning: high")));
    assert.equal(service.status().activeReasoningEffort,"high");
    release();await work;
    f.state.enqueue({...message("wake:test","inspect existing job"),kind:"wakeup"});await service.work();
    assert.deepEqual(efforts,["high","max"]);
  } finally {release();f.state.close();f.cleanup();}
});

test("reasoning changes and their replies commit atomically; interrupted commands replay without a model",async()=>{
  const f=fixture();const service=new Service(f.config,f.state,async()=>assert.fail("no model needed"),{reply:async()=>{}});
  const m=message("om_max","/reasoning max");
  try {
    const reply=f.state.reply;
    f.state.reply=()=>{throw new Error("simulated outbox failure");};
    assert.throws(()=>service.receive(m),/simulated outbox failure/);
    f.state.reply=reply;
    assert.equal(f.state.reasoningEffort("high"),"high");
    assert.equal(f.state.db.prepare("SELECT COUNT(*) AS n FROM outbox").get()?.n,0);
    assert.equal(f.state.claim()?.id,m.id); // Crash after claiming the queued command.
    assert.equal(f.state.recover(),1);
    assert.equal(f.state.db.prepare("SELECT COUNT(*) AS n FROM inbox WHERE kind='recovery'").get()?.n,0);
    await service.work();
    assert.equal(f.state.reasoningEffort("high"),"max");
    assert.match(f.state.outgoing()!.text,/Reasoning set to max/);
    assert.equal(f.state.claim(),undefined);
  } finally {f.state.close();f.cleanup();}
});

test("an older queued reasoning command cannot undo a newer selection after restart",async()=>{
  const f=fixture();const service=new Service(f.config,f.state,async()=>assert.fail("no model needed"),{reply:async()=>{}});
  try {
    f.state.enqueue(message("om_old","/reasoning low"));f.state.claim();
    f.state.recover();
    service.receive(message("om_new","/reasoning max"));
    await service.work();
    assert.equal(f.state.reasoningEffort("high"),"max");
    const texts=f.state.db.prepare("SELECT text FROM outbox").all().map(x=>String(x.text));
    assert(texts.some(x=>x.includes("Reasoning remains max")));
    assert.equal(f.state.claim(),undefined);
  } finally {f.state.close();f.cleanup();}
});
