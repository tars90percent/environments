#!/usr/bin/env node

import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { readFile, stat, unlink } from "node:fs/promises";
import { basename } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { contentTypeFor, storeSourcePayload } from "./capture-runtime.js";
import {
  pruneSubmissionHarborTasks,
  publishSubmissionHarborTasks,
  reconcileTaskSetWithHarborPublication,
  registerTaskSetWithHarborPublication,
} from "./harbor-publication.js";
import { classifyHarborTaskRegistrations } from "./harbor-export-cli.js";
import type { ArtifactStore } from "./registry/artifacts.js";
import { localArtifactStore, openLocalRepository } from "./registry/local.js";
import type { RegistryRepository } from "./registry/repository.js";
import {
  parseAssignTaskBenchmarks,
  parseAssignTaskGpuRequirements,
  parseAppendTasks,
  parseArtifact,
  parseHarborCheckAttempt,
  parseHarborCheckResult,
  parseHarborFinding,
  parsePurgeErroneousBenchmarks,
  parseRegisterBenchmark,
  parseReconcileHarborWorkItems,
  parseRemoveUnusedBenchmarks,
  parseReconcileSubmissionSourceItems,
  parseReconcileSubmissionTasks,
  parseSourceEnvelope,
  parseSubmissionIntakeClassification,
  parseSubmissionManifest,
  parseSubmissionRemoval,
  parseUpdateBenchmark,
  parseVendorArchive,
  parseVendorInteractionDelete,
  parseVendorInteraction,
  parseVendorInteractionUpdate,
  parseVendorTimelineCreate,
  parseVendorTimelineDelete,
  parseWorkCompletion,
} from "./registry/validation.js";

const [command, ...arguments_] = process.argv.slice(2);
const argument = arguments_[0];

