import type { CatalogSourceEvent, CatalogVendor } from "./catalog";
import { displayArchivePath } from "./archive-path";

export type DatasetSubmission = {
  id: string;
  date: string;
  label: string;
  source: string;
  formats: string[];
  sourceEvents?: CatalogSourceEvent[];
  tasks: Array<{
    id: string;
    stableKey: string;
    title: string;
    summary: string | null;
    kind: "task" | "trace";
    format: "harbor" | "non_harbor";
    benchmark: { id: string; displayName: string };
    gpuRequired: boolean;
    sourcePath: string | null;
    artifactId: string | null;
    contentSha256: string | null;
    checks: object;
    findings: Array<{ id: string; phase: string; checkRunId: string; finding: string }>;
  }>;
};

export type DatasetPackage = {
  taskId: string;
  stableKey: string;
  title: string;
  kind: "task" | "trace";
  format: "harbor" | "non_harbor";
  benchmark: { id: string; displayName: string };
  gpuRequired: boolean;
  sourcePath: string | null;
  artifactId: string;
  contentSha256: string | null;
  checks: object;
  findings: Array<{ id: string; phase: string; checkRunId: string; finding: string }>;
  packagePath: string;
};

export type PackageResolver = (task: DatasetPackage) => Promise<Response>;

export type VendorHarborDatasetTask = {
  taskId: string;
  stableKey: string;
  title: string;
  kind: "task";
  format: "harbor";
  benchmark: { id: string; displayName: string };
  gpuRequired: boolean;
  sourcePath: string;
  contentSha256: string | null;
  checks: object;
  findings: Array<{ id: string; phase: string; checkRunId: string; finding: string }>;
  submission: { id: string; date: string; label: string };
  bucketPrefix: string;
};

const encoder = new TextEncoder();

export function taskDatasetManifest(submission: DatasetSubmission) {
  const tasks = datasetPackages(submission);
  return {
    schemaVersion: "case.tasks.v1",
    submission: {
      id: submission.id,
      date: submission.date,
      label: submission.label,
      source: submission.source,
      formats: submission.formats,
    },
    selection: {
      kind: "all_available_task_artifacts",
      included: tasks.length,
      omittedWithoutExactArtifact: submission.tasks.filter((task) => !task.artifactId).length,
    },
    tasks,
  };
}

export function taskDatasetFilename(submission: DatasetSubmission): string {
  const label = safeFilenameSegment(submission.label, "case-submission");
  return `${label}-${submission.date}-tasks.tar`;
}

export function taskDatasetArchive(submission: DatasetSubmission, resolvePackage: PackageResolver): ReadableStream<Uint8Array> {
  const manifest = taskDatasetManifest(submission);
  const readme = `# CASE tasks\n\nThis archive contains the ${manifest.tasks.length} exact task or trace artifacts retained for the submission “${submission.label}”. See manifest.json for source identity, Harbor/non-Harbor format, the three Harbor checks when applicable, findings, and content hashes.\n`;
  return datasetArchiveStream(manifest.tasks, manifest, readme, resolvePackage);
}

export function vendorHarborDatasetManifest(vendor: CatalogVendor) {
  const tasks: VendorHarborDatasetTask[] = vendor.submissions.flatMap((submission) => submission.tasks
    .filter((task) => task.kind === "task" && task.format === "harbor")
    .map((task) => ({
      taskId: task.id,
      stableKey: task.stableKey,
      title: task.title,
      kind: "task" as const,
      format: "harbor" as const,
      benchmark: task.benchmark,
      gpuRequired: task.gpuRequired,
      sourcePath: displayArchivePath(requiredTaskSourcePath(task.sourcePath, task.id)),
      contentSha256: task.contentSha256,
      checks: task.checks,
      findings: task.findings,
      submission: { id: submission.id, date: submission.date, label: submission.label },
      bucketPrefix: harborTaskBucketPrefix(vendor.id, submission.id, task.sourcePath, task.id),
    })));
  return {
    schemaVersion: "case.vendor-harbor-task-files.v1",
    vendor: { id: vendor.id, name: vendor.name },
    selection: {
      kind: "all_active_vendor_harbor_tasks",
      source: "harbor-task-gateway",
      included: tasks.length,
    },
    tasks,
  };
}

