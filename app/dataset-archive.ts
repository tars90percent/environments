export type DatasetSubmission = {
  id: string;
  date: string;
  label: string;
  source: string;
  formats: string[];
  categories: Array<{
    id: string;
    name: string;
    tasks: Array<{
      id: string;
      stableKey: string;
      title: string;
      sourcePath: string | null;
      format: string;
      artifactId: string | null;
      contentSha256: string | null;
      workflowStatus: string;
      checks: { pass: number; fail: number; blocked: number; notRun: number };
    }>;
  }>;
};

export type DatasetPackage = {
  taskVersionId: string;
  stableKey: string;
  title: string;
  category: { id: string; name: string };
  format: string;
  sourcePath: string | null;
  artifactId: string;
  contentSha256: string | null;
  workflowStatus: string;
  checks: { pass: number; fail: number; blocked: number; notRun: number };
  packagePath: string;
};

export type PackageResolver = (task: DatasetPackage) => Promise<Response>;

const encoder = new TextEncoder();

export function taskDatasetManifest(submission: DatasetSubmission) {
  const tasks = datasetPackages(submission);
  return {
    schemaVersion: "case.task-dataset.v1",
    submission: {
      id: submission.id,
      date: submission.date,
      label: submission.label,
      source: submission.source,
      formats: submission.formats,
    },
    selection: {
      kind: "all_available_task_packages",
      included: tasks.length,
      omittedWithoutExactArtifact: submission.categories.reduce((total, category) => total + category.tasks.filter((task) => !task.artifactId).length, 0),
      statusPolicy: "all_statuses_included",
    },
    tasks,
  };
}

export function taskDatasetFilename(submission: DatasetSubmission): string {
  const label = submission.label.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "case-submission";
  return `${label}-${submission.date}-task-dataset.tar`;
}

export function taskDatasetArchive(submission: DatasetSubmission, resolvePackage: PackageResolver): ReadableStream<Uint8Array> {
  const iterator = taskDatasetChunks(submission, resolvePackage)[Symbol.asyncIterator]();
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

async function* taskDatasetChunks(submission: DatasetSubmission, resolvePackage: PackageResolver): AsyncGenerator<Uint8Array> {
  const manifest = taskDatasetManifest(submission);
  const tasks = manifest.tasks;
  const readme = `# CASE task dataset\n\nThis archive contains all ${tasks.length} exact task packages retained for the submission “${submission.label}”.\n\nPackages are included regardless of workflow status so researchers can inspect ready, checking, blocked, or needs-fix material. Each file under tasks/ is the original immutable task-package archive. See manifest.json for task identity, status, checks, and content hash.\n`;

  yield* inlineTarEntry("README.md", encoder.encode(readme));
  yield* inlineTarEntry("manifest.json", encoder.encode(`${JSON.stringify(manifest, null, 2)}\n`));

  for (const task of tasks) {
    const response = await resolvePackage(task);
    if (!response.ok || !response.body) throw new Error(`Task package unavailable: ${task.taskVersionId}`);
    const size = Number(response.headers.get("content-length"));
    if (!Number.isSafeInteger(size) || size < 0) throw new Error(`Task package has no usable content length: ${task.taskVersionId}`);

    yield tarHeader(task.packagePath, size, 0o644);
    const reader = response.body.getReader();
    let received = 0;
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        received += chunk.value.length;
        if (received > size) throw new Error(`Task package exceeded its declared size: ${task.taskVersionId}`);
        yield chunk.value;
      }
    } finally {
      reader.releaseLock();
    }
    if (received !== size) throw new Error(`Task package was truncated: ${task.taskVersionId}`);
    const padding = tarPadding(size);
    if (padding) yield new Uint8Array(padding);
  }

  yield new Uint8Array(1024);
}

function datasetPackages(submission: DatasetSubmission): DatasetPackage[] {
  let index = 0;
  return submission.categories.flatMap((category) => category.tasks
    .filter((task): task is typeof task & { artifactId: string } => Boolean(task.artifactId))
    .map((task) => {
      index += 1;
      const slug = safePathSegment(task.stableKey || task.title, "task");
      return {
        taskVersionId: task.id,
        stableKey: task.stableKey,
        title: task.title,
        category: { id: category.id, name: category.name },
        format: task.format,
        sourcePath: task.sourcePath,
        artifactId: task.artifactId,
        contentSha256: task.contentSha256,
        workflowStatus: task.workflowStatus,
        checks: task.checks,
        packagePath: `tasks/${String(index).padStart(4, "0")}-${slug}.tar.gz`,
      };
    }));
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
