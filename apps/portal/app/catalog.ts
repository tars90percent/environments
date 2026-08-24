export type TaskKind = "task" | "trace";
export type TaskFormat = "harbor" | "non_harbor";
export type HarborCheckPhase = "environment" | "oracle" | "nop";
export type HarborCheckOutcome = "pass" | "fail";

export type CatalogCheck = {
  id: string;
  phase: HarborCheckPhase;
  outcome: HarborCheckOutcome;
  summary: string;
  score: number | null;
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
  sourcePath: string | null;
  artifactId: string | null;
  contentSha256: string | null;
  sourceItemIds: string[];
  checks: Partial<Record<HarborCheckPhase, CatalogCheck>>;
  findings: CatalogFinding[];
};

export type CatalogSourceItem = {
  id: string;
  kind: string;
  displayName: string;
  locator: string | null;
  artifactId: string | null;
  contentSha256: string | null;
};

export type CatalogSourceEvent = {
  id: string;
  channel: string;
  externalRef: string;
  sender: string | null;
  receivedAt: string;
  rawArtifactId: string | null;
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
