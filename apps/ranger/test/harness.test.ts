import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { readConfig } from "../src/config.js";
import { prepareWorkspace } from "../src/agent.js";
import { runHarness } from "../src/harness.js";

test("official harness preserves history across separate processes and honors model selection",{timeout:90_000},async()=>{
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
  const config=readConfig({ALLOWED_USER_IDS:"ou_test",RANGER_DATA_DIR:dir,DSH_PERMISSION_MODE:"read-only"});
  const env={PATH:process.env.PATH,HOME:dir,DEEPSEEK_API_KEY:"sk-local-fixture-only",DEEPSEEK_BASE_URL:`http://127.0.0.1:${address.port}`};
  let sessionId:string|undefined;
  try {
    await prepareWorkspace(config);
    const first=await runHarness(config,env,join(config.harnessHome,"ranger.patch.yml"),{
      prompt:"Remember RANGER_MEMORY_42",signal:AbortSignal.timeout(35000),onSession:id=>{sessionId=id;},onText:()=>{},
    });
    assert.match(first,/Remembered/);assert(sessionId);
    const second=await runHarness(config,env,join(config.harnessHome,"ranger.patch.yml"),{
      sessionId,prompt:"What did I ask you to remember?",signal:AbortSignal.timeout(35000),onSession:id=>assert.equal(id,sessionId),onText:()=>{},
    });
    assert.match(second,/survived restart/);assert.equal(requests.length,2);
    for(const r of requests) {assert.equal(r.model,"deepseek-flash");assert.equal(r.max_tokens,16384);}
    assert.match(JSON.stringify(requests[1]?.messages),/Remembered RANGER_MEMORY_42/);
    assert.match(JSON.stringify(requests[1]?.messages),/Remember RANGER_MEMORY_42/);
  } finally {server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));await rm(dir,{recursive:true,force:true});}
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
