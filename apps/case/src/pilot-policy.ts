import type { FeishuMessageEvent } from "./types.js";

export type PilotRules = {
  allowGroupChats: boolean;
  allowAllUsers: boolean;
  allowedUserIds: Set<string>;
};

export function isEligiblePilotMessage(
  event: FeishuMessageEvent,
  rules: PilotRules,
  alreadyProcessed: boolean,
  inFlight: boolean,
): boolean {
  if (event.type !== "im.message.receive_v1") return false;
  if (event.sender_type !== "user") return false;
  if (!event.message_id || !event.chat_id || !event.content.trim()) return false;
  if (event.chat_type === "group" && !rules.allowGroupChats) return false;
  if (!rules.allowAllUsers && !rules.allowedUserIds.has(event.sender_id)) return false;
  if (alreadyProcessed || inFlight) return false;
  return true;
}
