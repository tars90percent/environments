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

export type AgentState = {
  version: 1;
  chats: Record<string, { threadId: string }>;
  processedMessageIds: string[];
};
