import assert from "node:assert/strict";
import test from "node:test";
import { parseAgentCommand } from "../src/commands.js";

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
});
