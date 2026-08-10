export type AgentCommand = { kind: "new" };

export function parseAgentCommand(content: string): AgentCommand | undefined {
  const trimmed = content.trim();
  if (trimmed.toLowerCase() === "/new") return { kind: "new" };
  return undefined;
}
