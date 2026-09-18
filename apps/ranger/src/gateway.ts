import { spawn, execFile, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface } from "node:readline";
import { promisify } from "node:util";
import type { Config } from "./config.js";
import type { Message, Outgoing } from "./state.js";

const exec = promisify(execFile);
export function parseMessage(value: unknown, allowed: Set<string>): Message | undefined {
  if (!value || typeof value !== "object") return;
  const v = value as Record<string, unknown>;
  if (v.type !== "im.message.receive_v1" || v.sender_type !== "user" || v.chat_type !== "p2p") return;
  if (typeof v.sender_id !== "string" || !allowed.has(v.sender_id)) return;
  if (typeof v.message_id !== "string" || !/^om_[A-Za-z0-9_-]+$/.test(v.message_id)) return;
  if (typeof v.chat_id !== "string" || !/^oc_[A-Za-z0-9_-]+$/.test(v.chat_id)) return;
  if (typeof v.content !== "string" || !v.content.trim()) return;
  return { id: v.message_id, chat: v.chat_id, replyTo: v.message_id, text: v.content, kind: "user" };
}

export class Gateway {
  private child?: ChildProcessWithoutNullStreams;
  private stopping = false;
  ready = false;
  constructor(private config: Config, private env: NodeJS.ProcessEnv) {}
  private args() { return this.config.larkProfile ? ["--profile", this.config.larkProfile] : []; }
  async listen(onMessage: (message: Message) => void): Promise<void> {
    const child = spawn(this.config.larkPath, [...this.args(), "event", "consume", "im.message.receive_v1", "--as", "bot"], {
      env: this.env, stdio: ["pipe", "pipe", "pipe"],
    });
    this.child = child;
    // lark-cli stops when stdin reaches EOF. Keep this pipe open while serving.
    child.stdout.pause();
    const closed = new Promise<number | null>((resolve, reject) => { child.once("close", resolve); child.once("error", reject); });
    void closed.catch(() => undefined);
    const stderr = createInterface({ input: child.stderr });
    const startup = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Feishu event listener did not become ready")), 45_000);
      const close = () => { clearTimeout(timer); if (!this.ready) reject(new Error("Feishu listener stopped during startup")); };
      child.once("close", close); child.once("error", close);
      stderr.on("line", line => {
        if (line.includes("[event] ready event_key=im.message.receive_v1")) {
          this.ready = true; clearTimeout(timer); resolve();
        } else if (/drop|overflow/i.test(line)) {
          console.error("Feishu listener reported dropped events; inspect message coverage.");
        } else {
          // Never copy arbitrary CLI stderr (potentially credentials) to the journal.
          try {
            const error = JSON.parse(line)?.error;
            if (error) console.error("Feishu listener error", JSON.stringify({type: error.type, subtype: error.subtype}));
          } catch { /* progress diagnostics are not application logs */ }
        }
      });
    });
    try {
      await startup;
      console.log("Feishu listener ready");
      const lines = createInterface({ input: child.stdout, crlfDelay: Infinity });
      child.stdout.resume();
      for await (const line of lines) {
        let value: unknown;
        try { value = JSON.parse(line); } catch { console.error("Malformed Feishu event ignored"); continue; }
        const message = parseMessage(value, this.config.allowedUsers);
        if (message) onMessage(message); // Database errors must stop ingestion, not silently discard a message.
      }
      const code = await closed;
      if (!this.stopping) throw new Error(`Feishu listener stopped (${code ?? "signal"})`);
    } finally { this.ready = false; this.stop(); stderr.close(); }
  }
  async reply(message: Outgoing) {
    await exec(this.config.larkPath, [...this.args(), "im", "+messages-reply", "--as", "bot",
      "--message-id", message.replyTo, "--text", message.text, "--idempotency-key", message.id, "--json"],
      { env: this.env, timeout: 30_000, maxBuffer: 2 * 1024 * 1024 });
  }
  stop() { this.stopping = true; this.child?.stdin.end(); this.child?.kill("SIGTERM"); }
}
