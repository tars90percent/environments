import assert from "node:assert/strict";
import test from "node:test";
import {
  reconcileTaskSetWithHarborPublication,
  registerTaskSetWithHarborPublication,
} from "../src/harbor-publication.js";
import type {
  HarborExportResult,
  HarborFormatValidation,
  HarborPruneResult,
  HarborTaskRegistrationClassification,
} from "../src/harbor-export-cli.js";
import type { AppendTasksInput, ReconcileSubmissionTasksInput, TaskRegistrationInput } from "../src/registry/types.js";

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

const pruned: HarborPruneResult = {
  submissionId: "submission-1",
  activePrefixCount: 1,
  deletedPrefixCount: 1,
  deletedObjectCount: 5,
  deletedPrefixes: [{ prefix: "vendor/submission-1/retired", objectCount: 5 }],
};

const validated: HarborFormatValidation = {
  requestedHarborTaskCount: 1,
  validHarborTaskCount: 1,
  reclassifiedTaskCount: 0,
  reclassifiedTasks: [],
};

function classified<T extends TaskRegistrationInput | ReconcileSubmissionTasksInput["tasks"][number]>(
  tasks: T[],
  validation: HarborFormatValidation = validated,
): HarborTaskRegistrationClassification<T> {
  return { tasks, validation };
}

function appendRegistration(tasks: TaskRegistrationInput[]): AppendTasksInput {
  return { submissionId: "submission-1", benchmarkAssignments: [], tasks, actor: "CASE" };
}

function reconcileRegistration(tasks: ReconcileSubmissionTasksInput["tasks"]): ReconcileSubmissionTasksInput {
  return {
    submissionId: "submission-1",
    benchmarkAssignments: [],
    tasks,
    reason: "Keep the active task set accurate.",
    actor: "CASE",
  };
}

test("publishes Harbor files only after the registry transaction succeeds", async () => {
  const events: string[] = [];
  const result = await registerTaskSetWithHarborPublication({
    registration: appendRegistration([harborTask]),
    async classify() {
      events.push("classified");
      return classified([harborTask]);
    },
    async register(registration) {
      assert.equal(registration.tasks[0]?.format, "harbor");
      events.push("registered");
      return { tasksAdded: 1 };
    },
    async publish(submissionId) {
      assert.deepEqual(events, ["classified", "registered"]);
      assert.equal(submissionId, "submission-1");
      events.push("published");
      return published;
    },
  });

  assert.deepEqual(events, ["classified", "registered", "published"]);
  assert.equal(result.tasksAdded, 1);
  assert.equal(result.harborTaskPublication.status, "completed");
  assert.equal(result.harborTaskPublication.completedTaskCount, 1);
});

test("does not require a Harbor bucket for a non-Harbor registration", async () => {
  let publishCalled = false;
  const nonHarborTask = { ...harborTask, format: "non_harbor" as const };
  const result = await registerTaskSetWithHarborPublication({
    registration: appendRegistration([nonHarborTask]),
    async classify() {
      return classified([nonHarborTask], {
        requestedHarborTaskCount: 0,
        validHarborTaskCount: 0,
        reclassifiedTaskCount: 0,
        reclassifiedTasks: [],
      });
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
      registration: appendRegistration([harborTask]),
      async classify() {
        return classified([harborTask]);
      },
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

test("retains a statically invalid task and registers it as non-Harbor", async () => {
  let publishCalled = false;
  const nonHarborTask = { ...harborTask, format: "non_harbor" as const };
  const result = await registerTaskSetWithHarborPublication({
    registration: appendRegistration([harborTask]),
    async classify() {
      return classified([nonHarborTask], {
        requestedHarborTaskCount: 1,
        validHarborTaskCount: 0,
        reclassifiedTaskCount: 1,
        reclassifiedTasks: [{ taskId: harborTask.id, reason: "Harbor 0.21.0: tests/test.sh is missing" }],
      });
    },
    async register(registration) {
      assert.equal(registration.tasks.length, 1);
      assert.equal(registration.tasks[0]?.id, harborTask.id);
      assert.equal(registration.tasks[0]?.format, "non_harbor");
      return { tasksAdded: 1 };
    },
    async publish() {
      publishCalled = true;
      return published;
    },
  });

  assert.equal(result.tasksAdded, 1);
  assert.equal(result.harborFormatValidation.reclassifiedTaskCount, 1);
  assert.equal(result.harborTaskPublication.status, "not_applicable");
  assert.equal(publishCalled, false);
});

test("reconciliation publishes active Harbor tasks before pruning inactive prefixes", async () => {
  const events: string[] = [];
  const result = await reconcileTaskSetWithHarborPublication({
    registration: reconcileRegistration([harborTask]),
    async classify() {
      events.push("classified");
      return classified([harborTask]);
    },
    async register() {
      events.push("registered");
      return { taskVersionsAdded: 1 };
    },
    async publish() {
      assert.deepEqual(events, ["classified", "registered"]);
      events.push("published");
      return published;
    },
    async prune() {
      assert.deepEqual(events, ["classified", "registered", "published"]);
      events.push("pruned");
      return pruned;
    },
  });

  assert.deepEqual(events, ["classified", "registered", "published", "pruned"]);
  assert.equal(result.harborTaskPublication.status, "completed");
  assert.deepEqual(result.harborTaskPruning, pruned);
});

test("reconciliation still prunes when no active task is Harbor", async () => {
  const events: string[] = [];
  const nonHarborTask = { ...harborTask, format: "non_harbor" as const };
  const result = await reconcileTaskSetWithHarborPublication({
    registration: reconcileRegistration([nonHarborTask]),
    async classify() {
      return classified([nonHarborTask], {
        requestedHarborTaskCount: 0,
        validHarborTaskCount: 0,
        reclassifiedTaskCount: 0,
        reclassifiedTasks: [],
      });
    },
    async register() {
      events.push("registered");
      return { taskVersionsAdded: 1 };
    },
    async publish() {
      events.push("published");
      return published;
    },
    async prune() {
      assert.deepEqual(events, ["registered"]);
      events.push("pruned");
      return { ...pruned, activePrefixCount: 0 };
    },
  });

  assert.deepEqual(events, ["registered", "pruned"]);
  assert.equal(result.harborTaskPublication.status, "not_applicable");
  assert.equal(result.harborTaskPruning.activePrefixCount, 0);
});
