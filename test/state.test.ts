import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { StateStore } from "../src/state.js";

test("persists thread mappings and processed message IDs", async () => {
  const directory = await mkdtemp(join(tmpdir(), "feishu-codex-agent-"));
  const path = join(directory, "state.json");
  const store = new StateStore(path);
  await store.load();
  await store.recordSuccess("oc_chat", "thread-1", "om_message");

  const reloaded = new StateStore(path);
  await reloaded.load();
  assert.equal(reloaded.threadId("oc_chat"), "thread-1");
  assert.equal(reloaded.hasProcessed("om_message"), true);
  assert.equal((await readFile(path, "utf8")).endsWith("\n"), true);
});

test("keeps only the configured number of processed IDs", async () => {
  const directory = await mkdtemp(join(tmpdir(), "feishu-codex-agent-"));
  const store = new StateStore(join(directory, "state.json"), 2);
  await store.load();
  await store.recordSuccess("oc_chat", "thread-1", "om_1");
  await store.recordSuccess("oc_chat", "thread-1", "om_2");
  await store.recordSuccess("oc_chat", "thread-1", "om_3");

  assert.equal(store.hasProcessed("om_1"), false);
  assert.equal(store.hasProcessed("om_2"), true);
  assert.equal(store.hasProcessed("om_3"), true);
});

test("reset removes the chat mapping and marks the command as processed", async () => {
  const directory = await mkdtemp(join(tmpdir(), "feishu-codex-agent-"));
  const path = join(directory, "state.json");
  const store = new StateStore(path);
  await store.load();
  await store.recordSuccess("oc_chat", "thread-1", "om_message");
  await store.resetChat("oc_chat", "om_new");

  assert.equal(store.threadId("oc_chat"), undefined);
  assert.equal(store.hasProcessed("om_new"), true);

  const reloaded = new StateStore(path);
  await reloaded.load();
  assert.equal(reloaded.threadId("oc_chat"), undefined);
  assert.equal(reloaded.hasProcessed("om_new"), true);
});

test("marks deterministic harness commands as processed without creating a thread", async () => {
  const directory = await mkdtemp(join(tmpdir(), "feishu-codex-agent-"));
  const store = new StateStore(join(directory, "state.json"));
  await store.load();
  await store.markProcessed("om_authorize");

  assert.equal(store.hasProcessed("om_authorize"), true);
  assert.equal(store.threadId("oc_chat"), undefined);
});
