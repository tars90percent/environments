#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { basename } from "node:path";
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
import { registryFileReferences } from "./registry/file-references.js";
import { migrateFiles, planFileFiling, pruneOldFileCopies } from "./registry/file-migration.js";
import type { FileContext } from "./registry/file-names.js";
import {
  parseAssignTaskBenchmarks,
  parseAssignTaskGpuRequirements,
  parseAppendTasks,
  parseCaptureSubmission,
  parseArtifact,
  parseHarborCheckAttempt,
  parseHarborCheckResult,
  parseHarborFinding,
  parseMergeBenchmarks,
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

const rawOutput = process.argv.includes("--raw");
const [command, ...arguments_] = process.argv.slice(2).filter((value) => value !== "--raw");
const argument = arguments_[0];
let activeRepository: RegistryRepository | undefined;
let commandResult: unknown;

if (command === "operations") {
  output(operationSchemas());
} else {
  const repository = await openLocalRepository();
  activeRepository = repository;
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
      case "merge-benchmarks":
        output(await repository.mergeBenchmarks(parseMergeBenchmarks(await jsonFile(argument))));
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
      case "capture-submission":
        output(await repository.captureSubmission(parseCaptureSubmission(await jsonFile(argument))));
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
        if (arguments_.length !== 2 && (arguments_.length !== 4 || !["--submission", "--context"].includes(arguments_[2]!))) fail("Usage: casectl registry store-file <kind> <path> [--submission <id> | --context <json-file>]");
        output(await storeFile(repository, required(argument, "artifact kind"), required(arguments_[1], "file path"),
          arguments_[2] === "--submission" ? await repository.files.submissionContext(required(arguments_[3],"submission id"))
          : arguments_[2] === "--context" ? await jsonFile(arguments_[3]) as FileContext : {}));
        break;
      case "plan-file-filing":
        output(planFileFiling(await repository.files.inventory()));
        break;
      case "file-inventory":
        output(await repository.files.inventory());
        break;
      case "file-moves":
        output(await repository.files.moves());
        break;
      case "migrate-file-locations":
        output(await migrateFiles(repository,localArtifactStore(),await jsonFile(argument) as Parameters<typeof migrateFiles>[2],(event)=>process.stderr.write(`${JSON.stringify(event)}\n`)));
        break;
      case "prune-old-file-copies":
        output(await pruneOldFileCopies(repository,localArtifactStore()));
        break;
      case "rollback-file-move": {
        const input=await jsonFile(argument) as {moveId:string;actor:string;reason:string};
        const move=(await repository.files.moves()).find((m)=>m.id===input.moveId);
        if (!move || move.oldCopyDeletedAt) fail("Rollback copy is not available");
        const artifact=await repository.getArtifact(move.artifactId);
        if (!artifact) fail("Artifact is missing");
        await localArtifactStore().verifyObject({key:move.fromKey,sha256:artifact.sha256,sizeBytes:artifact.sizeBytes});
        await repository.files.rollback(move.id,input.actor,input.reason);
        output({rolledBack:true,moveId:move.id});
        break;
      }
      case "merge-task-identities":
        output(await repository.files.mergeTaskIdentities(await jsonFile(argument) as Parameters<typeof repository.files.mergeTaskIdentities>[0]));
        break;
      case "correct-task-format": {
        const input=await jsonFile(argument) as Parameters<typeof repository.files.correctTaskFormat>[0];
        const task=await repository.getSampleTask(input.taskId);
        if (!task || !task.sourcePath || !task.artifactId) fail("Format correction requires an exact task package and root");
        const classification=await classifyHarborTaskRegistrations({repository,sourceStore:localArtifactStore(),tasks:[{...task,summary:task.summary ?? undefined,sourcePath:task.sourcePath,artifactId:task.artifactId,contentSha256:task.contentSha256 ?? undefined,benchmarkId:task.benchmark.id,format:"harbor" as const}]});
        if (classification.tasks[0]!.format!==input.format) fail(`Pinned static validation classified this task as ${classification.tasks[0]!.format}`);
        const result=await repository.files.correctTaskFormat(input);
        const publication=input.format==="harbor" ? await publishSubmissionHarborTasks(repository,result.submissionId) : await pruneSubmissionHarborTasks(repository,result.submissionId);
        output({...result,validation:classification.validation,publication});
        break;
      }
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
        fail("Usage: casectl registry operations|summary|catalog|vendors|create-vendor-timeline|vendor-timeline|vendor-timeline-history|record-vendor-interaction|vendor-interaction|update-vendor-interaction|delete-vendor-interaction|delete-vendor-timeline|vendor|submission|task|source-event|benchmarks|register-benchmark|update-benchmark|merge-benchmarks|remove-unused-benchmarks|purge-erroneous-benchmarks|assign-task-benchmarks|assign-task-gpu-requirements|capture-submission|import|import-source|reconcile-submission-source-items|append-tasks|reconcile-submission-tasks|classify-submission|archive-vendor|restore-vendor|store-file|file-inventory|plan-file-filing|file-moves|migrate-file-locations|rollback-file-move|prune-old-file-copies|merge-task-identities|correct-task-format|download-artifact|record-harbor-check|record-harbor-attempt|record-harbor-finding|register-artifact|remove-submission|delete-artifact|lease-work|complete-work|reconcile-harbor-work-items [arguments]");
    }
  } finally {
    try {
      if (commandResult !== undefined) {
        const result = rawOutput ? commandResult : await registryFileReferences(repository, commandResult, "output");
        process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      }
    } finally {
      await repository.close();
    }
  }
}

