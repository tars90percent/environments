export type FeishuMessageEvent = {
  type: "im.message.receive_v1";
  event_id: string;
  message_id: string;
  chat_id: string;
  chat_type: "p2p" | "group";
  sender_id: string;
  sender_type: "user" | "bot";
  message_type: string;
  content: string;
  mentions?: Array<{ id: string; key: string; name: string }>;
};

export type AuthSlot = "primary" | "backup";

export type AgentState = {
  version: 2;
  activeAuthSlot: AuthSlot;
  chats: Record<string, { threads: Partial<Record<AuthSlot, string>> }>;
  processedMessageIds: string[];
};
