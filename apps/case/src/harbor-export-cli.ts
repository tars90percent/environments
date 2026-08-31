#!/usr/bin/env node

import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { createReadStream, realpathSync } from "node:fs";
import { lstat, mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, sep } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { contentTypeFor } from "./capture-runtime.js";
import type { ArtifactStore } from "./registry/artifacts.js";
import { localArtifactStore, localHarborTaskStore, openLocalRepository } from "./registry/local.js";
import type { RegistryRepository } from "./registry/repository.js";
import type { ArtifactInput, SampleCatalogSourceItem, SampleCatalogSubmission, SampleCatalogTask, SampleCatalogVendor } from "./registry/types.js";

const execute = promisify(execFile);
const taskPackageScript = fileURLToPath(new URL("../scripts/case-task-package.py", import.meta.url));
const genericTaskNames = new Set(["task", "payload"]);
if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) await main();

export type HarborExportFile = {
  relativePath: string;
  path: string;
  key: string;
  sha256: string;
  sizeBytes: number;
  mode: number;
};

export async function exportSubmissions(input: {
  repository: RegistryRepository;
  sourceStore: ArtifactStore;
  destinationStore?: ArtifactStore;
  submissionIds: string[];
  allCatalogHarborTasks?: boolean;
  continueOnError?: boolean;
  onProgress?: (event: Record<string, unknown>) => void;
}): Promise<unknown> {
  const requested = new Set(input.submissionIds);
  if (requested.size !== input.submissionIds.length) throw new Error("Submission IDs must not be repeated");
  const snapshot = await input.repository.sampleCatalogSnapshot();
  const selected: Array<{ vendor: SampleCatalogVendor; submission: SampleCatalogSubmission; task: SampleCatalogTask }> = [];
  for (const vendor of snapshot.vendors) {
    for (const submission of vendor.submissions) {
      if (!input.allCatalogHarborTasks && !requested.has(submission.id)) continue;
      for (const task of submission.tasks) {
        if (task.kind === "task" && task.format === "harbor") selected.push({ vendor, submission, task });
      }
      requested.delete(submission.id);
    }
  }
  if (!input.allCatalogHarborTasks && requested.size) throw new Error(`Catalog-visible submission not found: ${[...requested].sort().join(", ")}`);
  if (!selected.length) throw new Error("The selected submissions contain no catalog-visible Harbor tasks");

  const prefixes = new Map<string, string>();
  for (const { vendor, submission, task } of selected) {
    const prefix = taskExportPrefix(vendor.id, submission.id, task.sourcePath);
    const existing = prefixes.get(prefix);
    if (existing) throw new Error(`Export path collision between ${existing} and ${task.id}: ${prefix}`);
    prefixes.set(prefix, task.id);
  }

  const tasks = [];
  const errors: Array<{ taskId: string; error: string }> = [];
  for (const [index, selection] of selected.entries()) {
    input.onProgress?.({ type: "task_started", position: index + 1, total: selected.length, taskId: selection.task.id });
    try {
      const result = await prepareAndMaybePublishTask({
        ...selection,
        repository: input.repository,
        sourceStore: input.sourceStore,
        destinationStore: input.destinationStore,
      });
      tasks.push(result);
      input.onProgress?.({ type: "task_completed", position: index + 1, total: selected.length, ...result });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push({ taskId: selection.task.id, error: message });
      input.onProgress?.({ type: "task_failed", position: index + 1, total: selected.length, taskId: selection.task.id, error: message });
      if (!input.continueOnError) throw error;
    }
  }
  return {
    mode: input.destinationStore ? "publish" : "plan",
    submissions: input.allCatalogHarborTasks ? "all_catalog_visible_harbor_submissions" : input.submissionIds,
    selectedTaskCount: selected.length,
    completedTaskCount: tasks.length,
    failedTaskCount: errors.length,
    fileCount: tasks.reduce((sum, task) => sum + task.fileCount, 0),
    sizeBytes: tasks.reduce((sum, task) => sum + task.sizeBytes, 0),
    tasks,
    errors,
  };
}