async function storeFile(repository: RegistryRepository, kind: string, path: string, context: FileContext): Promise<unknown> {
  const name=await repository.files.reserve(basename(path),context);
  const sourceArtifact = await storeSourcePayload(localArtifactStore(), path, {
    id:name.id,reference:name.reference,
    filename: basename(path),
    contentType: contentTypeFor(path),
    metadata: { source: "case_registry_cli" },
  });
  const artifact = parseArtifact({ ...sourceArtifact, kind });
  await repository.registerArtifact(artifact);
  return artifact;
}

async function downloadArtifact(repository: RegistryRepository, artifactId: string, path: string): Promise<unknown> {
  const artifact = await repository.getArtifact(artifactId);
  if (!artifact) fail(`Artifact not found: ${artifactId}`);
  await localArtifactStore().downloadFile({ key: artifact.storageKey, path, sha256: artifact.sha256, sizeBytes: artifact.sizeBytes });
  return { artifactId: artifact.id, path, sizeBytes: artifact.sizeBytes };
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
  id = (await repository.getArtifact(id))?.id ?? id;
  const artifact = await repository.unregisterArtifactIfUnreferenced(id);
  if (!artifact) return { artifactId: id, deleted: false, reason: "not_found_or_referenced" };
  try {
    await store.deleteObject(artifact.storageKey);
    return { artifactId: rawOutput ? id : artifact.reference ?? id, deleted: true, sizeBytes: artifact.sizeBytes ?? null };
  } catch (error) {
    await repository.registerArtifact(artifact);
    throw error;
  }
}

async function jsonFile(path: string | undefined): Promise<unknown> {
  if (!path) fail("A JSON file path is required");
  if (path === "-") {
    let payload = "";
    for await (const chunk of process.stdin) payload += String(chunk);
    return registryFileReferences(activeRepository!, JSON.parse(payload), "input");
  }
  return registryFileReferences(activeRepository!, JSON.parse(await readFile(path, "utf8")), "input");
}

function required(value: string | undefined, name: string): string {
  if (!value?.trim()) fail(`${name} is required`);
  return value.trim();
}

