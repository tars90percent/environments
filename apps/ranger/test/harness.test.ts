import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { readConfig } from "../src/config.js";
import { chatKey, createAgent, prepareWorkspace } from "../src/agent.js";
import { runHarness } from "../src/harness.js";
import { State, type Message } from "../src/state.js";
import { Service } from "../src/service.js";

test("Feishu reasoning commands reach the official harness across turns and restart with history intact",{timeout:150_000},async()=>{
  const dir=await mkdtemp(join(tmpdir(),"ranger-acp-"));
  const requests: Record<string,unknown>[]=[];
  const server=createServer(async(req,res)=>{
    const chunks:Buffer[]=[];for await(const c of req) chunks.push(c);
    const body=JSON.parse(Buffer.concat(chunks).toString());requests.push(body);
    res.writeHead(200,{"content-type":"text/event-stream"});
    const packet={id:"mock",object:"chat.completion.chunk",created:1,model:"deepseek-flash",choices:[{index:0,delta:{role:"assistant",content:requests.length===1?"Remembered RANGER_MEMORY_42.":"RANGER_MEMORY_42 survived restart."},finish_reason:null}]};
    res.write(`data: ${JSON.stringify(packet)}\n\n`);
    res.end(`data: ${JSON.stringify({...packet,choices:[{index:0,delta:{},finish_reason:"stop"}],usage:{prompt_tokens:10,completion_tokens:10,total_tokens:20}})}\n\ndata: [DONE]\n\n`);
  });
  await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve));
  const address=server.address();assert(address && typeof address!=="string");
  const config=readConfig({ALLOWED_USER_IDS:"ou_test",RANGER_DATA_DIR:dir,DSH_PERMISSION_MODE:"read-only",RANGER_TURN_TIMEOUT_SECONDS:"35"});
  const env={PATH:process.env.PATH,HOME:dir,DEEPSEEK_API_KEY:"sk-local-fixture-only",DEEPSEEK_BASE_URL:`http://127.0.0.1:${address.port}`};
  let state=new State(join(dir,"state.sqlite"));
  const makeService=()=>new Service(config,state,createAgent(config,state,env),{reply:async()=>{}});
  const message=(id:string,text:string):Message=>({id,chat:"oc_test",replyTo:id,text,kind:"user"});
  try {
    await prepareWorkspace(config);
    let service=makeService();
    service.receive(message("om_first","Remember RANGER_MEMORY_42"));await service.work();
    const sessionId=state.thread("oc_test");assert(sessionId);
    service.receive(message("om_max","/reasoning max"));
    state.close();state=new State(join(dir,"state.sqlite"));service=makeService();
    service.receive(message("om_second","What did I ask you to remember?"));await service.work();
    for (const effort of ["low","off"]) {
      service.receive(message(`om_set_${effort}`,`/reasoning ${effort}`));
      service.receive(message(`om_turn_${effort}`,"Recall the saved value."));await service.work();
    }
    assert.equal(state.thread("oc_test"),sessionId);assert.equal(requests.length,4);
    for(const r of requests) {assert.equal(r.model,"deepseek-flash");assert.equal(r.max_tokens,16384);}
    assert.deepEqual(requests.map(r=>r.reasoning_effort),["high","max","low",undefined]);
    assert.deepEqual(requests.map(r=>r.thinking),[{type:"enabled"},{type:"enabled"},{type:"enabled"},{type:"disabled"}]);
    assert.match(JSON.stringify(requests[1]?.messages),/Remembered RANGER_MEMORY_42/);
    assert.match(JSON.stringify(requests[1]?.messages),/Remember RANGER_MEMORY_42/);
    const context=JSON.parse(await readFile(join(config.data,"conversations",chatKey("oc_test"),"context.json"),"utf8"));
    assert.equal(context.reasoningEffort,"off");
    assert.equal(state.db.prepare("SELECT COUNT(*) AS n FROM inbox WHERE status!='completed'").get()?.n,0);
  } finally {state.close();server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));await rm(dir,{recursive:true,force:true});}
});