async function prepareAndMaybePublishTask(input: {
  vendor: SampleCatalogVendor;
  submission: SampleCatalogSubmission;
  task: SampleCatalogTask;
  repository: RegistryRepository;
  sourceStore: ArtifactStore;
  destinationStore?: ArtifactStore;
}): Promise<{ taskId: string; prefix: string; fileCount: number; sizeBytes: number; status: "planned" | "published" | "unchanged" }> {
  const { vendor, submission, task } = input;
  if (!task.sourcePath) throw new Error(`Harbor task has no source path: ${task.id}`);
  const candidates = await artifactCandidates(input.repository, submission, task);

  const temporary = await mkdtemp(join(tmpdir(), "case-harbor-export-"));
  try {
    let selected: { artifact: ArtifactInput; taskRoot: string } | undefined;
    const failures: string[] = [];
    for (const [index, artifact] of candidates.entries()) {
      const candidateDirectory = join(temporary, `candidate-${index}`);
      const archivePath = join(candidateDirectory, "artifact");
      const extractedPath = join(candidateDirectory, "extracted");
      try {
        await mkdir(candidateDirectory, { recursive: true });
        await input.sourceStore.downloadFile({
          key: artifact.storageKey,
          path: archivePath,
          sha256: artifact.sha256,
          sizeBytes: artifact.sizeBytes,
        });
        await extractArtifact(artifact, archivePath, extractedPath);
        selected = { artifact, taskRoot: await findHarborTaskRoot(extractedPath, task.sourcePath) };
        break;
      } catch (error) {
        failures.push(`${artifact.id}: ${error instanceof Error ? error.message : String(error)}`);
        await rm(candidateDirectory, { recursive: true, force: true });
      }
    }
    if (!selected) throw new Error(`No linked artifact resolved task ${task.id}: ${failures.join("; ")}`);
    const prefix = taskExportPrefix(vendor.id, submission.id, task.sourcePath);
    const files = await harborTaskFiles(selected.taskRoot, prefix);
    if (!files.some((file) => file.relativePath === "task.toml")) throw new Error(`Task root has no task.toml: ${task.id}`);
    const sizeBytes = files.reduce((sum, file) => sum + file.sizeBytes, 0);
    let status: "planned" | "published" | "unchanged" = "planned";
    if (input.destinationStore) status = await publishTaskFiles(input.destinationStore, files, prefix, selected.artifact.sha256);
    return { taskId: task.id, prefix, fileCount: files.length, sizeBytes, status };
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

async function artifactCandidates(
  repository: RegistryRepository,
  submission: SampleCatalogSubmission,
  task: SampleCatalogTask,
): Promise<ArtifactInput[]> {
  if (task.artifactId) {
    const artifact = await repository.getArtifact(task.artifactId);
    if (!artifact) throw new Error(`Task artifact not found: ${task.artifactId}`);
    if (!artifact.sizeBytes) throw new Error(`Task artifact has no recorded size: ${task.artifactId}`);
    if (task.contentSha256 && task.contentSha256 !== artifact.sha256) {
      throw new Error(`Task and artifact hashes differ for ${task.id}`);
    }
    return [artifact];
  }

  const sourceItems = new Map<string, SampleCatalogSourceItem>();
  for (const event of submission.sourceEvents) for (const item of event.items) sourceItems.set(item.id, item);
  const taskName = taskExportName(task.sourcePath);
  const rankedByArtifact = new Map<string, { item: SampleCatalogSourceItem; score: number }>();
  for (const sourceItemId of task.sourceItemIds) {
    const item = sourceItems.get(sourceItemId);
    if (!item?.artifactId) continue;
    const score = archiveStem(item.displayName).toLowerCase() === taskName.toLowerCase() ? 1 : 0;
    const previous = rankedByArtifact.get(item.artifactId);
    if (!previous || score > previous.score) rankedByArtifact.set(item.artifactId, { item, score });
  }
  if (!rankedByArtifact.size) throw new Error(`Harbor task has no immutable task or linked source artifact: ${task.id}`);
  const ranked = [...rankedByArtifact.entries()].sort((left, right) =>
    right[1].score - left[1].score
    || (left[1].item.sizeBytes ?? Number.MAX_SAFE_INTEGER) - (right[1].item.sizeBytes ?? Number.MAX_SAFE_INTEGER)
    || left[0].localeCompare(right[0]));
  const selectedIds = ranked.length === 1 || ranked[0]![1].score > ranked[1]![1].score
    ? [ranked[0]![0]]
    : ranked.map(([artifactId]) => artifactId);
  const artifacts = await Promise.all(selectedIds.map(async (artifactId) => {
    const artifact = await repository.getArtifact(artifactId);
    if (!artifact) throw new Error(`Linked source artifact not found: ${artifactId}`);
    if (!artifact.sizeBytes) throw new Error(`Linked source artifact has no recorded size: ${artifactId}`);
    return artifact;
  }));
  return artifacts;
}

async function main(): Promise<void> {
  const [command, ...submissionIds] = process.argv.slice(2);
  const all = command === "plan-all" || command === "publish-all";
  const publish = command === "publish" || command === "publish-all";
  if ((!all && command !== "plan" && command !== "publish") || (!all && submissionIds.length === 0) || (all && submissionIds.length > 0)) {
    fail("Usage: case-harbor-export plan|publish <submission-id> [submission-id ...] | plan-all | publish-all");
  }
  const repository = await openLocalRepository();
  try {
    const result = await exportSubmissions({
      repository,
      sourceStore: localArtifactStore(),
      destinationStore: publish ? localHarborTaskStore() : undefined,
      submissionIds,
      allCatalogHarborTasks: all,
      continueOnError: all,
      onProgress: all ? (event) => process.stderr.write(`${JSON.stringify(event)}\n`) : undefined,
    });
    if (all) {
      const { tasks, ...summary } = result as { tasks: unknown[]; [key: string]: unknown };
      process.stdout.write(`${JSON.stringify({ ...summary, statusCounts: countStatuses(tasks) }, null, 2)}\n`);
      if (typeof summary.failedTaskCount === "number" && summary.failedTaskCount > 0) process.exitCode = 2;
    } else {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    }
  } finally {
    await repository.close();
  }
}

async function extractArtifact(artifact: ArtifactInput, archivePath: string, extractedPath: string): Promise<void> {
  const originalName = typeof artifact.metadata?.originalName === "string" ? artifact.metadata.originalName.toLowerCase() : "";
  const isZip = artifact.contentType === "application/zip" || originalName.endsWith(".zip");
  const isTar = artifact.contentType === "application/gzip"
    || artifact.contentType === "application/x-tar"
    || originalName.endsWith(".tar.gz")
    || originalName.endsWith(".tgz")
    || originalName.endsWith(".tar");
  if (!isZip && !isTar) throw new Error(`Unsupported task artifact archive format: ${artifact.contentType ?? originalName}`);
  let stdout: string;
  try {
    const result = await execute("python3", [taskPackageScript, isZip ? "extract-zip" : "extract-tar", archivePath, extractedPath], {
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
    });
    stdout = result.stdout;
  } catch (error) {
    const output = typeof error === "object" && error && "stdout" in error && typeof error.stdout === "string"
      ? error.stdout
      : "";
    let report: { error?: string } | undefined;
    try {
      report = JSON.parse(output) as { error?: string };
    } catch {}
    if (report?.error) throw new Error(report.error);
    throw error;
  }
  const report = JSON.parse(stdout) as { safe?: boolean; error?: string };
  if (!report.safe) throw new Error(report.error || "Task artifact extraction was rejected");
}

export async function findHarborTaskRoot(extractedRoot: string, sourcePath: string): Promise<string> {
  const taskFiles = await findNamedFiles(extractedRoot, "task.toml");
  if (taskFiles.length === 0) throw new Error("Task artifact contains no task.toml");
  if (taskFiles.length === 1) return dirname(taskFiles[0]!);
  const sourceParts = portableParts(sourcePath);
  const ranked = taskFiles.map((path) => {
    const candidate = dirname(path);
    const candidateParts = portableParts(relative(extractedRoot, candidate));
    let suffixScore = 0;
    while (
      suffixScore < sourceParts.length
      && suffixScore < candidateParts.length
      && sourceParts[sourceParts.length - 1 - suffixScore] === candidateParts[candidateParts.length - 1 - suffixScore]
    ) suffixScore += 1;
    return { candidate, suffixScore };
  }).sort((left, right) => right.suffixScore - left.suffixScore || left.candidate.localeCompare(right.candidate));
  if (ranked[0]!.suffixScore > 0 && ranked[0]!.suffixScore > ranked[1]!.suffixScore) return ranked[0]!.candidate;
  throw new Error(`Task artifact root is ambiguous for source path ${sourcePath}`);
}

export function taskExportPrefix(vendorId: string, submissionId: string, sourcePath: string | null): string {
  const taskName = taskExportName(sourcePath);
  return [safeComponent(vendorId, "vendor"), safeComponent(submissionId, "submission"), safeComponent(taskName, "task")].join("/");
}

function taskExportName(sourcePath: string | null): string {
  if (!sourcePath) throw new Error("A Harbor task source path is required for export");
  const parts = portableParts(sourcePath);
  if (!parts.length) throw new Error("A Harbor task source path is empty");
  let taskName = parts.at(-1)!;
  if (genericTaskNames.has(taskName.toLowerCase()) && parts.length > 1) taskName = parts.at(-2)!;
  return taskName;
}

export async function harborTaskFiles(taskRoot: string, prefix: string): Promise<HarborExportFile[]> {
  const paths = await regularFiles(taskRoot);
  const files = await mapLimit(paths, 24, async (path) => {
    const details = await lstat(path);
    const relativePath = relative(taskRoot, path).split(sep).join("/");
    return {
      relativePath,
      path,
      key: `${prefix}/${relativePath}`,
      sha256: await sha256File(path),
      sizeBytes: details.size,
      mode: details.mode & 0o777,
    };
  });
  return files.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

export async function publishTaskFiles(store: ArtifactStore, files: HarborExportFile[], prefix: string, artifactSha256: string): Promise<"published" | "unchanged"> {
  const marker = files.find((file) => file.relativePath === "task.toml");
  if (!marker) throw new Error(`Cannot publish a task without task.toml: ${prefix}`);
  const expectedKeys = new Set(files.map((file) => file.key));
  const existingKeys = await store.listKeys(`${prefix}/`);
  const unexpected = existingKeys.filter((key) => !expectedKeys.has(key));
  if (unexpected.length) throw new Error(`Export prefix contains unexpected objects: ${unexpected.slice(0, 5).join(", ")}`);

  const markerMetadata = await store.objectMetadata(marker.key);
  if (markerMetadata) {
    if (existingKeys.length !== files.length) throw new Error(`Published task is incomplete and cannot be overwritten: ${prefix}`);
    await mapLimit(files, 24, (file) => assertExistingFile(store, file));
    return "unchanged";
  }

  await mapLimit(files.filter((candidate) => candidate.relativePath !== "task.toml"), 12, async (file) => {
    const existing = await store.objectMetadata(file.key);
    if (existing) {
      assertMetadata(file, existing);
      return;
    }
    await store.putFile({
      key: file.key,
      path: file.path,
      contentType: contentTypeFor(file.relativePath),
      sha256: file.sha256,
      sizeBytes: file.sizeBytes,
      metadata: { mode: file.mode.toString(8), "task-artifact-sha256": artifactSha256 },
    });
  });
  await store.putFile({
    key: marker.key,
    path: marker.path,
    contentType: "application/toml",
    sha256: marker.sha256,
    sizeBytes: marker.sizeBytes,
    metadata: { mode: marker.mode.toString(8), "task-artifact-sha256": artifactSha256 },
  });
  return "published";
}

async function assertExistingFile(store: ArtifactStore, file: HarborExportFile): Promise<void> {
  const metadata = await store.objectMetadata(file.key);
  if (!metadata) throw new Error(`Published task is missing ${file.key}`);
  assertMetadata(file, metadata);
}

function assertMetadata(file: HarborExportFile, metadata: { sha256: string | null; sizeBytes: number | null }): void {
  if (metadata.sha256 !== file.sha256 || metadata.sizeBytes !== file.sizeBytes) {
    throw new Error(`Existing export object differs from the immutable task file: ${file.key}`);
  }
}

async function findNamedFiles(root: string, name: string): Promise<string[]> {
  return (await regularFiles(root)).filter((path) => basename(path) === name);
}

async function regularFiles(root: string): Promise<string[]> {
  const files: string[] = [];
  const visit = async (directory: string): Promise<void> => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile()) files.push(path);
      else throw new Error(`Extracted task contains a link, device, or special file: ${path}`);
    }
  };
  await visit(root);
  return files.sort();
}