export function vendorHarborDatasetFilename(vendor: CatalogVendor): string {
  return `${safeFilenameSegment(vendor.name, "case-vendor")}-harbor-tasks.tar`;
}

export function vendorHarborDatasetArchive(vendor: CatalogVendor, gatewayArchive: Response): ReadableStream<Uint8Array> {
  if (!gatewayArchive.ok || !gatewayArchive.body) throw new Error("Harbor task gateway returned no archive body");
  const manifest = vendorHarborDatasetManifest(vendor);
  return iteratorStream(vendorHarborDatasetChunks(manifest, gatewayArchive.body)[Symbol.asyncIterator]());
}

function datasetArchiveStream(tasks: DatasetPackage[], manifest: unknown, readme: string, resolvePackage: PackageResolver): ReadableStream<Uint8Array> {
  return iteratorStream(datasetArchiveChunks(tasks, manifest, readme, resolvePackage)[Symbol.asyncIterator]());
}

function iteratorStream(iterator: AsyncIterator<Uint8Array>): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const next = await iterator.next();
        if (next.done) controller.close();
        else controller.enqueue(next.value);
      } catch (error) {
        controller.error(error);
      }
    },
    async cancel() {
      await iterator.return?.();
    },
  });
}

export function tarBytes(entries: Array<{ path: string; bytes: Uint8Array; mode?: number }>): Uint8Array {
  const blocks: Uint8Array[] = [];
  for (const entry of entries) {
    blocks.push(tarHeader(entry.path, entry.bytes.length, entry.mode ?? 0o644));
    blocks.push(entry.bytes);
    const padding = tarPadding(entry.bytes.length);
    if (padding) blocks.push(new Uint8Array(padding));
  }
  blocks.push(new Uint8Array(1024));
  const result = new Uint8Array(blocks.reduce((sum, block) => sum + block.length, 0));
  let offset = 0;
  for (const block of blocks) {
    result.set(block, offset);
    offset += block.length;
  }
  return result;
}

async function* datasetArchiveChunks(tasks: DatasetPackage[], manifest: unknown, readme: string, resolvePackage: PackageResolver): AsyncGenerator<Uint8Array> {
  yield* inlineTarEntry("README.md", encoder.encode(readme));
  yield* inlineTarEntry("manifest.json", encoder.encode(`${JSON.stringify(manifest, null, 2)}\n`));

  for (const task of tasks) {
    const response = await resolvePackage(task);
    if (!response.ok || !response.body) throw new Error(`Task unavailable: ${task.taskId}`);
    const size = Number(response.headers.get("content-length"));
    if (!Number.isSafeInteger(size) || size < 0) throw new Error(`Task has no usable content length: ${task.taskId}`);

    yield tarHeader(task.packagePath, size, 0o644);
    const reader = response.body.getReader();
    let received = 0;
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        received += chunk.value.length;
        if (received > size) throw new Error(`Task exceeded its declared size: ${task.taskId}`);
        yield chunk.value;
      }
    } finally {
      reader.releaseLock();
    }
    if (received !== size) throw new Error(`Task was truncated: ${task.taskId}`);
    const padding = tarPadding(size);
    if (padding) yield new Uint8Array(padding);
  }

  yield new Uint8Array(1024);
}

async function* vendorHarborDatasetChunks(manifest: ReturnType<typeof vendorHarborDatasetManifest>, gatewayBody: ReadableStream<Uint8Array>): AsyncGenerator<Uint8Array> {
  yield* inlineTarEntry("manifest.json", encoder.encode(`${JSON.stringify(manifest, null, 2)}\n`));
  const reader = gatewayBody.getReader();
  let completed = false;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) {
        completed = true;
        break;
      }
      yield chunk.value;
    }
  } finally {
    if (!completed) await reader.cancel();
    reader.releaseLock();
  }
}

