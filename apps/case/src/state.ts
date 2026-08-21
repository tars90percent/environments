import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { AgentState } from "./types.js";

const EMPTY_STATE: AgentState = {
  version: 1,
  chats: {},
  processedMessageIds: [],
};

export class StateStore {
  private state: AgentState = structuredClone(EMPTY_STATE);

  constructor(
    private readonly path: string,
    private readonly processedLimit = 5_000,
  ) {}

  async load(): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    try {
      const parsed = JSON.parse(await readFile(this.path, "utf8")) as AgentState;
      if (parsed.version !== 1 || !parsed.chats || !parsed.processedMessageIds) {
        throw new Error("Unsupported agent state format");
      }
      this.state = parsed;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      await this.save();
    }
  }

  threadId(chatId: string): string | undefined {
    return this.state.chats[chatId]?.threadId;
  }

  hasProcessed(messageId: string): boolean {
    return this.state.processedMessageIds.includes(messageId);
  }

  async recordSuccess(chatId: string, threadId: string, messageId: string): Promise<void> {
    this.state.chats[chatId] = { threadId };
    this.appendProcessed(messageId);
    await this.save();
  }

  async resetChat(chatId: string, messageId: string): Promise<void> {
    delete this.state.chats[chatId];
    this.appendProcessed(messageId);
    await this.save();
  }

  async markProcessed(messageId: string): Promise<void> {
    this.appendProcessed(messageId);
    await this.save();
  }

  private appendProcessed(messageId: string): void {
    this.state.processedMessageIds.push(messageId);
    if (this.state.processedMessageIds.length > this.processedLimit) {
      this.state.processedMessageIds = this.state.processedMessageIds.slice(-this.processedLimit);
    }
  }

  private async save(): Promise<void> {
    const temporaryPath = `${this.path}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(this.state, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
    await rename(temporaryPath, this.path);
  }
}