if (command === "operations") {
  output(operationSchemas());
} else {
  const repository = await openLocalRepository();
  try {
    switch (command) {
      case "summary":
        output(await repository.operationsSummary());
        break;
      case "catalog":
        output(await repository.sampleCatalogSnapshot());
        break;
      case "vendors":
        if (arguments_.length > 1 || (argument && argument !== "--all")) fail("Usage: casectl registry vendors [--all]");
        output(await repository.vendorDirectory(argument === "--all"));
        break;
      case "create-vendor-timeline":
        output(await repository.createVendorTimeline(parseVendorTimelineCreate(await jsonFile(argument))));
        break;
      case "vendor-timeline": {
        const vendorId = required(argument, "vendor id");
        const timeline = await repository.getVendorTimeline(vendorId);
        if (!timeline) fail(`Vendor timeline not found: ${vendorId}`);
        output(timeline);
        break;
      }
      case "vendor-timeline-history":
        output(await repository.getVendorTimelineHistory(required(argument, "vendor id")));
        break;
      case "vendor-interaction": {
        const interactionId = required(argument, "vendor interaction id");
        const interaction = await repository.getVendorInteraction(interactionId);
        if (!interaction) fail(`Vendor interaction not found: ${interactionId}`);
        output(interaction);
        break;
      }
      case "record-vendor-interaction":
        output(await repository.recordVendorInteraction(parseVendorInteraction(await jsonFile(argument))));
        break;
      case "update-vendor-interaction":
        output(await repository.updateVendorInteraction(parseVendorInteractionUpdate(await jsonFile(argument))));
        break;
      case "delete-vendor-interaction":
        output(await repository.deleteVendorInteraction(parseVendorInteractionDelete(await jsonFile(argument))));
        break;
      case "delete-vendor-timeline":
        output(await repository.deleteVendorTimeline(parseVendorTimelineDelete(await jsonFile(argument))));
        break;
      case "vendor": {
        const vendorId = required(argument, "vendor id");
        const vendor = (await repository.sampleCatalogSnapshot()).vendors.find((candidate) => candidate.id === vendorId);
        if (!vendor) fail(`Vendor not found: ${vendorId}`);
        output(vendor);
        break;
      }
      case "submission": {
        const submissionId = required(argument, "submission id");
        const submission = await repository.getSampleSubmission(submissionId);
        if (!submission) fail(`Submission not found: ${submissionId}`);
        output(submission);
        break;
      }
      case "task": {
        const taskId = required(argument, "task id");
        const task = await repository.getSampleTask(taskId);
        if (!task) fail(`Task not found: ${taskId}`);
        output(task);
        break;
      }
      case "source-event": {
        const sourceEventId = required(argument, "source event id");
        const sourceEvent = await repository.getSourceEvent(sourceEventId);
        if (!sourceEvent) fail(`Source event not found: ${sourceEventId}`);
        output(sourceEvent);
        break;
      }
      case "benchmarks":
        output(await repository.listBenchmarks());
        break;
      case "register-benchmark":
        output(await repository.registerBenchmark(parseRegisterBenchmark(await jsonFile(argument))));
        break;
      case "update-benchmark":
        output(await repository.updateBenchmark(parseUpdateBenchmark(await jsonFile(argument))));
        break;
      case "remove-unused-benchmarks":
        output(await repository.removeUnusedBenchmarks(parseRemoveUnusedBenchmarks(await jsonFile(argument))));
        break;
      case "purge-erroneous-benchmarks":
        output(await repository.purgeErroneousBenchmarks(parsePurgeErroneousBenchmarks(await jsonFile(argument))));
        break;
      case "assign-task-benchmarks":
        output(await repository.assignTaskBenchmarks(parseAssignTaskBenchmarks(await jsonFile(argument))));
        break;
      case "assign-task-gpu-requirements":
        output(await repository.assignTaskGpuRequirements(parseAssignTaskGpuRequirements(await jsonFile(argument))));
        break;
      case "import":
        output(await repository.ingestSubmission(parseSubmissionManifest(await jsonFile(argument))));
        break;
      case "import-source":
        output(await repository.ingestSourceEnvelope(parseSourceEnvelope(await jsonFile(argument))));
        break;
      case "reconcile-submission-source-items":
        output(await repository.reconcileSubmissionSourceItems(parseReconcileSubmissionSourceItems(await jsonFile(argument))));
        break;
      case "append-tasks": {
        const registration = parseAppendTasks(await jsonFile(argument));
        output(await registerTaskSetWithHarborPublication({
          registration,
          classify: () => classifyHarborTaskRegistrations({ repository, sourceStore: localArtifactStore(), tasks: registration.tasks }),
          register: (classifiedRegistration) => repository.appendTasks(classifiedRegistration),
          publish: (submissionId) => publishSubmissionHarborTasks(repository, submissionId),
        }));
        break;
      }
      case "reconcile-submission-tasks": {
        const registration = parseReconcileSubmissionTasks(await jsonFile(argument));
        output(await reconcileTaskSetWithHarborPublication({
          registration,
          classify: () => classifyHarborTaskRegistrations({ repository, sourceStore: localArtifactStore(), tasks: registration.tasks }),
          register: (classifiedRegistration) => repository.reconcileSubmissionTasks(classifiedRegistration),
          publish: (submissionId) => publishSubmissionHarborTasks(repository, submissionId),
          prune: (submissionId) => pruneSubmissionHarborTasks(repository, submissionId),
        }));
        break;
      }
      case "classify-submission":
        output(await repository.classifySubmissionIntake(parseSubmissionIntakeClassification(await jsonFile(argument))));
        break;
      case "archive-vendor":
        output(await repository.archiveVendor(parseVendorArchive(await jsonFile(argument))));
        break;
      case "restore-vendor":
        output(await repository.restoreVendor(parseVendorArchive(await jsonFile(argument))));
        break;
      case "store-file":
        output(await storeFile(repository, required(argument, "artifact kind"), required(arguments_[1], "file path")));
        break;
      case "download-artifact":
        output(await downloadArtifact(repository, required(argument, "artifact id"), required(arguments_[1], "output path")));
        break;
      case "record-harbor-check":
        await repository.recordHarborCheck(parseHarborCheckResult(await jsonFile(argument)));
        output({ recorded: true });
        break;
      case "record-harbor-attempt":
        await repository.recordHarborAttempt(parseHarborCheckAttempt(await jsonFile(argument)));
        output({ recorded: true });
        break;
      case "record-harbor-finding":
        output(await repository.recordHarborFinding(parseHarborFinding(await jsonFile(argument))));
        break;
      case "register-artifact": {
        const artifact = parseArtifact(await jsonFile(argument));
        const store = localArtifactStore();
        await store.verifyObject({ key: artifact.storageKey, sha256: artifact.sha256, sizeBytes: artifact.sizeBytes });
        await repository.registerArtifact(artifact);
        output({ recorded: true });
        break;
      }
      case "remove-submission":
        output(await removeSubmission(repository, parseSubmissionRemoval(await jsonFile(argument))));
        break;
      case "delete-artifact":
        output(await purgeArtifact(repository, localArtifactStore(), required(argument, "artifact id")));
        break;
      case "lease-work":
        output({ item: await repository.leaseWorkItem(required(argument, "worker id"), 900) });
        break;
      case "complete-work":
        await repository.completeWorkItem(parseWorkCompletion(await jsonFile(argument)));
        output({ updated: true });
        break;
      case "reconcile-harbor-work-items":
        output(await repository.reconcileHarborWorkItems(parseReconcileHarborWorkItems(await jsonFile(argument))));
        break;
      default:
        fail("Usage: casectl registry operations|summary|catalog|vendors|create-vendor-timeline|vendor-timeline|vendor-timeline-history|record-vendor-interaction|vendor-interaction|update-vendor-interaction|delete-vendor-interaction|delete-vendor-timeline|vendor|submission|task|source-event|benchmarks|register-benchmark|update-benchmark|remove-unused-benchmarks|purge-erroneous-benchmarks|assign-task-benchmarks|assign-task-gpu-requirements|import|import-source|reconcile-submission-source-items|append-tasks|reconcile-submission-tasks|classify-submission|archive-vendor|restore-vendor|store-file|download-artifact|record-harbor-check|record-harbor-attempt|record-harbor-finding|register-artifact|remove-submission|delete-artifact|lease-work|complete-work|reconcile-harbor-work-items [arguments]");
    }
  } finally {
    await repository.close();
  }
}

