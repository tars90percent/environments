import type {
  CatalogCheck,
  CatalogSnapshot,
  CatalogSourceEvent,
  CatalogSourceItem,
  CatalogSubmission,
  CatalogTask,
  CatalogVendor,
  HarborCheckOutcome,
  HarborCheckPhase,
  TaskFormat,
  TaskKind,
} from "../app/catalog";
import type { DatasetSubmission } from "../app/dataset-archive";

type JsonRecord = Record<string, unknown>;

const LEGACY_TRACE_FORMATS = new Set([
  "native jsonl instruction and chat-trajectory record",
  "metadata-only agentic trajectory session boundary",
  "native trajectory record with embedded coding prompt",
]);

const LEGACY_PHASES: Array<[string, HarborCheckPhase]> = [
  ["positiveControl", "oracle"],
  ["negativeControl", "nop"],
];

/**
 * Temporary deployment bridge. It can be removed after CASE migration 016 has
 * deployed and the portal no longer needs to consume the former catalog shape.
 */
export function normalizeCaseCatalog(value: unknown): CatalogSnapshot {
  const root = record(value);
  const rawVendors = records(root.vendors);
  if (!rawVendors.some((vendor) => Array.isArray(vendor.batches))) {
    return value as CatalogSnapshot;
  }

  const vendors = rawVendors.map(normalizeLegacyVendor);
  const submissions = vendors.flatMap((vendor) => vendor.submissions);
  const tasks = submissions.flatMap((submission) => submission.tasks);
  return {
    generatedAt: text(root.generatedAt, new Date(0).toISOString()),
    vendors,
    totals: {
      vendors: vendors.length,
      submissions: submissions.length,
      tasks: tasks.length,
      harborTasks: tasks.filter((task) => task.format === "harbor").length,
    },
  };
}

export function normalizeCaseSubmission(value: unknown): DatasetSubmission {
  const submission = record(value);
  if (Array.isArray(submission.tasks)) return value as DatasetSubmission;
  return normalizeLegacySubmission(submission);
}

function normalizeLegacyVendor(value: JsonRecord): CatalogVendor {
  return {
    id: text(value.id),
    name: text(value.name),
    short: text(value.short, text(value.name)),
    submissions: records(value.batches).map(normalizeLegacySubmission),
  };
}

function normalizeLegacySubmission(value: JsonRecord): CatalogSubmission {
  const taskById = new Map<string, CatalogTask>();
  for (const category of records(value.categories)) {
    for (const task of records(category.tasks)) {
      const normalized = normalizeLegacyTask(task);
      if (normalized.id && !taskById.has(normalized.id)) taskById.set(normalized.id, normalized);
    }
  }
  const tasks = [...taskById.values()];
  const formats = tasks.length
    ? unique(tasks.map((task) => task.format))
    : unique(strings(value.formats).map((format) => legacyFormat(format, null)));

  return {
    id: text(value.id),
    date: text(value.date),
    label: text(value.label),
    source: text(value.source),
    formats: formats.length ? formats : ["non_harbor"],
    sourceEvents: records(value.sourceEvents).map(normalizeLegacySourceEvent),
    tasks,
  };
}

function normalizeLegacyTask(value: JsonRecord): CatalogTask {
  const representation = optionalRecord(value.representation);
  const sourcePath = nullableText(value.sourcePath);
  return {
    id: text(value.id),
    stableKey: text(value.stableKey, text(value.id)),
    title: text(value.title, text(value.stableKey, text(value.id))),
    summary: nullableText(value.summary),
    kind: legacyKind(text(value.format)),
    format: legacyFormat(text(value.format), representation),
    sourcePath,
    artifactId: nullableText(value.artifactId),
    contentSha256: nullableText(value.contentSha256),
    sourceItemIds: strings(value.sourceItemIds),
    checks: legacyChecks(optionalRecord(value.runtimeVerification)),
    findings: [],
  };
}

function normalizeLegacySourceEvent(value: JsonRecord): CatalogSourceEvent {
  return {
    id: text(value.id),
    channel: text(value.channel),
    externalRef: text(value.externalRef),
    sender: nullableText(value.sender),
    receivedAt: text(value.receivedAt),
    rawArtifactId: nullableText(value.rawArtifactId),
    items: records(value.items).map(normalizeLegacySourceItem),
  };
}

