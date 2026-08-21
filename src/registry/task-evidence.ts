import type {
  CheckEvidenceRole,
  CheckOutcome,
  RuntimePhaseEvidence,
  RuntimeVerificationSummary,
} from "./types.js";

export type RuntimeCheckFact = {
  id: string;
  evidenceRole: CheckEvidenceRole;
  outcome: CheckOutcome;
  completedAt: string;
};

const EMPTY_PHASE: RuntimePhaseEvidence = {
  outcome: null,
  checkRunId: null,
  completedAt: null,
};

export function deriveRuntimeVerification(
  facts: RuntimeCheckFact[],
  unclassifiedCheckRuns: number,
): RuntimeVerificationSummary {
  const phases: RuntimeVerificationSummary["phases"] = {
    build: { ...EMPTY_PHASE },
    boot: { ...EMPTY_PHASE },
    positiveControl: { ...EMPTY_PHASE },
    negativeControl: { ...EMPTY_PHASE },
  };

  for (const fact of facts) {
    const key = phaseKey(fact.evidenceRole);
    if (!key) continue;
    phases[key] = {
      outcome: fact.outcome,
      checkRunId: fact.id,
      completedAt: fact.completedAt,
    };
  }

  // A successful Oracle or Nop control necessarily executed inside a built,
  // started task environment. Older registry records predate the dedicated
  // build and boot evidence roles, so use the passed control as the supporting
  // fact when either prerequisite phase is missing or explicitly not run.
  // Preserve an explicit pass, fail, or blocked phase result rather than
  // replacing separately recorded evidence.
  const passedControl = latestPassedControl(phases);
  if (passedControl) {
    for (const key of ["build", "boot"] as const) {
      if (phases[key].outcome === null || phases[key].outcome === "not_run") {
        phases[key] = { ...passedControl };
      }
    }
  }

  const outcomes = Object.values(phases).map((phase) => phase.outcome);
  const hasClassifiedEvidence = outcomes.some((outcome) => outcome !== null);
  const hasBeenChecked = outcomes.some((outcome) => outcome === "pass" || outcome === "fail" || outcome === "blocked");
  const runtimeSuiteCompleted = outcomes.every((outcome) => outcome === "pass" || outcome === "fail");
  const runtimeVerified = outcomes.every((outcome) => outcome === "pass");
  const status = runtimeVerified
    ? "verified"
    : outcomes.includes("fail")
      ? "failed"
      : outcomes.includes("blocked")
        ? "blocked"
        : hasClassifiedEvidence
          ? "partial"
          : unclassifiedCheckRuns > 0
            ? "unclassified"
            : "not_checked";

  return {
    status,
    hasBeenChecked,
    runtimeSuiteCompleted,
    runtimeVerified,
    unclassifiedCheckRuns,
    phases,
  };
}

function latestPassedControl(phases: RuntimeVerificationSummary["phases"]): RuntimePhaseEvidence | null {
  const passed = [phases.positiveControl, phases.negativeControl]
    .filter((phase) => phase.outcome === "pass")
    .sort((left, right) => (left.completedAt ?? "").localeCompare(right.completedAt ?? ""));
  return passed.at(-1) ?? null;
}

function phaseKey(role: CheckEvidenceRole): keyof RuntimeVerificationSummary["phases"] | null {
  if (role === "build") return "build";
  if (role === "boot") return "boot";
  if (role === "positive_control") return "positiveControl";
  if (role === "negative_control") return "negativeControl";
  return null;
}
