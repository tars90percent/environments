import type { ArtifactStore } from "./artifacts.js";
import type { RegistryRepository } from "./repository.js";
import type { FilingArtifact, FileMoveInput } from "./file-filing.js";
import { collisionName, fileName, readableFileKey, type FileContext } from "./file-names.js";

export function planFileFiling(artifacts: FilingArtifact[]) {
  const occupied = new Map(artifacts.map((a) => [a.storageKey,a.id]));
  const entries: Array<FileMoveInput & { context: FileContext; sizeBytes: number | null }> = [];
  for (const artifact of artifacts) {
    if (artifact.reference === artifact.storageKey && !artifact.storageKey.startsWith("files/")) continue;
    const contexts = artifact.contexts.filter((c) => c.vendorId);
    const correspondence = contexts.some((c) => c.sourceKind === "message");
    const sorted = [...contexts].sort((a,b) => {
      // Task packages belong to their first documented delivery, even when
      // later parsing captured the source event. Documents can arrive later.
      const score = (c: typeof a) => correspondence ? 0
        : artifact.kind === "task_package" ? (c.submissionId ? 0 : 1)
        : c.date && c.date === c.sourceDate ? 0 : c.submissionId ? 1 : 2;
      return score(a)-score(b) || (correspondence ? a.sourceDate || a.date || "" : a.date || a.sourceDate || "").localeCompare(correspondence ? b.sourceDate || b.date || "" : b.date || b.sourceDate || "") || (a.submissionId || "").localeCompare(b.submissionId || "");
    });
    const chosen = sorted[0];
    const vendors = new Set(contexts.map((c) => c.vendorId));
    const context: FileContext = { vendorId: vendors.size > 1 ? "shared-vendors" : chosen?.vendorId,
      date: (correspondence ? chosen?.sourceDate : chosen?.date || chosen?.sourceDate) || artifact.createdAt.slice(0,10),
      label: correspondence ? undefined : chosen?.label, submissionId: correspondence ? undefined : chosen?.submissionId, correspondence };
    const metadata = artifact.metadata || {};
    const original = typeof metadata.originalName === "string" ? metadata.originalName : typeof metadata.filename === "string" ? metadata.filename : undefined;
    const candidate = artifact.names.find((name) => /\.[a-z0-9]{1,8}$/i.test(name)) || artifact.names[0];
    const extension = artifact.contentType === "application/zip" ? ".zip" : artifact.contentType === "application/gzip" ? ".tar.gz" : artifact.contentType === "application/json" ? ".json" : artifact.contentType === "application/pdf" ? ".pdf" : "";
    const filename = original || (candidate ? fileName(candidate.replace(/ — exact task package$/, "")) + extension : artifact.kind.replaceAll("_","-") + extension);
    const base = readableFileKey(filename,context);
    let toKey = base;
    for (let n=2;occupied.has(toKey) && occupied.get(toKey)!==artifact.id;n++) toKey=collisionName(base,n);
    occupied.set(toKey,artifact.id);
    entries.push({ artifactId:artifact.id,fromKey:artifact.storageKey,toKey,context,sizeBytes:artifact.sizeBytes ?? null });
  }
  return { schemaVersion:1, files:entries.length, sizeBytes:entries.reduce((n,e)=>n+(e.sizeBytes || 0),0), entries };
}

export async function migrateFiles(repository: RegistryRepository, store: ArtifactStore, input: { entries: FileMoveInput[]; actor: string; reason: string }, progress?: (value: unknown)=>void) {
  if (!Array.isArray(input.entries) || !input.actor?.trim() || !input.reason?.trim()) throw new Error("Filing requires entries, actor and reason");
  let completed=0;
  for (const entry of input.entries) {
    const artifact=await repository.getArtifact(entry.artifactId);
    if (!artifact) throw new Error(`Missing artifact ${entry.artifactId}`);
    const move=await repository.files.prepare({...entry,artifactId:artifact.id},input.actor,input.reason);
    if (!move.switchedAt) {
      progress?.({ phase:"copying", completed, total:input.entries.length, toKey:entry.toKey, sizeBytes:artifact.sizeBytes });
      await store.copyVerified({fromKey:move.fromKey,toKey:move.toKey,sha256:artifact.sha256,sizeBytes:artifact.sizeBytes});
      await repository.files.complete(move.id);
    }
    completed++;
    progress?.({phase:"filed",completed,total:input.entries.length,toKey:entry.toKey});
  }
  return { completed, oldCopiesRetained:true };
}

export async function pruneOldFileCopies(repository: RegistryRepository, store: ArtifactStore) {
  let deleted=0; let retained=0;
  for (const move of await repository.files.moves()) {
    if (move.oldCopyDeletedAt) continue;
    if (!move.switchedAt || Date.now()-new Date(move.switchedAt).getTime()<24*60*60*1000) {retained++;continue;}
    const artifact=await repository.getArtifact(move.artifactId);
    if (!artifact || artifact.storageKey!==move.toKey) throw new Error(`Current location does not match move ${move.id}`);
    await store.verifyObject({key:move.toKey,sha256:artifact.sha256,sizeBytes:artifact.sizeBytes});
    await store.deleteObject(move.fromKey);
    await repository.files.markOldCopyDeleted(move.id);
    deleted++;
  }
  return { deleted,retained,minimumRollbackHours:24 };
}
