import { copyFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { Codex, type Thread } from "@openai/codex-sdk";
import { inspectCodexLogin, type AuthStatus, type AuthSlotState } from "./auth.js";
import { config } from "./config.js";
import { StateStore } from "./state.js";
import type { AuthSlot, FeishuMessageEvent } from "./types.js";

export type AuthSwitchResult = "already-active" | "signed-out" | "switched" | "unavailable";

export class ChatAgent {
  private readonly codexBySlot = new Map<AuthSlot, Codex>();
  private readonly threads = new Map<string, Thread>();
  private readonly env: NodeJS.ProcessEnv;
  private activeSlot: AuthSlot;
  private authMutationQueue: Promise<void> = Promise.resolve();

  constructor(
    private readonly state: StateStore,
    env: NodeJS.ProcessEnv = process.env,
  ) {
    this.env = env;
    this.activeSlot = state.activeAuthSlot();
  }

  async initialize(): Promise<void> {
    await installWorkspaceInstructions(config.workspace, config.agentInstructionsFile);
  }

  currentAuthSlot(): AuthSlot {
    return this.activeSlot;
  }

  async authStatus(): Promise<AuthStatus> {
    const [primary, backup] = await Promise.all([
      this.slotStatus("primary"),
      this.slotStatus("backup"),
    ]);
    return { active: this.activeSlot, slots: { primary, backup } };
  }

  async useAuthSlot(slot: AuthSlot): Promise<AuthSwitchResult> {
    let result: AuthSwitchResult = "unavailable";
    const mutation = this.authMutationQueue.then(async () => {
      if (slot === this.activeSlot) {
        result = "already-active";
        return;
      }
      const status = await this.slotStatus(slot);
      if (status !== "signed-in") {
        result = status;
        return;
      }
      await this.state.setActiveAuthSlot(slot);
      this.activeSlot = slot;
      result = "switched";
    });
    this.authMutationQueue = mutation.catch(() => undefined);
    await mutation;
    return result;
  }

  async respond(event: FeishuMessageEvent): Promise<{ text: string; threadId: string; authSlot: AuthSlot }> {
    const authSlot = this.activeSlot;
    const thread = this.threadFor(event.chat_id, authSlot);
    const content = event.content.slice(0, config.maxInputCharacters);
    const turn = await thread.run(content);
    const threadId = thread.id;
    if (!threadId) throw new Error("Codex did not return a persistent thread ID");

    const text = turn.finalResponse.trim() || "I couldn't produce a response for that message.";
    return { text: text.slice(0, config.maxReplyCharacters), threadId, authSlot };
  }

  reset(chatId: string, slot: AuthSlot): void {
    this.threads.delete(threadKey(chatId, slot));
  }

  private threadFor(chatId: string, slot: AuthSlot): Thread {
    const key = threadKey(chatId, slot);
    const cached = this.threads.get(key);
    if (cached) return cached;

    const options = {
      workingDirectory: config.workspace,
      skipGitRepoCheck: true,
      sandboxMode: config.codexSandboxMode,
      approvalPolicy: config.codexApprovalPolicy,
      networkAccessEnabled: config.codexNetworkAccess,
      webSearchMode: config.codexWebSearchMode,
    };
    const codex = this.codexFor(slot);
    const savedThreadId = this.state.threadId(chatId, slot);
    const thread = savedThreadId
      ? codex.resumeThread(savedThreadId, options)
      : codex.startThread(options);
    this.threads.set(key, thread);
    return thread;
  }

  private codexFor(slot: AuthSlot): Codex {
    const existing = this.codexBySlot.get(slot);
    if (existing) return existing;
    const codex = new Codex({
      codexPathOverride: config.codexPath,
      config: {
        approvals_reviewer: config.codexApprovalsReviewer,
      },
      env: definedEnvironment({ ...this.env, CODEX_HOME: config.codexAuthHomes[slot] }),
    });
    this.codexBySlot.set(slot, codex);
    return codex;
  }

  private async slotStatus(slot: AuthSlot): Promise<AuthSlotState> {
    return inspectCodexLogin(config.codexPath, config.codexAuthHomes[slot], this.env);
  }
}

export async function installWorkspaceInstructions(workspace: string, source: string): Promise<void> {
  await mkdir(workspace, { recursive: true });
  await copyFile(source, join(workspace, "AGENTS.md"));
}

function definedEnvironment(env: NodeJS.ProcessEnv): Record<string, string> {
  return Object.fromEntries(
    Object.entries(env).filter((entry): entry is [string, string] => entry[1] !== undefined),
  );
}

function threadKey(chatId: string, slot: AuthSlot): string {
  return `${slot}:${chatId}`;
}
