import type { CatalogSourceEvent, CatalogSourceItem, CatalogSubmission } from "./catalog";

export type OriginalSubmissionArtifact = {
  artifactId: string;
  displayName: string;
  contentSha256: string | null;
  sizeBytes: number | null;
  mediaType: string | null;
};

const ORIGINAL_KINDS = ["source_payload", "source_snapshot"] as const;

export function originalSubmissionArtifacts(events: CatalogSourceEvent[]): OriginalSubmissionArtifact[] {
  const selected: OriginalSubmissionArtifact[] = [];
  for (const event of events) {
    const knownKinds = event.items.some((item) => Boolean(item.artifactKind)) || Boolean(event.rawArtifact?.kind);
    let candidates: OriginalSubmissionArtifact[] = [];

    for (const artifactKind of ORIGINAL_KINDS) {
      candidates = event.items
        .filter((item): item is CatalogSourceItem & { artifactId: string } => Boolean(item.artifactId) && item.artifactKind === artifactKind)
        .map(artifactFromItem);
      if (event.rawArtifact?.kind === artifactKind) {
        candidates.push({
          artifactId: event.rawArtifact.id,
          displayName: event.rawArtifact.originalName || "original-submission",
          contentSha256: event.rawArtifact.contentSha256,
          sizeBytes: finiteSize(event.rawArtifact.sizeBytes),
          mediaType: event.rawArtifact.contentType,
        });
      }
      if (candidates.length) break;
    }

    if (!candidates.length && !knownKinds) {
      let legacyItems = event.items
        .filter((item): item is CatalogSourceItem & { artifactId: string } => Boolean(item.artifactId) && item.kind !== "task_package");
      if (event.rawArtifactId && legacyItems.some((item) => item.artifactId !== event.rawArtifactId)) {
        legacyItems = legacyItems.filter((item) => item.artifactId !== event.rawArtifactId);
      }
      candidates = legacyItems.map(artifactFromItem);
      if (!candidates.length && event.rawArtifactId) {
        candidates.push({
          artifactId: event.rawArtifactId,
          displayName: "original-submission",
          contentSha256: null,
          sizeBytes: null,
          mediaType: null,
        });
      }
    }

    selected.push(...candidates);
  }

  return [...new Map(selected.map((artifact) => [artifact.artifactId, artifact])).values()];
}

export function originalSubmissionArchiveFilename(submission: Pick<CatalogSubmission, "label" | "date">): string {
  const label = safeFilenamePart(submission.label) || "case-submission";
  return `${label}-${submission.date}-original-files.zip`;
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

function artifactFromItem(item: CatalogSourceItem & { artifactId: string }): OriginalSubmissionArtifact {
  return {
    artifactId: item.artifactId,
    displayName: item.displayName,
    contentSha256: item.contentSha256,
    sizeBytes: finiteSize(item.sizeBytes),
    mediaType: item.mediaType,
  };
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
