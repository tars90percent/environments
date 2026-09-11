import type { AuthSlot } from "./types.js";
import type { ChatAgent } from "./agent.js";
import type { StateStore } from "./state.js";
import { isReasoningEffort, REASONING_EFFORTS, type ReasoningEffort } from "./reasoning.js";

export type ReasoningCommand = { kind: "reasoning"; effort?: ReasoningEffort; invalid?: true };

export type AgentCommand =
  | { kind: "new" }
  | ReasoningCommand
  | { kind: "auth-help" }
  | { kind: "auth-status" }
  | { kind: "auth-use"; slot: AuthSlot };

export function parseAgentCommand(content: string): AgentCommand | undefined {
  const command = content.trim().toLowerCase().replace(/\s+/g, " ");
  if (command === "/new") return { kind: "new" };
  if (command === "/reasoning" || command === "/reasoning status") return { kind: "reasoning" };
  if (command.startsWith("/reasoning ")) {
    const effort = command.slice("/reasoning ".length);
    return isReasoningEffort(effort)
      ? { kind: "reasoning", effort }
      : { kind: "reasoning", invalid: true };
  }
  if (command === "/auth") return { kind: "auth-help" };
  if (command === "/auth status") return { kind: "auth-status" };
  if (command === "/auth use primary") return { kind: "auth-use", slot: "primary" };
  if (command === "/auth use backup") return { kind: "auth-use", slot: "backup" };
  return undefined;
}

export async function handleReasoningCommand(options: {
  command: ReasoningCommand;
  senderId: string;
  messageId: string;
  adminUserIds: ReadonlySet<string>;
  agent: Pick<ChatAgent, "modelSettings" | "useReasoningEffort">;
  state: Pick<StateStore, "markProcessed">;
}): Promise<string> {
  const { command, senderId, messageId, adminUserIds, agent, state } = options;
  if (!adminUserIds.has(senderId)) {
    await state.markProcessed(messageId);
    return "This command is restricted to CASE admins.";
  }
  if (command.effort) {
    await agent.useReasoningEffort(command.effort, messageId);
    return `CASE now uses ${agent.modelSettings().model} with ${command.effort} reasoning. This applies to the next response in every chat and both credential slots, persists across restarts, and keeps conversation history. Responses already running keep their previous setting.`;
  }
  await state.markProcessed(messageId);
  const settings = agent.modelSettings();
  return [
    ...(command.invalid ? ["Unsupported reasoning level. No change was made."] : []),
    `CASE model: ${settings.model}`,
    `Reasoning: ${settings.reasoningEffort}`,
    `Set reasoning: /reasoning <${REASONING_EFFORTS.join("|")}>`,
    "This setting applies to every chat and both credential slots, and persists across restarts.",
  ].join("\n");
}
