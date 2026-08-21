import assert from "node:assert/strict";
import test from "node:test";
import { deriveRuntimeVerification, type RuntimeCheckFact } from "../src/registry/task-evidence.js";

const completePass: RuntimeCheckFact[] = [
  fact("build", "pass"),
  fact("boot", "pass"),
  fact("positive_control", "pass"),
  fact("negative_control", "pass"),
];

test("derives runtime verification only from all four sandbox phases", () => {
  const result = deriveRuntimeVerification(completePass, 0);
  assert.equal(result.status, "verified");
  assert.equal(result.hasBeenChecked, true);
  assert.equal(result.runtimeSuiteCompleted, true);
  assert.equal(result.runtimeVerified, true);
});

test("a passed Oracle or Nop control implies missing build and boot phases", () => {
  for (const role of ["positive_control", "negative_control"] as const) {
    const control = fact(role, "pass");
    const result = deriveRuntimeVerification([control], 0);

    assert.deepEqual(result.phases.build, {
      outcome: "pass",
      checkRunId: control.id,
      completedAt: control.completedAt,
    });
    assert.deepEqual(result.phases.boot, result.phases.build);
    assert.equal(result.status, "partial");
    assert.equal(result.runtimeSuiteCompleted, false);
    assert.equal(result.runtimeVerified, false);
  }
});

test("passed Oracle and Nop controls imply a complete verified runtime suite", () => {
  const result = deriveRuntimeVerification([
    fact("positive_control", "pass"),
    fact("negative_control", "pass"),
  ], 0);

  assert.equal(result.phases.build.outcome, "pass");
  assert.equal(result.phases.boot.outcome, "pass");
  assert.equal(result.status, "verified");
  assert.equal(result.runtimeSuiteCompleted, true);
  assert.equal(result.runtimeVerified, true);
});

test("build and boot passes do not imply either control", () => {
  const result = deriveRuntimeVerification([
    fact("build", "pass"),
    fact("boot", "pass"),
  ], 0);

  assert.equal(result.phases.positiveControl.outcome, null);
  assert.equal(result.phases.negativeControl.outcome, null);
  assert.equal(result.status, "partial");
  assert.equal(result.runtimeVerified, false);
});

test("a passed control replaces a not-run prerequisite with implied pass evidence", () => {
  const control = fact("negative_control", "pass");
  const result = deriveRuntimeVerification([
    fact("build", "not_run"),
    fact("boot", "not_run"),
    control,
  ], 0);

  assert.equal(result.phases.build.outcome, "pass");
  assert.equal(result.phases.boot.outcome, "pass");
  assert.equal(result.phases.build.checkRunId, control.id);
  assert.equal(result.phases.boot.checkRunId, control.id);
});

test("a failed control does not imply build or boot", () => {
  const result = deriveRuntimeVerification([fact("positive_control", "fail")], 0);

  assert.equal(result.phases.build.outcome, null);
  assert.equal(result.phases.boot.outcome, null);
  assert.equal(result.status, "failed");
});

test("control implication does not replace explicit phase failures or blocks", () => {
  const build = fact("build", "fail");
  const boot = fact("boot", "blocked");
  const result = deriveRuntimeVerification([build, boot, fact("positive_control", "pass")], 0);

  assert.deepEqual(result.phases.build, {
    outcome: "fail",
    checkRunId: build.id,
    completedAt: build.completedAt,
  });
  assert.deepEqual(result.phases.boot, {
    outcome: "blocked",
    checkRunId: boot.id,
    completedAt: boot.completedAt,
  });
  assert.equal(result.status, "failed");
});

test("distinguishes partial, failed, blocked, and unclassified evidence", () => {
  assert.deepEqual(
    pick(deriveRuntimeVerification([fact("build", "pass")], 0)),
    { status: "partial", hasBeenChecked: true, runtimeSuiteCompleted: false, runtimeVerified: false },
  );
  assert.deepEqual(
    pick(deriveRuntimeVerification([fact("build", "fail")], 0)),
    { status: "failed", hasBeenChecked: true, runtimeSuiteCompleted: false, runtimeVerified: false },
  );
  assert.deepEqual(
    pick(deriveRuntimeVerification([...completePass.slice(0, 3), fact("negative_control", "fail")], 0)),
    { status: "failed", hasBeenChecked: true, runtimeSuiteCompleted: true, runtimeVerified: false },
  );
  assert.deepEqual(
    pick(deriveRuntimeVerification([fact("build", "blocked")], 0)),
    { status: "blocked", hasBeenChecked: true, runtimeSuiteCompleted: false, runtimeVerified: false },
  );
  assert.deepEqual(
    pick(deriveRuntimeVerification([fact("build", "not_run")], 0)),
    { status: "partial", hasBeenChecked: false, runtimeSuiteCompleted: false, runtimeVerified: false },
  );
  assert.deepEqual(
    pick(deriveRuntimeVerification([], 6)),
    { status: "unclassified", hasBeenChecked: false, runtimeSuiteCompleted: false, runtimeVerified: false },
  );
  assert.equal(deriveRuntimeVerification([], 0).status, "not_checked");
});

function fact(evidenceRole: RuntimeCheckFact["evidenceRole"], outcome: RuntimeCheckFact["outcome"]): RuntimeCheckFact {
  return {
    id: `check:${evidenceRole}:${outcome}`,
    evidenceRole,
    outcome,
    completedAt: "2026-08-21T00:00:00.000Z",
  };
}

function pick(result: ReturnType<typeof deriveRuntimeVerification>) {
  return {
    status: result.status,
    hasBeenChecked: result.hasBeenChecked,
    runtimeSuiteCompleted: result.runtimeSuiteCompleted,
    runtimeVerified: result.runtimeVerified,
  };
}
