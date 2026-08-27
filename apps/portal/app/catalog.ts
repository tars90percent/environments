export type TaskKind = "task" | "trace";
export type TaskFormat = "harbor" | "non_harbor";
export type HarborCheckPhase = "environment" | "oracle" | "nop";
export type HarborCheckOutcome = "pass" | "fail";
export type HarborCheckAttemptStatus = "blocked" | "inconclusive";

export type CatalogCheck = {
  id: string;
  phase: HarborCheckPhase;
  outcome: HarborCheckOutcome;
  summary: string;
  score: number | null;
  completedAt: string;
};

export type CatalogAttempt = {
  id: string;
  phase: HarborCheckPhase;
  status: HarborCheckAttemptStatus;
  summary: string;
  completedAt: string;
};

export type CatalogFinding = {
  id: string;
  phase: HarborCheckPhase;
  checkRunId: string;
  finding: string;
};

export type CatalogTask = {
  id: string;
  stableKey: string;
  title: string;
  summary: string | null;
  kind: TaskKind;
  format: TaskFormat;
  benchmark: {
    id: string;
    displayName: string;
  };
  gpuRequired: boolean;
  sourcePath: string | null;
  artifactId: string | null;
  contentSha256: string | null;
  sourceItemIds: string[];
  checks: Partial<Record<HarborCheckPhase, CatalogCheck>>;
  attempts: Partial<Record<HarborCheckPhase, CatalogAttempt>>;
  findings: CatalogFinding[];
};

export type CatalogSourceItem = {
  id: string;
  kind: string;
  displayName: string;
  locator: string | null;
  mediaType: string | null;
  artifactId: string | null;
  artifactKind: string | null;
  contentSha256: string | null;
  sizeBytes: number | null;
  submissionRoles?: string[];
};

export type CatalogRawArtifact = {
  id: string;
  kind: string;
  contentSha256: string;
  sizeBytes: number | null;
  contentType: string | null;
  originalName: string | null;
};

export type CatalogSourceEvent = {
  id: string;
  channel: string;
  externalRef: string;
  sender: string | null;
  receivedAt: string;
  rawArtifactId: string | null;
  rawArtifact: CatalogRawArtifact | null;
  items: CatalogSourceItem[];
};

export type CatalogSubmission = {
  id: string;
  date: string;
  label: string;
  source: string;
  formats: TaskFormat[];
  sourceEvents: CatalogSourceEvent[];
  tasks: CatalogTask[];
};

export type CatalogVendor = {
  id: string;
  name: string;
  short: string;
  submissions: CatalogSubmission[];
};

export type CatalogSnapshot = {
  generatedAt: string;
  vendors: CatalogVendor[];
  totals: {
    vendors: number;
    submissions: number;
    tasks: number;
    harborTasks: number;
  };
};
