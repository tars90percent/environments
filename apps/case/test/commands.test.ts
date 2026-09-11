import assert from "node:assert/strict";
import test from "node:test";
import { handleReasoningCommand, parseAgentCommand, type ReasoningCommand } from "../src/commands.js";
import type { ReasoningEffort } from "../src/reasoning.js";

test("recognizes the new-session command", () => {
  assert.deepEqual(parseAgentCommand("/new"), { kind: "new" });
  assert.deepEqual(parseAgentCommand("  /NEW\n"), { kind: "new" });
});

test("recognizes credential administration commands", () => {
  assert.deepEqual(parseAgentCommand("/auth"), { kind: "auth-help" });
  assert.deepEqual(parseAgentCommand(" /AUTH   STATUS "), { kind: "auth-status" });
  assert.deepEqual(parseAgentCommand("/auth use primary"), { kind: "auth-use", slot: "primary" });
  assert.deepEqual(parseAgentCommand("/AUTH USE BACKUP"), { kind: "auth-use", slot: "backup" });
});

test("passes ordinary messages and authorization language through to Codex", () => {
  assert.equal(parseAgentCommand("please start /new"), undefined);
  assert.equal(parseAgentCommand("/new project"), undefined);
  assert.equal(parseAgentCommand("new"), undefined);
  assert.equal(parseAgentCommand("/authorize"), undefined);
  assert.equal(parseAgentCommand("authorize"), undefined);
  assert.equal(parseAgentCommand("/authorized"), undefined);
  assert.equal(parseAgentCommand("authorization complete"), undefined);
  assert.equal(parseAgentCommand("/auth-status"), undefined);
  assert.equal(parseAgentCommand("auth status"), undefined);
  assert.equal(parseAgentCommand("/auth use tertiary"), undefined);
  assert.equal(parseAgentCommand("please use /reasoning high"), undefined);
  assert.equal(parseAgentCommand("/reasoning-about"), undefined);
});

test("reasoning commands accept supported levels and catch malformed settings", () => {
  assert.deepEqual(parseAgentCommand(" /REASONING   HIGH\n"), { kind: "reasoning", effort: "high" });
  assert.deepEqual(parseAgentCommand("/reasoning"), { kind: "reasoning" });
  assert.deepEqual(parseAgentCommand("/reasoning status"), { kind: "reasoning" });
  for (const effort of ["low", "medium", "high", "xhigh"]) {
    assert.deepEqual(parseAgentCommand(`/reasoning ${effort}`), { kind: "reasoning", effort });
  }
  for (const value of ["none", "minimal", "max", "ultra", "hgh", "high extra", "status extra"]) {
    assert.deepEqual(parseAgentCommand(`/reasoning ${value}`), { kind: "reasoning", invalid: true });
  }
});

test("reasoning control enforces admin access and reports status without model calls", async () => {
  let current: ReasoningEffort = "high";
  const changes: string[] = [];
  const processed: string[] = [];
  const options = {
    senderId: "admin", messageId: "reasoning-command", adminUserIds: new Set(["admin"]),
    agent: {
      modelSettings: () => ({ model: "gpt-6-astra", reasoningEffort: current }),
      useReasoningEffort: async (effort: ReasoningEffort, messageId: string) => {
        current = effort;
        changes.push(effort);
        processed.push(messageId);
      },
    },
    state: { markProcessed: async (messageId: string) => { processed.push(messageId); } },
  };
  for (const content of ["/reasoning", "/reasoning low", "/reasoning bogus"]) {
    const result = await handleReasoningCommand({ ...options, senderId: "non-admin", command: parseAgentCommand(content) as ReasoningCommand });
    assert.match(result, /restricted to CASE admins/);
  }
  assert.deepEqual(changes, []);
  const status = await handleReasoningCommand({ ...options, command: { kind: "reasoning" } });
  assert.match(status, /gpt-6-astra/);
  assert.match(status, /Reasoning: high/);
  assert.match(status, /low\|medium\|high\|xhigh/);
  const invalid = await handleReasoningCommand({ ...options, command: { kind: "reasoning", invalid: true } });
  assert.match(invalid, /No change was made/);
  assert.deepEqual(changes, []);
  const changed = await handleReasoningCommand({ ...options, command: { kind: "reasoning", effort: "low" } });
  assert.match(changed, /gpt-6-astra with low reasoning/);
  assert.match(changed, /every chat/);
  assert.deepEqual(changes, ["low"]);
  assert.equal(processed.length, 6);
});
