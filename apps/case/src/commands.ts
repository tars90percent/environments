import type { AuthSlot } from "./types.js";

export type AgentCommand =
  | { kind: "new" }
  | { kind: "auth-help" }
  | { kind: "auth-status" }
  | { kind: "auth-use"; slot: AuthSlot };

export function parseAgentCommand(content: string): AgentCommand | undefined {
  const command = content.trim().toLowerCase().replace(/\s+/g, " ");
  if (command === "/new") return { kind: "new" };
  if (command === "/auth") return { kind: "auth-help" };
  if (command === "/auth status") return { kind: "auth-status" };
  if (command === "/auth use primary") return { kind: "auth-use", slot: "primary" };
  if (command === "/auth use backup") return { kind: "auth-use", slot: "backup" };
  return undefined;
}