function output(value: unknown): void {
  if (activeRepository) commandResult = value;
  else process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
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
  files: {
    note: "Use readable vendor/date/filename references from store-file and catalog output. Checksums are managed internally; task registration does not require contentSha256. Original file IDs remain accepted. Add --raw to inspect original identifiers, storage keys and integrity metadata.",
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
    "merge-benchmarks": {
      arguments: ["<merge.json>"],
      fields: ["target{id,displayName,aliases?}", "sourceIds", "reason", "actor"],
      note: "Creates or reuses one canonical benchmark, redirects the source directions without deleting their historical identities or task assignments, and records audited merge events.",
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
    import: { arguments: ["<submission-manifest.json>"], compatibility: "Legacy normalized manifest import. Use capture-submission for arbitrary deliveries, or casectl intake feishu/mail for supported channel capture." },
    "import-source": {
      arguments: ["<source-envelope.json>"],
      fields: ["vendor{id,name,short,description,aliases?}", "sourceEvent{id,channel,externalRef,sender?,receivedAt,rawArtifactId?,metadata?}", "items[{id,kind,displayName,locator?,artifactId?,mediaType?,sizeBytes?,fetchStatus,parseStatus,mutable,capturedAt?,metadata?}]", "relations[{fromItemId,toItemId,relation,position?,metadata?}]?", "submissionLinks[{submissionId,role,sourceItemIds?}]?"],
      note: "Registers evidence or adds newly discovered items and relations to an existing source event without replacing earlier evidence. Use metadata to preserve details that do not fit the standard fields; file checksums are optional.",
    },
    "reconcile-submission-source-items": {
      arguments: ["<reconciliation.json>"],
      fields: ["submissionId", "sourceEventId", "items[{sourceItemId,role}]", "reason", "actor"],
      roles: ["original_vendor_file", "provenance"],
      note: "Replaces only this submission's item links for one already-linked source event; source records and artifacts are not changed.",
    },
    "append-tasks": {
      arguments: ["<tasks.json>"],
      fields: ["submissionId", "benchmarkAssignments[{sourceItemId,benchmarkId}]", "tasks", "actor"],
      taskFields: ["id", "stableKey", "title", "summary?", "kind=task|trace", "format=harbor|non_harbor", "benchmarkId?", "sourcePath", "artifactId=<file-reference>", "sourceItemIds"],
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
    "store-file": { arguments: ["<artifact-kind>", "<absolute-file-path>", "[--submission <existing-submission-id> | --context <file-context.json>]"] , contextFields:["vendorId?","submissionId?","date?","label?","correspondence?"] },
    "file-inventory": { arguments:[], result:"Every registered file and its known vendor, delivery and source context; use --raw to inspect storage locations." },
    "plan-file-filing": { arguments:[], result:"Reviewable entries mapping current object locations to readable vendor/date/filename paths." },
    "migrate-file-locations": { arguments:["<plan.json>"], fields:["entries[{artifactId,fromKey,toKey}]","actor","reason"], note:"Resumes the same plan. Copies and verifies bytes before switching each location; preserves old references and copies." },
    "file-moves": {arguments:[], result:"Recorded file relocations and rollback-copy status."},
    "rollback-file-move": {arguments:["<rollback.json>"],fields:["moveId","actor","reason"],note:"Verifies the retained original copy before restoring its location; every file name remains an alias."},
    "prune-old-file-copies": {arguments:[], note:"Verifies the current copy again and removes old copies only after 24 hours. Old file references remain valid."},
    "merge-task-identities": {arguments:["<merge.json>"],fields:["targetTaskVersionId","sourceTaskVersionId","actor","reason"],note:"Unifies task identity only for the same vendor and exact package, preserves both deliveries, all versions, original keys and an audit record."},
    "correct-task-format": {arguments:["<correction.json>"],fields:["taskId","format","actor","reason"],note:"Checks the exact root with pinned static Harbor validation, audits the correction and updates Harbor publication."},
    "capture-submission": {
      arguments: ["<capture.json>"],
      fields: ["purpose=sample_evaluation", "vendor{id,name,short,description,aliases?}", "submission{id,date,label,sourceLabel,formats?,revisesSubmissionId?,metadata?}", "sources[{sourceEventId,sourceItemIds?}|{sourceEvent,items,relations?}]", "actor"],
      note: "Preserve any delivery before parsing, including links, folders, PDFs, spreadsheets and mixed material. Store available files with store-file; external-only items need a locator, not a file. Sources use the import-source graph schema. CASE decides what to follow and parse, and records a sample-delivery entry with record-vendor-interaction linked to this submission and its sources.",
    },
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
