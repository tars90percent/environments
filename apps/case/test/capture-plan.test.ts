import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parseFeishuCapturePlan, parseMailCapturePlan } from "../src/capture-plan.js";

test("Feishu capture plans contain submissions and provenance, not categories or filename formats", () => {
  const plan = parseFeishuCapturePlan({
    purpose: "sample_evaluation",
    submissions: [{
      vendor: { id: "vendor-one", name: "Vendor One", short: "V1", description: "Fixture" },
      submission: {
        id: "submission-one",
        date: "2026-08-21",
        label: "Sample",
        categories: [{ id: "obsolete", name: "Ignored", description: "Compatibility input" }],
        attachments: [{
          messageId: "om_message",
          fileKey: "file_payload",
          filename: "sample.ZIP",
          messageLink: "https://example.feishu.cn/message/om_message",
          sender: "Vendor One",
          receivedAt: "2026-08-21T00:00:00Z",
          categoryId: "obsolete",
        }],
      },
    }],
  });
  assert.equal(plan.submissions[0]?.submission.id, "submission-one");
  assert.equal(plan.submissions[0]?.submission.format, undefined);
  assert.equal("categories" in (plan.submissions[0]?.submission ?? {}), false);
  assert.equal("categoryId" in (plan.submissions[0]?.submission.attachments[0] ?? {}), false);
});

test("capture plans accept only an explicit Harbor or non-Harbor classification", () => {
  const input = {
    purpose: "sample_evaluation",
    submissions: [{
      vendor: { id: "vendor-one", name: "Vendor One", short: "V1", description: "Fixture" },
      submission: {
        id: "submission-one",
        date: "2026-08-21",
        label: "Sample",
        format: "non_harbor",
        attachments: [{ messageId: "message", attachmentId: "attachment", filename: "trace.jsonl", receivedAt: "2026-08-21T00:00:00Z" }],
      },
    }],
  };
  assert.equal(parseMailCapturePlan(input).submissions[0]?.submission.format, "non_harbor");
  assert.throws(() => parseMailCapturePlan({
    ...input,
    submissions: [{ ...input.submissions[0], submission: { ...input.submissions[0]!.submission, format: "JSONL" } }],
  }), /must be harbor or non_harbor/);
});

test("capture plans reject duplicate submission and attachment identities", () => {
  const input = {
    purpose: "sample_evaluation",
    submissions: [{
      vendor: { id: "vendor-one", name: "Vendor One", short: "V1", description: "Fixture" },
      submission: {
        id: "submission-one",
        date: "2026-08-21",
        label: "Sample",
        attachments: [{
          messageId: "om_message",
          fileKey: "file_payload",
          filename: "sample.zip",
          messageLink: "https://example.feishu.cn/message/om_message",
          receivedAt: "2026-08-21T00:00:00Z",
        }],
      },
    }],
  };
  assert.throws(() => parseFeishuCapturePlan({
    ...input,
    submissions: [input.submissions[0], input.submissions[0]],
  }), /unique ids/);
  assert.throws(() => parseFeishuCapturePlan({
    ...input,
    submissions: [{
      ...input.submissions[0],
      submission: {
        ...input.submissions[0]!.submission,
        attachments: [input.submissions[0]!.submission.attachments[0], input.submissions[0]!.submission.attachments[0]],
      },
    }],
  }), /duplicate attachment/);
});

test("trusted Feishu capture commands use the local registry rather than its HTTP API", async () => {
  const messageCapture = await readFile(new URL("../src/intake-plan-cli.ts", import.meta.url), "utf8");
  const mailCapture = await readFile(new URL("../src/mail-intake-plan-cli.ts", import.meta.url), "utf8");
  for (const source of [messageCapture, mailCapture]) {
    assert.match(source, /openLocalRegistry/);
    assert.match(source, /captureSubmission/);
    assert.doesNotMatch(source, /CASE_REGISTRY_URL|CASE_REGISTRY_ADMIN_TOKEN|\/v1\//);
    assert.doesNotMatch(source, /formatFor|categoryId/);
  }
  const registryCli = await readFile(new URL("../src/registry-cli.ts", import.meta.url), "utf8");
  assert.match(registryCli, /openLocalRepository/);
  assert.doesNotMatch(registryCli, /CASE_REGISTRY_URL|CASE_REGISTRY_ADMIN_TOKEN|\/v1\//);
});
