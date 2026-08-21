import assert from "node:assert/strict";
import test from "node:test";
import { deriveRuntimeVerification, type RuntimeCheckFact } from "../src/registry/task-evidence.js";

test("reports only explicitly recorded phases", () => {
  const oracle = fact("positive_control", "pass");
  const result = deriveRuntimeVerification([oracle], 0);
  assert.equal(result.phases.build.outcome, null);
  assert.equal(result.phases.boot.outcome, null);
  assert.equal(result.phases.positiveControl.outcome, "pass");
  assert.equal(result.runtimeSuiteCompleted, false);
  assert.equal(result.runtimeVerified, false);
});

test("requires four explicit passes for a verified legacy summary", () => {
  const result = deriveRuntimeVerification([
    fact("build", "pass"),
    fact("boot", "pass"),
    fact("positive_control", "pass"),
    fact("negative_control", "pass"),
  ], 0);
  assert.equal(result.runtimeSuiteCompleted, true);
  assert.equal(result.runtimeVerified, true);
});

test("keeps unset, failed, and blocked phases distinct", () => {
  const result = deriveRuntimeVerification([fact("build", "pass"), fact("boot", "fail")], 0);
  assert.equal(result.phases.positiveControl.outcome, null);
  assert.equal(result.phases.negativeControl.outcome, null);
  assert.equal(result.status, "failed");
  assert.equal(deriveRuntimeVerification([fact("build", "blocked")], 0).status, "blocked");
  assert.equal(deriveRuntimeVerification([], 0).status, "not_checked");
});

function fact(evidenceRole: RuntimeCheckFact["evidenceRole"], outcome: RuntimeCheckFact["outcome"]): RuntimeCheckFact {
  return { id: `check:${evidenceRole}:${outcome}`, evidenceRole, outcome, completedAt: "2026-08-21T00:00:00.000Z" };
}
