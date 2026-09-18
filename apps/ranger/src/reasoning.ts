export const reasoningEfforts = ["off", "low", "high", "max"] as const;
export type ReasoningEffort = typeof reasoningEfforts[number];

export function isReasoningEffort(value: unknown): value is ReasoningEffort {
  return typeof value === "string" && reasoningEfforts.some(effort => effort === value);
}

export function reasoningCommand(text: string): {effort?: ReasoningEffort; valid: boolean} | undefined {
  const [command, value, ...extra] = text.trim().split(/\s+/);
  if (command !== "/reasoning") return;
  if (value === undefined) return {valid:true};
  const effort = value.toLowerCase();
  return extra.length === 0 && isReasoningEffort(effort) ? {valid:true,effort} : {valid:false};
}