function portableParts(value: string): string[] {
  return value.replace(/\\/g, "/").split("/").filter((part) => part && part !== ".");
}

function safeComponent(value: string, label: string): string {
  const component = value.trim();
  if (!component || component === "." || component === ".." || component.includes("/") || component.includes("\\") || /[\u0000-\u001f\u007f]/.test(component)) {
    throw new Error(`Invalid ${label} export path component: ${JSON.stringify(value)}`);
  }
  return component;
}

function archiveStem(value: string): string {
  const lower = value.toLowerCase();
  for (const suffix of [".tar.gz", ".tgz", ".zip", ".tar", ".gz"]) {
    if (lower.endsWith(suffix)) return value.slice(0, -suffix.length);
  }
  return value;
}

async function sha256File(path: string): Promise<string> {
  const hash = createHash("sha256");
  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(path);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", resolve);
  });
  return hash.digest("hex");
}

async function mapLimit<T, R>(values: T[], limit: number, operation: (value: T, index: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(values.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, values.length) }, async () => {
    while (true) {
      const index = next++;
      if (index >= values.length) return;
      results[index] = await operation(values[index]!, index);
    }
  });
  await Promise.all(workers);
  return results;
}

function countStatuses(tasks: unknown[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const task of tasks) {
    const status = task && typeof task === "object" && "status" in task ? String(task.status) : "unknown";
    counts[status] = (counts[status] ?? 0) + 1;
  }
  return counts;
}

function fail(message: string): never {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}
