import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { StateStore } from "../src/state.js";

test("persists thread mappings and processed message IDs", async () => {
  const directory = await mkdtemp(join(tmpdir(), "feishu-codex-agent-"));
  const path = join(directory, "state.json");
  const store = new StateStore(path);
  await store.load();
  await store.recordSuccess("oc_chat", "primary", "thread-1", "om_message");

  const reloaded = new StateStore(path);
  await reloaded.load();
  assert.equal(reloaded.threadId("oc_chat", "primary"), "thread-1");
  assert.equal(reloaded.hasProcessed("om_message"), true);
  assert.equal((await readFile(path, "utf8")).endsWith("\n"), true);
});

test("keeps only the configured number of processed IDs", async () => {
  const directory = await mkdtemp(join(tmpdir(), "feishu-codex-agent-"));
  const store = new StateStore(join(directory, "state.json"), 2);
  await store.load();
  await store.recordSuccess("oc_chat", "primary", "thread-1", "om_1");
  await store.recordSuccess("oc_chat", "primary", "thread-1", "om_2");
  await store.recordSuccess("oc_chat", "primary", "thread-1", "om_3");

  assert.equal(store.hasProcessed("om_1"), false);
  assert.equal(store.hasProcessed("om_2"), true);
  assert.equal(store.hasProcessed("om_3"), true);
});

test("reset removes the chat mapping and marks the command as processed", async () => {
  const directory = await mkdtemp(join(tmpdir(), "feishu-codex-agent-"));
  const path = join(directory, "state.json");
  const store = new StateStore(path);
  await store.load();
  await store.recordSuccess("oc_chat", "primary", "thread-1", "om_message");
  await store.recordSuccess("oc_chat", "backup", "thread-2", "om_backup");
  await store.resetChat("oc_chat", "primary", "om_new");

  assert.equal(store.threadId("oc_chat", "primary"), undefined);
  assert.equal(store.threadId("oc_chat", "backup"), "thread-2");
  assert.equal(store.hasProcessed("om_new"), true);

  const reloaded = new StateStore(path);
  await reloaded.load();
  assert.equal(reloaded.threadId("oc_chat", "primary"), undefined);
  assert.equal(reloaded.threadId("oc_chat", "backup"), "thread-2");
  assert.equal(reloaded.hasProcessed("om_new"), true);
});

test("marks a message as processed without creating a thread", async () => {
  const directory = await mkdtemp(join(tmpdir(), "feishu-codex-agent-"));
  const store = new StateStore(join(directory, "state.json"));
  await store.load();
  await store.markProcessed("om_command");

  assert.equal(store.hasProcessed("om_command"), true);
  assert.equal(store.threadId("oc_chat", "primary"), undefined);
});

test("persists the active credential slot and keeps slot histories separate", async () => {
  const directory = await mkdtemp(join(tmpdir(), "feishu-codex-agent-"));
  const path = join(directory, "state.json");
  const store = new StateStore(path);
  await store.load();
  await store.recordSuccess("oc_chat", "primary", "thread-primary", "om_primary");
  await store.recordSuccess("oc_chat", "backup", "thread-backup", "om_backup");
  await store.setActiveAuthSlot("backup");

  const reloaded = new StateStore(path);
  await reloaded.load();
  assert.equal(reloaded.activeAuthSlot(), "backup");
  assert.equal(reloaded.threadId("oc_chat", "primary"), "thread-primary");
  assert.equal(reloaded.threadId("oc_chat", "backup"), "thread-backup");
});

test("migrates version 1 state into the primary credential slot", async () => {
  const directory = await mkdtemp(join(tmpdir(), "feishu-codex-agent-"));
  const path = join(directory, "state.json");
  await writeFile(path, JSON.stringify({
    version: 1,
    chats: { oc_chat: { threadId: "thread-legacy" } },
    processedMessageIds: ["om_legacy"],
  }));

  const store = new StateStore(path);
  await store.load();
  assert.equal(store.activeAuthSlot(), "primary");
  assert.equal(store.threadId("oc_chat", "primary"), "thread-legacy");
  assert.equal(store.threadId("oc_chat", "backup"), undefined);
  assert.equal(store.hasProcessed("om_legacy"), true);
  assert.equal(JSON.parse(await readFile(path, "utf8")).version, 2);
});
