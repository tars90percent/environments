import assert from "node:assert/strict";
import test from "node:test";
import { parseAgentCommand } from "../src/commands.js";

test("recognizes the new-session command", () => {
  assert.deepEqual(parseAgentCommand("/new"), { kind: "new" });
  assert.deepEqual(parseAgentCommand("  /NEW\n"), { kind: "new" });
});

test("recognizes authorization commands without sending them to Codex", () => {
  assert.deepEqual(parseAgentCommand("/authorize"), { kind: "authorize" });
  assert.deepEqual(parseAgentCommand("authorize"), { kind: "authorize" });
  assert.deepEqual(parseAgentCommand("/authorized"), { kind: "authorized" });
  assert.deepEqual(parseAgentCommand("authorization complete"), { kind: "authorized" });
  assert.deepEqual(parseAgentCommand("/auth-status"), { kind: "auth-status" });
  assert.deepEqual(parseAgentCommand("auth status"), { kind: "auth-status" });
});

test("parses targeted authorization domains and scopes", () => {
  assert.deepEqual(parseAgentCommand("/authorize domains docs, drive"), {
    kind: "authorize",
    request: { mode: "domains", domains: ["docs", "drive"] },
  });
  assert.deepEqual(
    parseAgentCommand("/authorize scope calendar:calendar:readonly im:message"),
    {
      kind: "authorize",
      request: {
        mode: "scopes",
        scopes: ["calendar:calendar:readonly", "im:message"],
      },
    },
  );
  assert.equal(parseAgentCommand("/authorize something")?.kind, "invalid");
});

test("does not treat ordinary messages or command arguments as commands", () => {
  assert.equal(parseAgentCommand("please start /new"), undefined);
  assert.equal(parseAgentCommand("/new project"), undefined);
  assert.equal(parseAgentCommand("new"), undefined);
});
