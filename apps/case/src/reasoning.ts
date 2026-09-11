import type { ModelReasoningEffort } from "@openai/codex-sdk";

// Levels supported by both Astra and the pinned SDK's thread options.
export const REASONING_EFFORTS = ["low", "medium", "high", "xhigh"] as const satisfies readonly ModelReasoningEffort[];
export type ReasoningEffort = typeof REASONING_EFFORTS[number];

export function isReasoningEffort(value: unknown): value is ReasoningEffort {
  return REASONING_EFFORTS.some((effort) => effort === value);
}
