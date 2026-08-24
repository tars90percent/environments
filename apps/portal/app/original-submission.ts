import type { CatalogSourceEvent, CatalogSourceItem, CatalogSubmission } from "./catalog";

export type OriginalSubmissionArtifact = {
  artifactId: string;
  displayName: string;
  contentSha256: string | null;
  sizeBytes: number | null;
  mediaType: string | null;
};

const DERIVED_ARTIFACT_KINDS = new Set([
  "submission_manifest",
  "trajectory",
  "check_evidence",
  "extracted_text",
]);

/**
 * Select exact inbound files, not every artifact that happens to be attached to
 * a submission. Legacy capture registered many untouched vendor attachments as
 * `task_package`, so the source-event relationship is authoritative here; the
 * artifact's single global kind is not.
 */
export function originalSubmissionArtifacts(submission: CatalogSubmission): OriginalSubmissionArtifact[] {
  return inboundSubmissionArtifacts(submission);
}

export function originalSubmissionArchiveFilename(submission: Pick<CatalogSubmission, "label" | "date">): string {
  const label = safeFilenamePart(submission.label) || "case-submission";
  return `${label}-${submission.date}-original-vendor-files.zip`;
}

export function originalSubmissionEntryNames(artifacts: OriginalSubmissionArtifact[]): string[] {
  const used = new Map<string, number>();
  return artifacts.map((artifact, index) => {
    const base = safeEntryName(artifact.displayName) || `original-file-${String(index + 1).padStart(4, "0")}`;
    const count = (used.get(base) ?? 0) + 1;
    used.set(base, count);
    return count === 1 ? base : `${String(count).padStart(2, "0")}-${base}`;
  });
}

function inboundSubmissionArtifacts(submission: CatalogSubmission): OriginalSubmissionArtifact[] {
  const taskSourceItemIds = new Set(submission.tasks.flatMap((task) => task.sourceItemIds));
  const originalFiles: OriginalSubmissionArtifact[] = [];

  for (const event of submission.sourceEvents) {
    if (isDerivedEvent(event)) continue;

    for (const item of event.items) {
      if (!item.artifactId) continue;
      if (isSourceRecord(item)) continue;
      if (isInboundFile(item, event, taskSourceItemIds)) {
        originalFiles.push(artifactFromItem(item));
      }
    }
  }

  return uniqueArtifacts(originalFiles);
}

function isInboundFile(
  item: CatalogSourceItem & { artifactId: string },
  event: CatalogSourceEvent,
  taskSourceItemIds: Set<string>,
): boolean {
  if (item.artifactKind === "source_payload") return true;

  const isEventPayload = item.artifactId === event.rawArtifactId;
  if (!isEventPayload) return false;
  if (item.artifactKind && DERIVED_ARTIFACT_KINDS.has(item.artifactKind)) return false;

  // Legacy capture often registered an untouched inbound attachment as a task
  // package before it linked that same object to the source event.
  return item.artifactKind === "task_package"
    || item.artifactKind === null
    || taskSourceItemIds.has(item.id);
}

function isSourceRecord(item: CatalogSourceItem): boolean {
  return item.artifactKind === "source_snapshot" || item.kind === "message";
}

function isDerivedEvent(event: CatalogSourceEvent): boolean {
  return /^(case-normalization|case-parsing|case-derived):\/\//.test(event.externalRef)
    || /^(normalization|parsing):/.test(event.id);
}

function artifactFromItem(item: CatalogSourceItem & { artifactId: string }): OriginalSubmissionArtifact {
  return {
    artifactId: item.artifactId,
    displayName: item.displayName,
    contentSha256: item.contentSha256,
    sizeBytes: finiteSize(item.sizeBytes),
    mediaType: item.mediaType,
  };
}

function uniqueArtifacts(artifacts: OriginalSubmissionArtifact[]): OriginalSubmissionArtifact[] {
  return [...new Map(artifacts.map((artifact) => [artifact.artifactId, artifact])).values()];
}

function finiteSize(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function safeEntryName(value: string): string {
  return value.replaceAll("\\", "/").split("/").filter((part) => part && part !== "." && part !== "..").at(-1)?.replaceAll("\0", "").slice(0, 180) ?? "";
}

function safeFilenamePart(value: string): string {
  return value.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}
