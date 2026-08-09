import { mkdir } from "node:fs/promises";
import { Codex, type Thread } from "@openai/codex-sdk";
import { config } from "./config.js";
import { StateStore } from "./state.js";
import type { FeishuMessageEvent } from "./types.js";

export class ChatAgent {
  private readonly codex: Codex;
  private readonly threads = new Map<string, Thread>();

  constructor(
    private readonly state: StateStore,
    env: NodeJS.ProcessEnv = process.env,
  ) {
    this.codex = new Codex({
      codexPathOverride: config.codexPath,
      config: {
        approvals_reviewer: config.codexApprovalsReviewer,
      },
      env: definedEnvironment(env),
    });
  }

  async initialize(): Promise<void> {
    await mkdir(config.workspace, { recursive: true });
  }

  async respond(event: FeishuMessageEvent): Promise<{ text: string; threadId: string }> {
    const thread = this.threadFor(event.chat_id);
    const content = event.content.slice(0, config.maxInputCharacters);
    const turn = await thread.run(content);
    const threadId = thread.id;
    if (!threadId) throw new Error("Codex did not return a persistent thread ID");

    const text = turn.finalResponse.trim() || "I couldn't produce a response for that message.";
    return { text: text.slice(0, config.maxReplyCharacters), threadId };
  }

  reset(chatId: string): void {
    this.threads.delete(chatId);
  }

  private threadFor(chatId: string): Thread {
    const cached = this.threads.get(chatId);
    if (cached) return cached;

    const options = {
      workingDirectory: config.workspace,
      skipGitRepoCheck: true,
      sandboxMode: config.codexSandboxMode,
      approvalPolicy: config.codexApprovalPolicy,
      networkAccessEnabled: config.codexNetworkAccess,
      webSearchMode: config.codexWebSearchMode,
      modelReasoningEffort: "medium" as const,
    };
    const savedThreadId = this.state.threadId(chatId);
    const thread = savedThreadId
      ? this.codex.resumeThread(savedThreadId, options)
      : this.codex.startThread(options);
    this.threads.set(chatId, thread);
    return thread;
  }
}

function definedEnvironment(env: NodeJS.ProcessEnv): Record<string, string> {
  return Object.fromEntries(
    Object.entries(env).filter((entry): entry is [string, string] => entry[1] !== undefined),
  );
}