function datasetPackages(submission: DatasetSubmission): DatasetPackage[] {
  return submission.tasks
    .filter((task): task is typeof task & { artifactId: string } => Boolean(task.artifactId))
    .map((task, index) => datasetPackage(task, index + 1));
}

function datasetPackage(task: (DatasetSubmission["tasks"][number] | CatalogVendor["submissions"][number]["tasks"][number]) & { artifactId: string }, index: number): DatasetPackage {
  const slug = safePathSegment(task.stableKey || task.title, task.kind);
  return {
    taskId: task.id,
    stableKey: task.stableKey,
    title: task.title,
    kind: task.kind,
    format: task.format,
    benchmark: task.benchmark,
    gpuRequired: task.gpuRequired,
    sourcePath: task.sourcePath ? displayArchivePath(task.sourcePath) : null,
    artifactId: task.artifactId,
    contentSha256: task.contentSha256,
    checks: task.checks,
    findings: task.findings,
    packagePath: `tasks/${String(index).padStart(4, "0")}-${slug}.artifact`,
  };
}

function* inlineTarEntry(path: string, bytes: Uint8Array): Generator<Uint8Array> {
  yield tarHeader(path, bytes.length, 0o644);
  yield bytes;
  const padding = tarPadding(bytes.length);
  if (padding) yield new Uint8Array(padding);
}

function tarHeader(path: string, size: number, mode: number): Uint8Array {
  if (encoder.encode(path).length > 100) throw new Error(`Dataset path is too long: ${path}`);
  const header = new Uint8Array(512);
  const write = (value: string, offset: number, length: number) => header.set(encoder.encode(value).subarray(0, length), offset);
  const octal = (value: number, length: number) => value.toString(8).padStart(length - 1, "0") + "\0";

  write(path, 0, 100);
  write(octal(mode, 8), 100, 8);
  write(octal(0, 8), 108, 8);
  write(octal(0, 8), 116, 8);
  write(octal(size, 12), 124, 12);
  write(octal(0, 12), 136, 12);
  header.fill(0x20, 148, 156);
  write("0", 156, 1);
  write("ustar\0", 257, 6);
  write("00", 263, 2);
  write("case", 265, 32);
  write("case", 297, 32);
  const checksum = header.reduce((sum, byte) => sum + byte, 0);
  write(checksum.toString(8).padStart(6, "0") + "\0 ", 148, 8);
  return header;
}

function tarPadding(size: number): number {
  return (512 - (size % 512)) % 512;
}

function safePathSegment(value: string, fallback: string): string {
  return value.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 72) || fallback;
}

function safeFilenameSegment(value: string, fallback: string): string {
  return value.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || fallback;
}

function harborTaskBucketPrefix(vendorId: string, submissionId: string, sourcePath: string | null, taskId: string): string {
  const path = requiredTaskSourcePath(sourcePath, taskId).replace(/\\/g, "/");
  const parts = path.split("/").filter((part) => part && part !== ".");
  let taskName = parts.at(-1)!;
  if (["task", "payload"].includes(taskName.toLowerCase()) && parts.length > 1) taskName = parts.at(-2)!;
  return [bucketComponent(vendorId, "vendor"), bucketComponent(submissionId, "submission"), bucketComponent(taskName, "task")].join("/");
}

function requiredTaskSourcePath(sourcePath: string | null, taskId: string): string {
  if (!sourcePath) throw new Error(`Harbor task has no source path: ${taskId}`);
  return sourcePath;
}

function bucketComponent(value: string, label: string): string {
  const component = value.trim();
  if (!component || component === "." || component === ".." || component.includes("/") || component.includes("\\") || hasControlCharacter(component)) {
    throw new Error(`Invalid ${label} bucket path component`);
  }
  return component;
}

function hasControlCharacter(value: string): boolean {
  return [...value].some((character) => {
    const code = character.codePointAt(0)!;
    return code < 32 || code === 127;
  });
}
