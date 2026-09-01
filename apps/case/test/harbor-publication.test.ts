import assert from "node:assert/strict";
import test from "node:test";
import { registerTaskSetWithHarborPublication } from "../src/harbor-publication.js";
import type { HarborExportResult } from "../src/harbor-export-cli.js";
import type { TaskRegistrationInput } from "../src/registry/types.js";

const harborTask: TaskRegistrationInput = {
  id: "task-version-1",
  stableKey: "vendor:submission:task",
  title: "Task",
  kind: "task",
  format: "harbor",
  benchmarkId: "unspecified",
  sourcePath: "delivery/task",
  artifactId: `artifact:sha256:${"a".repeat(64)}`,
  contentSha256: "a".repeat(64),
  sourceItemIds: ["source-item-1"],
};

const published: HarborExportResult = {
  mode: "publish",
  submissions: ["submission-1"],
  selectedTaskCount: 1,
  completedTaskCount: 1,
  failedTaskCount: 0,
  fileCount: 5,
  sizeBytes: 100,
  tasks: [{
    taskId: "task-version-1",
    prefix: "vendor/submission-1/task",
    fileCount: 5,
    sizeBytes: 100,
    status: "published",
  }],
  errors: [],
};

test("publishes Harbor files only after the registry transaction succeeds", async () => {
  const events: string[] = [];
  const result = await registerTaskSetWithHarborPublication({
    registration: { submissionId: "submission-1", tasks: [harborTask] },
    async register() {
      events.push("registered");
      return { tasksAdded: 1 };
    },
    async publish(submissionId) {
      assert.deepEqual(events, ["registered"]);
      assert.equal(submissionId, "submission-1");
      events.push("published");
      return published;
    },
  });

  assert.deepEqual(events, ["registered", "published"]);
  assert.equal(result.tasksAdded, 1);
  assert.equal(result.harborTaskPublication.status, "completed");
  assert.equal(result.harborTaskPublication.completedTaskCount, 1);
});

test("does not require a Harbor bucket for a non-Harbor registration", async () => {
  let publishCalled = false;
  const result = await registerTaskSetWithHarborPublication({
    registration: {
      submissionId: "submission-1",
      tasks: [{ ...harborTask, format: "non_harbor" }],
    },
    async register() {
      return { tasksAdded: 1 };
    },
    async publish() {
      publishCalled = true;
      return published;
    },
  });

  assert.equal(publishCalled, false);
  assert.deepEqual(result.harborTaskPublication, {
    status: "not_applicable",
    submissionId: "submission-1",
    reason: "registration_contains_no_harbor_tasks",
  });
});

test("surfaces publication failures after registration so the operation can be retried", async () => {
  let registered = false;
  await assert.rejects(
    registerTaskSetWithHarborPublication({
      registration: { submissionId: "submission-1", tasks: [harborTask] },
      async register() {
        registered = true;
        return { tasksAdded: 1 };
      },
      async publish() {
        assert.equal(registered, true);
        throw new Error("bucket unavailable");
      },
    }),
    /bucket unavailable/,
  );
  assert.equal(registered, true);
});
