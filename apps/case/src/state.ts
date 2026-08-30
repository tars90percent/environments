import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { AgentState, AuthSlot } from "./types.js";

const EMPTY_STATE: AgentState = {
  version: 2,
  activeAuthSlot: "primary",
  chats: {},
  processedMessageIds: [],
};

type LegacyAgentState = {
  version: 1;
  chats: Record<string, { threadId: string }>;
  processedMessageIds: string[];
};

export class StateStore {
  private state: AgentState = structuredClone(EMPTY_STATE);
  private mutationQueue: Promise<void> = Promise.resolve();

  constructor(
    private readonly path: string,
    private readonly processedLimit = 5_000,
  ) {}

  async load(): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    try {
      const parsed = JSON.parse(await readFile(this.path, "utf8")) as AgentState | LegacyAgentState;
      if (!parsed.chats || !Array.isArray(parsed.processedMessageIds)) {
        throw new Error("Unsupported agent state format");
      }
      if (parsed.version === 1) {
        this.state = migrateLegacyState(parsed);
        await this.saveCurrentState();
      } else if (parsed.version === 2 && isAuthSlot(parsed.activeAuthSlot)) {
        this.state = parsed;
      } else {
        throw new Error("Unsupported agent state format");
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      await this.saveCurrentState();
    }
  }

  activeAuthSlot(): AuthSlot {
    return this.state.activeAuthSlot;
  }

  threadId(chatId: string, slot: AuthSlot): string | undefined {
    return this.state.chats[chatId]?.threads[slot];
  }

  hasProcessed(messageId: string): boolean {
    return this.state.processedMessageIds.includes(messageId);
  }

  async setActiveAuthSlot(slot: AuthSlot): Promise<void> {
    await this.mutate(() => {
      this.state.activeAuthSlot = slot;
    });
  }

  async recordSuccess(chatId: string, slot: AuthSlot, threadId: string, messageId: string): Promise<void> {
    await this.mutate(() => {
      const chat = this.state.chats[chatId] ?? { threads: {} };
      chat.threads[slot] = threadId;
      this.state.chats[chatId] = chat;
      this.appendProcessed(messageId);
    });
  }

  async resetChat(chatId: string, slot: AuthSlot, messageId: string): Promise<void> {
    await this.mutate(() => {
      const chat = this.state.chats[chatId];
      if (chat) {
        delete chat.threads[slot];
        if (Object.keys(chat.threads).length === 0) delete this.state.chats[chatId];
      }
      this.appendProcessed(messageId);
    });
  }

  async markProcessed(messageId: string): Promise<void> {
    await this.mutate(() => this.appendProcessed(messageId));
  }

  private appendProcessed(messageId: string): void {
    this.state.processedMessageIds.push(messageId);
    if (this.state.processedMessageIds.length > this.processedLimit) {
      this.state.processedMessageIds = this.state.processedMessageIds.slice(-this.processedLimit);
    }
  }

  private async mutate(operation: () => void): Promise<void> {
    const mutation = this.mutationQueue.then(async () => {
      operation();
      await this.saveCurrentState();
    });
    this.mutationQueue = mutation.catch(() => undefined);
    await mutation;
  }

  private async saveCurrentState(): Promise<void> {
    const temporaryPath = `${this.path}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(this.state, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
    await rename(temporaryPath, this.path);
  }
}

function isAuthSlot(value: unknown): value is AuthSlot {
  return value === "primary" || value === "backup";
}

function migrateLegacyState(legacy: LegacyAgentState): AgentState {
  return {
    version: 2,
    activeAuthSlot: "primary",
    chats: Object.fromEntries(
      Object.entries(legacy.chats).map(([chatId, chat]) => [
        chatId,
        { threads: { primary: chat.threadId } },
      ]),
    ),
    processedMessageIds: legacy.processedMessageIds,
  };
}