async function storeFile(repository: RegistryRepository, kind: string, path: string): Promise<unknown> {
  const sourceArtifact = await storeSourcePayload(localArtifactStore(), path, {
    filename: basename(path),
    contentType: contentTypeFor(path),
    metadata: { source: "case_registry_cli" },
  });
  const artifact = parseArtifact({ ...sourceArtifact, kind });
  await repository.registerArtifact(artifact);
  return artifact;
}

async function downloadArtifact(repository: RegistryRepository, artifactId: string, path: string): Promise<unknown> {
  const expectedSha256 = artifactId.startsWith("artifact:sha256:") ? artifactId.slice("artifact:sha256:".length) : "";
  if (!/^[a-f0-9]{64}$/.test(expectedSha256)) fail("artifact id must be content-addressed with SHA-256");
  const artifact = await repository.getArtifact(artifactId);
  if (!artifact) fail(`Artifact not found: ${artifactId}`);
  const originalName = typeof artifact.metadata?.originalName === "string" ? artifact.metadata.originalName : undefined;
  const download = await localArtifactStore().createDownloadUrl(artifact.storageKey, originalName);
  try {
    const response = await fetch(download.url);
    if (!response.ok || !response.body) throw new Error(`Artifact download failed with ${response.status}`);
    await pipeline(Readable.fromWeb(response.body as never), createWriteStream(path, { flags: "wx", mode: 0o600 }));
    const sha256 = await sha256File(path);
    if (sha256 !== expectedSha256) throw new Error(`Artifact checksum mismatch: expected ${expectedSha256}, received ${sha256}`);
    const fileStat = await stat(path);
    return { artifactId, path, sha256, sizeBytes: fileStat.size };
  } catch (error) {
    await unlink(path).catch(() => undefined);
    throw error;
  }
}

async function removeSubmission(repository: RegistryRepository, input: ReturnType<typeof parseSubmissionRemoval>): Promise<unknown> {
  const store = localArtifactStore();
  const removed = await repository.removeSubmission(input);
  const artifacts = [];
  for (const candidate of removed.unreferencedArtifacts) {
    artifacts.push(await purgeArtifact(repository, store, candidate.id));
  }
  return { ...removed, unreferencedArtifacts: undefined, artifacts };
}

