import { spawn } from "node:child_process";
import { Readable, Writable } from "node:stream";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ClientSideConnection, ndJsonStream, PROTOCOL_VERSION,
  type SessionConfigOption, type SessionNotification } from "@agentclientprotocol/sdk";
import type { Config } from "./config.js";
import { HarnessEvents, type HarnessObservers } from "./harness-events.js";

export async function bounded<T>(operation: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try { return await Promise.race([operation, new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out`)), ms);
  })]); } finally { clearTimeout(timer); }
}

function choices(options: SessionConfigOption[], id: string) {
  const row = options.find(x => x.id === id);
  return row?.type === "select" ? row.options.flatMap(x => "options" in x ? x.options : [x]) : [];
}

export interface HarnessRun extends HarnessObservers {
  sessionId?: string;
  prompt: string;
  signal: AbortSignal;
  onSession(id: string): void;
}

/** The upstream ACP profile owns the agent loop, tools, persistence and model calls. */
export async function runHarness(config: Config, environment: NodeJS.ProcessEnv, patch: string, run: HarnessRun) {
  run.signal.throwIfAborted();
  const child = spawn(process.execPath,[config.harnessPath,"--profile","acp","--patch",patch],{
    cwd:config.workspace,env:{...environment,DSH_HOME:config.harnessHome,DSH_TELEMETRY_DISABLED:"1"},
    stdio:["pipe","pipe","pipe"],
  });
  // Drain diagnostics without writing prompts, credentials or tool output to the journal.
  let stderr = "";
  child.stderr.on("data",chunk => { stderr=(stderr+String(chunk)).slice(-8000); });
  const exited = new Promise<void>((resolve,reject) => {child.once("close",()=>resolve());child.once("error",reject);});
  void exited.catch(()=>undefined);
  let sessionId = run.sessionId, observerError: unknown;
  const events = new HarnessEvents(run);
  const client = new ClientSideConnection(()=>({
    // The service cannot ask interactive sandbox questions. Never silently grant an escalation.
    requestPermission:async()=>({outcome:{outcome:"cancelled" as const}}),
    sessionUpdate:async(notification: SessionNotification)=>{
      if (notification.sessionId !== sessionId || observerError) return;
      try { events.accept(notification.update); }
      catch(error) { observerError=error; void client.cancel({sessionId}).catch(()=>undefined); }
    },
  }),ndJsonStream(Writable.toWeb(child.stdin),Readable.toWeb(child.stdout) as ReadableStream<Uint8Array>));
  let killTimer: NodeJS.Timeout | undefined;
  let stage="initialize", failure: unknown;
  const cancel=()=>{
    if (sessionId) void client.cancel({sessionId}).catch(()=>undefined);
    else child.kill("SIGTERM");
    killTimer=setTimeout(()=>child.kill("SIGTERM"),5000);
  };
  run.signal.addEventListener("abort",cancel,{once:true});
  try {
    const initialized=await bounded(client.initialize({protocolVersion:PROTOCOL_VERSION,clientCapabilities:{},clientInfo:{name:"ranger",version:"0.1.0"}}),45_000,"Harness initialization");
    if (!initialized.agentCapabilities?.sessionCapabilities?.resume || !initialized.agentCapabilities?.sessionCapabilities?.close) throw new Error("Harness lacks durable resume/close capabilities");
    stage="session-open";
    const opened=await bounded(sessionId
      ? client.resumeSession({sessionId,cwd:config.workspace,mcpServers:[]})
      : client.newSession({cwd:config.workspace,mcpServers:[]}),30_000,"Session open");
    if (!sessionId && "sessionId" in opened && typeof opened.sessionId === "string") sessionId=opened.sessionId;
    if (!sessionId) throw new Error("Harness did not return a session ID");
    run.onSession(sessionId);
    run.signal.throwIfAborted();
    const modelChoice=choices(opened.configOptions || [],"model").find(x=>{
      // Use an advertised opaque value, checking its upstream DSH route encoding.
      try { const value=JSON.parse(x.value);return value[0]==="deepseek-official" && value[1]===config.model; } catch { return false; }
    });
    if (!modelChoice) throw new Error("Requested DeepSeek model is not advertised by the harness");
    stage="model-selection";
    const selected=await bounded(client.setSessionConfigOption({sessionId,configId:"model",value:modelChoice.value}),10_000,"Model selection");
    const effort=choices(selected.configOptions,"reasoning_effort").find(x=>x.value===config.effort);
    if (!effort) throw new Error("Requested reasoning effort is not advertised by the model");
    stage="reasoning-selection";
    await bounded(client.setSessionConfigOption({sessionId,configId:"reasoning_effort",value:effort.value}),10_000,"Reasoning selection");
    run.signal.throwIfAborted();
    stage="prompt";
    const result=await client.prompt({sessionId,prompt:[{type:"text",text:run.prompt}]});
    if (observerError) throw observerError;
    run.signal.throwIfAborted();
    if (result.stopReason!=="end_turn") throw new Error(`Harness stopped: ${result.stopReason}`);
    return events.finish();
  } catch(error) {
    failure=error;
    // Only the error class is logged. Private runtime session files retain detailed evidence.
    console.error(JSON.stringify({event:"harness_error",stage,type:error instanceof Error ? error.name : "unknown",diagnosticsAvailable:stderr.length>0}));
    throw error;
  } finally {
    run.signal.removeEventListener("abort",cancel);clearTimeout(killTimer);
    let closeFailure: unknown;
    if (sessionId && child.exitCode===null && child.signalCode===null) {
      await bounded(client.closeSession({sessionId}),5000,"Session close").catch(error=>{closeFailure=error;});
    }
    child.stdin.end();
    try { await bounded(exited,6000,"Harness exit"); }
    catch {
      child.kill("SIGTERM");
      try { await bounded(exited,3000,"Harness termination"); }
      catch { child.kill("SIGKILL");await bounded(exited,3000,"Harness kill"); }
    }
    if (failure || closeFailure) {
      const error=failure || closeFailure;
      let diagnostics=JSON.stringify({at:new Date().toISOString(),stage,sessionId,
        error:error instanceof Error ? {type:error.name,message:error.message,data:(error as Error & {data?:unknown}).data} : String(error),stderr});
      for (const [name,value] of Object.entries(environment)) {
        if (/key|secret|token|password/i.test(name) && value && value.length>=8) diagnostics=diagnostics.replaceAll(value,"[redacted]");
      }
      await writeFile(join(config.harnessHome,"last-error.json"),diagnostics,{mode:0o600});
    }
    if (closeFailure && !failure) throw closeFailure;
  }
}
