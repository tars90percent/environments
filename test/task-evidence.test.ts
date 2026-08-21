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
