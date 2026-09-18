import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { isReasoningEffort, reasoningCommand, type ReasoningEffort } from "./reasoning.js";

export type Message = {
  id: string; chat: string; replyTo: string; text: string;
  kind: "user" | "wakeup" | "recovery";
};
export type Outgoing = { id: string; replyTo: string; text: string; attempts: number };

export class State {
  readonly db: DatabaseSync;
  constructor(path: string) {
    this.db = new DatabaseSync(path);
    this.db.exec(`
      PRAGMA journal_mode=WAL;
      PRAGMA synchronous=FULL;
      PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS conversations (chat TEXT PRIMARY KEY, thread TEXT, reply_to TEXT NOT NULL, generation INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS inbox (
        seq INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT UNIQUE NOT NULL,
        chat TEXT NOT NULL, reply_to TEXT NOT NULL, text TEXT NOT NULL, kind TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'queued', created INTEGER NOT NULL, updated INTEGER NOT NULL, expires INTEGER
      );
      CREATE TABLE IF NOT EXISTS outbox (
        seq INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT UNIQUE NOT NULL, reply_to TEXT NOT NULL,
        text TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, next_try INTEGER NOT NULL DEFAULT 0,
        sent INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS wakeups (
        id TEXT PRIMARY KEY, chat TEXT NOT NULL, prompt TEXT NOT NULL, due INTEGER NOT NULL,
        expires INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'pending'
      );
      CREATE TABLE IF NOT EXISTS runtime_settings (
        id INTEGER PRIMARY KEY CHECK(id=1), reasoning_effort TEXT NOT NULL, message_seq INTEGER NOT NULL
      );
    `);
  }
  close() { this.db.close(); }
  transaction<T>(fn: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try { const result = fn(); this.db.exec("COMMIT"); return result; }
    catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }
  enqueue(m: Message) {
    return this.transaction(() => {
      const now = Date.now();
      const result = this.db.prepare("INSERT OR IGNORE INTO inbox(id,chat,reply_to,text,kind,created,updated) VALUES(?,?,?,?,?,?,?)")
        .run(m.id, m.chat, m.replyTo, m.text, m.kind, now, now);
      if (result.changes) this.db.prepare("INSERT INTO conversations(chat,reply_to) VALUES(?,?) ON CONFLICT(chat) DO UPDATE SET reply_to=excluded.reply_to")
        .run(m.chat, m.replyTo);
      return Boolean(result.changes);
    });
  }
  claim(): Message | undefined {
    return this.transaction(() => {
      this.db.prepare("UPDATE inbox SET status='expired' WHERE status='queued' AND expires<?").run(Date.now());
      // Reconcile the interrupted conversation before a queued /new can discard its thread ID.
      const row = this.db.prepare("SELECT id,chat,reply_to AS replyTo,text,kind FROM inbox WHERE status='queued' ORDER BY (kind='recovery') DESC,seq LIMIT 1").get() as Message | undefined;
      if (row) this.db.prepare("UPDATE inbox SET status='running',updated=? WHERE id=?").run(Date.now(), row.id);
      return row;
    });
  }
  saveThread(chat: string, thread: string) { this.db.prepare("UPDATE conversations SET thread=? WHERE chat=?").run(thread, chat); }
  thread(chat: string) { return (this.db.prepare("SELECT thread FROM conversations WHERE chat=?").get(chat) as {thread: string | null} | undefined)?.thread || undefined; }
  reasoningEffort(fallback: ReasoningEffort): ReasoningEffort {
    const row = this.db.prepare("SELECT reasoning_effort FROM runtime_settings WHERE id=1").get();
    if (!row) return fallback;
    if (!isReasoningEffort(row.reasoning_effort)) throw new Error("Invalid stored reasoning effort");
    return row.reasoning_effort;
  }
  finishReasoningChange(m: Message, effort: ReasoningEffort, response: string) {
    this.transaction(() => {
      const message = this.db.prepare("SELECT seq FROM inbox WHERE id=?").get(m.id);
      if (!message || typeof message.seq !== "number") throw new Error("Reasoning command is missing from the inbox");
      // An older queued command recovered after restart must not undo a newer
      // selection already handled by the live event stream.
      const changed = this.db.prepare("INSERT INTO runtime_settings(id,reasoning_effort,message_seq) VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET reasoning_effort=excluded.reasoning_effort,message_seq=excluded.message_seq WHERE excluded.message_seq>runtime_settings.message_seq").run(effort,message.seq);
      this.reply(`${m.id}:final`,m.replyTo,changed.changes ? response : `A newer reasoning command has already taken precedence. Reasoning remains ${this.reasoningEffort(effort)}.`);
      this.db.prepare("UPDATE inbox SET status='completed',updated=? WHERE id=?").run(Date.now(),m.id);
    });
  }
  reset(chat: string) {
    this.transaction(() => {
      this.db.prepare("UPDATE conversations SET thread=NULL,generation=generation+1 WHERE chat=?").run(chat);
      this.db.prepare("UPDATE wakeups SET status='cancelled' WHERE chat=? AND status='pending'").run(chat);
      this.db.prepare("UPDATE inbox SET status='cancelled' WHERE chat=? AND kind='wakeup' AND status='queued'").run(chat);
    });
  }
  reply(id: string, replyTo: string, text: string) {
    // Small Unicode code-point chunks stay below Feishu's UTF-8 payload limit.
    const chunks = chunkText(text.trim() || "The operation finished without a text response.");
    chunks.forEach((part, i) => this.db.prepare("INSERT OR IGNORE INTO outbox(id,reply_to,text) VALUES(?,?,?)")
      .run(createHash("sha256").update(`${id}:${i}`).digest("hex").slice(0, 48), replyTo, part));
  }
  finish(m: Message, text?: string, status = "completed") {
    this.transaction(() => {
      if (text) this.reply(`${m.id}:final`, m.replyTo, text);
      this.db.prepare("UPDATE inbox SET status=?,updated=? WHERE id=?").run(status, Date.now(), m.id);
    });
  }
  outgoing(now = Date.now()): Outgoing | undefined {
    // Preserve reply ordering, including when the oldest reply is backing off.
    const row = this.db.prepare("SELECT id,reply_to AS replyTo,text,attempts,next_try FROM outbox WHERE sent=0 ORDER BY seq LIMIT 1").get() as (Outgoing & {next_try:number}) | undefined;
    return row && row.next_try <= now ? row : undefined;
  }
  delivered(id: string) { this.db.prepare("UPDATE outbox SET sent=1 WHERE id=?").run(id); }
  retry(id: string, attempts: number) {
    this.db.prepare("UPDATE outbox SET attempts=attempts+1,next_try=? WHERE id=?")
      .run(Date.now() + Math.min(300_000, 1000 * 2 ** Math.min(attempts, 9)), id);
  }
  recover() {
    const rows = this.db.prepare("SELECT id,chat,reply_to AS replyTo,text,kind FROM inbox WHERE status='running'").all() as Message[];
    for (const m of rows) this.transaction(() => {
      // A control command has no model-side effects to reconcile. Its setting,
      // completion and reply commit atomically, so an interrupted command can retry.
      if (m.kind === "user" && reasoningCommand(m.text)) {
        this.db.prepare("UPDATE inbox SET status='queued',updated=? WHERE id=?").run(Date.now(),m.id);
        return;
      }
      this.db.prepare("UPDATE inbox SET status='interrupted',updated=? WHERE id=?").run(Date.now(), m.id);
      // Recovery is a fresh turn in the persisted conversation, never a replay of shell commands.
      this.db.prepare("INSERT OR IGNORE INTO inbox(id,chat,reply_to,text,kind,created,updated) VALUES(?,?,?,?,?,?,?)")
        .run(`recover:${m.id}`, m.chat, m.replyTo,
          m.kind === "recovery" ? m.text : `RANGER restarted during an unfinished request. Inspect the saved conversation and reconcile existing external operations before continuing within the original authorization. Do not blindly repeat submissions or commands. If the outcome cannot be established, report that uncertainty. Interrupted request:\n\n${m.text}`, "recovery", Date.now(), Date.now());
    });
    return rows.length;
  }
  generation(chat: string) { return Number(this.db.prepare("SELECT generation FROM conversations WHERE chat=?").get(chat)?.generation ?? 0); }
  chats() { return this.db.prepare("SELECT chat,reply_to AS replyTo,generation FROM conversations").all() as {chat:string;replyTo:string;generation:number}[]; }
  schedule(id: string, chat: string, prompt: string, due: number, expires: number) {
    return Boolean(this.db.prepare("INSERT OR IGNORE INTO wakeups(id,chat,prompt,due,expires) VALUES(?,?,?,?,?)").run(id,chat,prompt,due,expires).changes);
  }
  dispatchWakeups(now = Date.now()) {
    this.transaction(() => {
      this.db.prepare("UPDATE wakeups SET status='expired' WHERE status='pending' AND expires<?").run(now);
      const due = this.db.prepare("SELECT w.id,w.chat,w.prompt,w.expires,c.reply_to AS replyTo FROM wakeups w JOIN conversations c ON c.chat=w.chat WHERE w.status='pending' AND w.due<=?").all(now) as {id:string;chat:string;prompt:string;replyTo:string;expires:number}[];
      for (const w of due) {
        this.db.prepare("INSERT OR IGNORE INTO inbox(id,chat,reply_to,text,kind,created,updated,expires) VALUES(?,?,?,?,?,?,?,?)")
          .run(`wake:${w.id}`,w.chat,w.replyTo,w.prompt,"wakeup",now,now,w.expires);
        this.db.prepare("UPDATE wakeups SET status='dispatched' WHERE id=?").run(w.id);
      }
    });
  }
  summary() { return this.db.prepare("SELECT status,COUNT(*) AS count FROM inbox GROUP BY status").all(); }
}

export function chunkText(text: string, size = 3000): string[] {
  const characters = Array.from(text), chunks: string[] = [];
  for (let i = 0; i < characters.length;) {
    let end = Math.min(i+size,characters.length);
    if (end < characters.length) {
      const minimum = i+Math.floor(size/2);
      for (const boundary of ["paragraph","line","space"]) {
        let found = false;
        for (let j=end; j>minimum; j--) {
          if (boundary === "paragraph" ? characters[j-1]==="\n" && characters[j-2]==="\n" : boundary === "line" ? characters[j-1]==="\n" : characters[j-1]===" ") {
            end=j;found=true;break;
          }
        }
        if (found) break;
      }
    }
    chunks.push(characters.slice(i,end).join(""));i=end;
  }
  return chunks;
}