async function purgeArtifact(repository: RegistryRepository, store: ArtifactStore, id: string): Promise<unknown> {
  const artifact = await repository.unregisterArtifactIfUnreferenced(id);
  if (!artifact) return { artifactId: id, deleted: false, reason: "not_found_or_referenced" };
  try {
    await store.deleteObject(artifact.storageKey);
    return { artifactId: id, deleted: true, sizeBytes: artifact.sizeBytes ?? null };
  } catch (error) {
    await repository.registerArtifact(artifact);
    throw error;
  }
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

async function jsonFile(path: string | undefined): Promise<unknown> {
  if (!path) fail("A JSON file path is required");
  if (path === "-") {
    let payload = "";
    for await (const chunk of process.stdin) payload += String(chunk);
    return JSON.parse(payload);
  }
  return JSON.parse(await readFile(path, "utf8"));
}

function required(value: string | undefined, name: string): string {
  if (!value?.trim()) fail(`${name} is required`);
  return value.trim();
}

function output(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function fail(message: string): never {
  throw new Error(message);
}

function operationSchemas() {
  return {
  connection: {
    database: "DATABASE_URL",
    objectStore: ["AWS_ENDPOINT_URL", "AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_S3_BUCKET_NAME"],
    note: "Trusted CASE commands call the registry library directly; no registry URL or admin token is used.",
  },
  commands: {
    operations: { arguments: [], result: "this command reference" },
    summary: { arguments: [], result: "registry counts" },
    catalog: { arguments: [], result: "researcher-facing sample catalog" },
    vendors: { arguments: ["[--all]"], result: "vendor directory" },
    "create-vendor-timeline": {
      arguments: ["<timeline.json>"],
      fields: ["vendorId", "actor"],
      note: "Creates an explicit empty timeline for an existing vendor. Recording the first interaction also creates one automatically.",
    },
    "vendor-timeline": { arguments: ["<vendor-id>"], result: "active timeline, entries, and audit history" },
    "vendor-timeline-history": { arguments: ["<vendor-id>"], result: "timeline audit history, including deleted timelines and entries" },
    "vendor-interaction": { arguments: ["<interaction-id>"], result: "one active timeline entry" },
    "record-vendor-interaction": {
      arguments: ["<interaction.json>"],
      fields: ["id", "vendorId", "kind", "eventType", "title", "summary", "channel", "evidence", "visibility", "occurredAt", "sourceEventIds", "submissionIds", "actor"],
      kinds: ["contact", "sample", "evaluation", "commercial", "delivery", "acceptance", "payment", "relationship", "note"],
      channels: ["meeting", "email", "feishu", "slack", "wechat", "file_delivery", "internal", "other"],
      evidence: ["direct", "relayed", "automated", "internal"],
      visibility: ["portal", "internal"],
      note: "Creates an active timeline entry and creates the vendor timeline automatically when needed.",
    },
    "update-vendor-interaction": {
      arguments: ["<update.json>"],
      fields: ["id", "changes{kind?,eventType?,title?,summary?,channel?,evidence?,visibility?,occurredAt?,sourceEventIds?,submissionIds?}", "reason", "actor"],
      note: "Updates the active entry and retains its before/after values in the timeline audit history.",
    },
    "delete-vendor-interaction": {
      arguments: ["<deletion.json>"],
      fields: ["id", "reason", "actor"],
      note: "Removes the entry from the active timeline and retains the deleted value in audit history.",
    },
    "delete-vendor-timeline": {
      arguments: ["<deletion.json>"],
      fields: ["vendorId", "reason", "actor"],
      note: "Deletes the active timeline and its entries while retaining a complete audit snapshot. The vendor record is not deleted.",
    },
    vendor: { arguments: ["<vendor-id>"] },
    submission: { arguments: ["<submission-id>"] },
    task: { arguments: ["<task-id>"] },
    "source-event": { arguments: ["<source-event-id>"] },
    benchmarks: { arguments: [], result: "registered general benchmark directions" },
    "register-benchmark": { arguments: ["<benchmark.json>"], fields: ["id", "displayName", "aliases?", "actor"] },
    "update-benchmark": {
      arguments: ["<update.json>"],
      fields: ["id", "displayName", "aliases?", "reason", "actor"],
      note: "Updates a benchmark label and aliases in place, retaining assignments and recording an audited before/after event.",
    },
    "remove-unused-benchmarks": {
      arguments: ["<removal.json>"],
      fields: ["benchmarkIds"],
      note: "Atomically deletes benchmark definitions and their registration events only when no current or historical task version or benchmark assignment references any requested benchmark.",
    },
    "purge-erroneous-benchmarks": {
      arguments: ["<purge.json>"],
      fields: ["benchmarkIds", "reason", "actor"],
      note: "Deletes explicitly confirmed erroneous non-current assignment history and now-unused benchmark definitions; refuses current assignments and task-version compatibility references and records a purge event.",
    },
    "assign-task-benchmarks": {
      arguments: ["<assignments.json>"],
      fields: ["submissionId", "assignments[{taskId,benchmarkId}]", "reason", "actor"],
      note: "Appends audited benchmark assignments without replacing task versions or disturbing Harbor evidence.",
    },
    "assign-task-gpu-requirements": {
      arguments: ["<assignments.json>"],
      fields: ["submissionId", "assignments[{taskId,gpuRequired,evidence}]", "reason", "actor"],
      note: "Appends audited GPU-requirement assignments without replacing task versions or creating Harbor attempts.",
    },
    import: { arguments: ["<submission-manifest.json>"], compatibility: "Prefer casectl intake feishu or casectl intake mail for Feishu capture." },
    "import-source": { arguments: ["<source-envelope.json>"], compatibility: "Registers standalone provenance evidence." },
    "reconcile-submission-source-items": {
      arguments: ["<reconciliation.json>"],
      fields: ["submissionId", "sourceEventId", "items[{sourceItemId,role}]", "reason", "actor"],
      roles: ["original_vendor_file", "provenance"],
      note: "Replaces only this submission's item links for one already-linked source event; source records and artifacts are not changed.",
    },
    "append-tasks": {
      arguments: ["<tasks.json>"],
      fields: ["submissionId", "benchmarkAssignments[{sourceItemId,benchmarkId}]", "tasks", "actor"],
      note: "Each task must resolve exactly one registered benchmark from a source-item bulk assignment or its own benchmarkId override. Before registration, each task requested as Harbor is checked with the pinned Harbor library's static task-format validation without executing task code. A format failure retains the task but changes its format to non_harbor; missing or mismatched provenance still fails the operation. After the registry transaction commits, every active Harbor task in the submission is published as exact individual files to harbor-tasks; an export failure leaves the registration committed and makes this command fail so the same input can be retried safely.",
    },
    "reconcile-submission-tasks": {
      arguments: ["<reconciliation.json>"],
      fields: ["submissionId", "benchmarkAssignments[{sourceItemId,benchmarkId}]", "tasks", "reason", "actor"],
      note: "Checks each desired task requested as Harbor with the pinned Harbor library's static task-format validation without executing task code. A format failure retains the task but changes its format to non_harbor; missing or mismatched provenance still fails the operation. The reconciliation then atomically replaces changed parsed task/trace contents while preserving prior versions; benchmark-only changes do not supersede a task version. After commit, active Harbor tasks are published before inactive task prefixes are removed from harbor-tasks; both steps are safely retryable. A null artifactId is accepted only for a non-Harbor unchanged legacy version that predates task-artifact links.",
    },
    "classify-submission": { arguments: ["<classification.json>"], fields: ["submissionId", "purpose", "sourceEventIds", "reason", "actor"] },
    "archive-vendor": { arguments: ["<archive.json>"], fields: ["vendorId", "reason", "actor"] },
    "restore-vendor": { arguments: ["<restore.json>"], fields: ["vendorId", "reason", "actor"] },
    "store-file": { arguments: ["<artifact-kind>", "<absolute-file-path>"] },
    "download-artifact": { arguments: ["<artifact-id>", "<output-path>"] },
    "record-harbor-check": { arguments: ["<check.json>"], phases: ["environment", "oracle", "nop"] },
    "record-harbor-attempt": {
      arguments: ["<attempt.json>"],
      fields: ["id", "taskId", "phase", "status", "summary", "evidenceArtifactId", "harborVersion", "modalVersion", "command", "sandboxRef?", "startedAt", "completedAt"],
      phases: ["environment", "oracle", "nop"],
      statuses: ["blocked", "inconclusive"],
    },
    "record-harbor-finding": { arguments: ["<finding.json>"], fields: ["id", "taskId", "checkRunId", "finding"] },
    "register-artifact": { arguments: ["<artifact.json>"], note: "The object is verified before its record is registered." },
    "remove-submission": { arguments: ["<removal.json>"], fields: ["submissionId", "disposition", "reason", "actor"] },
    "delete-artifact": { arguments: ["<unreferenced-artifact-id>"] },
    "lease-work": { arguments: ["<worker-id>"], leaseSeconds: 900 },
    "complete-work": { arguments: ["<completion.json>"], fields: ["id", "workerId", "outcome", "error?"] },
    "reconcile-harbor-work-items": {
      arguments: ["<reconciliation.json>"],
      fields: ["taskIds", "reason", "actor"],
      note: "Completes exact queued Harbor-check work items only when every requested active Harbor task has recorded phase results or operational attempts sufficient to show its check work was processed; refuses leased, failed, unresolved, missing, duplicate, or non-Harbor targets.",
    },
  },
  } as const;
}
