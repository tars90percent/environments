import { copyFile, mkdir, symlink, lstat, readlink, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import type { Config } from "./config.js";
import type { Message, State } from "./state.js";
import { runHarness } from "./harness.js";

export function chatKey(chat: string) { return createHash("sha256").update(chat).digest("hex").slice(0, 24); }
export type AgentRunner = (message: Message, signal: AbortSignal) => Promise<void>;

export async function prepareWorkspace(config: Config) {
  for (const p of [config.data, config.workspace, config.harnessHome, config.larkConfig]) await mkdir(p, { recursive: true, mode: 0o700 });
  await copyFile(join(config.sourceRoot, "AGENTS.md"), join(config.workspace, "AGENTS.md"));
  for (const name of ["docs", "ops", "apps"]) {
    const destination = join(config.workspace, name);
    try {
      const info = await lstat(destination);
      if (!info.isSymbolicLink()) throw new Error(`Expected a documentation symlink: ${destination}`);
      if (await readlink(destination) === join(config.sourceRoot,name)) continue;
      await unlink(destination);
    } catch (e) { if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e; }
    await symlink(join(config.sourceRoot, name), destination);
  }
  // JSON is valid YAML. Configuration uses the upstream plugin composition surface.
  await writeFile(join(config.harnessHome,"ranger.patch.yml"),JSON.stringify([
    {id:"hmr",disabled:true},
    {id:"acp",config:{provider:"deepseek-official",model:config.model}},
    {id:"llm-deepseek",config:{maxTokens:config.maxTokens,reasoningEffort:config.effort}},
    {id:"approval",config:{policy:"never"}},
    {id:"permission",config:{defaultPreset:"ranger",presets:{ranger:{sandbox:config.sandbox,approval:"never"}}}},
    {id:"sandbox-policy",config:{mode:config.sandbox,workspaceRoot:config.workspace}},
  ],null,2),{mode:0o600});
}

export function createAgent(config: Config, state: State, environment: NodeJS.ProcessEnv): AgentRunner {
  return async (message, signal) => {
    const conversationDir = join(config.data,"conversations",chatKey(message.chat));
    const wakeupDir = join(conversationDir,"wakeups",String(state.generation(message.chat)));
    await mkdir(wakeupDir,{recursive:true,mode:0o700});
    const contextPath=join(conversationDir,"context.json");
    await writeFile(contextPath,JSON.stringify({
      chatId:message.chat,messageId:message.replyTo,trigger:message.kind,
      wakeupDirectory:wakeupDir,documentation:join(config.sourceRoot,"apps/ranger/README.md"),
    },null,2),{mode:0o600});
    const env={...environment,RANGER_CHAT_ID:message.chat,RANGER_MESSAGE_ID:message.replyTo,
      RANGER_CONTEXT:contextPath,RANGER_WAKEUP_DIR:wakeupDir};
    const trigger=message.kind==="wakeup"
      ? "Scheduled follow-up from this conversation. Continue only within the previously authorized scope. Report only meaningful changes, completion, failure, or required user action unless periodic updates were requested. If unchanged, finish with exactly RANGER_NO_UPDATE."
      : "A message from the authorized Feishu user.";
    const input=`You are RANGER on the development machine. Read the workspace AGENTS.md and its RANGER guide. This turn's operational context is in ${contextPath}; its wakeup directory is ${wakeupDir}. ${trigger}\n\n${message.text}`;
    let sequence=0;
    const final=await runHarness(config,env,join(config.harnessHome,"ranger.patch.yml"),{
      sessionId:state.thread(message.chat),prompt:input,signal,
      onSession:id=>state.saveThread(message.chat,id),
      onText:text=>{
        if (message.kind!=="wakeup" && text.trim()) state.reply(`${message.id}:text:${sequence++}`,message.replyTo,text);
      },
    });
    state.finish(message,message.kind==="wakeup"
      ? final && !final.endsWith("RANGER_NO_UPDATE") ? final : undefined
      : sequence ? undefined : "RANGER finished without a text response. The conversation has been saved.");
  };
}
