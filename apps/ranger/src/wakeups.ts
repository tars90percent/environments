import { readdir, readFile, lstat, rename } from "node:fs/promises";
import { join } from "node:path";
import { chatKey } from "./agent.js";
import type { State } from "./state.js";

export function parseWakeup(value: unknown, now = Date.now()) {
  if (!value || typeof value !== "object") throw new Error("Wakeup must be an object");
  const v = value as Record<string,unknown>;
  if (typeof v.prompt !== "string" || !v.prompt.trim() || v.prompt.length > 32_000) throw new Error("Invalid wakeup prompt");
  if (typeof v.runAt !== "string" || typeof v.expiresAt !== "string") throw new Error("Wakeup needs runAt and expiresAt");
  const due = Date.parse(v.runAt), expires = Date.parse(v.expiresAt);
  if (!Number.isFinite(due) || !Number.isFinite(expires) || expires <= due || expires <= now) throw new Error("Invalid or expired wakeup dates");
  return {prompt:v.prompt, due, expires};
}

export async function importWakeups(data: string, state: State) {
  for (const {chat, replyTo, generation} of state.chats()) {
    const directory = join(data, "conversations", chatKey(chat), "wakeups", String(generation));
    let files: string[];
    try { files = await readdir(directory); } catch (e) { if ((e as NodeJS.ErrnoException).code === "ENOENT") continue; throw e; }
    for (const file of files.filter(f => /^[A-Za-z0-9_-]{1,100}\.json$/.test(f)).slice(0, 100)) {
      const path = join(directory,file);
      let w: ReturnType<typeof parseWakeup>;
      try {
        const stat = await lstat(path);
        if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 64_000) throw new Error("Invalid wakeup file");
        w = parseWakeup(JSON.parse(await readFile(path,"utf8")));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
        await rename(path, `${path}.rejected`);
        state.reply(`wakeup-rejected:${chatKey(chat)}:${file}`,replyTo,"A scheduled follow-up file was invalid or expired. It was retained with a .rejected suffix for inspection.");
        continue;
      }
      // /new can reset this conversation while filesystem reads yield. Never
      // import an old generation after reset has cancelled its follow-ups.
      if (state.generation(chat) !== generation) break;
      // Storage failures are fatal and leave the request available for retry after restart.
      state.schedule(`${chatKey(chat)}:${generation}:${file}`,chat,w.prompt,w.due,w.expires);
      await rename(path, `${path}.accepted`);
    }
  }
  state.dispatchWakeups();
}
