import type { SessionNotification } from "@agentclientprotocol/sdk";

export type ToolCallNotice = {id: string; name: string; input: unknown};
export interface HarnessObservers {
  onText(text: string, messageId?: string): void;
  onToolCall?(call: ToolCallNotice): void;
}

/** Project only public assistant text and tool inputs from the ACP event stream. */
export class HarnessEvents {
  private pending = "";
  private messageId?: string;
  private texts: string[] = [];
  private seenTools = new Set<string>();
  constructor(private observers: HarnessObservers) {}
  accept(update: SessionNotification["update"]) {
    if (update.sessionUpdate === "agent_message_chunk" && update.content.type === "text") {
      const id = update.messageId ?? undefined;
      if (this.pending && id !== this.messageId) this.flush();
      this.messageId = id;
      this.pending += update.content.text;
    } else if (update.sessionUpdate === "tool_call") {
      this.flush();
      if (this.seenTools.has(update.toolCallId)) return;
      this.observers.onToolCall?.({id:update.toolCallId,name:update.name || update.title,input:update.rawInput});
      this.seenTools.add(update.toolCallId);
    } else if (update.sessionUpdate === "usage_update") {
      // The pinned DSH bridge emits usage after a committed message's blocks.
      this.flush();
    }
    // agent_thought_chunk and tool_call_update (including results) stay private.
  }
  flush() {
    const text = this.pending.trim();
    if (text) {
      this.observers.onText(text,this.messageId);
      this.texts.push(text);
    }
    this.pending = "";
    this.messageId = undefined;
  }
  finish() { this.flush(); return this.texts.join("\n\n"); }
}