function normalizeLegacySourceItem(value: JsonRecord): CatalogSourceItem {
  return {
    id: text(value.id),
    kind: text(value.kind),
    displayName: text(value.displayName),
    locator: nullableText(value.locator),
    artifactId: nullableText(value.artifactId),
    contentSha256: nullableText(value.contentSha256),
  };
}

function legacyKind(format: string): TaskKind {
  if (LEGACY_TRACE_FORMATS.has(format.trim().toLowerCase())) return "trace";
  return "task";
}

function legacyFormat(format: string, representation: JsonRecord | null): TaskFormat {
  const path = representation ? text(representation.path) : "";
  const outcome = representation ? text(representation.normalizationOutcome) : "";
  if (path === "normalized_to_harbor" || outcome === "normalized") return "non_harbor";
  const normalized = format.trim().toLowerCase();
  if (
    path === "already_harbor"
    || outcome === "already_harbor"
    || /^harbor($|[ _-])/.test(normalized)
    || normalized === "deepswe material package (incomplete harbor)"
  ) return "harbor";
  return "non_harbor";
}

function legacyChecks(runtimeVerification: JsonRecord | null): Partial<Record<HarborCheckPhase, CatalogCheck>> {
  const phases = optionalRecord(runtimeVerification?.phases);
  if (!phases) return {};
  const checks: Partial<Record<HarborCheckPhase, CatalogCheck>> = {};
  const explicitEnvironment = legacyCheck(optionalRecord(phases.environment), "environment");
  if (explicitEnvironment) checks.environment = explicitEnvironment;
  for (const [legacyPhase, phase] of LEGACY_PHASES) {
    const check = legacyCheck(optionalRecord(phases[legacyPhase]), phase);
    if (check) checks[phase] = check;
  }
  if (!checks.environment) {
    const passingControl = [checks.oracle, checks.nop]
      .filter((check): check is CatalogCheck => check?.outcome === "pass")
      .sort((left, right) => left.completedAt.localeCompare(right.completedAt))[0];
    if (passingControl) {
      checks.environment = {
        id: `inferred-environment:${passingControl.id}`,
        phase: "environment",
        outcome: "pass",
        summary: `Environment usability inferred from passing ${passingControl.phase} evidence.`,
        score: null,
        completedAt: passingControl.completedAt,
      };
    } else {
      const build = legacyCheck(optionalRecord(phases.build), "environment");
      const boot = legacyCheck(optionalRecord(phases.boot), "environment");
      if (build?.outcome === "pass" && boot?.outcome === "pass") {
        checks.environment = {
          id: `inferred-environment:${boot.id}`,
          phase: "environment",
          outcome: "pass",
          summary: "Environment usability inferred from passing Build and Boot evidence.",
          score: null,
          completedAt: [build.completedAt, boot.completedAt].sort().at(-1) ?? boot.completedAt,
        };
      } else {
        const failedSetup = [build, boot]
          .filter((check): check is CatalogCheck => check?.outcome === "fail")
          .sort((left, right) => right.completedAt.localeCompare(left.completedAt))[0];
        if (failedSetup) {
          checks.environment = {
            id: `inferred-environment:${failedSetup.id}`,
            phase: "environment",
            outcome: "fail",
            summary: "Environment failure inferred from failed Build or Boot evidence.",
            score: null,
            completedAt: failedSetup.completedAt,
          };
        }
      }
    }
  }
  return checks;
}

function legacyCheck(evidence: JsonRecord | null, phase: HarborCheckPhase): CatalogCheck | null {
  const outcome = evidence?.outcome;
  const id = evidence?.checkRunId;
  const completedAt = evidence?.completedAt;
  if ((outcome !== "pass" && outcome !== "fail") || typeof id !== "string" || typeof completedAt !== "string") return null;
  return {
    id,
    phase,
    outcome: outcome as HarborCheckOutcome,
    summary: `Recorded ${phase} result.`,
    score: null,
    completedAt,
  };
}

function record(value: unknown): JsonRecord {
  return optionalRecord(value) ?? {};
}

function optionalRecord(value: unknown): JsonRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : null;
}

function records(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.map(optionalRecord).filter((item): item is JsonRecord => item !== null) : [];
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function nullableText(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}