test("cancelling a real harness request stops the model stream and reaps its process",{timeout:60_000},async()=>{
  const dir=await mkdtemp(join(tmpdir(),"ranger-cancel-"));
  let accepted!:()=>void;const requested=new Promise<void>(resolve=>accepted=resolve);
  const server=createServer(async(req,res)=>{for await(const _ of req){};res.writeHead(200,{"content-type":"text/event-stream"});res.flushHeaders();accepted();});
  await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve));
  const address=server.address();assert(address && typeof address!=="string");
  const config=readConfig({ALLOWED_USER_IDS:"ou_test",RANGER_DATA_DIR:dir,DSH_PERMISSION_MODE:"read-only"});
  const controller=new AbortController();
  try {
    await prepareWorkspace(config);
    const running=runHarness(config,{PATH:process.env.PATH,HOME:dir,DEEPSEEK_API_KEY:"sk-local-fixture-only",DEEPSEEK_BASE_URL:`http://127.0.0.1:${address.port}`},join(config.harnessHome,"ranger.patch.yml"),{
      prompt:"Wait for a response",signal:controller.signal,onSession:()=>{},onText:()=>{},
    });
    const rejection=assert.rejects(running);
    await Promise.race([requested,running]);controller.abort(new Error("test cancellation"));await rejection;
  } finally {controller.abort();server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));await rm(dir,{recursive:true,force:true});}
});

test("real harness tool inputs reach the outbox in order, with no outputs or thoughts and quiet wakeups",{timeout:90_000},async()=>{
  const dir=await mkdtemp(join(tmpdir(),"ranger-tools-"));
  const config=readConfig({ALLOWED_USER_IDS:"ou_test",RANGER_DATA_DIR:dir,DSH_PERMISSION_MODE:"read-only",RANGER_TURN_TIMEOUT_SECONDS:"35"});
  const path=join(config.workspace,"example.txt"),requests:Record<string,unknown>[]=[];
  const server=createServer(async(req,res)=>{
    const chunks:Buffer[]=[];for await(const c of req) chunks.push(c);
    const body=JSON.parse(Buffer.concat(chunks).toString());requests.push(body);
    const toolTurn=requests.length%2===1;
    const delta=toolTurn ? {role:"assistant",content:"Checking the file.",reasoning_content:"THOUGHT_MUST_STAY_PRIVATE",tool_calls:[{index:0,id:`read_${requests.length}`,type:"function",function:{name:"read",arguments:JSON.stringify({file_path:path})}}]} : {role:"assistant",content:requests.length===2 ? "The check is complete." : "RANGER_NO_UPDATE"};
    const packet={id:"mock",object:"chat.completion.chunk",created:1,model:"deepseek-flash",choices:[{index:0,delta,finish_reason:null}]};
    res.writeHead(200,{"content-type":"text/event-stream"});res.write(`data: ${JSON.stringify(packet)}\n\n`);
    res.end(`data: ${JSON.stringify({...packet,choices:[{index:0,delta:{},finish_reason:toolTurn?"tool_calls":"stop"}],usage:{prompt_tokens:10,completion_tokens:10,total_tokens:20}})}\n\ndata: [DONE]\n\n`);
  });
  await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve));
  const address=server.address();assert(address && typeof address!=="string");
  const state=new State(join(dir,"state.sqlite"));
  const env={PATH:process.env.PATH,HOME:dir,DEEPSEEK_API_KEY:"sk-local-fixture-only",DEEPSEEK_BASE_URL:`http://127.0.0.1:${address.port}`};
  try {
    await prepareWorkspace(config);await writeFile(path,"TOOL_OUTPUT_MUST_STAY_PRIVATE");
    const service=new Service(config,state,createAgent(config,state,env),{reply:async()=>{}});
    service.receive({id:"om_tools",chat:"oc_tools",replyTo:"om_tools",text:"Inspect example.txt",kind:"user"});await service.work();
    assert.equal(requests.length,2);
    assert.match(JSON.stringify(requests[1]?.messages),/TOOL_OUTPUT_MUST_STAY_PRIVATE/);
    const texts=state.db.prepare("SELECT text FROM outbox ORDER BY seq").all().map(x=>String(x.text));
    assert.equal(texts.length,4);assert.equal(texts[1],"Checking the file.");
    assert.match(texts[2]!,/🔧 Tool call: read/);assert(texts[2]!.includes(path));
    assert.equal(texts[3],"The check is complete.");
    assert.doesNotMatch(texts.join("\n"),/TOOL_OUTPUT_MUST_STAY_PRIVATE|THOUGHT_MUST_STAY_PRIVATE/);
    state.enqueue({id:"wake:tools",chat:"oc_tools",replyTo:"om_tools",text:"Check the file again",kind:"wakeup"});await service.work();
    assert.equal(requests.length,4);
    assert.equal(state.db.prepare("SELECT COUNT(*) AS n FROM outbox").get()?.n,4);
    assert.equal(state.db.prepare("SELECT COUNT(*) AS n FROM inbox WHERE status!='completed'").get()?.n,0);
  } finally {state.close();server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));await rm(dir,{recursive:true,force:true});}
});
