import assert from "node:assert/strict";
import test from "node:test";
import { isEligiblePilotMessage } from "../src/pilot-policy.js";
import type { FeishuMessageEvent } from "../src/types.js";

const directMessage: FeishuMessageEvent = {
  type: "im.message.receive_v1",
  event_id: "evt_1",
  message_id: "om_1",
  chat_id: "oc_1",
  chat_type: "p2p",
  sender_id: "ou_allowed",
  sender_type: "user",
  message_type: "text",
  content: "hello",
};

const rules = {
  allowGroupChats: false,
  allowAllUsers: false,
  allowedUserIds: new Set(["ou_allowed"]),
};

test("allows an allowlisted direct message", () => {
  assert.equal(isEligiblePilotMessage(directMessage, rules, false, false), true);
});

test("rejects groups, unlisted users, bots, duplicates, and in-flight messages", () => {
  assert.equal(
    isEligiblePilotMessage({ ...directMessage, chat_type: "group" }, rules, false, false),
    false,
  );
  assert.equal(
    isEligiblePilotMessage({ ...directMessage, sender_id: "ou_other" }, rules, false, false),
    false,
  );
  assert.equal(
    isEligiblePilotMessage({ ...directMessage, sender_type: "bot" }, rules, false, false),
    false,
  );
  assert.equal(isEligiblePilotMessage(directMessage, rules, true, false), false);
  assert.equal(isEligiblePilotMessage(directMessage, rules, false, true), false);
});
