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
    environment: { ...EMPTY_PHASE },
    positiveControl: { ...EMPTY_PHASE },
    negativeControl: { ...EMPTY_PHASE },
  };

  let legacyBuild: RuntimeCheckFact | undefined;
  let legacyBoot: RuntimeCheckFact | undefined;
  for (const fact of facts) {
    if (fact.evidenceRole === "build") legacyBuild = fact;
    if (fact.evidenceRole === "boot") legacyBoot = fact;
    const key = phaseKey(fact.evidenceRole);
    if (!key) continue;
    phases[key] = {
      outcome: fact.outcome,
      checkRunId: fact.id,
      completedAt: fact.completedAt,
    };
  }

  if (phases.environment.outcome === null) {
    const passingControl = [phases.positiveControl, phases.negativeControl]
      .filter((phase) => phase.outcome === "pass")
      .sort((left, right) => (left.completedAt ?? "").localeCompare(right.completedAt ?? ""))[0];
    if (passingControl) {
      phases.environment = {
        outcome: "pass",
        checkRunId: passingControl.checkRunId,
        completedAt: passingControl.completedAt,
      };
    } else if (legacyBuild?.outcome === "pass" && legacyBoot?.outcome === "pass") {
      phases.environment = {
        outcome: "pass",
        checkRunId: legacyBoot.id,
        completedAt: [legacyBuild.completedAt, legacyBoot.completedAt].sort().at(-1) ?? legacyBoot.completedAt,
      };
    } else {
      const failedSetup = [legacyBuild, legacyBoot]
        .filter((fact): fact is RuntimeCheckFact => fact?.outcome === "fail")
        .sort((left, right) => right.completedAt.localeCompare(left.completedAt))[0];
      if (failedSetup) {
        phases.environment = {
          outcome: "fail",
          checkRunId: failedSetup.id,
          completedAt: failedSetup.completedAt,
        };
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

function phaseKey(role: CheckEvidenceRole): keyof RuntimeVerificationSummary["phases"] | null {
  if (role === "environment") return "environment";
  if (role === "positive_control") return "positiveControl";
  if (role === "negative_control") return "negativeControl";
  return null;
}
