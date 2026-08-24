import assert from "node:assert/strict";
import test from "node:test";
import { deriveRuntimeVerification, type RuntimeCheckFact } from "../src/registry/task-evidence.js";

test("infers Environment pass from a passing historical control", () => {
  const oracle = fact("positive_control", "pass");
  const result = deriveRuntimeVerification([oracle], 0);
  assert.equal(result.phases.environment.outcome, "pass");
  assert.equal(result.phases.environment.checkRunId, oracle.id);
  assert.equal(result.phases.positiveControl.outcome, "pass");
  assert.equal(result.runtimeSuiteCompleted, false);
  assert.equal(result.runtimeVerified, false);
});

test("requires Environment, Oracle, and Nop passes for a verified summary", () => {
  const result = deriveRuntimeVerification([
    fact("environment", "pass"),
    fact("positive_control", "pass"),
    fact("negative_control", "pass"),
  ], 0);
  assert.equal(result.runtimeSuiteCompleted, true);
  assert.equal(result.runtimeVerified, true);
});

test("keeps unset, failed, and blocked phases distinct", () => {
  const result = deriveRuntimeVerification([fact("environment", "fail")], 0);
  assert.equal(result.phases.positiveControl.outcome, null);
  assert.equal(result.phases.negativeControl.outcome, null);
  assert.equal(result.status, "failed");
  assert.equal(deriveRuntimeVerification([fact("environment", "blocked")], 0).status, "blocked");
  assert.equal(deriveRuntimeVerification([], 0).status, "not_checked");
});

test("does not infer Environment from a failed historical control", () => {
  const result = deriveRuntimeVerification([fact("positive_control", "fail")], 0);
  assert.equal(result.phases.environment.outcome, null);
  assert.equal(result.status, "failed");
});

test("infers Environment from passing historical Build and Boot results", () => {
  const result = deriveRuntimeVerification([fact("build", "pass"), fact("boot", "pass")], 0);
  assert.equal(result.phases.environment.outcome, "pass");
  assert.match(result.phases.environment.checkRunId ?? "", /boot/);
});

test("does not infer Environment unless both historical setup results pass", () => {
  assert.equal(
    deriveRuntimeVerification([fact("build", "pass"), fact("boot", "fail")], 0).phases.environment.outcome,
    null,
  );
  assert.equal(deriveRuntimeVerification([fact("build", "pass")], 0).phases.environment.outcome, null);
});

function fact(evidenceRole: RuntimeCheckFact["evidenceRole"], outcome: RuntimeCheckFact["outcome"]): RuntimeCheckFact {
  return { id: `check:${evidenceRole}:${outcome}`, evidenceRole, outcome, completedAt: "2026-08-21T00:00:00.000Z" };
}
