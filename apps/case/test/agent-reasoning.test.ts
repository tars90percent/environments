import assert from "node:assert/strict";
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { ChatAgent } from "../src/agent.js";
import { config } from "../src/config.js";
import { StateStore } from "../src/state.js";
import type { FeishuMessageEvent } from "../src/types.js";

test("SDK receives Astra and updated effort on fresh, cached, resumed and restarted conversations", async () => {
  const root = await mkdtemp(join(tmpdir(), "case-agent-reasoning-"));
  const fixture = join(root, "codex-fixture.mjs");
  const trace = join(root, "calls.jsonl");
  const original = { codexPath: config.codexPath, codexAuthHomes: config.codexAuthHomes };
  await writeFile(fixture, `#!/usr/bin/env node
import { appendFileSync } from "node:fs";
const args = process.argv.slice(2);
if (args[0] === "login") { console.error("Logged in using ChatGPT"); process.exit(0); }
for await (const chunk of process.stdin) {}
appendFileSync(${JSON.stringify(trace)}, JSON.stringify({ args, home: process.env.CODEX_HOME }) + "\\n");
const threadId = args.includes("resume") ? args[args.indexOf("resume") + 1] : "fixture-thread";
for (const event of [
  { type: "thread.started", thread_id: threadId },
  { type: "item.completed", item: { id: "reply", type: "agent_message", text: "fixture reply" } },
  { type: "turn.completed", usage: { input_tokens: 1, cached_input_tokens: 0, output_tokens: 1 } },
]) console.log(JSON.stringify(event));
`);
  await chmod(fixture, 0o755);
  config.codexPath = fixture;
  config.codexAuthHomes = { primary: join(root, "primary"), backup: join(root, "backup") };
  const event: FeishuMessageEvent = {
    type: "im.message.receive_v1", event_id: "event", message_id: "message", chat_id: "chat",
    chat_type: "p2p", sender_id: "admin", sender_type: "user", message_type: "text", content: "synthetic prompt",
  };
  const calls = async () => (await readFile(trace, "utf8")).trim().split("\n").map((line) => JSON.parse(line) as { args: string[]; home: string });
  const verify = (args: string[], effort: string, threadId?: string) => {
    assert.equal(args[args.indexOf("--model") + 1], "gpt-6-astra");
    assert.ok(args.includes(`model_reasoning_effort="${effort}"`));
    if (threadId) assert.equal(args[args.indexOf("resume") + 1], threadId);
    else assert.ok(!args.includes("resume"));
  };
  try {
    const statePath = join(root, "state.json");
    const state = new StateStore(statePath);
    await state.load();
    const agent = new ChatAgent(state);
    assert.deepEqual(agent.modelSettings(), { model: "gpt-6-astra", reasoningEffort: "high" });
    const first = await agent.respond(event);
    verify((await calls()).at(-1)!.args, "high");
    // Cached thread ID must survive an effort change even before the outer handler records success.
    await agent.useReasoningEffort("low", "set-low");
    await agent.respond(event);
    verify((await calls()).at(-1)!.args, "low", first.threadId);
    await state.recordSuccess(event.chat_id, first.authSlot, first.threadId, event.message_id);
    await agent.respond(event);
    verify((await calls()).at(-1)!.args, "low", first.threadId);
    const reloaded = new StateStore(statePath);
    await reloaded.load();
    const restarted = new ChatAgent(reloaded);
    await restarted.respond(event);
    verify((await calls()).at(-1)!.args, "low", first.threadId);
    await restarted.useReasoningEffort("xhigh", "set-xhigh");
    await reloaded.recordSuccess("chat", "backup", "backup-thread", "backup-existing");
    assert.equal(await restarted.useAuthSlot("backup"), "switched");
    await restarted.respond(event);
    const backupCall = (await calls()).at(-1)!;
    verify(backupCall.args, "xhigh", "backup-thread");
    assert.equal(backupCall.home, config.codexAuthHomes.backup);
    await restarted.respond({ ...event, chat_id: "another-chat" });
    verify((await calls()).at(-1)!.args, "xhigh");
  } finally {
    Object.assign(config, original);
    await rm(root, { recursive: true, force: true });
  }
});
