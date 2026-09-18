import type { Config } from "./config.js";
import type { AgentRunner } from "./agent.js";
import { State, type Message, type Outgoing } from "./state.js";
import { reasoningCommand, type ReasoningEffort } from "./reasoning.js";

export interface Replies { reply(message: Outgoing): Promise<void> }
export class Service {
  private current?: {message: Message; controller: AbortController; effort: ReasoningEffort};
  private stopping = false;
  private delivering = false;
  constructor(private config: Config, readonly state: State, private agent: AgentRunner, private gateway: Replies) {}
  receive(m: Message) {
    if (!this.state.enqueue(m)) return;
    if (m.text.length > 100_000) {
      this.state.finish(m,"This message is too large to process as one turn. Please send a document link or split it into smaller messages.");
    } else if (m.kind === "user" && m.text.trim() === "/status") {
      this.state.finish(m,`RANGER is online.\nModel: ${this.config.model}\nReasoning: ${this.state.reasoningEffort(this.config.effort)} (all conversations)\n${this.current ? `Active turn reasoning: ${this.current.effort}\n` : ""}Conversation: ${this.state.thread(m.chat) || "not started"}\nCurrent turn in this chat: ${this.current?.message.chat === m.chat ? "running" : "idle"}\nExternal operations may continue between turns.`);
    } else if (m.kind === "user" && m.text.trim() === "/stop") {
      if (this.current?.message.chat === m.chat) this.current.controller.abort("user-stop");
      this.state.finish(m,"Stopped the active DeepSeek turn in this chat, if any. External transfers and evaluations require their own cancellation; stopping this turn does not cancel them.");
    } else this.handleReasoning(m);
  }
  private handleReasoning(m: Message) {
    const command = m.kind === "user" ? reasoningCommand(m.text) : undefined;
    if (!command) return false;
    const usage = "Use /reasoning off|low|high|max. This setting applies across all conversations and survives restarts and /new.";
    if (!command.valid) this.state.finish(m,`Invalid reasoning level. ${usage}`);
    else if (!command.effort) this.state.finish(m,`Reasoning: ${this.state.reasoningEffort(this.config.effort)}. ${this.current ? `The active turn is using ${this.current.effort}. ` : ""}${usage}`);
    else this.state.finishReasoningChange(m,command.effort,`Reasoning set to ${command.effort} for subsequent turns in all conversations. ${this.current ? `The active turn continues with ${this.current.effort}. ` : ""}Saved across restarts and /new.`);
    return true;
  }
  async work() {
    if (this.stopping || this.current) return;
    const message = this.state.claim();
    if (!message) return;
    if (this.handleReasoning(message)) return;
    if (message.kind === "user" && message.text.trim() === "/new") {
      this.state.reset(message.chat);
      this.state.finish(message,"Started a fresh conversation and cancelled pending conversation wakeups. Previous transcripts remain on disk. External operations are unchanged.");
      return;
    }
    const controller = new AbortController();
    const effort = this.state.reasoningEffort(this.config.effort);
    this.current = {message, controller, effort};
    const timer = setTimeout(() => controller.abort("turn-timeout"),this.config.turnTimeoutMs);
    if (message.kind !== "wakeup") this.state.reply(`${message.id}:ack`,message.replyTo,message.kind === "recovery" ? "RANGER restarted. I’m reconciling the interrupted request with its saved state." : "Working on it.");
    try { await this.agent(message,controller.signal,effort); }
    catch {
      if (!this.stopping) this.state.finish(message,
        controller.signal.aborted
          ? "This DeepSeek turn was stopped or reached its time limit. Its history is saved; external operations may still be running. I can inspect their state before continuing."
          : "The DeepSeek turn failed. Its saved conversation and any external operation records should be inspected before retrying work.",
        "failed");
      console.error(JSON.stringify({event:"turn_interrupted",messageId:message.id,shutdown:this.stopping}));
    } finally { clearTimeout(timer); this.current=undefined; }
  }
  async deliver() {
    if (this.delivering) return;
    const message = this.state.outgoing();
    if (!message) return;
    this.delivering = true;
    try { await this.gateway.reply(message); this.state.delivered(message.id); }
    catch { this.state.retry(message.id,message.attempts); console.error("Feishu reply deferred; durable outbox retained"); }
    finally { this.delivering=false; }
  }
  stop() { this.stopping=true; this.current?.controller.abort("shutdown"); }
  status() { return {activeMessageId:this.current?.message.id || null,reasoningEffort:this.state.reasoningEffort(this.config.effort),activeReasoningEffort:this.current?.effort || null,inbox:this.state.summary()}; }
}
