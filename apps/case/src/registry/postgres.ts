import { createHash, randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import { runRegistryMigrations } from "./migrations.js";
import { PROCUREMENT_EVENT_KINDS, procurementSummaryFromEvent } from "./procurement-summary.js";
import type { RegistryRepository } from "./repository.js";
import { deriveRuntimeVerification, type RuntimeCheckFact } from "./task-evidence.js";
import type {
  ArtifactInput,
  ArtifactRecord,
  AssignTaskGpuRequirementsInput,
  AssignTaskGpuRequirementsResult,
  AssignTaskBenchmarksInput,
  AssignTaskBenchmarksResult,
  AppendTasksInput,
  AppendTasksResult,
  AppendNormalizedTasksInput,
  AppendNormalizedTasksResult,
  CaptureSubmissionInput,
  CaptureSubmissionResult,
  CatalogBatch,
  CatalogCategory,
  CatalogScope,
  CatalogSnapshot,
  CatalogSourceEvent,
  CatalogSourceItem,
  CatalogSourceRelation,
  CatalogTask,
  CatalogVendor,
  CheckEvidenceRole,
  CheckExecutionScope,
  CheckOutcome,
  CheckResultInput,
  FollowUpInput,
  HarborCheckAttemptInput,
  HarborCheckPhase,
  HarborCheckResultInput,
  HarborFindingInput,
  OperationsSummary,
  ReconcileHarborWorkItemsInput,
  ReconcileHarborWorkItemsResult,
  ReconcileSubmissionSourceItemsInput,
  ReconcileSubmissionSourceItemsResult,
  ReconcileSubmissionTasksInput,
  ReconcileSubmissionTasksResult,
  PurgeErroneousBenchmarksInput,
  PurgeErroneousBenchmarksResult,
  RegisterBenchmarkInput,
  RegisterBenchmarkResult,
  RemoveUnusedBenchmarksInput,
  RemoveUnusedBenchmarksResult,
  RegistryBenchmark,
  SampleCatalogCheck,
  SampleCatalogAttempt,
  SampleCatalogFinding,
  SampleCatalogSnapshot,
  SampleCatalogSubmission,
  SampleCatalogTask,
  SourceEnvelopeInput,
  StatusUpdateInput,
  SubmissionManifest,
  SubmissionIntakeClassificationInput,
  SubmissionIntakeClassificationResult,
  SubmissionRemovalInput,
  SubmissionRemovalResult,
  SubmissionReview,
  SubmissionReviewInput,
  TaskFindingInput,
  TaskFindingUpdateInput,
  TaskSourceLinksInput,
  VendorArchiveContext,
  VendorArchiveInput,
  VendorArchiveResult,
  VendorDirectoryEntry,
  VendorEvent,
  VendorEventInput,
  VendorInteraction,
  VendorInteractionInput,
  WorkCompletionInput,
  WorkItem,
} from "./types.js";

const ORIGINAL_VENDOR_SOURCE_ITEM_KINDS = new Set<CatalogSourceItem["kind"]>([
  "attachment",
  "pdf",
  "archive",
  "file",
  "task_package",
]);

type VendorRow = { id: string; name: string; short: string; description: string };
type BenchmarkRow = {
  id: string;
  display_name: string;
  aliases: string[];
  created_at: string | Date;
};
type CurrentTaskBenchmarkRow = {
  task_version_id: string;
  benchmark_id: string;
};
type CurrentTaskGpuRequirementRow = {
  task_version_id: string;
  gpu_required: boolean;
  assignment_id: string | null;
};
type ResearchDemandRow = {
  id: string;
  domain_en: string;
  domain_zh: string;
  subdomain_en: string;
  subdomain_zh: string;
  title_en: string;
  title_zh: string;
  note_en: string;
  note_zh: string;
  source_label_en: string;
  source_label_zh: string;
  source_date: string | Date;
  source_url: string;
};
type VendorArchiveRow = {
  id: string;
  archived_at: string | Date | null;
  archived_by: string | null;
  archive_reason: string | null;
};
type BatchRow = {
  id: string;
  vendor_id: string;
  submission_date: string | Date;
  label: string;
  source_label: string;
  declared_task_count: number;
  formats: string[];
  workflow_status: CatalogBatch["workflowStatus"];
  catalog_visibility: CatalogBatch["catalogVisibility"];
  revises_batch_id: string | null;
  delta: CatalogBatch["delta"];
};
type CategoryRow = {
  batch_id: string;
  id: string;
  name: string;
  description: string;
  declared_count: number;
  examples: string[];
};
type TaskRow = {
  batch_id: string;
  category_id: string;
  id: string;
  stable_key: string;
  title: string;
  summary: string | null;
  source_path: string | null;
  format: string;
  representation_kind: CatalogTask["representation"]["kind"];
  representation_path: CatalogTask["representation"]["path"];
  normalization_outcome: CatalogTask["representation"]["normalizationOutcome"];
  representation_basis: CatalogTask["representation"]["basis"];
  artifact_id: string | null;
  content_sha256: string | null;
  workflow_status: CatalogTask["workflowStatus"];
  catalog_visibility: CatalogTask["catalogVisibility"];
  pass_count: string;
  fail_count: string;
  blocked_count: string;
  not_run_count: string;
  unclassified_check_count: string;
};
type RuntimeCheckRow = {
  task_version_id: string;
  id: string;
  evidence_role: CheckEvidenceRole;
  execution_scope: CheckExecutionScope;
  outcome: CheckOutcome;
  completed_at: string | Date;
};
type TaskFindingRow = {
  id: string;
  task_version_id: string;
  finding: string;
};
type SampleTaskRow = {
  submission_id: string;
  id: string;
  stable_key: string;
  title: string;
  summary: string | null;
  task_kind: SampleCatalogTask["kind"];
  format_kind: SampleCatalogTask["format"];
  benchmark_id: string;
  benchmark_name: string;
  gpu_required: boolean;
  source_path: string | null;
  artifact_id: string | null;
  content_sha256: string | null;
};
type SampleCheckRow = {
  task_id: string;
  id: string;
  phase: HarborCheckPhase;
  outcome: SampleCatalogCheck["outcome"];
  summary: string;
  score: number | null;
  completed_at: string | Date;
};
type SampleAttemptRow = {
  task_id: string;
  id: string;
  phase: HarborCheckPhase;
  status: SampleCatalogAttempt["status"];
  summary: string;
  completed_at: string | Date;
};
type SampleFindingRow = {
  task_id: string;
  id: string;
  check_run_id: string;
  check_phase: HarborCheckPhase;
  finding: string;
};
type SourceEventRow = {
  batch_id: string;
  id: string;
  role: CatalogSourceEvent["role"];
  channel: CatalogSourceEvent["channel"];
  external_ref: string;
  sender: string | null;
  received_at: string | Date;
  raw_artifact_id: string | null;
};
type SampleSourceEventRow = SourceEventRow & {
  raw_artifact_kind: ArtifactInput["kind"] | null;
  raw_artifact_sha256: string | null;
  raw_artifact_size_bytes: string | null;
  raw_artifact_content_type: string | null;
  raw_artifact_original_name: string | null;
};
type SourceItemRow = {
  source_event_id: string;
  id: string;
  kind: CatalogSourceItem["kind"];
  display_name: string;
  locator: string | null;
  media_type: string | null;
  artifact_id: string | null;
  content_sha256: string | null;
  size_bytes: string | null;
  fetch_status: CatalogSourceItem["fetchStatus"];
  parse_status: CatalogSourceItem["parseStatus"];
  mutable: boolean;
  captured_at: string | Date | null;
  metadata: Record<string, unknown>;
};
type BatchSourceItemRow = SourceItemRow & {
  batch_id: string;
  submission_roles: string[];
};
type SampleSourceItemRow = BatchSourceItemRow & {
  artifact_kind: ArtifactInput["kind"] | null;
};
type SourceRelationRow = {
  source_event_id: string;
  from_item_id: string;
  to_item_id: string;
  relation: CatalogSourceRelation["relation"];
  position: number | null;
};
type SubmissionReviewRow = {
  id: string;
  batch_id: string;
  signal: SubmissionReview["signal"];
  scope: SubmissionReview["scope"];
  category_ids: string[];
  reviewer_open_id: string;
  reviewer_union_id: string | null;
  reviewer_tenant_key: string;
  reviewer_name: string;
  comment: string;
  metadata: Record<string, unknown>;
  created_at: string | Date;
};
type VendorEventRow = {
  id: string;
  vendor_id: string;
  kind: VendorEvent["kind"];
  event_type: string;
  summary: string;
  actor: string;
  occurred_at: string | Date;
  source_event_ids: string[];
  batch_ids: string[];
  metadata: Record<string, unknown>;
  created_at: string | Date;
};
type VendorInteractionRow = {
  id: string;
  vendor_id: string;
  kind: VendorInteraction["kind"];
  event_type: string;
  title: string;
  summary: string;
  channel: VendorInteraction["channel"];
  evidence: VendorInteraction["evidence"];
  visibility: VendorInteraction["visibility"];
  occurred_at: string | Date;
  source_event_ids: string[];
  batch_ids: string[];
  actor: string;
  created_at: string | Date;
};
type VendorDirectoryRow = {
  id: string;
  name: string;
  short: string;
  description: string;
  aliases: string[];
  source_event_count: string;
  submission_count: string;
  vendor_event_count: string;
  interaction_count: string;
  latest_activity_at: string | Date | null;
  archived_at: string | Date | null;
  archived_by: string | null;
  archive_reason: string | null;
  updated_at: string | Date;
};
type ArtifactRow = {
  id: string;
  kind: ArtifactInput["kind"];
  storage_key: string;
  sha256: string;
  size_bytes: string | null;
  content_type: string | null;
  metadata: Record<string, unknown>;
  created_at: string | Date;
};

export class PostgresRegistry implements RegistryRepository {
  private readonly pool: Pool;

  constructor(databaseUrl: string) {
    this.pool = new Pool({ connectionString: databaseUrl, max: 10 });
  }

  async initialize(): Promise<void> {
    const client = await this.pool.connect();
    try {
      await runRegistryMigrations(client);
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  async captureSubmission(input: CaptureSubmissionInput): Promise<CaptureSubmissionResult> {
    if (!input.sources.length) throw new RegistryConflictError("A captured submission must have at least one source");
    const formats = [...new Set(input.submission.formats ?? [])].sort();
    if (formats.some((format) => format !== "harbor" && format !== "non_harbor")) {
      throw new RegistryConflictError("Submission formats may contain only harbor and non_harbor");
    }

    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await this.upsertVendor(client, input.vendor);
      for (const artifact of input.artifacts) await this.registerArtifactWithClient(client, artifact);

      const artifactKinds = new Map(input.artifacts.map((artifact) => [artifact.id, artifact.kind]));
      const sourceLinks: Array<{
        sourceEventId: string;
        items: Array<{ id: string; role: "original_vendor_file" | "provenance" }>;
      }> = [];
      const seenSourceEvents = new Set<string>();
      for (const source of input.sources) {
        if ("sourceEvent" in source) {
          if (!source.items.length) throw new RegistryConflictError(`Source event ${source.sourceEvent.id} must contain at least one source item`);
          if (seenSourceEvents.has(source.sourceEvent.id)) throw new RegistryConflictError(`Source event ${source.sourceEvent.id} is repeated`);
          seenSourceEvents.add(source.sourceEvent.id);
          for (const item of source.items) {
            if (!item.artifactId) continue;
            const artifact = await client.query<{ sha256: string; kind: ArtifactInput["kind"] }>(
              "SELECT sha256, kind FROM registry_artifacts WHERE id = $1",
              [item.artifactId],
            );
            if (!artifact.rows[0]) throw new RegistryConflictError(`Source item ${item.id} references missing artifact ${item.artifactId}`);
            artifactKinds.set(item.artifactId, artifact.rows[0].kind);
            if (item.contentSha256 && artifact.rows[0].sha256 !== item.contentSha256) {
              throw new RegistryConflictError(`Source item ${item.id} content hash does not match its artifact`);
            }
          }
          await this.ingestSourceEnvelopeWithClient(client, {
            vendor: input.vendor,
            sourceEvent: source.sourceEvent,
            items: source.items,
            relations: source.relations,
          }, input.actor);
          sourceLinks.push({
            sourceEventId: source.sourceEvent.id,
            items: source.items.map((item) => ({
              id: item.id,
              role: defaultSubmissionSourceItemRole(item.kind, item.artifactId, item.artifactId ? artifactKinds.get(item.artifactId) : undefined),
            })),
          });
          continue;
        }

        if (seenSourceEvents.has(source.sourceEventId)) throw new RegistryConflictError(`Source event ${source.sourceEventId} is repeated`);
        seenSourceEvents.add(source.sourceEventId);
        const event = await client.query<{ vendor_id: string }>(
          "SELECT vendor_id FROM registry_source_events WHERE id = $1",
          [source.sourceEventId],
        );
        if (!event.rows[0]) throw new RegistryNotFoundError(`Source event ${source.sourceEventId} does not exist`);
        if (event.rows[0].vendor_id !== input.vendor.id) {
          throw new RegistryConflictError(`Source event ${source.sourceEventId} does not belong to vendor ${input.vendor.id}`);
        }
        const items = await client.query<{
          id: string;
          kind: CatalogSourceItem["kind"];
          artifact_id: string | null;
          artifact_kind: ArtifactInput["kind"] | null;
        }>(
          `SELECT si.id, si.kind, si.artifact_id, artifact.kind AS artifact_kind
           FROM registry_source_items si
           LEFT JOIN registry_artifacts artifact ON artifact.id = si.artifact_id
           WHERE si.source_event_id = $1
             AND ($2::text[] IS NULL OR si.id = ANY($2::text[]))
           ORDER BY si.created_at, si.id`,
          [source.sourceEventId, source.sourceItemIds ?? null],
        );
        if (source.sourceItemIds && items.rowCount !== source.sourceItemIds.length) {
          throw new RegistryConflictError(`One or more source items do not belong to source event ${source.sourceEventId}`);
        }
        sourceLinks.push({
          sourceEventId: source.sourceEventId,
          items: items.rows.map((item) => ({
            id: item.id,
            role: defaultSubmissionSourceItemRole(item.kind, item.artifact_id ?? undefined, item.artifact_kind ?? undefined),
          })),
        });
      }

      const existing = await client.query<{
        vendor_id: string;
        submission_date: string | Date;
        label: string;
        source_label: string;
        formats: string[];
        revises_batch_id: string | null;
      }>(
        `SELECT vendor_id, submission_date, label, source_label, formats, revises_batch_id
         FROM registry_submission_batches WHERE id = $1 FOR UPDATE`,
        [input.submission.id],
      );
      const current = existing.rows[0];
      const created = !current;
      if (current) {
        const matches = current.vendor_id === input.vendor.id
          && isoDate(current.submission_date) === input.submission.date
          && current.label === input.submission.label
          && current.source_label === input.submission.sourceLabel
          && current.revises_batch_id === (input.submission.revisesSubmissionId ?? null);
        if (!matches) throw new RegistryConflictError(`Submission ${input.submission.id} already exists with different immutable contents`);
        const mergedFormats = [...new Set([...current.formats, ...formats])].sort();
        if (hashValue(mergedFormats) !== hashValue(current.formats)) {
          await client.query(
            "UPDATE registry_submission_batches SET formats = $2::jsonb, updated_at = now() WHERE id = $1",
            [input.submission.id, json(mergedFormats)],
          );
        }
      } else {
        const primary = sourceLinks[0]!;
        const metadata = { intakePurpose: "sample_evaluation", ...(input.submission.metadata ?? {}) };
        const manifestSha256 = hashValue({
          vendor: input.vendor,
          submission: input.submission,
          sourceEventIds: sourceLinks.map((source) => source.sourceEventId),
        });
        await client.query(
          `INSERT INTO registry_submission_batches(
             id, vendor_id, source_event_id, submission_date, label, source_label,
             declared_task_count, formats, workflow_status, catalog_visibility,
             revises_batch_id, delta, metadata, manifest_sha256, intake_purpose
           ) VALUES ($1, $2, $3, $4, $5, $6, 0, $7::jsonb, 'unchecked', 'available',
                     $8, $9::jsonb, $10::jsonb, $11, 'sample_evaluation')`,
          [input.submission.id, input.vendor.id, primary.sourceEventId, input.submission.date,
            input.submission.label, input.submission.sourceLabel, json(formats), input.submission.revisesSubmissionId ?? null,
            json({ added: 0, removed: 0, changedFiles: sourceLinks.reduce((sum, source) => sum + source.items.length, 0), note: "Original delivery preserved before parsing." }),
            json(metadata), manifestSha256],
        );
      }

      const hasPrimary = current ? await client.query<{ exists: boolean }>(
        "SELECT EXISTS (SELECT 1 FROM registry_batch_source_events WHERE batch_id = $1 AND role = 'primary') AS exists",
        [input.submission.id],
      ) : null;
      let primaryAssigned = !created && Boolean(hasPrimary?.rows[0]?.exists);
      for (const source of sourceLinks) {
        const role = primaryAssigned ? "supplement" : "primary";
        await client.query(
          `INSERT INTO registry_batch_source_events(batch_id, source_event_id, role)
           VALUES ($1, $2, $3)
           ON CONFLICT(batch_id, source_event_id) DO UPDATE SET
             role = CASE WHEN registry_batch_source_events.role = 'primary' THEN 'primary' ELSE EXCLUDED.role END`,
          [input.submission.id, source.sourceEventId, role],
        );
        for (const item of source.items) {
          await client.query(
            `INSERT INTO registry_batch_source_items(batch_id, source_item_id, role)
             VALUES ($1, $2, $3)
             ON CONFLICT(batch_id, source_item_id, role) DO NOTHING`,
            [input.submission.id, item.id, item.role],
          );
        }
        primaryAssigned = true;
      }

      if (created) {
        await this.insertStatusEvent(client, "submission_batch", input.submission.id, "submission.captured", input.actor, {
          sourceEventIds: sourceLinks.map((source) => source.sourceEventId),
          artifactIds: input.artifacts.map((artifact) => artifact.id),
        });
        await this.enqueueWork(client, "parse_submission", "submission_batch", input.submission.id, {
          sourceEventIds: sourceLinks.map((source) => source.sourceEventId),
        });
      }
      await client.query("COMMIT");
      return {
        submissionId: input.submission.id,
        created,
        sourceEventIds: sourceLinks.map((source) => source.sourceEventId),
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async reconcileSubmissionSourceItems(
    input: ReconcileSubmissionSourceItemsInput,
  ): Promise<ReconcileSubmissionSourceItemsResult> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const linkedEvent = await client.query<{ vendor_id: string }>(
        `SELECT b.vendor_id
         FROM registry_submission_batches b
         JOIN registry_batch_source_events bse ON bse.batch_id = b.id
         JOIN registry_source_events se ON se.id = bse.source_event_id AND se.vendor_id = b.vendor_id
         WHERE b.id = $1 AND se.id = $2
         FOR UPDATE OF b`,
        [input.submissionId, input.sourceEventId],
      );
      if (!linkedEvent.rows[0]) {
        throw new RegistryConflictError(
          `Source event ${input.sourceEventId} is not linked to submission ${input.submissionId}`,
        );
      }

      const requestedIds = input.items.map((item) => item.sourceItemId);
      const sourceItems = await client.query<{ id: string }>(
        `SELECT id
         FROM registry_source_items
         WHERE source_event_id = $1 AND id = ANY($2::text[])
         ORDER BY id`,
        [input.sourceEventId, requestedIds],
      );
      if (sourceItems.rowCount !== requestedIds.length) {
        throw new RegistryConflictError(
          `Every reconciled source item must belong to source event ${input.sourceEventId}`,
        );
      }

      const requiredTaskSources = await client.query<{ source_item_id: string }>(
        `SELECT DISTINCT tsi.source_item_id
         FROM registry_task_source_items tsi
         JOIN registry_task_versions tv ON tv.id = tsi.task_version_id
         JOIN registry_source_items si ON si.id = tsi.source_item_id
         WHERE tv.batch_id = $1 AND si.source_event_id = $2
         ORDER BY tsi.source_item_id`,
        [input.submissionId, input.sourceEventId],
      );
      const requested = new Set(requestedIds);
      const missingTaskSources = requiredTaskSources.rows
        .map((row) => row.source_item_id)
        .filter((sourceItemId) => !requested.has(sourceItemId));
      if (missingTaskSources.length) {
        throw new RegistryConflictError(
          `Reconciliation cannot remove task source items: ${missingTaskSources.join(", ")}`,
        );
      }

      const previous = await client.query<{ source_item_id: string; role: string }>(
        `SELECT bsi.source_item_id, bsi.role
         FROM registry_batch_source_items bsi
         JOIN registry_source_items si ON si.id = bsi.source_item_id
         WHERE bsi.batch_id = $1 AND si.source_event_id = $2
         ORDER BY bsi.source_item_id, bsi.role`,
        [input.submissionId, input.sourceEventId],
      );
      const next = [...input.items].sort((a, b) =>
        a.sourceItemId.localeCompare(b.sourceItemId) || a.role.localeCompare(b.role));
      const previousLinks = previous.rows.map((row) => ({ sourceItemId: row.source_item_id, role: row.role }));
      const changed = hashValue(previousLinks) !== hashValue(next);

      if (changed) {
        await client.query(
          `DELETE FROM registry_batch_source_items bsi
           USING registry_source_items si
           WHERE bsi.source_item_id = si.id
             AND bsi.batch_id = $1
             AND si.source_event_id = $2`,
          [input.submissionId, input.sourceEventId],
        );
        for (const item of next) {
          await client.query(
            `INSERT INTO registry_batch_source_items(batch_id, source_item_id, role)
             VALUES ($1, $2, $3)`,
            [input.submissionId, item.sourceItemId, item.role],
          );
        }
        await client.query(
          "UPDATE registry_submission_batches SET updated_at = now() WHERE id = $1",
          [input.submissionId],
        );
        await this.insertStatusEvent(
          client,
          "submission_batch",
          input.submissionId,
          "submission.source_items_reconciled",
          input.actor,
          {
            sourceEventId: input.sourceEventId,
            reason: input.reason,
            previous: previousLinks,
            current: next,
          },
        );
      }

      await client.query("COMMIT");
      return {
        submissionId: input.submissionId,
        sourceEventId: input.sourceEventId,
        previousItemCount: new Set(previous.rows.map((row) => row.source_item_id)).size,
        itemCount: input.items.length,
        changed,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async ingestSourceEnvelope(envelope: SourceEnvelopeInput): Promise<{ sourceEventId: string; created: boolean }> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await this.upsertVendor(client, envelope.vendor);
      const created = await this.ingestSourceEnvelopeWithClient(client, envelope, "case");
      await client.query("COMMIT");
      return { sourceEventId: envelope.sourceEvent.id, created };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private async recordVendorEvent(input: VendorEventInput): Promise<{ eventId: string; created: boolean }> {
    const payloadSha256 = hashValue(input);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const vendor = await client.query<{ id: string }>("SELECT id FROM registry_vendors WHERE id = $1", [input.vendorId]);
      if (!vendor.rowCount) throw new RegistryNotFoundError(`Vendor ${input.vendorId} does not exist`);

      const existing = await client.query<{ payload_sha256: string }>(
        "SELECT payload_sha256 FROM registry_vendor_events WHERE id = $1",
        [input.id],
      );
      if (existing.rows[0]?.payload_sha256 && existing.rows[0].payload_sha256 !== payloadSha256) {
        throw new RegistryConflictError(`Vendor event ${input.id} already exists with different immutable contents`);
      }
      if (existing.rowCount) {
        await client.query("COMMIT");
        return { eventId: input.id, created: false };
      }

      if (input.sourceEventIds.length) {
        const sources = await client.query<{ id: string }>(
          "SELECT id FROM registry_source_events WHERE vendor_id = $1 AND id = ANY($2::text[])",
          [input.vendorId, input.sourceEventIds],
        );
        if (sources.rowCount !== input.sourceEventIds.length) {
          throw new RegistryNotFoundError(`One or more source events do not belong to vendor ${input.vendorId}`);
        }
      }
      if (input.batchIds.length) {
        const batches = await client.query<{ id: string }>(
          "SELECT id FROM registry_submission_batches WHERE vendor_id = $1 AND id = ANY($2::text[])",
          [input.vendorId, input.batchIds],
        );
        if (batches.rowCount !== input.batchIds.length) {
          throw new RegistryNotFoundError(`One or more submissions do not belong to vendor ${input.vendorId}`);
        }
      }

      await client.query(
        `INSERT INTO registry_vendor_events(
           id, vendor_id, kind, event_type, summary, actor, occurred_at,
           source_event_ids, batch_ids, metadata, payload_sha256
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10::jsonb, $11)`,
        [input.id, input.vendorId, input.kind, input.eventType, input.summary, input.actor, input.occurredAt,
          json(input.sourceEventIds), json(input.batchIds), json(input.metadata ?? {}), payloadSha256],
      );
      await client.query("COMMIT");
      return { eventId: input.id, created: true };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private async listVendorEvents(vendorId: string): Promise<VendorEvent[]> {
    const result = await this.pool.query<VendorEventRow>(
      `SELECT id, vendor_id, kind, event_type, summary, actor, occurred_at,
              source_event_ids, batch_ids, metadata, created_at
       FROM registry_vendor_events
       WHERE vendor_id = $1
       ORDER BY occurred_at DESC, created_at DESC, id`,
      [vendorId],
    );
    return result.rows.map(vendorEventFromRow);
  }

  async recordVendorInteraction(input: VendorInteractionInput): Promise<{ interactionId: string; created: boolean }> {
    const payloadSha256 = hashValue(input);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const vendor = await client.query<{ id: string }>("SELECT id FROM registry_vendors WHERE id = $1", [input.vendorId]);
      if (!vendor.rowCount) throw new RegistryNotFoundError(`Vendor ${input.vendorId} does not exist`);

      const existing = await client.query<{ payload_sha256: string }>(
        "SELECT payload_sha256 FROM registry_vendor_interactions WHERE id = $1",
        [input.id],
      );
      if (existing.rows[0]?.payload_sha256 && existing.rows[0].payload_sha256 !== payloadSha256) {
        throw new RegistryConflictError(`Vendor interaction ${input.id} already exists with different immutable contents`);
      }
      if (existing.rowCount) {
        await client.query("COMMIT");
        return { interactionId: input.id, created: false };
      }

      if (input.sourceEventIds.length) {
        const sources = await client.query<{ id: string }>(
          "SELECT id FROM registry_source_events WHERE vendor_id = $1 AND id = ANY($2::text[])",
          [input.vendorId, input.sourceEventIds],
        );
        if (sources.rowCount !== input.sourceEventIds.length) {
          throw new RegistryNotFoundError(`One or more source events do not belong to vendor ${input.vendorId}`);
        }
      }
      if (input.batchIds.length) {
        const batches = await client.query<{ id: string }>(
          "SELECT id FROM registry_submission_batches WHERE vendor_id = $1 AND id = ANY($2::text[])",
          [input.vendorId, input.batchIds],
        );
        if (batches.rowCount !== input.batchIds.length) {
          throw new RegistryNotFoundError(`One or more submissions do not belong to vendor ${input.vendorId}`);
        }
      }

      await client.query(
        `INSERT INTO registry_vendor_interactions(
           id, vendor_id, kind, event_type, title, summary, channel, evidence, visibility,
           occurred_at, source_event_ids, batch_ids, actor, payload_sha256
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12::jsonb, $13, $14)`,
        [input.id, input.vendorId, input.kind, input.eventType, input.title, input.summary, input.channel,
          input.evidence, input.visibility, input.occurredAt, json(input.sourceEventIds), json(input.batchIds),
          input.actor, payloadSha256],
      );
      await client.query("COMMIT");
      return { interactionId: input.id, created: true };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async vendorDirectory(includeArchived = false): Promise<VendorDirectoryEntry[]> {
    const result = await this.pool.query<VendorDirectoryRow>(
      `SELECT v.id, v.name, v.short, v.description, v.aliases, v.updated_at,
              v.archived_at, v.archived_by, v.archive_reason,
              COALESCE(se.event_count, 0)::text AS source_event_count,
              COALESCE(sb.batch_count, 0)::text AS submission_count,
              COALESCE(ve.event_count, 0)::text AS vendor_event_count,
              COALESCE(vi.interaction_count, 0)::text AS interaction_count,
              GREATEST(se.latest_at, sb.latest_at, ve.latest_at, vi.latest_at) AS latest_activity_at
       FROM registry_vendors v
       LEFT JOIN LATERAL (
         SELECT COUNT(*) AS event_count, MAX(received_at) AS latest_at
         FROM registry_source_events WHERE vendor_id = v.id
       ) se ON true
       LEFT JOIN LATERAL (
         SELECT COUNT(*) AS batch_count, MAX(submission_date::timestamptz) AS latest_at
         FROM registry_submission_batches WHERE vendor_id = v.id
       ) sb ON true
       LEFT JOIN LATERAL (
         SELECT COUNT(*) AS event_count, MAX(occurred_at) AS latest_at
         FROM registry_vendor_events WHERE vendor_id = v.id
       ) ve ON true
       LEFT JOIN LATERAL (
         SELECT COUNT(*) AS interaction_count, MAX(occurred_at) AS latest_at
         FROM registry_vendor_interactions WHERE vendor_id = v.id
       ) vi ON true
       WHERE ($1::boolean OR v.archived_at IS NULL)
       ORDER BY v.name, v.id`,
      [includeArchived],
    );
    return result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      short: row.short,
      description: row.description,
      aliases: row.aliases,
      sourceEventCount: Number(row.source_event_count),
      submissionCount: Number(row.submission_count),
      vendorEventCount: Number(row.vendor_event_count),
      interactionCount: Number(row.interaction_count),
      latestActivityAt: row.latest_activity_at ? new Date(row.latest_activity_at).toISOString() : null,
      archivedAt: row.archived_at ? new Date(row.archived_at).toISOString() : null,
      archivedBy: row.archived_by,
      archiveReason: row.archive_reason,
      updatedAt: new Date(row.updated_at).toISOString(),
    }));
  }

  async archiveVendor(input: VendorArchiveInput): Promise<VendorArchiveResult> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const vendor = await client.query<VendorArchiveRow>(
        `SELECT id, archived_at, archived_by, archive_reason
         FROM registry_vendors WHERE id = $1 FOR UPDATE`,
        [input.vendorId],
      );
      const current = vendor.rows[0];
      if (!current) throw new RegistryNotFoundError(`Vendor ${input.vendorId} does not exist`);
      const existingArchive = archiveContextFromRow(current);
      if (existingArchive) {
        await client.query("COMMIT");
        return { vendorId: input.vendorId, archived: true, changed: false, archive: existingArchive };
      }

      const visibleSubmission = await client.query<{ id: string; catalog_visibility: string }>(
        `SELECT id, catalog_visibility
         FROM registry_submission_batches
         WHERE vendor_id = $1 AND catalog_visibility <> 'internal'
         ORDER BY submission_date DESC, created_at DESC
         LIMIT 1`,
        [input.vendorId],
      );
      if (visibleSubmission.rows[0]) {
        throw new RegistryConflictError(
          `Vendor ${input.vendorId} has non-internal submission ${visibleSubmission.rows[0].id}; set every submission to internal before archiving`,
        );
      }

      const updated = await client.query<VendorArchiveRow>(
        `UPDATE registry_vendors
         SET archived_at = now(), archived_by = $2, archive_reason = $3, updated_at = now()
         WHERE id = $1
         RETURNING id, archived_at, archived_by, archive_reason`,
        [input.vendorId, input.actor, input.reason],
      );
      const archive = requiredArchiveContext(updated.rows[0]!);
      await this.insertStatusEvent(client, "vendor", input.vendorId, "vendor.archived", input.actor, {
        reason: input.reason,
        archivedAt: archive.archivedAt,
      });
      await client.query("COMMIT");
      return { vendorId: input.vendorId, archived: true, changed: true, archive };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async restoreVendor(input: VendorArchiveInput): Promise<VendorArchiveResult> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const vendor = await client.query<VendorArchiveRow>(
        `SELECT id, archived_at, archived_by, archive_reason
         FROM registry_vendors WHERE id = $1 FOR UPDATE`,
        [input.vendorId],
      );
      const current = vendor.rows[0];
      if (!current) throw new RegistryNotFoundError(`Vendor ${input.vendorId} does not exist`);
      const previousArchive = archiveContextFromRow(current);
      if (!previousArchive) {
        await client.query("COMMIT");
        return { vendorId: input.vendorId, archived: false, changed: false, archive: null };
      }

      await client.query(
        `UPDATE registry_vendors
         SET archived_at = NULL, archived_by = NULL, archive_reason = NULL, updated_at = now()
         WHERE id = $1`,
        [input.vendorId],
      );
      await this.insertStatusEvent(client, "vendor", input.vendorId, "vendor.restored", input.actor, {
        reason: input.reason,
        previousArchive,
      });
      await client.query("COMMIT");
      return {
        vendorId: input.vendorId,
        archived: false,
        changed: true,
        archive: null,
        previousArchive,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async ingestSubmission(manifest: SubmissionManifest): Promise<{ batchId: string; created: boolean }> {
    const manifestSha256 = hashManifest(manifest);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await this.upsertVendor(client, manifest.vendor);

      const existing = await client.query<{ manifest_sha256: string }>(
        "SELECT manifest_sha256 FROM registry_submission_batches WHERE id = $1",
        [manifest.batch.id],
      );
      if (existing.rows[0]) {
        if (existing.rows[0].manifest_sha256 !== manifestSha256) {
          throw new RegistryConflictError(`Batch ${manifest.batch.id} already exists with different immutable contents`);
        }
        await client.query("COMMIT");
        return { batchId: manifest.batch.id, created: false };
      }

      await client.query(
        `INSERT INTO registry_source_events(
           id, vendor_id, channel, external_ref, sender, received_at, raw_artifact_id, metadata
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
         ON CONFLICT(id) DO NOTHING`,
        [manifest.sourceEvent.id, manifest.vendor.id, manifest.sourceEvent.channel, manifest.sourceEvent.externalRef,
          manifest.sourceEvent.sender ?? null, manifest.sourceEvent.receivedAt, manifest.sourceEvent.rawArtifactId ?? null,
          json(manifest.sourceEvent.metadata ?? {})],
      );
      await client.query(
        `INSERT INTO registry_submission_batches(
           id, vendor_id, source_event_id, submission_date, label, source_label,
           declared_task_count, formats, workflow_status, catalog_visibility,
           revises_batch_id, delta, metadata, manifest_sha256, intake_purpose
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, $12::jsonb, $13::jsonb, $14, $15)`,
        [manifest.batch.id, manifest.vendor.id, manifest.sourceEvent.id, manifest.batch.date, manifest.batch.label,
          manifest.batch.sourceLabel, manifest.batch.taskCount, json(manifest.batch.formats), manifest.batch.workflowStatus,
          manifest.batch.catalogVisibility, manifest.batch.revisesBatchId ?? null, json(manifest.batch.delta),
          json(manifest.batch.metadata ?? {}), manifestSha256, manifest.batch.metadata?.intakePurpose ?? null],
      );
      await client.query(
        `INSERT INTO registry_batch_source_events(batch_id, source_event_id, role)
         VALUES ($1, $2, 'primary')
         ON CONFLICT(batch_id, source_event_id) DO NOTHING`,
        [manifest.batch.id, manifest.sourceEvent.id],
      );

      for (const category of manifest.categories) {
        await client.query(
          `INSERT INTO registry_categories(id, name, description)
           VALUES ($1, $2, $3)
           ON CONFLICT(id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, updated_at = now()`,
          [category.id, category.name, category.description],
        );
        await client.query(
          `INSERT INTO registry_batch_categories(batch_id, category_id, declared_count, examples)
           VALUES ($1, $2, $3, $4::jsonb)`,
          [manifest.batch.id, category.id, category.count, json(category.examples ?? [])],
        );
      }

      for (const task of manifest.tasks ?? []) {
        await client.query(
          `INSERT INTO registry_tasks(id, vendor_id, stable_key, title, summary, first_seen_batch_id)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT(vendor_id, stable_key) DO UPDATE SET
             title = EXCLUDED.title,
             summary = COALESCE(EXCLUDED.summary, registry_tasks.summary),
             updated_at = now()`,
          [stableTaskId(manifest.vendor.id, task.stableKey), manifest.vendor.id, task.stableKey, task.title,
            task.summary ?? null, manifest.batch.id],
        );
        await client.query(
          `INSERT INTO registry_task_versions(
             id, task_id, batch_id, category_id, source_path, format, content_sha256,
             workflow_status, catalog_visibility, metadata, representation_kind,
             representation_path, normalization_outcome, representation_basis,
             task_kind, format_kind, task_stable_key, task_title, task_summary
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12, $13, $14,
                     $15, $16, $17, $18, $19)`,
          [task.id, stableTaskId(manifest.vendor.id, task.stableKey), manifest.batch.id, task.categoryId,
            task.sourcePath ?? null, task.format, task.contentSha256 ?? null,
            task.workflowStatus ?? manifest.batch.workflowStatus,
            task.catalogVisibility ?? manifest.batch.catalogVisibility,
            json(task.metadata ?? {}), task.representationKind ?? "unknown",
            task.representationPath ?? null, task.normalizationOutcome ?? null,
            task.representationKind ? "recorded" : "unknown",
            legacyTaskKind(task.metadata), legacyFormatKind(task.format, task.representationPath, task.normalizationOutcome),
            task.stableKey, task.title, task.summary ?? null],
        );
        for (const sourceItemId of task.sourceItemIds ?? []) {
          await client.query(
            `INSERT INTO registry_task_source_items(task_version_id, source_item_id, role)
             VALUES ($1, $2, 'normalized_from')
             ON CONFLICT(task_version_id, source_item_id, role) DO NOTHING`,
            [task.id, sourceItemId],
          );
        }
      }

      await this.insertStatusEvent(client, "submission_batch", manifest.batch.id, "submission.ingested", "case", {
        manifestSha256,
        sourceEventId: manifest.sourceEvent.id,
        taskVersions: manifest.tasks?.length ?? 0,
      });
      await this.enqueueWork(client, "parse_submission", "submission_batch", manifest.batch.id, { manifestSha256 });
      await client.query("COMMIT");
      return { batchId: manifest.batch.id, created: true };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async classifySubmissionIntake(
    input: SubmissionIntakeClassificationInput,
  ): Promise<SubmissionIntakeClassificationResult> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const batchResult = await client.query<{
        vendor_id: string;
        source_event_id: string;
        intake_purpose: string | null;
      }>(
        `SELECT vendor_id, source_event_id, intake_purpose
         FROM registry_submission_batches WHERE id = $1 FOR UPDATE`,
        [input.batchId],
      );
      const batch = batchResult.rows[0];
      if (!batch) throw new RegistryNotFoundError(`Submission ${input.batchId} does not exist`);
      if (batch.intake_purpose && batch.intake_purpose !== input.purpose) {
        throw new RegistryConflictError(
          `Submission ${input.batchId} is already classified as ${batch.intake_purpose}`,
        );
      }

      const linkedSources = await client.query<{ id: string }>(
        `SELECT DISTINCT se.id
         FROM registry_source_events se
         WHERE se.vendor_id = $1
           AND se.id = ANY($2::text[])
           AND (
             se.id = $3
             OR EXISTS (
               SELECT 1 FROM registry_batch_source_events bse
               WHERE bse.batch_id = $4 AND bse.source_event_id = se.id
             )
           )`,
        [batch.vendor_id, input.sourceEventIds, batch.source_event_id, input.batchId],
      );
      if (linkedSources.rowCount !== input.sourceEventIds.length) {
        throw new RegistryConflictError(
          `Every governing source event must belong to vendor ${batch.vendor_id} and submission ${input.batchId}`,
        );
      }

      const changed = batch.intake_purpose !== input.purpose;
      if (changed) {
        await client.query(
          "UPDATE registry_submission_batches SET intake_purpose = $2, updated_at = now() WHERE id = $1",
          [input.batchId, input.purpose],
        );
        await this.insertStatusEvent(client, "submission_batch", input.batchId, "intake.purpose_classified", input.actor, {
          purpose: input.purpose,
          sourceEventIds: input.sourceEventIds,
          reason: input.reason,
        });
      }
      await client.query("COMMIT");
      return { batchId: input.batchId, purpose: input.purpose, changed };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async listBenchmarks(): Promise<RegistryBenchmark[]> {
    const result = await this.pool.query<BenchmarkRow>(
      "SELECT id, display_name, aliases, created_at FROM registry_benchmarks ORDER BY display_name, id",
    );
    return result.rows.map(benchmarkFromRow);
  }

  async registerBenchmark(input: RegisterBenchmarkInput): Promise<RegisterBenchmarkResult> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("LOCK TABLE registry_benchmarks IN SHARE ROW EXCLUSIVE MODE");
      const existingResult = await client.query<BenchmarkRow>(
        "SELECT id, display_name, aliases, created_at FROM registry_benchmarks WHERE id = $1",
        [input.id],
      );
      const existing = existingResult.rows[0];
      if (existing) {
        if (existing.display_name !== input.displayName || hashValue(existing.aliases) !== hashValue(input.aliases ?? [])) {
          throw new RegistryConflictError(`Benchmark ${input.id} already exists with different contents`);
        }
        await client.query("COMMIT");
        return { benchmark: benchmarkFromRow(existing), created: false };
      }

      const requestedLabels = new Set([input.id, input.displayName, ...(input.aliases ?? [])].map(normalizedBenchmarkLabel));
      const allBenchmarks = await client.query<BenchmarkRow>(
        "SELECT id, display_name, aliases, created_at FROM registry_benchmarks",
      );
      for (const benchmark of allBenchmarks.rows) {
        const registeredLabels = [benchmark.id, benchmark.display_name, ...benchmark.aliases].map(normalizedBenchmarkLabel);
        if (registeredLabels.some((label) => requestedLabels.has(label))) {
          throw new RegistryConflictError(`Benchmark ${input.id} conflicts with registered benchmark ${benchmark.id}`);
        }
      }

      const inserted = await client.query<BenchmarkRow>(
        `INSERT INTO registry_benchmarks(id, display_name, aliases)
         VALUES ($1, $2, $3::jsonb)
         RETURNING id, display_name, aliases, created_at`,
        [input.id, input.displayName, json(input.aliases ?? [])],
      );
      await this.insertStatusEvent(client, "benchmark", input.id, "benchmark.registered", input.actor, {
        displayName: input.displayName,
        aliases: input.aliases ?? [],
      });
      await client.query("COMMIT");
      return { benchmark: benchmarkFromRow(inserted.rows[0]!), created: true };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async removeUnusedBenchmarks(input: RemoveUnusedBenchmarksInput): Promise<RemoveUnusedBenchmarksResult> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("LOCK TABLE registry_benchmarks IN SHARE ROW EXCLUSIVE MODE");
      await client.query("LOCK TABLE registry_task_versions, registry_task_benchmark_assignments IN SHARE MODE");

      const benchmarkResult = await client.query<BenchmarkRow>(
        `SELECT id, display_name, aliases, created_at
         FROM registry_benchmarks
         WHERE id = ANY($1::text[])
         ORDER BY display_name, id`,
        [input.benchmarkIds],
      );
      const foundIds = new Set(benchmarkResult.rows.map((row) => row.id));
      const missingIds = input.benchmarkIds.filter((id) => !foundIds.has(id));
      if (missingIds.length) throw new RegistryNotFoundError(`Benchmarks not found: ${missingIds.join(", ")}`);
      if (foundIds.has("unspecified")) throw new RegistryConflictError("The unspecified benchmark cannot be removed");

      const referencedResult = await client.query<{ benchmark_id: string; task_version_count: string; assignment_count: string }>(
        `SELECT benchmark.id AS benchmark_id,
                (SELECT COUNT(*)::text
                 FROM registry_task_versions task_version
                 WHERE task_version.benchmark_id = benchmark.id) AS task_version_count,
                (SELECT COUNT(*)::text
                 FROM registry_task_benchmark_assignments assignment
                 WHERE assignment.benchmark_id = benchmark.id) AS assignment_count
         FROM registry_benchmarks benchmark
         WHERE benchmark.id = ANY($1::text[])
           AND (EXISTS (
                  SELECT 1 FROM registry_task_versions task_version
                  WHERE task_version.benchmark_id = benchmark.id
                ) OR EXISTS (
                  SELECT 1 FROM registry_task_benchmark_assignments assignment
                  WHERE assignment.benchmark_id = benchmark.id
                ))
         ORDER BY benchmark.id`,
        [input.benchmarkIds],
      );
      if (referencedResult.rows.length) {
        const references = referencedResult.rows.map((row) =>
          `${row.benchmark_id} (${row.task_version_count} task versions, ${row.assignment_count} assignments)`,
        );
        throw new RegistryConflictError(`Referenced benchmarks cannot be removed: ${references.join("; ")}`);
      }

      const eventsResult = await client.query(
        `DELETE FROM registry_status_events
         WHERE entity_type = 'benchmark' AND entity_id = ANY($1::text[])`,
        [input.benchmarkIds],
      );
      await client.query(
        "DELETE FROM registry_benchmarks WHERE id = ANY($1::text[])",
        [input.benchmarkIds],
      );
      await client.query("COMMIT");
      return {
        removed: benchmarkResult.rows.map(benchmarkFromRow),
        registrationEventsRemoved: eventsResult.rowCount ?? 0,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async purgeErroneousBenchmarks(input: PurgeErroneousBenchmarksInput): Promise<PurgeErroneousBenchmarksResult> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("LOCK TABLE registry_benchmarks IN SHARE ROW EXCLUSIVE MODE");
      await client.query("LOCK TABLE registry_task_versions, registry_task_benchmark_assignments IN SHARE MODE");

      const benchmarkResult = await client.query<BenchmarkRow>(
        `SELECT id, display_name, aliases, created_at
         FROM registry_benchmarks
         WHERE id = ANY($1::text[])
         ORDER BY display_name, id`,
        [input.benchmarkIds],
      );
      const foundIds = new Set(benchmarkResult.rows.map((row) => row.id));
      const missingIds = input.benchmarkIds.filter((id) => !foundIds.has(id));
      if (missingIds.length) throw new RegistryNotFoundError(`Benchmarks not found: ${missingIds.join(", ")}`);
      if (foundIds.has("unspecified")) throw new RegistryConflictError("The unspecified benchmark cannot be purged");

      const compatibilityReferences = await client.query<{ benchmark_id: string; reference_count: string }>(
        `SELECT benchmark_id, COUNT(*)::text AS reference_count
         FROM registry_task_versions
         WHERE benchmark_id = ANY($1::text[])
         GROUP BY benchmark_id
         ORDER BY benchmark_id`,
        [input.benchmarkIds],
      );
      if (compatibilityReferences.rows.length) {
        const references = compatibilityReferences.rows.map((row) => `${row.benchmark_id} (${row.reference_count})`);
        throw new RegistryConflictError(
          `Benchmarks referenced by task-version compatibility snapshots cannot be purged: ${references.join("; ")}`,
        );
      }

      const currentReferences = await client.query<{ benchmark_id: string; reference_count: string }>(
        `SELECT benchmark_id, COUNT(*)::text AS reference_count
         FROM registry_current_task_benchmarks
         WHERE benchmark_id = ANY($1::text[])
         GROUP BY benchmark_id
         ORDER BY benchmark_id`,
        [input.benchmarkIds],
      );
      if (currentReferences.rows.length) {
        const references = currentReferences.rows.map((row) => `${row.benchmark_id} (${row.reference_count})`);
        throw new RegistryConflictError(`Benchmarks with current task or trace assignments cannot be purged: ${references.join("; ")}`);
      }

      const assignmentsResult = await client.query(
        `DELETE FROM registry_task_benchmark_assignments
         WHERE benchmark_id = ANY($1::text[])`,
        [input.benchmarkIds],
      );
      const eventsResult = await client.query(
        `DELETE FROM registry_status_events
         WHERE entity_type = 'benchmark' AND entity_id = ANY($1::text[])`,
        [input.benchmarkIds],
      );
      await client.query(
        "DELETE FROM registry_benchmarks WHERE id = ANY($1::text[])",
        [input.benchmarkIds],
      );
      await this.insertStatusEvent(
        client,
        "registry",
        `benchmark-purge:${hashValue(input).slice(0, 24)}`,
        "benchmark.erroneous_history_purged",
        input.actor,
        {
          benchmarkIds: input.benchmarkIds,
          reason: input.reason,
          assignmentRowsRemoved: assignmentsResult.rowCount ?? 0,
          registrationEventsRemoved: eventsResult.rowCount ?? 0,
        },
      );
      await client.query("COMMIT");
      return {
        removed: benchmarkResult.rows.map(benchmarkFromRow),
        assignmentRowsRemoved: assignmentsResult.rowCount ?? 0,
        registrationEventsRemoved: eventsResult.rowCount ?? 0,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async assignTaskBenchmarks(input: AssignTaskBenchmarksInput): Promise<AssignTaskBenchmarksResult> {
    const requestSha256 = hashValue(input);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const submissionResult = await client.query<{ intake_purpose: string | null }>(
        `SELECT COALESCE(intake_purpose, metadata->>'intakePurpose') AS intake_purpose
         FROM registry_submission_batches
         WHERE id = $1
         FOR UPDATE`,
        [input.submissionId],
      );
      const submission = submissionResult.rows[0];
      if (!submission) throw new RegistryNotFoundError(`Submission ${input.submissionId} does not exist`);
      if (submission.intake_purpose !== "sample_evaluation") {
        throw new RegistryConflictError(`Submission ${input.submissionId} is not a sample submission`);
      }

      const benchmarkIds = [...new Set(input.assignments.map((assignment) => assignment.benchmarkId))];
      const benchmarkResult = await client.query<{ id: string }>(
        "SELECT id FROM registry_benchmarks WHERE id = ANY($1::text[])",
        [benchmarkIds],
      );
      const registeredBenchmarkIds = new Set(benchmarkResult.rows.map((row) => row.id));
      for (const benchmarkId of benchmarkIds) {
        if (!registeredBenchmarkIds.has(benchmarkId)) {
          throw new RegistryNotFoundError(`Benchmark ${benchmarkId} is not registered`);
        }
      }

      const taskIds = input.assignments.map((assignment) => assignment.taskId);
      const currentResult = await client.query<CurrentTaskBenchmarkRow>(
        `SELECT tv.id AS task_version_id, current_benchmark.benchmark_id
         FROM registry_task_versions tv
         JOIN registry_current_task_benchmarks current_benchmark
           ON current_benchmark.task_version_id = tv.id
         WHERE tv.batch_id = $1
           AND tv.superseded_at IS NULL
           AND tv.id = ANY($2::text[])
         FOR UPDATE OF tv`,
        [input.submissionId, taskIds],
      );
      const currentBenchmarks = new Map(currentResult.rows.map((row) => [row.task_version_id, row.benchmark_id]));
      for (const taskId of taskIds) {
        if (!currentBenchmarks.has(taskId)) {
          throw new RegistryNotFoundError(`Active task ${taskId} does not belong to submission ${input.submissionId}`);
        }
      }

      let assignmentsAdded = 0;
      let assignmentsUnchanged = 0;
      const changes: Array<{ taskId: string; previousBenchmarkId: string; benchmarkId: string; assignmentId: string }> = [];
      for (const assignment of input.assignments) {
        const previousBenchmarkId = currentBenchmarks.get(assignment.taskId)!;
        if (previousBenchmarkId === assignment.benchmarkId) {
          assignmentsUnchanged += 1;
          continue;
        }
        const assignmentId = benchmarkAssignmentId(requestSha256, assignment.taskId);
        await client.query(
          `INSERT INTO registry_task_benchmark_assignments(
             id, task_version_id, benchmark_id, actor, reason, request_sha256
           ) VALUES ($1, $2, $3, $4, $5, $6)`,
          [assignmentId, assignment.taskId, assignment.benchmarkId, input.actor, input.reason, requestSha256],
        );
        changes.push({
          taskId: assignment.taskId,
          previousBenchmarkId,
          benchmarkId: assignment.benchmarkId,
          assignmentId,
        });
        assignmentsAdded += 1;
      }

      if (changes.length) {
        await client.query(
          "UPDATE registry_submission_batches SET updated_at = now() WHERE id = $1",
          [input.submissionId],
        );
        await this.insertStatusEvent(
          client,
          "submission_batch",
          input.submissionId,
          "benchmark.assignments_recorded",
          input.actor,
          { reason: input.reason, requestSha256, changes },
        );
      }
      await client.query("COMMIT");
      return {
        submissionId: input.submissionId,
        assignmentsAdded,
        assignmentsUnchanged,
        assignments: input.assignments,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async assignTaskGpuRequirements(input: AssignTaskGpuRequirementsInput): Promise<AssignTaskGpuRequirementsResult> {
    const requestSha256 = hashValue(input);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const submissionResult = await client.query<{ intake_purpose: string | null }>(
        `SELECT COALESCE(intake_purpose, metadata->>'intakePurpose') AS intake_purpose
         FROM registry_submission_batches
         WHERE id = $1
         FOR UPDATE`,
        [input.submissionId],
      );
      const submission = submissionResult.rows[0];
      if (!submission) throw new RegistryNotFoundError(`Submission ${input.submissionId} does not exist`);
      if (submission.intake_purpose !== "sample_evaluation") {
        throw new RegistryConflictError(`Submission ${input.submissionId} is not a sample submission`);
      }

      const taskIds = input.assignments.map((assignment) => assignment.taskId);
      const currentResult = await client.query<CurrentTaskGpuRequirementRow>(
        `SELECT tv.id AS task_version_id,
                current_gpu.gpu_required,
                current_gpu.assignment_id
         FROM registry_task_versions tv
         JOIN registry_current_task_gpu_requirements current_gpu
           ON current_gpu.task_version_id = tv.id
         WHERE tv.batch_id = $1
           AND tv.superseded_at IS NULL
           AND tv.task_kind = 'task'
           AND tv.id = ANY($2::text[])
         FOR UPDATE OF tv`,
        [input.submissionId, taskIds],
      );
      const currentRequirements = new Map(currentResult.rows.map((row) => [row.task_version_id, row]));
      for (const taskId of taskIds) {
        if (!currentRequirements.has(taskId)) {
          throw new RegistryNotFoundError(`Active task ${taskId} does not belong to submission ${input.submissionId}`);
        }
      }

      let assignmentsAdded = 0;
      let assignmentsUnchanged = 0;
      const changes: Array<{
        taskId: string;
        previousGpuRequired: boolean;
        gpuRequired: boolean;
        evidence: string;
        assignmentId: string;
      }> = [];
      for (const assignment of input.assignments) {
        const currentRequirement = currentRequirements.get(assignment.taskId)!;
        const previousGpuRequired = currentRequirement.gpu_required;
        if (currentRequirement.assignment_id !== null && previousGpuRequired === assignment.gpuRequired) {
          assignmentsUnchanged += 1;
          continue;
        }
        const assignmentId = gpuRequirementAssignmentId(requestSha256, assignment.taskId);
        await client.query(
          `INSERT INTO registry_task_gpu_requirement_assignments(
             id, task_version_id, gpu_required, evidence, actor, reason, request_sha256
           ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [assignmentId, assignment.taskId, assignment.gpuRequired, assignment.evidence,
            input.actor, input.reason, requestSha256],
        );
        changes.push({
          taskId: assignment.taskId,
          previousGpuRequired,
          gpuRequired: assignment.gpuRequired,
          evidence: assignment.evidence,
          assignmentId,
        });
        assignmentsAdded += 1;
      }

      if (changes.length) {
        await client.query(
          "UPDATE registry_submission_batches SET updated_at = now() WHERE id = $1",
          [input.submissionId],
        );
        await this.insertStatusEvent(
          client,
          "submission_batch",
          input.submissionId,
          "gpu_requirement.assignments_recorded",
          input.actor,
          { reason: input.reason, requestSha256, changes },
        );
      }
      await client.query("COMMIT");
      return {
        submissionId: input.submissionId,
        assignmentsAdded,
        assignmentsUnchanged,
        assignments: input.assignments,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async appendTasks(input: AppendTasksInput): Promise<AppendTasksResult> {
    const requestSha256 = hashValue(input);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const batchResult = await client.query<{
        vendor_id: string;
        workflow_status: string;
        catalog_visibility: string;
        intake_purpose: string | null;
        formats: string[];
      }>(
        `SELECT vendor_id, workflow_status, catalog_visibility, formats,
                COALESCE(intake_purpose, metadata->>'intakePurpose') AS intake_purpose
         FROM registry_submission_batches WHERE id = $1 FOR UPDATE`,
        [input.submissionId],
      );
      const batch = batchResult.rows[0];
      if (!batch) throw new RegistryNotFoundError(`Submission ${input.submissionId} does not exist`);
      if (batch.intake_purpose !== "sample_evaluation") {
        throw new RegistryConflictError(`Submission ${input.submissionId} is not a sample submission`);
      }

      const artifactIds = [...new Set(input.tasks.map((task) => task.artifactId))];
      const artifactResult = await client.query<{ id: string; sha256: string }>(
        "SELECT id, sha256 FROM registry_artifacts WHERE id = ANY($1::text[])",
        [artifactIds],
      );
      const artifacts = new Map(artifactResult.rows.map((artifact) => [artifact.id, artifact.sha256]));
      for (const task of input.tasks) {
        if (artifacts.get(task.artifactId) !== task.contentSha256) {
          throw new RegistryConflictError(`Task ${task.id} must reference its exact immutable artifact`);
        }
      }

      const sourceItemIds = [...new Set(input.tasks.flatMap((task) => task.sourceItemIds))];
      const sourceResult = await client.query<{ id: string }>(
        `SELECT DISTINCT si.id
         FROM registry_source_items si
         WHERE si.id = ANY($1::text[])
           AND (
             EXISTS (
               SELECT 1 FROM registry_batch_source_items bsi
               WHERE bsi.batch_id = $2 AND bsi.source_item_id = si.id
             )
             OR EXISTS (
               SELECT 1 FROM registry_batch_source_events bse
               WHERE bse.batch_id = $2 AND bse.source_event_id = si.source_event_id
             )
           )`,
        [sourceItemIds, input.submissionId],
      );
      const linkedSourceIds = new Set(sourceResult.rows.map((row) => row.id));
      for (const sourceItemId of sourceItemIds) {
        if (!linkedSourceIds.has(sourceItemId)) {
          throw new RegistryConflictError(`Source item ${sourceItemId} is not linked to submission ${input.submissionId}`);
        }
      }

      const benchmarkIds = [...new Set(input.tasks.map((task) => task.benchmarkId))];
      const benchmarkResult = await client.query<{ id: string }>(
        "SELECT id FROM registry_benchmarks WHERE id = ANY($1::text[])",
        [benchmarkIds],
      );
      const registeredBenchmarkIds = new Set(benchmarkResult.rows.map((row) => row.id));
      for (const benchmarkId of benchmarkIds) {
        if (!registeredBenchmarkIds.has(benchmarkId)) {
          throw new RegistryNotFoundError(`Benchmark ${benchmarkId} is not registered`);
        }
      }

      const compatibilityCategoryId = "case:tasks";
      await client.query(
        `INSERT INTO registry_categories(id, name, description)
         VALUES ($1, 'Tasks', 'Compatibility row for the pre-014 schema.')
         ON CONFLICT(id) DO NOTHING`,
        [compatibilityCategoryId],
      );
      await client.query(
        `INSERT INTO registry_batch_categories(batch_id, category_id, declared_count, examples)
         VALUES ($1, $2, 0, '[]'::jsonb)
         ON CONFLICT(batch_id, category_id) DO NOTHING`,
        [input.submissionId, compatibilityCategoryId],
      );

      let tasksAdded = 0;
      for (const task of input.tasks) {
        const taskId = stableTaskId(batch.vendor_id, task.stableKey);
        await client.query(
          `INSERT INTO registry_tasks(id, vendor_id, stable_key, title, summary, first_seen_batch_id)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT(vendor_id, stable_key) DO NOTHING`,
          [taskId, batch.vendor_id, task.stableKey, task.title, task.summary ?? null, input.submissionId],
        );

        const existing = await client.query<{
          id: string;
          batch_id: string;
          task_stable_key: string;
          task_title: string;
          task_summary: string | null;
          task_kind: string;
          format_kind: string;
          benchmark_id: string;
          source_path: string | null;
          artifact_id: string | null;
          content_sha256: string | null;
        }>(
          `SELECT tv.id, tv.batch_id, tv.task_stable_key, tv.task_title, tv.task_summary,
                  tv.task_kind, tv.format_kind, current_benchmark.benchmark_id,
                  tv.source_path, tv.artifact_id, tv.content_sha256
           FROM registry_task_versions tv
           JOIN registry_current_task_benchmarks current_benchmark
             ON current_benchmark.task_version_id = tv.id
           WHERE tv.superseded_at IS NULL
             AND (tv.id = $1 OR (tv.batch_id = $2 AND tv.task_id = $3))
           FOR UPDATE OF tv`,
          [task.id, input.submissionId, taskId],
        );
        const current = existing.rows[0];
        if (current) {
          const immutableMatches = current.id === task.id
            && current.batch_id === input.submissionId
            && current.task_stable_key === task.stableKey
            && current.task_title === task.title
            && current.task_summary === (task.summary ?? null)
            && current.task_kind === task.kind
            && current.format_kind === task.format
            && current.source_path === task.sourcePath
            && current.artifact_id === task.artifactId
            && current.content_sha256 === task.contentSha256;
          if (!immutableMatches) throw new RegistryConflictError(`Task ${task.id} already exists with different immutable contents`);
          if (current.benchmark_id !== task.benchmarkId) {
            throw new RegistryConflictError(`Task ${task.id} already exists; use assign-task-benchmarks to change its benchmark`);
          }
        } else {
          await client.query(
            `INSERT INTO registry_task_versions(
               id, task_id, batch_id, category_id, source_path, format, artifact_id, content_sha256,
               workflow_status, catalog_visibility, metadata, representation_kind, representation_path,
               normalization_outcome, representation_basis, task_kind, format_kind,
               task_stable_key, task_title, task_summary, benchmark_id
             ) VALUES (
               $1, $2, $3, $4, $5, $6, $7, $8,
               $9, $10, '{}'::jsonb, 'unknown', NULL, NULL, 'unknown', $11, $12, $13, $14, $15, $16
             )`,
            [task.id, taskId, input.submissionId, compatibilityCategoryId, task.sourcePath, task.format,
              task.artifactId, task.contentSha256, batch.workflow_status, batch.catalog_visibility,
              task.kind, task.format, task.stableKey, task.title, task.summary ?? null, task.benchmarkId],
          );
          await client.query(
            `INSERT INTO registry_task_benchmark_assignments(
               id, task_version_id, benchmark_id, actor, reason, request_sha256
             ) VALUES ($1, $2, $3, $4, $5, $6)`,
            [benchmarkAssignmentId(requestSha256, task.id), task.id, task.benchmarkId, input.actor,
              "Initial benchmark assignment during task registration.", requestSha256],
          );
          tasksAdded += 1;
          if (task.format === "harbor") {
            await this.enqueueWork(client, "harbor_checks", "task", task.id, {
              phases: ["environment", "oracle", "nop"],
            });
          }
        }
        for (const sourceItemId of task.sourceItemIds) {
          await client.query(
            `INSERT INTO registry_task_source_items(task_version_id, source_item_id, role)
             VALUES ($1, $2, 'discovered_in')
             ON CONFLICT(task_version_id, source_item_id, role) DO NOTHING`,
            [task.id, sourceItemId],
          );
        }
      }

      if (tasksAdded) {
        const mergedFormats = [...new Set([...batch.formats, ...input.tasks.map((task) => task.format)])].sort();
        await client.query(
          "UPDATE registry_submission_batches SET formats = $2::jsonb, updated_at = now() WHERE id = $1",
          [input.submissionId, json(mergedFormats)],
        );
        await client.query(
          `UPDATE registry_batch_categories
           SET declared_count = (
             SELECT COUNT(*) FROM registry_task_versions
             WHERE batch_id = $1 AND superseded_at IS NULL
           )
           WHERE batch_id = $1 AND category_id = $2`,
          [input.submissionId, compatibilityCategoryId],
        );
        await this.insertStatusEvent(client, "submission_batch", input.submissionId, "parsing.tasks_registered", input.actor, {
          taskIds: input.tasks.map((task) => task.id),
        });
      }
      await client.query("COMMIT");
      return { submissionId: input.submissionId, tasksAdded, taskIds: input.tasks.map((task) => task.id) };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async reconcileSubmissionTasks(input: ReconcileSubmissionTasksInput): Promise<ReconcileSubmissionTasksResult> {
    const requestSha256 = hashValue(input);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const batchResult = await client.query<{
        vendor_id: string;
        workflow_status: string;
        catalog_visibility: string;
        intake_purpose: string | null;
      }>(
        `SELECT vendor_id, workflow_status, catalog_visibility,
                COALESCE(intake_purpose, metadata->>'intakePurpose') AS intake_purpose
         FROM registry_submission_batches WHERE id = $1 FOR UPDATE`,
        [input.submissionId],
      );
      const batch = batchResult.rows[0];
      if (!batch) throw new RegistryNotFoundError(`Submission ${input.submissionId} does not exist`);
      if (batch.intake_purpose !== "sample_evaluation") {
        throw new RegistryConflictError(`Submission ${input.submissionId} is not a sample submission`);
      }

      const artifactIds = [...new Set(input.tasks.flatMap((task) => task.artifactId ? [task.artifactId] : []))];
      const artifactResult = await client.query<{ id: string; sha256: string }>(
        "SELECT id, sha256 FROM registry_artifacts WHERE id = ANY($1::text[])",
        [artifactIds],
      );
      const artifacts = new Map(artifactResult.rows.map((artifact) => [artifact.id, artifact.sha256]));
      for (const task of input.tasks) {
        if (!task.artifactId) continue;
        if (artifacts.get(task.artifactId) !== task.contentSha256) {
          throw new RegistryConflictError(`Task ${task.id} must reference its exact immutable artifact`);
        }
      }

      const sourceItemIds = [...new Set(input.tasks.flatMap((task) => task.sourceItemIds))];
      const sourceResult = await client.query<{ id: string }>(
        `SELECT DISTINCT si.id
         FROM registry_source_items si
         WHERE si.id = ANY($1::text[])
           AND (
             EXISTS (
               SELECT 1 FROM registry_batch_source_items bsi
               WHERE bsi.batch_id = $2 AND bsi.source_item_id = si.id
             )
             OR EXISTS (
               SELECT 1 FROM registry_batch_source_events bse
               WHERE bse.batch_id = $2 AND bse.source_event_id = si.source_event_id
             )
           )`,
        [sourceItemIds, input.submissionId],
      );
      const linkedSourceIds = new Set(sourceResult.rows.map((row) => row.id));
      for (const sourceItemId of sourceItemIds) {
        if (!linkedSourceIds.has(sourceItemId)) {
          throw new RegistryConflictError(`Source item ${sourceItemId} is not linked to submission ${input.submissionId}`);
        }
      }

      const benchmarkIds = [...new Set(input.tasks.map((task) => task.benchmarkId))];
      const benchmarkResult = await client.query<{ id: string }>(
        "SELECT id FROM registry_benchmarks WHERE id = ANY($1::text[])",
        [benchmarkIds],
      );
      const registeredBenchmarkIds = new Set(benchmarkResult.rows.map((row) => row.id));
      for (const benchmarkId of benchmarkIds) {
        if (!registeredBenchmarkIds.has(benchmarkId)) {
          throw new RegistryNotFoundError(`Benchmark ${benchmarkId} is not registered`);
        }
      }

      const compatibilityCategoryId = "case:tasks";
      await client.query(
        `INSERT INTO registry_categories(id, name, description)
         VALUES ($1, 'Tasks', 'Compatibility row for the active task-registration schema.')
         ON CONFLICT(id) DO NOTHING`,
        [compatibilityCategoryId],
      );
      await client.query(
        `INSERT INTO registry_batch_categories(batch_id, category_id, declared_count, examples)
         VALUES ($1, $2, 0, '[]'::jsonb)
         ON CONFLICT(batch_id, category_id) DO NOTHING`,
        [input.submissionId, compatibilityCategoryId],
      );

      type ActiveTaskVersionRow = {
        id: string;
        task_id: string;
        category_id: string;
        task_stable_key: string;
        task_title: string;
        task_summary: string | null;
        task_kind: string;
        format_kind: string;
        benchmark_id: string;
        source_path: string | null;
        artifact_id: string | null;
        content_sha256: string | null;
      };
      const activeResult = await client.query<ActiveTaskVersionRow>(
        `SELECT tv.id, tv.task_id, tv.category_id, tv.task_stable_key, tv.task_title, tv.task_summary,
                tv.task_kind, tv.format_kind, current_benchmark.benchmark_id,
                tv.source_path, tv.artifact_id, tv.content_sha256
         FROM registry_task_versions tv
         JOIN registry_current_task_benchmarks current_benchmark
           ON current_benchmark.task_version_id = tv.id
         WHERE tv.batch_id = $1 AND tv.superseded_at IS NULL
         FOR UPDATE OF tv`,
        [input.submissionId],
      );
      const activeByTaskId = new Map(activeResult.rows.map((row) => [row.task_id, row]));
      const activeIds = activeResult.rows.map((row) => row.id);
      const activeSourceResult = activeIds.length
        ? await client.query<{ task_version_id: string; source_item_id: string }>(
          `SELECT DISTINCT task_version_id, source_item_id
           FROM registry_task_source_items
           WHERE task_version_id = ANY($1::text[])
           ORDER BY source_item_id`,
          [activeIds],
        )
        : { rows: [] as Array<{ task_version_id: string; source_item_id: string }> };
      const activeSourceIds = new Map<string, string[]>();
      for (const row of activeSourceResult.rows) {
        const values = activeSourceIds.get(row.task_version_id) ?? [];
        values.push(row.source_item_id);
        activeSourceIds.set(row.task_version_id, values);
      }

      const desiredTaskIds = new Set<string>();
      const activeTaskVersionIds: string[] = [];
      const supersededTaskVersionIds: string[] = [];
      const retiredTaskVersionIds: string[] = [];
      let taskVersionsAdded = 0;
      let taskVersionsUnchanged = 0;
      let benchmarkAssignmentsAdded = 0;
      let benchmarkAssignmentsUnchanged = 0;

      for (const task of input.tasks) {
        const taskId = stableTaskId(batch.vendor_id, task.stableKey);
        if (desiredTaskIds.has(taskId)) {
          throw new RegistryConflictError(`Task stable key ${task.stableKey} is repeated`);
        }
        desiredTaskIds.add(taskId);
        activeTaskVersionIds.push(task.id);

        await client.query(
          `INSERT INTO registry_tasks(id, vendor_id, stable_key, title, summary, first_seen_batch_id)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT(vendor_id, stable_key) DO NOTHING`,
          [taskId, batch.vendor_id, task.stableKey, task.title, task.summary ?? null, input.submissionId],
        );

        const current = activeByTaskId.get(taskId);
        const sourceIds = [...task.sourceItemIds].sort();
        const currentSourceIds = current ? [...(activeSourceIds.get(current.id) ?? [])].sort() : [];
        const sameContents = current
          ? current.task_stable_key === task.stableKey
          && current.task_title === task.title
          && current.task_summary === (task.summary ?? null)
          && current.task_kind === task.kind
          && current.format_kind === task.format
          && current.source_path === task.sourcePath
          && current.artifact_id === task.artifactId
          && current.content_sha256 === task.contentSha256
          && hashValue(currentSourceIds) === hashValue(sourceIds)
          : false;
        if (current && sameContents && current.id !== task.id) {
          throw new RegistryConflictError(
            `Task ${current.id} has unchanged contents; keep its version id and use assign-task-benchmarks for a benchmark correction`,
          );
        }
        if (current && sameContents && current.id === task.id) {
          if (current.benchmark_id === task.benchmarkId) {
            benchmarkAssignmentsUnchanged += 1;
          } else {
            await client.query(
              `INSERT INTO registry_task_benchmark_assignments(
                 id, task_version_id, benchmark_id, actor, reason, request_sha256
               ) VALUES ($1, $2, $3, $4, $5, $6)`,
              [benchmarkAssignmentId(requestSha256, current.id), current.id, task.benchmarkId,
                input.actor, input.reason, requestSha256],
            );
            benchmarkAssignmentsAdded += 1;
          }
          taskVersionsUnchanged += 1;
          continue;
        }

        if (!task.artifactId) {
          throw new RegistryConflictError(
            `Task ${task.id} may omit artifactId only when retaining an unchanged legacy active version`,
          );
        }

        if (current) {
          await client.query(
            `UPDATE registry_task_versions
             SET superseded_at = now(), updated_at = now()
             WHERE id = $1 AND superseded_at IS NULL`,
            [current.id],
          );
          supersededTaskVersionIds.push(current.id);
        }

        const conflictingId = await client.query<{ id: string }>(
          "SELECT id FROM registry_task_versions WHERE id = $1",
          [task.id],
        );
        if (conflictingId.rows[0]) {
          throw new RegistryConflictError(`Task version ${task.id} already exists`);
        }

        await client.query(
          `INSERT INTO registry_task_versions(
             id, task_id, batch_id, category_id, source_path, format, artifact_id, content_sha256,
             workflow_status, catalog_visibility, metadata, representation_kind, representation_path,
             normalization_outcome, representation_basis, task_kind, format_kind,
             task_stable_key, task_title, task_summary, benchmark_id
           ) VALUES (
             $1, $2, $3, $4, $5, $6, $7, $8,
             $9, $10, $11::jsonb, 'unknown', NULL,
             NULL, 'recorded', $12, $13,
             $14, $15, $16, $17
           )`,
          [task.id, taskId, input.submissionId, current?.category_id ?? compatibilityCategoryId,
            task.sourcePath, task.format, task.artifactId, task.contentSha256,
            batch.workflow_status, batch.catalog_visibility,
            json({ reconciliationRequestSha256: requestSha256, reconciliationReason: input.reason }),
            task.kind, task.format, task.stableKey, task.title, task.summary ?? null, task.benchmarkId],
        );
        await client.query(
          `INSERT INTO registry_task_benchmark_assignments(
             id, task_version_id, benchmark_id, actor, reason, request_sha256
           ) VALUES ($1, $2, $3, $4, $5, $6)`,
          [benchmarkAssignmentId(requestSha256, task.id), task.id, task.benchmarkId,
            input.actor, input.reason, requestSha256],
        );
        benchmarkAssignmentsAdded += 1;
        for (const sourceItemId of task.sourceItemIds) {
          await client.query(
            `INSERT INTO registry_task_source_items(task_version_id, source_item_id, role)
             VALUES ($1, $2, 'discovered_in')`,
            [task.id, sourceItemId],
          );
        }
        if (current) {
          await client.query(
            "UPDATE registry_task_versions SET superseded_by_task_version_id = $2 WHERE id = $1",
            [current.id, task.id],
          );
        } else if (task.format === "harbor" && task.kind === "task") {
          await this.enqueueWork(client, "harbor_checks", "task", task.id, {
            phases: ["environment", "oracle", "nop"],
          });
        }
        taskVersionsAdded += 1;
      }

      for (const current of activeResult.rows) {
        if (desiredTaskIds.has(current.task_id)) continue;
        await client.query(
          `UPDATE registry_task_versions
           SET superseded_at = now(), updated_at = now()
           WHERE id = $1 AND superseded_at IS NULL`,
          [current.id],
        );
        supersededTaskVersionIds.push(current.id);
        retiredTaskVersionIds.push(current.id);
      }

      await client.query(
        `UPDATE registry_batch_categories bc
         SET declared_count = (
           SELECT COUNT(*)
           FROM registry_task_versions tv
           WHERE tv.batch_id = bc.batch_id
             AND tv.category_id = bc.category_id
             AND tv.superseded_at IS NULL
         )
         WHERE bc.batch_id = $1`,
        [input.submissionId],
      );
      await client.query(
        `UPDATE registry_submission_batches
         SET formats = COALESCE((
           SELECT jsonb_agg(format_kind ORDER BY format_kind)
           FROM (
             SELECT DISTINCT format_kind
             FROM registry_task_versions
             WHERE batch_id = $1 AND superseded_at IS NULL
           ) active_formats
         ), '[]'::jsonb),
             updated_at = now()
         WHERE id = $1`,
        [input.submissionId],
      );
      await this.insertStatusEvent(
        client,
        "submission_batch",
        input.submissionId,
        "parsing.tasks_reconciled",
        input.actor,
        {
          reason: input.reason,
          requestSha256,
          activeTaskVersionIds,
          taskVersionsAdded,
          taskVersionsUnchanged,
          benchmarkAssignmentsAdded,
          benchmarkAssignmentsUnchanged,
          supersededTaskVersionIds,
          retiredTaskVersionIds,
        },
      );

      await client.query("COMMIT");
      return {
        submissionId: input.submissionId,
        activeTaskVersionIds,
        taskVersionsAdded,
        taskVersionsUnchanged,
        taskVersionsSuperseded: supersededTaskVersionIds.length,
        supersededTaskVersionIds,
        retiredTaskVersionIds,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private async appendNormalizedTasks(input: AppendNormalizedTasksInput): Promise<AppendNormalizedTasksResult> {
    const requestSha256 = hashValue(input);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const batchResult = await client.query<{
        vendor_id: string;
        workflow_status: string;
        catalog_visibility: string;
        intake_purpose: string | null;
      }>(
        `SELECT vendor_id, workflow_status, catalog_visibility,
                COALESCE(intake_purpose, metadata->>'intakePurpose') AS intake_purpose
         FROM registry_submission_batches WHERE id = $1 FOR UPDATE`,
        [input.batchId],
      );
      const batch = batchResult.rows[0];
      if (!batch) throw new RegistryNotFoundError(`Submission ${input.batchId} does not exist`);
      if (batch.intake_purpose !== "sample_evaluation") {
        throw new RegistryConflictError(`Submission ${input.batchId} is not an evaluation-sample intake`);
      }

      const artifactIds = [...new Set(input.tasks.map((task) => task.artifactId))];
      const artifactResult = await client.query<{ id: string; kind: string; sha256: string }>(
        `SELECT id, kind, sha256 FROM registry_artifacts WHERE id = ANY($1::text[])`,
        [artifactIds],
      );
      const artifacts = new Map(artifactResult.rows.map((artifact) => [artifact.id, artifact]));
      for (const task of input.tasks) {
        const artifact = artifacts.get(task.artifactId);
        if (!artifact) throw new RegistryNotFoundError(`Task artifact ${task.artifactId} does not exist`);
        if (artifact.kind !== "task_package" || artifact.sha256 !== task.contentSha256) {
          throw new RegistryConflictError(`Task artifact ${task.artifactId} is not the declared immutable task package`);
        }
      }

      const sourceItemIds = [...new Set(input.tasks.flatMap((task) => task.sourceItemIds))];
      const sourceResult = await client.query<{ id: string; artifact_id: string | null }>(
        `SELECT DISTINCT si.id, si.artifact_id
         FROM registry_source_items si
         WHERE si.id = ANY($1::text[])
           AND (
             EXISTS (
               SELECT 1 FROM registry_batch_source_items bsi
               WHERE bsi.batch_id = $2 AND bsi.source_item_id = si.id
             )
             OR EXISTS (
               SELECT 1 FROM registry_batch_source_events bse
               WHERE bse.batch_id = $2 AND bse.source_event_id = si.source_event_id
             )
           )`,
        [sourceItemIds, input.batchId],
      );
      const sources = new Map(sourceResult.rows.map((source) => [source.id, source]));
      for (const sourceItemId of sourceItemIds) {
        if (!sources.has(sourceItemId)) {
          throw new RegistryConflictError(`Source item ${sourceItemId} is not linked to submission ${input.batchId}`);
        }
      }
      for (const task of input.tasks) {
        if (!task.sourceItemIds.some((sourceItemId) => sources.get(sourceItemId)?.artifact_id === task.artifactId)) {
          throw new RegistryConflictError(`Task ${task.id} must cite its task-package source item`);
        }
      }

      let categoriesAdded = 0;
      for (const category of input.categories) {
        const existingCategory = await client.query<{ name: string; description: string }>(
          "SELECT name, description FROM registry_categories WHERE id = $1",
          [category.id],
        );
        if (existingCategory.rows[0]) {
          if (existingCategory.rows[0].name !== category.name || existingCategory.rows[0].description !== category.description) {
            throw new RegistryConflictError(`Category ${category.id} already exists with different contents`);
          }
        } else {
          await client.query(
            `INSERT INTO registry_categories(id, name, description) VALUES ($1, $2, $3)`,
            [category.id, category.name, category.description],
          );
        }

        const existingBatchCategory = await client.query<{ declared_count: number; examples: string[] }>(
          `SELECT declared_count, examples FROM registry_batch_categories
           WHERE batch_id = $1 AND category_id = $2`,
          [input.batchId, category.id],
        );
        if (existingBatchCategory.rows[0]) {
          if (
            existingBatchCategory.rows[0].declared_count !== category.count
            || hashValue(existingBatchCategory.rows[0].examples) !== hashValue(category.examples ?? [])
          ) {
            throw new RegistryConflictError(`Submission category ${category.id} already exists with different contents`);
          }
        } else {
          await client.query(
            `INSERT INTO registry_batch_categories(batch_id, category_id, declared_count, examples)
             VALUES ($1, $2, $3, $4::jsonb)`,
            [input.batchId, category.id, category.count, json(category.examples ?? [])],
          );
          categoriesAdded += 1;
        }
      }

      let taskVersionsAdded = 0;
      let taskVersionsFinalized = 0;
      for (const task of input.tasks) {
        const taskId = stableTaskId(batch.vendor_id, task.stableKey);
        await client.query(
          `INSERT INTO registry_tasks(id, vendor_id, stable_key, title, summary, first_seen_batch_id)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT(vendor_id, stable_key) DO UPDATE SET
             title = EXCLUDED.title,
             summary = COALESCE(EXCLUDED.summary, registry_tasks.summary),
             updated_at = now()`,
          [taskId, batch.vendor_id, task.stableKey, task.title, task.summary ?? null, input.batchId],
        );

        const existingVersion = await client.query<{
          id: string;
          task_id: string;
          batch_id: string;
          category_id: string;
          source_path: string | null;
          format: string;
          representation_kind: CatalogTask["representation"]["kind"];
          representation_path: CatalogTask["representation"]["path"];
          normalization_outcome: CatalogTask["representation"]["normalizationOutcome"];
          representation_basis: CatalogTask["representation"]["basis"];
          artifact_id: string | null;
          content_sha256: string | null;
          workflow_status: string;
          catalog_visibility: string;
          metadata: Record<string, unknown>;
        }>(
          `SELECT id, task_id, batch_id, category_id, source_path, format,
                  representation_kind, representation_path, normalization_outcome, representation_basis,
                  artifact_id, content_sha256, workflow_status, catalog_visibility, metadata
           FROM registry_task_versions
           WHERE superseded_at IS NULL
             AND (id = $1 OR (batch_id = $2 AND task_id = $3))
           FOR UPDATE`,
          [task.id, input.batchId, taskId],
        );
        const expected = {
          id: task.id,
          task_id: taskId,
          batch_id: input.batchId,
          category_id: task.categoryId,
          source_path: task.sourcePath,
          format: task.format,
          representation_kind: task.representationKind,
          representation_path: task.representationPath,
          normalization_outcome: task.normalizationOutcome,
          representation_basis: "recorded" as const,
          artifact_id: task.artifactId,
          content_sha256: task.contentSha256,
          workflow_status: task.workflowStatus ?? batch.workflow_status,
          catalog_visibility: task.catalogVisibility ?? batch.catalog_visibility,
          metadata: task.metadata ?? {},
        };
        const current = existingVersion.rows[0];
        if (current) {
          if (registeredTaskVersionMatches(current, expected)) {
            // Idempotent replay of an already registered exact task version.
          } else if (canFinalizeUnboundTaskVersion(current, expected)) {
            const metadata = mergeCompatibleMetadata(current.metadata, expected.metadata, task.id);
            await client.query(
              `UPDATE registry_task_versions
               SET artifact_id = $2, content_sha256 = $3, workflow_status = $4,
                   metadata = $5::jsonb, representation_kind = $6, representation_path = $7,
                   normalization_outcome = $8, representation_basis = 'recorded', updated_at = now()
               WHERE id = $1`,
              [task.id, task.artifactId, task.contentSha256, expected.workflow_status, json(metadata),
                task.representationKind, task.representationPath, task.normalizationOutcome],
            );
            taskVersionsFinalized += 1;
            await this.insertStatusEvent(client, "task_version", task.id, "normalization.task_finalized", input.actor, {
              reason: input.reason,
              requestSha256,
              artifactId: task.artifactId,
              contentSha256: task.contentSha256,
            });
          } else {
            throw new RegistryConflictError(`Task version ${task.id} already exists with different immutable contents`);
          }
        } else {
          await client.query(
            `INSERT INTO registry_task_versions(
               id, task_id, batch_id, category_id, source_path, format, artifact_id, content_sha256,
               workflow_status, catalog_visibility, metadata, representation_kind, representation_path,
               normalization_outcome, representation_basis, task_kind, format_kind,
               task_stable_key, task_title, task_summary
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, $13, $14, 'recorded',
                       $15, $16, $17, $18, $19)`,
            [task.id, taskId, input.batchId, task.categoryId, task.sourcePath, task.format,
              task.artifactId, task.contentSha256, expected.workflow_status, expected.catalog_visibility,
              json(task.metadata ?? {}), task.representationKind, task.representationPath, task.normalizationOutcome,
              legacyTaskKind(task.metadata), legacyFormatKind(task.format, task.representationPath, task.normalizationOutcome),
              task.stableKey, task.title, task.summary ?? null],
          );
          taskVersionsAdded += 1;
        }
        for (const sourceItemId of task.sourceItemIds) {
          await client.query(
            `INSERT INTO registry_task_source_items(task_version_id, source_item_id, role)
             VALUES ($1, $2, 'normalized_from')
             ON CONFLICT(task_version_id, source_item_id, role) DO NOTHING`,
            [task.id, sourceItemId],
          );
        }
      }

      if (taskVersionsAdded > 0 || taskVersionsFinalized > 0 || categoriesAdded > 0) {
        await this.insertStatusEvent(client, "submission_batch", input.batchId, "normalization.tasks_appended", input.actor, {
          reason: input.reason,
          requestSha256,
          categoriesAdded,
          taskVersionsAdded,
          taskVersionsFinalized,
          taskVersionIds: input.tasks.map((task) => task.id),
        });
        await this.enqueueWork(client, "check_submission", "submission_batch", input.batchId, {
          reason: "normalized_tasks_appended",
          requestSha256,
          taskVersionIds: input.tasks.map((task) => task.id),
        });
      }
      await client.query("COMMIT");
      return {
        batchId: input.batchId,
        categoriesAdded,
        taskVersionsAdded,
        taskVersionsFinalized,
        taskVersionIds: input.tasks.map((task) => task.id),
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async removeSubmission(input: SubmissionRemovalInput): Promise<SubmissionRemovalResult> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const batch = await client.query<{ vendor_id: string }>(
        "SELECT vendor_id FROM registry_submission_batches WHERE id = $1 FOR UPDATE",
        [input.batchId],
      );
      const vendorId = batch.rows[0]?.vendor_id;
      if (!vendorId) throw new RegistryNotFoundError(`Submission ${input.batchId} does not exist`);

      const detachedRevisions = await client.query<{ id: string }>(
        `UPDATE registry_submission_batches
         SET revises_batch_id = NULL, updated_at = now()
         WHERE revises_batch_id = $1
         RETURNING id`,
        [input.batchId],
      );
      const detachedRevisionBatchIds = detachedRevisions.rows.map((row) => row.id).sort();
      for (const batchId of detachedRevisionBatchIds) {
        await this.insertStatusEvent(client, "submission_batch", batchId, "submission.revision_reference_removed", input.actor, {
          disposition: input.disposition,
          reason: input.reason,
          removedSubmissionId: input.batchId,
        });
      }

      const taskVersions = await client.query<{ id: string; task_id: string; artifact_id: string | null }>(
        `SELECT id, task_id, artifact_id
         FROM registry_task_versions
         WHERE batch_id = $1
         FOR UPDATE`,
        [input.batchId],
      );
      const removedTaskVersionIds = taskVersions.rows.map((row) => row.id).sort();
      const firstSeenTasks = await client.query<{ id: string; replacement_batch_id: string | null }>(
        `SELECT t.id,
                (
                  SELECT tv.batch_id
                  FROM registry_task_versions tv
                  JOIN registry_submission_batches replacement ON replacement.id = tv.batch_id
                  WHERE tv.task_id = t.id AND tv.batch_id <> $1
                  ORDER BY replacement.submission_date, tv.created_at, tv.id
                  LIMIT 1
                ) AS replacement_batch_id
         FROM registry_tasks t
         WHERE t.first_seen_batch_id = $1
         FOR UPDATE OF t`,
        [input.batchId],
      );
      const removedTaskIds = firstSeenTasks.rows
        .filter((row) => !row.replacement_batch_id)
        .map((row) => row.id)
        .sort();
      for (const task of firstSeenTasks.rows) {
        if (!task.replacement_batch_id) continue;
        await client.query(
          "UPDATE registry_tasks SET first_seen_batch_id = $2, updated_at = now() WHERE id = $1",
          [task.id, task.replacement_batch_id],
        );
      }
      const affectedTaskIds = [...new Set([
        ...taskVersions.rows.map((row) => row.task_id),
        ...firstSeenTasks.rows.map((row) => row.id),
      ])].sort();
      const retainedTaskIds = affectedTaskIds.filter((id) => !removedTaskIds.includes(id));
      const trajectoryArtifacts = removedTaskVersionIds.length ? await client.query<{ id: string }>(
        `SELECT artifact_id AS id
         FROM registry_trajectories
         WHERE task_version_id = ANY($1::text[]) AND artifact_id IS NOT NULL`,
        [removedTaskVersionIds],
      ) : { rows: [] as Array<{ id: string }> };
      const checkArtifacts = removedTaskVersionIds.length ? await client.query<{ id: string }>(
        `SELECT evidence_artifact_id AS id
         FROM registry_check_runs
         WHERE task_version_id = ANY($1::text[]) AND evidence_artifact_id IS NOT NULL
         UNION
         SELECT evidence_artifact_id AS id
         FROM registry_harbor_check_attempts
         WHERE task_version_id = ANY($1::text[])`,
        [removedTaskVersionIds],
      ) : { rows: [] as Array<{ id: string }> };
      const taskArtifactIds = [
        ...taskVersions.rows.flatMap((row) => row.artifact_id ? [row.artifact_id] : []),
        ...trajectoryArtifacts.rows.map((row) => row.id),
        ...checkArtifacts.rows.map((row) => row.id),
      ];

      const linkedEvents = await client.query<{ id: string }>(
        `SELECT source_event_id AS id FROM registry_batch_source_events WHERE batch_id = $1
         UNION
         SELECT source_event_id AS id FROM registry_submission_batches WHERE id = $1`,
        [input.batchId],
      );
      const linkedEventIds = linkedEvents.rows.map((row) => row.id).sort();
      const removableEvents = linkedEventIds.length ? await client.query<{ id: string }>(
        `SELECT se.id
         FROM registry_source_events se
         WHERE se.id = ANY($1::text[])
           AND NOT EXISTS (
             SELECT 1 FROM registry_batch_source_events other
             WHERE other.source_event_id = se.id AND other.batch_id <> $2
           )
           AND NOT EXISTS (
             SELECT 1 FROM registry_submission_batches other
             WHERE other.source_event_id = se.id AND other.id <> $2
           )
           AND NOT EXISTS (
             SELECT 1 FROM registry_vendor_events ve WHERE ve.source_event_ids ? se.id
           )
           AND NOT EXISTS (
             SELECT 1
             FROM registry_source_items si
             JOIN registry_batch_source_items bsi ON bsi.source_item_id = si.id
             WHERE si.source_event_id = se.id AND bsi.batch_id <> $2
           )
           AND NOT EXISTS (
             SELECT 1
             FROM registry_source_items si
             JOIN registry_task_source_items tsi ON tsi.source_item_id = si.id
             JOIN registry_task_versions tv ON tv.id = tsi.task_version_id
             WHERE si.source_event_id = se.id AND tv.batch_id <> $2
           )`,
        [linkedEventIds, input.batchId],
      ) : { rows: [] as Array<{ id: string }> };
      const removedSourceEventIds = removableEvents.rows.map((row) => row.id).sort();
      const retainedSourceEventIds = linkedEventIds.filter((id) => !removedSourceEventIds.includes(id));

      const retainedOnlyEvents = retainedSourceEventIds.length ? await client.query<{ id: string }>(
        `SELECT se.id
         FROM registry_source_events se
         WHERE se.id = ANY($1::text[])
           AND NOT EXISTS (
             SELECT 1 FROM registry_batch_source_events other
             WHERE other.source_event_id = se.id AND other.batch_id <> $2
           )
           AND NOT EXISTS (
             SELECT 1 FROM registry_submission_batches other
             WHERE other.source_event_id = se.id AND other.id <> $2
           )
           AND NOT EXISTS (
             SELECT 1
             FROM registry_source_items si
             JOIN registry_batch_source_items bsi ON bsi.source_item_id = si.id
             WHERE si.source_event_id = se.id AND bsi.batch_id <> $2
           )
           AND NOT EXISTS (
             SELECT 1
             FROM registry_source_items si
             JOIN registry_task_source_items tsi ON tsi.source_item_id = si.id
             JOIN registry_task_versions tv ON tv.id = tsi.task_version_id
             WHERE si.source_event_id = se.id AND tv.batch_id <> $2
           )`,
        [retainedSourceEventIds, input.batchId],
      ) : { rows: [] as Array<{ id: string }> };
      const retainedOnlyEventIds = retainedOnlyEvents.rows.map((row) => row.id).sort();
      const cancelledEventIds = [...new Set([...removedSourceEventIds, ...retainedOnlyEventIds])];

      const sourceItems = cancelledEventIds.length ? await client.query<{ id: string }>(
        "SELECT id FROM registry_source_items WHERE source_event_id = ANY($1::text[])",
        [cancelledEventIds],
      ) : { rows: [] as Array<{ id: string }> };
      const sourceItemIds = sourceItems.rows.map((row) => row.id);
      const removedSourceItems = removedSourceEventIds.length ? await client.query<{ id: string }>(
        "SELECT id FROM registry_source_items WHERE source_event_id = ANY($1::text[])",
        [removedSourceEventIds],
      ) : { rows: [] as Array<{ id: string }> };
      const removedSourceItemIds = removedSourceItems.rows.map((row) => row.id);
      const candidateArtifacts = removedSourceEventIds.length ? await client.query<{ id: string }>(
        `SELECT raw_artifact_id AS id FROM registry_source_events
         WHERE id = ANY($1::text[]) AND raw_artifact_id IS NOT NULL
         UNION
         SELECT artifact_id AS id FROM registry_source_items
         WHERE source_event_id = ANY($1::text[]) AND artifact_id IS NOT NULL`,
        [removedSourceEventIds],
      ) : { rows: [] as Array<{ id: string }> };
      const candidateArtifactIds = [...new Set([
        ...candidateArtifacts.rows.map((row) => row.id),
        ...taskArtifactIds,
      ])];

      await client.query(
        `DELETE FROM registry_work_items
         WHERE (entity_type = 'submission_batch' AND entity_id = $1)
            OR (entity_type = 'source_event' AND entity_id = ANY($2::text[]))
            OR (entity_type = 'source_item' AND entity_id = ANY($3::text[]))
            OR (entity_type = 'task_version' AND entity_id = ANY($4::text[]))`,
        [input.batchId, cancelledEventIds, sourceItemIds, removedTaskVersionIds],
      );
      await client.query(
        `DELETE FROM registry_status_events
         WHERE (entity_type = 'submission_batch' AND entity_id = $1)
            OR (entity_type = 'source_event' AND entity_id = ANY($2::text[]))
            OR (entity_type = 'source_item' AND entity_id = ANY($3::text[]))
            OR (entity_type = 'task_version' AND entity_id = ANY($4::text[]))`,
        [input.batchId, removedSourceEventIds, removedSourceItemIds, removedTaskVersionIds],
      );
      if (removedTaskVersionIds.length) {
        await client.query("DELETE FROM registry_task_versions WHERE id = ANY($1::text[])", [removedTaskVersionIds]);
      }
      if (removedTaskIds.length) {
        await client.query("DELETE FROM registry_tasks WHERE id = ANY($1::text[])", [removedTaskIds]);
      }
      if (retainedOnlyEventIds.length) {
        const retainedSourceEventType = input.disposition === "purchased_delivery_handoff"
          ? "source.handed_off"
          : "source.retained_after_submission_removal";
        if (input.disposition === "purchased_delivery_handoff") {
          await client.query(
            `UPDATE registry_source_items
             SET fetch_status = CASE WHEN fetch_status IN ('queued', 'fetching') THEN 'blocked' ELSE fetch_status END,
                 parse_status = CASE WHEN parse_status IN ('queued', 'parsing') THEN 'blocked' ELSE parse_status END,
                 metadata = metadata || $2::jsonb,
                 updated_at = now()
             WHERE source_event_id = ANY($1::text[])`,
            [retainedOnlyEventIds, json({ scopeBoundary: "purchased_delivery_handed_off", handoffReason: input.reason })],
          );
        }
        for (const sourceEventId of retainedOnlyEventIds) {
          await this.insertStatusEvent(client, "source_event", sourceEventId, retainedSourceEventType, input.actor, {
            disposition: input.disposition,
            reason: input.reason,
            removedSubmissionId: input.batchId,
          });
        }
      }
      await client.query("DELETE FROM registry_submission_batches WHERE id = $1", [input.batchId]);
      if (removedSourceEventIds.length) {
        await client.query("DELETE FROM registry_source_events WHERE id = ANY($1::text[])", [removedSourceEventIds]);
      }
      await this.insertStatusEvent(client, "removed_submission", input.batchId, "submission.removed", input.actor, {
        disposition: input.disposition,
        reason: input.reason,
        vendorId,
        detachedRevisionBatchIds,
        removedTaskVersionIds,
        removedTaskIds,
        retainedTaskIds,
        removedSourceEventIds,
        retainedSourceEventIds,
      });

      const unreferenced = candidateArtifactIds.length ? await client.query<ArtifactRow>(
        `SELECT a.id, a.kind, a.storage_key, a.sha256, a.size_bytes, a.content_type, a.metadata, a.created_at
         FROM registry_artifacts a
         WHERE a.id = ANY($1::text[])
           AND NOT EXISTS (SELECT 1 FROM registry_source_events se WHERE se.raw_artifact_id = a.id)
           AND NOT EXISTS (SELECT 1 FROM registry_source_items si WHERE si.artifact_id = a.id)
           AND NOT EXISTS (SELECT 1 FROM registry_task_versions tv WHERE tv.artifact_id = a.id)
           AND NOT EXISTS (SELECT 1 FROM registry_trajectories tr WHERE tr.artifact_id = a.id)
           AND NOT EXISTS (SELECT 1 FROM registry_check_runs cr WHERE cr.evidence_artifact_id = a.id)
           AND NOT EXISTS (SELECT 1 FROM registry_harbor_check_attempts ca WHERE ca.evidence_artifact_id = a.id)
         ORDER BY a.size_bytes DESC NULLS LAST, a.id`,
        [candidateArtifactIds],
      ) : { rows: [] as ArtifactRow[] };
      await client.query("COMMIT");
      return {
        batchId: input.batchId,
        vendorId,
        disposition: input.disposition,
        detachedRevisionBatchIds,
        removedTaskVersionIds,
        removedTaskIds,
        retainedTaskIds,
        removedSourceEventIds,
        retainedSourceEventIds,
        unreferencedArtifacts: unreferenced.rows.map(artifactFromRow),
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private async recordCheckResult(input: CheckResultInput): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const definition = await client.query(
        `INSERT INTO registry_check_definitions(id, version, kind, name, description, required, evidence_role)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT(id, version) DO UPDATE SET
           evidence_role = CASE
             WHEN registry_check_definitions.evidence_role = 'other' THEN EXCLUDED.evidence_role
             ELSE registry_check_definitions.evidence_role
           END
         WHERE registry_check_definitions.kind = EXCLUDED.kind
           AND registry_check_definitions.name = EXCLUDED.name
           AND registry_check_definitions.description = EXCLUDED.description
           AND registry_check_definitions.required = EXCLUDED.required
           AND registry_check_definitions.evidence_role IN ('other', EXCLUDED.evidence_role)
         RETURNING id`,
        [input.definitionId, input.definitionVersion, input.kind, input.name, input.description, input.required, input.evidenceRole],
      );
      if (!definition.rowCount) {
        throw new RegistryConflictError(`Check definition ${input.definitionId}@${input.definitionVersion} conflicts with its immutable record`);
      }
      await client.query(
        `INSERT INTO registry_check_runs(
           id, task_version_id, definition_id, definition_version, outcome, summary,
           runner, evidence, started_at, completed_at, execution_scope
         ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, $10, $11)
         ON CONFLICT(id) DO NOTHING`,
        [input.id, input.taskVersionId, input.definitionId, input.definitionVersion, input.outcome, input.summary,
          json(input.runner), json(input.evidence), input.startedAt, input.completedAt, input.executionScope],
      );
      await this.insertStatusEvent(client, "task_version", input.taskVersionId, "check.completed", "case", {
        checkRunId: input.id,
        definition: `${input.definitionId}@${input.definitionVersion}`,
        evidenceRole: input.evidenceRole,
        executionScope: input.executionScope,
        outcome: input.outcome,
      });
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async recordHarborCheck(input: HarborCheckResultInput): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const task = await client.query<{ format_kind: string }>(
        "SELECT format_kind FROM registry_task_versions WHERE id = $1 AND superseded_at IS NULL FOR UPDATE",
        [input.taskId],
      );
      if (!task.rowCount) throw new RegistryNotFoundError(`Task ${input.taskId} does not exist`);
      if (task.rows[0]?.format_kind !== "harbor") {
        throw new RegistryConflictError(`Checks are not recorded for non-Harbor task ${input.taskId}`);
      }
      const evidence = await client.query<{ kind: string }>(
        "SELECT kind FROM registry_artifacts WHERE id = $1",
        [input.evidenceArtifactId],
      );
      if (evidence.rows[0]?.kind !== "check_evidence") {
        throw new RegistryConflictError(`Harbor check ${input.id} must reference an immutable check_evidence artifact`);
      }

      const phaseOrder: HarborCheckPhase[] = ["environment", "oracle", "nop"];
      const phaseIndex = phaseOrder.indexOf(input.phase);
      if (phaseIndex > 0) {
        const prior = await client.query<{ phase: HarborCheckPhase; outcome: "pass" | "fail" }>(
          `SELECT DISTINCT ON (check_phase) check_phase AS phase, outcome
           FROM registry_check_runs
           WHERE task_version_id = $1
             AND check_phase = ANY($2::text[])
             AND outcome IN ('pass', 'fail')
           ORDER BY check_phase, completed_at DESC, created_at DESC`,
          [input.taskId, phaseOrder.slice(0, phaseIndex)],
        );
        const priorByPhase = new Map(prior.rows.map((row) => [row.phase, row.outcome]));
        for (const requiredPhase of phaseOrder.slice(0, phaseIndex)) {
          if (!priorByPhase.has(requiredPhase)) {
            throw new RegistryConflictError(`${input.phase} cannot be recorded before ${requiredPhase}`);
          }
        }
        if (input.phase !== "environment" && priorByPhase.get("environment") !== "pass") {
          throw new RegistryConflictError(`${input.phase} requires Environment to pass`);
        }
      }

      const existing = await client.query<{
        task_version_id: string;
        check_phase: HarborCheckPhase;
        outcome: "pass" | "fail";
        summary: string;
        evidence_artifact_id: string;
        harbor_version: string;
        modal_version: string;
        command: string;
        sandbox_ref: string | null;
        score: number | null;
        started_at: string | Date;
        completed_at: string | Date;
      }>(
        `SELECT task_version_id, check_phase, outcome, summary, evidence_artifact_id,
                harbor_version, modal_version, command, sandbox_ref, score, started_at, completed_at
         FROM registry_check_runs WHERE id = $1`,
        [input.id],
      );
      if (existing.rows[0]) {
        const row = existing.rows[0];
        const matches = row.task_version_id === input.taskId
          && row.check_phase === input.phase
          && row.outcome === input.outcome
          && row.summary === input.summary
          && row.evidence_artifact_id === input.evidenceArtifactId
          && row.harbor_version === input.harborVersion
          && row.modal_version === input.modalVersion
          && row.command === input.command
          && row.sandbox_ref === (input.sandboxRef ?? null)
          && row.score === (input.score ?? null)
          && new Date(row.started_at).toISOString() === input.startedAt
          && new Date(row.completed_at).toISOString() === input.completedAt;
        if (!matches) throw new RegistryConflictError(`Harbor check ${input.id} already exists with different immutable contents`);
        await client.query("COMMIT");
        return;
      }

      const definitionId = `case.harbor.${input.phase}`;
      const evidenceRole = input.phase === "environment" ? "environment"
        : input.phase === "oracle" ? "positive_control"
        : input.phase === "nop" ? "negative_control"
          : "other";
      await client.query(
        `INSERT INTO registry_check_definitions(id, version, kind, name, description, required, evidence_role)
         VALUES ($1, 1, 'deterministic', $2, $3, true, $4)
         ON CONFLICT(id, version) DO NOTHING`,
        [definitionId, input.phase, `Harbor ${input.phase} pass/fail`, evidenceRole],
      );
      await client.query(
        `INSERT INTO registry_check_runs(
           id, task_version_id, definition_id, definition_version, outcome, summary,
           runner, evidence, started_at, completed_at, execution_scope, check_phase,
           evidence_artifact_id, harbor_version, modal_version, command, sandbox_ref, score
         ) VALUES (
           $1, $2, $3, 1, $4, $5, '{}'::jsonb, '{}'::jsonb, $6, $7, 'remote_sandbox', $8,
           $9, $10, $11, $12, $13, $14
         )`,
        [input.id, input.taskId, definitionId, input.outcome, input.summary, input.startedAt, input.completedAt,
          input.phase, input.evidenceArtifactId, input.harborVersion, input.modalVersion, input.command,
          input.sandboxRef ?? null, input.score ?? null],
      );
      await this.insertStatusEvent(client, "task", input.taskId, "harbor_check.completed", "CASE", {
        checkRunId: input.id,
        phase: input.phase,
        outcome: input.outcome,
      });
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async recordHarborAttempt(input: HarborCheckAttemptInput): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const task = await client.query<{ format_kind: string }>(
        "SELECT format_kind FROM registry_task_versions WHERE id = $1 AND superseded_at IS NULL FOR UPDATE",
        [input.taskId],
      );
      if (!task.rowCount) throw new RegistryNotFoundError(`Task ${input.taskId} does not exist`);
      if (task.rows[0]?.format_kind !== "harbor") {
        throw new RegistryConflictError(`Check attempts are not recorded for non-Harbor task ${input.taskId}`);
      }
      const evidence = await client.query<{ kind: string }>(
        "SELECT kind FROM registry_artifacts WHERE id = $1",
        [input.evidenceArtifactId],
      );
      if (evidence.rows[0]?.kind !== "check_evidence") {
        throw new RegistryConflictError(`Harbor attempt ${input.id} must reference an immutable check_evidence artifact`);
      }
      const existing = await client.query<{
        task_version_id: string;
        check_phase: HarborCheckPhase;
        status: SampleCatalogAttempt["status"];
        summary: string;
        evidence_artifact_id: string;
        harbor_version: string;
        modal_version: string;
        command: string;
        sandbox_ref: string | null;
        started_at: string | Date;
        completed_at: string | Date;
      }>(
        `SELECT task_version_id, check_phase, status, summary, evidence_artifact_id,
                harbor_version, modal_version, command, sandbox_ref, started_at, completed_at
         FROM registry_harbor_check_attempts WHERE id = $1`,
        [input.id],
      );
      if (existing.rows[0]) {
        const row = existing.rows[0];
        const matches = row.task_version_id === input.taskId
          && row.check_phase === input.phase
          && row.status === input.status
          && row.summary === input.summary
          && row.evidence_artifact_id === input.evidenceArtifactId
          && row.harbor_version === input.harborVersion
          && row.modal_version === input.modalVersion
          && row.command === input.command
          && row.sandbox_ref === (input.sandboxRef ?? null)
          && new Date(row.started_at).toISOString() === input.startedAt
          && new Date(row.completed_at).toISOString() === input.completedAt;
        if (!matches) throw new RegistryConflictError(`Harbor attempt ${input.id} already exists with different immutable contents`);
        await client.query("COMMIT");
        return;
      }
      await client.query(
        `INSERT INTO registry_harbor_check_attempts(
           id, task_version_id, check_phase, status, summary, evidence_artifact_id,
           harbor_version, modal_version, command, sandbox_ref, started_at, completed_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          input.id, input.taskId, input.phase, input.status, input.summary, input.evidenceArtifactId,
          input.harborVersion, input.modalVersion, input.command, input.sandboxRef ?? null,
          input.startedAt, input.completedAt,
        ],
      );
      await this.insertStatusEvent(client, "task", input.taskId, "harbor_check.attempted", "CASE", {
        attemptId: input.id,
        phase: input.phase,
        status: input.status,
      });
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async recordHarborFinding(input: HarborFindingInput): Promise<{ findingId: string; created: boolean }> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const check = await client.query<{ check_phase: HarborCheckPhase; outcome: string; task_version_id: string }>(
        `SELECT check_phase, outcome, task_version_id
         FROM registry_check_runs
         WHERE id = $1 AND check_phase IN ('environment', 'oracle', 'nop')`,
        [input.checkRunId],
      );
      const row = check.rows[0];
      if (!row) throw new RegistryNotFoundError(`Harbor check ${input.checkRunId} does not exist`);
      if (row.task_version_id !== input.taskId) throw new RegistryConflictError("Finding and check must name the same task");
      if (row.outcome !== "fail") throw new RegistryConflictError("Findings can only be attached to a failed Harbor check");

      const existing = await client.query<{ task_version_id: string; check_run_id: string; finding: string }>(
        "SELECT task_version_id, check_run_id, finding FROM registry_task_findings WHERE id = $1",
        [input.id],
      );
      if (existing.rows[0]) {
        const current = existing.rows[0];
        if (current.task_version_id !== input.taskId || current.check_run_id !== input.checkRunId || current.finding !== input.finding) {
          throw new RegistryConflictError(`Harbor finding ${input.id} already exists with different immutable contents`);
        }
        await client.query("COMMIT");
        return { findingId: input.id, created: false };
      }

      await client.query(
        `INSERT INTO registry_task_findings(
           id, task_version_id, finding, visibility, check_run_id, check_phase
         ) VALUES ($1, $2, $3, 'portal', $4, $5)`,
        [input.id, input.taskId, input.finding, input.checkRunId, row.check_phase],
      );
      await this.insertStatusEvent(client, "task", input.taskId, "harbor_finding.recorded", "CASE", {
        findingId: input.id,
        checkRunId: input.checkRunId,
        phase: row.check_phase,
      });
      await client.query("COMMIT");
      return { findingId: input.id, created: true };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private async recordTaskFinding(input: TaskFindingInput): Promise<{ findingId: string; created: boolean }> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const task = await client.query<{ id: string }>(
        "SELECT id FROM registry_task_versions WHERE id = $1 AND superseded_at IS NULL",
        [input.taskVersionId],
      );
      if (!task.rowCount) throw new RegistryNotFoundError(`task_version ${input.taskVersionId} does not exist`);

      const existing = await client.query<{ task_version_id: string; finding: string }>(
        "SELECT task_version_id, finding FROM registry_task_findings WHERE id = $1",
        [input.id],
      );
      if (existing.rowCount) {
        if (existing.rows[0]?.task_version_id !== input.taskVersionId || existing.rows[0]?.finding !== input.finding) {
          throw new RegistryConflictError(`Task finding ${input.id} already exists; use the update operation to change its words`);
        }
        await client.query("COMMIT");
        return { findingId: input.id, created: false };
      }

      await client.query(
        `INSERT INTO registry_task_findings(id, task_version_id, finding, visibility)
         VALUES ($1, $2, $3, 'portal')`,
        [input.id, input.taskVersionId, input.finding],
      );
      await this.insertStatusEvent(client, "task_version", input.taskVersionId, "finding.recorded", "CASE", {
        findingId: input.id,
      });
      await client.query("COMMIT");
      return { findingId: input.id, created: true };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private async updateTaskFinding(input: TaskFindingUpdateInput): Promise<{ findingId: string; updated: boolean }> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const existing = await client.query<{ task_version_id: string; finding: string }>(
        "SELECT task_version_id, finding FROM registry_task_findings WHERE id = $1 FOR UPDATE",
        [input.id],
      );
      if (!existing.rowCount) throw new RegistryNotFoundError(`Task finding ${input.id} does not exist`);
      if (existing.rows[0]?.finding === input.finding) {
        await client.query("COMMIT");
        return { findingId: input.id, updated: false };
      }

      await client.query(
        "UPDATE registry_task_findings SET finding = $2, updated_at = now() WHERE id = $1",
        [input.id, input.finding],
      );
      await this.insertStatusEvent(client, "task_version", existing.rows[0]!.task_version_id, "finding.updated", "CASE", {
        findingId: input.id,
      });
      await client.query("COMMIT");
      return { findingId: input.id, updated: true };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private async deleteTaskFinding(id: string): Promise<{ findingId: string; deleted: boolean }> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const existing = await client.query<{ task_version_id: string }>(
        "SELECT task_version_id FROM registry_task_findings WHERE id = $1 FOR UPDATE",
        [id],
      );
      if (!existing.rowCount) throw new RegistryNotFoundError(`Task finding ${id} does not exist`);

      await client.query("DELETE FROM registry_task_findings WHERE id = $1", [id]);
      await this.insertStatusEvent(client, "task_version", existing.rows[0]!.task_version_id, "finding.deleted", "CASE", {
        findingId: id,
      });
      await client.query("COMMIT");
      return { findingId: id, deleted: true };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private async recordFollowUp(input: FollowUpInput): Promise<void> {
    await this.pool.query(
      `INSERT INTO registry_follow_ups(
         id, batch_id, channel, recipient, status, reason, evidence_check_run_ids, sent_at, external_ref
       ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9)
       ON CONFLICT(id) DO UPDATE SET
         status = EXCLUDED.status,
         sent_at = EXCLUDED.sent_at,
         external_ref = EXCLUDED.external_ref,
         updated_at = now()`,
      [input.id, input.batchId, input.channel, input.recipient, input.status, input.reason,
        json(input.evidenceCheckRunIds), input.sentAt ?? null, input.externalRef ?? null],
    );
  }

  private async recordSubmissionReview(input: SubmissionReviewInput): Promise<SubmissionReview> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const batch = await client.query<{ id: string }>(
        "SELECT id FROM registry_submission_batches WHERE id = $1",
        [input.batchId],
      );
      if (!batch.rowCount) throw new RegistryNotFoundError(`submission_batch ${input.batchId} does not exist`);

      if (input.categoryIds.length) {
        const categories = await client.query<{ category_id: string }>(
          `SELECT category_id FROM registry_batch_categories
           WHERE batch_id = $1 AND category_id = ANY($2::text[])`,
          [input.batchId, input.categoryIds],
        );
        if (categories.rowCount !== input.categoryIds.length) {
          throw new RegistryNotFoundError(`One or more review categories do not belong to submission ${input.batchId}`);
        }
      }

      const inserted = await client.query<SubmissionReviewRow>(
        `INSERT INTO registry_submission_reviews(
           id, batch_id, signal, scope, category_ids, reviewer_open_id, reviewer_union_id,
           reviewer_tenant_key, reviewer_name, comment, metadata
         ) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10, $11::jsonb)
         RETURNING id, batch_id, signal, scope, category_ids, reviewer_open_id, reviewer_union_id,
                   reviewer_tenant_key, reviewer_name, comment, metadata, created_at`,
        [input.id, input.batchId, input.signal, input.scope, json(input.categoryIds), input.reviewer.openId,
          input.reviewer.unionId ?? null, input.reviewer.tenantKey, input.reviewer.name, input.comment ?? "",
          json(input.metadata ?? {})],
      );
      await this.insertStatusEvent(client, "submission_batch", input.batchId, "review.recorded", input.reviewer.openId, {
        reviewId: input.id,
        signal: input.signal,
        scope: input.scope,
        categoryIds: input.categoryIds,
      });
      await client.query("COMMIT");
      return submissionReviewFromRow(inserted.rows[0]!);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private async listSubmissionReviews(batchId: string): Promise<SubmissionReview[]> {
    const batch = await this.pool.query<{ id: string }>(
      "SELECT id FROM registry_submission_batches WHERE id = $1",
      [batchId],
    );
    if (!batch.rowCount) throw new RegistryNotFoundError(`submission_batch ${batchId} does not exist`);
    const result = await this.pool.query<SubmissionReviewRow>(
      `SELECT id, batch_id, signal, scope, category_ids, reviewer_open_id, reviewer_union_id,
              reviewer_tenant_key, reviewer_name, comment, metadata, created_at
       FROM registry_submission_reviews
       WHERE batch_id = $1
       ORDER BY created_at DESC, id DESC`,
      [batchId],
    );
    return result.rows.map(submissionReviewFromRow);
  }

  async registerArtifact(input: ArtifactInput): Promise<void> {
    const existing = await this.pool.query<{ storage_key: string; sha256: string }>(
      "SELECT storage_key, sha256 FROM registry_artifacts WHERE id = $1",
      [input.id],
    );
    if (existing.rows[0]) {
      if (existing.rows[0].storage_key !== input.storageKey || existing.rows[0].sha256 !== input.sha256) {
        throw new RegistryConflictError(`Artifact ${input.id} already exists with different immutable contents`);
      }
      return;
    }
    await this.pool.query(
      `INSERT INTO registry_artifacts(id, kind, storage_key, sha256, size_bytes, content_type, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
      [input.id, input.kind, input.storageKey, input.sha256, input.sizeBytes ?? null,
        input.contentType ?? null, json(input.metadata ?? {})],
    );
  }

  async getArtifact(id: string): Promise<ArtifactRecord | null> {
    const result = await this.pool.query<ArtifactRow>(
      `SELECT id, kind, storage_key, sha256, size_bytes, content_type, metadata, created_at
       FROM registry_artifacts WHERE id = $1`,
      [id],
    );
    const row = result.rows[0];
    return row ? artifactFromRow(row) : null;
  }

  async unregisterArtifactIfUnreferenced(id: string): Promise<ArtifactRecord | null> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const artifact = await client.query<ArtifactRow>(
        `SELECT id, kind, storage_key, sha256, size_bytes, content_type, metadata, created_at
         FROM registry_artifacts WHERE id = $1 FOR UPDATE`,
        [id],
      );
      const row = artifact.rows[0];
      if (!row) {
        await client.query("COMMIT");
        return null;
      }
      const referenced = await client.query<{ referenced: boolean }>(
        `SELECT EXISTS (
           SELECT 1 FROM registry_source_events WHERE raw_artifact_id = $1
           UNION ALL SELECT 1 FROM registry_source_items WHERE artifact_id = $1
           UNION ALL SELECT 1 FROM registry_task_versions WHERE artifact_id = $1
           UNION ALL SELECT 1 FROM registry_trajectories WHERE artifact_id = $1
           UNION ALL SELECT 1 FROM registry_check_runs WHERE evidence_artifact_id = $1
           UNION ALL SELECT 1 FROM registry_harbor_check_attempts WHERE evidence_artifact_id = $1
         ) AS referenced`,
        [id],
      );
      if (referenced.rows[0]?.referenced) {
        throw new RegistryConflictError(`Artifact ${id} is still referenced and cannot be deleted`);
      }
      await client.query("DELETE FROM registry_artifacts WHERE id = $1", [id]);
      await client.query("COMMIT");
      return artifactFromRow(row);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private async updateStatus(input: StatusUpdateInput): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const table = input.entityType === "submission_batch" ? "registry_submission_batches" : "registry_task_versions";
      const result = await client.query(
        `UPDATE ${table}
         SET workflow_status = $2, catalog_visibility = $3, updated_at = now()
         WHERE id = $1`,
        [input.entityId, input.workflowStatus, input.catalogVisibility],
      );
      if (!result.rowCount) throw new RegistryNotFoundError(`${input.entityType} ${input.entityId} does not exist`);
      await this.insertStatusEvent(client, input.entityType, input.entityId, "status.changed", input.actor, {
        workflowStatus: input.workflowStatus,
        catalogVisibility: input.catalogVisibility,
        reason: input.reason,
      });
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private async linkTaskSources(input: TaskSourceLinksInput): Promise<{ linked: number }> {
    const client = await this.pool.connect();
    let linked = 0;
    try {
      await client.query("BEGIN");
      for (const link of input.links) {
        const result = await client.query(
          `INSERT INTO registry_task_source_items(task_version_id, source_item_id, role)
           VALUES ($1, $2, $3)
           ON CONFLICT(task_version_id, source_item_id, role) DO NOTHING
           RETURNING task_version_id`,
          [link.taskVersionId, link.sourceItemId, link.role],
        );
        if (!result.rowCount) continue;
        linked += 1;
        await this.insertStatusEvent(client, "task_version", link.taskVersionId, "source.linked", input.actor, {
          sourceItemId: link.sourceItemId,
          role: link.role,
          reason: input.reason,
        });
      }
      await client.query("COMMIT");
      return { linked };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async leaseWorkItem(workerId: string, leaseSeconds: number): Promise<WorkItem | null> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `UPDATE registry_work_items
         SET status = 'queued', leased_by = NULL, lease_expires_at = NULL, updated_at = now()
         WHERE status = 'leased' AND lease_expires_at < now()`,
      );
      const result = await client.query<{
        id: string;
        kind: string;
        entity_type: string;
        entity_id: string;
        attempts: number;
        payload: Record<string, unknown>;
        lease_expires_at: string | Date;
      }>(
        `WITH next_item AS (
           SELECT id
           FROM registry_work_items
           WHERE status = 'queued' AND available_at <= now()
           ORDER BY available_at, created_at
           FOR UPDATE SKIP LOCKED
           LIMIT 1
         )
         UPDATE registry_work_items item
         SET status = 'leased', leased_by = $1, attempts = attempts + 1,
             lease_expires_at = now() + ($2 * interval '1 second'), updated_at = now()
         FROM next_item
         WHERE item.id = next_item.id
         RETURNING item.id, item.kind, item.entity_type, item.entity_id, item.attempts,
                   item.payload, item.lease_expires_at`,
        [workerId, leaseSeconds],
      );
      await client.query("COMMIT");
      const row = result.rows[0];
      return row ? {
        id: row.id,
        kind: row.kind,
        entityType: row.entity_type,
        entityId: row.entity_id,
        attempts: row.attempts,
        payload: row.payload,
        leaseExpiresAt: new Date(row.lease_expires_at).toISOString(),
      } : null;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async completeWorkItem(input: WorkCompletionInput): Promise<void> {
    const result = await this.pool.query(
      `UPDATE registry_work_items
       SET status = CASE $3 WHEN 'completed' THEN 'completed' WHEN 'failed' THEN 'failed' ELSE 'queued' END,
           available_at = CASE WHEN $3 = 'retry' THEN now() + interval '5 minutes' ELSE available_at END,
           lease_expires_at = NULL,
           leased_by = NULL,
           last_error = $4,
           updated_at = now()
       WHERE id = $1 AND status = 'leased' AND leased_by = $2`,
      [input.id, input.workerId, input.outcome, input.error ?? null],
    );
    if (!result.rowCount) throw new RegistryConflictError(`Work item ${input.id} is not leased by ${input.workerId}`);
  }

  async reconcileHarborWorkItems(input: ReconcileHarborWorkItemsInput): Promise<ReconcileHarborWorkItemsResult> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const tasks = await client.query<{ id: string; format_kind: string }>(
        `SELECT id, format_kind
         FROM registry_task_versions
         WHERE id = ANY($1::text[]) AND superseded_at IS NULL
         FOR UPDATE`,
        [input.taskIds],
      );
      const tasksById = new Map(tasks.rows.map((task) => [task.id, task]));
      for (const taskId of input.taskIds) {
        const task = tasksById.get(taskId);
        if (!task) throw new RegistryNotFoundError(`Active task ${taskId} does not exist`);
        if (task.format_kind !== "harbor") {
          throw new RegistryConflictError(`Harbor work cannot be reconciled for non-Harbor task ${taskId}`);
        }
      }

      const checks = await client.query<{
        task_version_id: string;
        check_phase: HarborCheckPhase;
        outcome: "pass" | "fail";
      }>(
        `SELECT DISTINCT ON (task_version_id, check_phase)
                task_version_id, check_phase, outcome
         FROM registry_check_runs
         WHERE task_version_id = ANY($1::text[])
           AND check_phase IN ('environment', 'oracle', 'nop')
         ORDER BY task_version_id, check_phase, completed_at DESC, created_at DESC`,
        [input.taskIds],
      );
      const attempts = await client.query<{ task_version_id: string; check_phase: HarborCheckPhase }>(
        `SELECT DISTINCT ON (task_version_id, check_phase)
                task_version_id, check_phase
         FROM registry_harbor_check_attempts
         WHERE task_version_id = ANY($1::text[])
           AND check_phase IN ('environment', 'oracle', 'nop')
         ORDER BY task_version_id, check_phase, completed_at DESC, created_at DESC`,
        [input.taskIds],
      );
      const checksByTask = new Map<string, Map<HarborCheckPhase, "pass" | "fail">>();
      for (const check of checks.rows) {
        const phases = checksByTask.get(check.task_version_id) ?? new Map();
        phases.set(check.check_phase, check.outcome);
        checksByTask.set(check.task_version_id, phases);
      }
      const attemptsByTask = new Map<string, Set<HarborCheckPhase>>();
      for (const attempt of attempts.rows) {
        const phases = attemptsByTask.get(attempt.task_version_id) ?? new Set();
        phases.add(attempt.check_phase);
        attemptsByTask.set(attempt.task_version_id, phases);
      }
      for (const taskId of input.taskIds) {
        const taskChecks = checksByTask.get(taskId) ?? new Map();
        const taskAttempts = attemptsByTask.get(taskId) ?? new Set();
        const environment = taskChecks.get("environment");
        if (!environment && !taskAttempts.has("environment")) {
          throw new RegistryConflictError(`Harbor work for ${taskId} has no Environment check or attempt`);
        }
        if (environment === "pass") {
          for (const phase of ["oracle", "nop"] as const) {
            if (!taskChecks.has(phase) && !taskAttempts.has(phase)) {
              throw new RegistryConflictError(`Harbor work for ${taskId} has no ${phase} check or attempt after Environment passed`);
            }
          }
        }
      }

      const workItems = await client.query<{
        id: string;
        entity_id: string;
        status: string;
      }>(
        `SELECT id, entity_id, status
         FROM registry_work_items
         WHERE kind = 'harbor_checks'
           AND entity_type = 'task'
           AND entity_id = ANY($1::text[])
         ORDER BY entity_id, created_at
         FOR UPDATE`,
        [input.taskIds],
      );
      const itemsByTask = new Map<string, Array<{ id: string; status: string }>>();
      for (const item of workItems.rows) {
        const items = itemsByTask.get(item.entity_id) ?? [];
        items.push({ id: item.id, status: item.status });
        itemsByTask.set(item.entity_id, items);
      }
      for (const taskId of input.taskIds) {
        const items = itemsByTask.get(taskId) ?? [];
        if (items.length !== 1) {
          throw new RegistryConflictError(`Expected exactly one Harbor work item for ${taskId}, found ${items.length}`);
        }
        if (!new Set(["queued", "completed"]).has(items[0]!.status)) {
          throw new RegistryConflictError(`Harbor work item ${items[0]!.id} is ${items[0]!.status}, not queued or completed`);
        }
      }

      const queuedIds = workItems.rows.filter((item) => item.status === "queued").map((item) => item.id);
      if (queuedIds.length) {
        await client.query(
          `UPDATE registry_work_items
           SET status = 'completed', leased_by = NULL, lease_expires_at = NULL,
               last_error = NULL, updated_at = now()
           WHERE id = ANY($1::text[]) AND status = 'queued'`,
          [queuedIds],
        );
        for (const taskId of input.taskIds) {
          const item = itemsByTask.get(taskId)![0]!;
          if (item.status !== "queued") continue;
          await this.insertStatusEvent(client, "task", taskId, "harbor_checks.work_reconciled", input.actor, {
            workItemId: item.id,
            reason: input.reason,
          });
        }
      }
      await client.query("COMMIT");
      return {
        taskIds: input.taskIds,
        workItemIds: workItems.rows.map((item) => item.id).sort((a, b) => a.localeCompare(b)),
        itemsCompleted: queuedIds.length,
        itemsUnchanged: workItems.rows.length - queuedIds.length,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private async catalogSnapshot(scope: CatalogScope): Promise<CatalogSnapshot> {
    const visibility = catalogVisibility(scope);
    const [demandsResult, vendorsResult, batchesResult, categoriesResult, tasksResult, runtimeChecksResult, sourceEventsResult, sourceItemsResult, sourceRelationsResult, taskSourcesResult, taskFindingsResult, procurementEventsResult] = await Promise.all([
      this.pool.query<ResearchDemandRow>(
        `SELECT id, domain_en, domain_zh, subdomain_en, subdomain_zh,
                title_en, title_zh, note_en, note_zh,
                source_label_en, source_label_zh, source_date, source_url
         FROM registry_research_demands
         WHERE superseded_at IS NULL
         ORDER BY sort_order, id`,
      ),
      this.pool.query<VendorRow>(
        `SELECT v.id, v.name, v.short, v.description
         FROM registry_vendors v
         WHERE ($1::boolean OR v.archived_at IS NULL)
         ORDER BY v.name`,
        [scope === "all"],
      ),
      this.pool.query<BatchRow>(
        `SELECT id, vendor_id, submission_date, label, source_label, declared_task_count,
                formats, workflow_status, catalog_visibility, revises_batch_id, delta
         FROM registry_submission_batches
         WHERE catalog_visibility = ANY($1::text[])
         ORDER BY submission_date DESC, created_at DESC`,
        [visibility],
      ),
      this.pool.query<CategoryRow>(
        `SELECT bc.batch_id, c.id, c.name, c.description, bc.declared_count, bc.examples
         FROM registry_batch_categories bc
         JOIN registry_categories c ON c.id = bc.category_id
         JOIN registry_submission_batches b ON b.id = bc.batch_id
         WHERE b.catalog_visibility = ANY($1::text[])
         ORDER BY c.name`,
        [visibility],
      ),
      this.pool.query<TaskRow>(
        `SELECT tv.batch_id, tv.category_id, tv.id, t.stable_key, t.title, t.summary,
                tv.source_path, tv.format, tv.representation_kind, tv.representation_path,
                tv.normalization_outcome, tv.representation_basis, tv.artifact_id, tv.content_sha256,
                tv.workflow_status, tv.catalog_visibility,
                COUNT(cr.id) FILTER (WHERE cr.outcome = 'pass')::text AS pass_count,
                COUNT(cr.id) FILTER (WHERE cr.outcome = 'fail')::text AS fail_count,
                COUNT(cr.id) FILTER (WHERE cr.outcome = 'blocked')::text AS blocked_count,
                COUNT(cr.id) FILTER (WHERE cr.outcome = 'not_run')::text AS not_run_count,
                COUNT(cr.id) FILTER (
                  WHERE cd.evidence_role = 'other'
                     OR (cd.evidence_role IN ('environment', 'positive_control', 'negative_control')
                         AND cr.execution_scope <> 'remote_sandbox')
                )::text AS unclassified_check_count
         FROM registry_task_versions tv
         JOIN registry_tasks t ON t.id = tv.task_id
         LEFT JOIN registry_check_runs cr ON cr.task_version_id = tv.id
         LEFT JOIN registry_check_definitions cd
           ON cd.id = cr.definition_id AND cd.version = cr.definition_version
         WHERE tv.catalog_visibility = ANY($1::text[])
           AND tv.superseded_at IS NULL
         GROUP BY tv.batch_id, tv.category_id, tv.id, t.stable_key, t.title, t.summary,
                  tv.source_path, tv.format, tv.representation_kind, tv.representation_path,
                  tv.normalization_outcome, tv.representation_basis, tv.artifact_id, tv.content_sha256,
                  tv.workflow_status, tv.catalog_visibility
         ORDER BY t.title`,
        [visibility],
      ),
      this.pool.query<RuntimeCheckRow>(
        `SELECT DISTINCT ON (cr.task_version_id, cd.evidence_role)
                cr.task_version_id, cr.id, cd.evidence_role, cr.execution_scope,
                cr.outcome, cr.completed_at
         FROM registry_check_runs cr
         JOIN registry_check_definitions cd
           ON cd.id = cr.definition_id AND cd.version = cr.definition_version
         JOIN registry_task_versions tv ON tv.id = cr.task_version_id
         WHERE tv.catalog_visibility = ANY($1::text[])
           AND tv.superseded_at IS NULL
           AND cd.evidence_role IN ('environment', 'build', 'boot', 'positive_control', 'negative_control')
           AND cr.execution_scope = 'remote_sandbox'
         ORDER BY cr.task_version_id, cd.evidence_role, cr.completed_at DESC, cr.created_at DESC, cr.id DESC`,
        [visibility],
      ),
      this.pool.query<SourceEventRow>(
        `SELECT bse.batch_id, bse.role, se.id, se.channel, se.external_ref, se.sender,
                se.received_at, se.raw_artifact_id
         FROM registry_batch_source_events bse
         JOIN registry_source_events se ON se.id = bse.source_event_id
         JOIN registry_submission_batches b ON b.id = bse.batch_id
         WHERE b.catalog_visibility = ANY($1::text[])
         ORDER BY se.received_at, se.created_at`,
        [visibility],
      ),
      this.pool.query<BatchSourceItemRow>(
        `SELECT bse.batch_id, si.source_event_id, si.id, si.kind, si.display_name, si.locator,
                si.media_type, si.artifact_id, si.content_sha256, si.size_bytes,
                si.fetch_status, si.parse_status, si.mutable, si.captured_at, si.metadata,
                si.created_at,
                array_remove(array_agg(DISTINCT bsi.role), NULL) AS submission_roles
         FROM registry_batch_source_events bse
         JOIN registry_submission_batches b ON b.id = bse.batch_id
         JOIN registry_source_items si ON si.source_event_id = bse.source_event_id
         LEFT JOIN registry_batch_source_items bsi
           ON bsi.batch_id = bse.batch_id AND bsi.source_item_id = si.id
         WHERE b.catalog_visibility = ANY($1::text[])
           AND (
             bsi.source_item_id IS NOT NULL
             OR NOT EXISTS (
               SELECT 1
               FROM registry_batch_source_items explicit_link
               JOIN registry_source_items explicit_item ON explicit_item.id = explicit_link.source_item_id
               WHERE explicit_link.batch_id = bse.batch_id
                 AND explicit_item.source_event_id = bse.source_event_id
             )
           )
         GROUP BY bse.batch_id, si.source_event_id, si.id, si.kind, si.display_name, si.locator,
                  si.media_type, si.artifact_id, si.content_sha256, si.size_bytes,
                  si.fetch_status, si.parse_status, si.mutable, si.captured_at, si.metadata,
                  si.created_at
         ORDER BY bse.batch_id, si.created_at, si.id`,
        [visibility],
      ),
      this.pool.query<SourceRelationRow>(
        `SELECT DISTINCT sr.source_event_id, sr.from_item_id, sr.to_item_id, sr.relation, sr.position,
                sr.created_at
         FROM registry_source_relations sr
         JOIN registry_batch_source_events bse ON bse.source_event_id = sr.source_event_id
         JOIN registry_submission_batches b ON b.id = bse.batch_id
         WHERE b.catalog_visibility = ANY($1::text[])
         ORDER BY sr.position NULLS LAST, sr.created_at`,
        [visibility],
      ),
      this.pool.query<{ task_version_id: string; source_item_id: string }>(
        `SELECT tsi.task_version_id, tsi.source_item_id
         FROM registry_task_source_items tsi
         JOIN registry_task_versions tv ON tv.id = tsi.task_version_id
         WHERE tv.catalog_visibility = ANY($1::text[])
           AND tv.superseded_at IS NULL
         ORDER BY tsi.created_at`,
        [visibility],
      ),
      this.pool.query<TaskFindingRow>(
        `SELECT tf.id, tf.task_version_id, tf.finding
         FROM registry_task_findings tf
         JOIN registry_task_versions tv ON tv.id = tf.task_version_id
         WHERE tv.catalog_visibility = ANY($1::text[])
           AND tv.superseded_at IS NULL
           AND ($2::boolean OR tf.visibility = 'portal')
         ORDER BY tf.updated_at DESC, tf.created_at DESC, tf.id`,
        [visibility, scope === "all"],
      ),
      this.pool.query<VendorEventRow>(
        `SELECT DISTINCT ON (vendor_id)
                id, vendor_id, kind, event_type, summary, actor, occurred_at,
                source_event_ids, batch_ids, metadata, created_at
         FROM registry_vendor_events
         WHERE kind = ANY($1::text[])
         ORDER BY vendor_id, occurred_at DESC, created_at DESC, id DESC`,
        [PROCUREMENT_EVENT_KINDS],
      ),
    ]);

    const taskSourceIds = group(taskSourcesResult.rows, (row) => row.task_version_id);
    const taskFindings = group(taskFindingsResult.rows, (row) => row.task_version_id);
    const runtimeChecks = group(runtimeChecksResult.rows, (row) => row.task_version_id);
    const tasksByCategory = group(tasksResult.rows, (row) => `${row.batch_id}\u0000${row.category_id}`);
    const categoriesByBatch = new Map<string, CatalogCategory[]>();
    for (const row of categoriesResult.rows) {
      const tasks = (tasksByCategory.get(`${row.batch_id}\u0000${row.id}`) ?? [])
        .map((task) => taskFromRow(
          task,
          (taskSourceIds.get(task.id) ?? []).map((source) => source.source_item_id),
          (taskFindings.get(task.id) ?? []).map(taskFindingFromRow),
          (runtimeChecks.get(task.id) ?? []).map(runtimeCheckFactFromRow),
        ));
      append(categoriesByBatch, row.batch_id, {
        id: row.id,
        name: row.name,
        description: row.description,
        count: row.declared_count,
        examples: row.examples,
        tasks,
      });
    }

    const sourceItemsByEvent = group(sourceItemsResult.rows, (row) => `${row.batch_id}\u0000${row.source_event_id}`);
    const sourceRelationsByEvent = group(sourceRelationsResult.rows, (row) => row.source_event_id);
    const sourceEventsByBatch = new Map<string, CatalogSourceEvent[]>();
    for (const row of sourceEventsResult.rows) {
      append(sourceEventsByBatch, row.batch_id, {
        id: row.id,
        role: row.role,
        channel: row.channel,
        externalRef: row.external_ref,
        sender: row.sender,
        receivedAt: new Date(row.received_at).toISOString(),
        rawArtifactId: row.raw_artifact_id,
        items: (sourceItemsByEvent.get(`${row.batch_id}\u0000${row.id}`) ?? []).map(sourceItemFromRow),
        relations: (sourceRelationsByEvent.get(row.id) ?? []).map(sourceRelationFromRow),
      });
    }

    const batchesByVendor = new Map<string, CatalogBatch[]>();
    for (const row of batchesResult.rows) {
      const categories = categoriesByBatch.get(row.id) ?? [];
      append(batchesByVendor, row.vendor_id, {
        id: row.id,
        date: isoDate(row.submission_date),
        label: row.label,
        source: row.source_label,
        taskCount: categories.reduce((sum, category) => sum + category.tasks.length, 0),
        declaredTaskCount: row.declared_task_count,
        formats: row.formats,
        workflowStatus: row.workflow_status,
        catalogVisibility: row.catalog_visibility,
        revisesBatchId: row.revises_batch_id,
        delta: row.delta,
        sourceEvents: sourceEventsByBatch.get(row.id) ?? [],
        categories,
      });
    }

    const procurementByVendor = new Map(procurementEventsResult.rows.map((row) => [
      row.vendor_id,
      procurementSummaryFromEvent(vendorEventFromRow(row)),
    ]));
    const vendors = vendorsResult.rows.map((row) => ({
      id: row.id,
      name: row.name,
      short: row.short,
      description: row.description,
      procurementSummary: procurementByVendor.get(row.id) ?? null,
      batches: batchesByVendor.get(row.id) ?? [],
    }));
    const batches = vendors.flatMap((vendor) => vendor.batches);
    return {
      generatedAt: new Date().toISOString(),
      demands: demandsResult.rows.map((row) => ({
        id: row.id,
        domain: { en: row.domain_en, zh: row.domain_zh },
        subdomain: { en: row.subdomain_en, zh: row.subdomain_zh },
        title: { en: row.title_en, zh: row.title_zh },
        note: { en: row.note_en, zh: row.note_zh },
        sourceLabel: { en: row.source_label_en, zh: row.source_label_zh },
        sourceDate: isoDate(row.source_date),
        sourceUrl: row.source_url,
      })),
      vendors,
      totals: {
        vendors: vendors.length,
        batches: batches.length,
        taskVersions: batches.reduce((sum, batch) => sum + batch.taskCount, 0),
      },
    };
  }

  async sampleCatalogSnapshot(): Promise<SampleCatalogSnapshot> {
    const [vendorsResult, interactionsResult, submissionsResult, tasksResult, checksResult, attemptsResult, findingsResult, taskSourcesResult, sourceEventsResult, sourceItemsResult] = await Promise.all([
      this.pool.query<VendorRow>(
        `SELECT id, name, short, description
         FROM registry_vendors
         WHERE archived_at IS NULL
         ORDER BY name, id`,
      ),
      this.pool.query<VendorInteractionRow>(
        `SELECT vi.id, vi.vendor_id, vi.kind, vi.event_type, vi.title, vi.summary, vi.channel,
                vi.evidence, vi.visibility, vi.occurred_at, vi.source_event_ids, vi.batch_ids,
                vi.actor, vi.created_at
         FROM registry_vendor_interactions vi
         JOIN registry_vendors v ON v.id = vi.vendor_id
         WHERE vi.visibility = 'portal'
           AND v.archived_at IS NULL
         ORDER BY vi.vendor_id, vi.occurred_at, vi.created_at, vi.id`,
      ),
      this.pool.query<BatchRow>(
        `SELECT id, vendor_id, submission_date, label, source_label, declared_task_count,
                formats, workflow_status, catalog_visibility, revises_batch_id, delta
         FROM registry_submission_batches
         WHERE catalog_visibility IN ('featured', 'available', 'log_only')
         ORDER BY submission_date DESC, created_at DESC, id`,
      ),
      this.pool.query<SampleTaskRow>(
        `SELECT st.submission_id, st.id, st.stable_key, st.title, st.summary,
                st.task_kind, st.format_kind, st.benchmark_id, st.benchmark_name, st.gpu_required,
                st.source_path, st.artifact_id, st.content_sha256
         FROM registry_sample_tasks st
         JOIN registry_task_versions tv ON tv.id = st.id
         JOIN registry_submission_batches b ON b.id = st.submission_id
         WHERE b.catalog_visibility IN ('featured', 'available', 'log_only')
           AND tv.catalog_visibility IN ('featured', 'available', 'log_only')
         ORDER BY st.created_at, st.id`,
      ),
      this.pool.query<SampleCheckRow>(
        `SELECT DISTINCT ON (task_id, phase)
                task_id, id, phase, outcome, summary, score, completed_at
         FROM registry_harbor_check_results
         ORDER BY task_id, phase, completed_at DESC, id DESC`,
      ),
      this.pool.query<SampleAttemptRow>(
        `SELECT DISTINCT ON (task_version_id, check_phase)
                task_version_id AS task_id, id, check_phase AS phase, status, summary, completed_at
         FROM registry_harbor_check_attempts
         ORDER BY task_version_id, check_phase, completed_at DESC, created_at DESC, id DESC`,
      ),
      this.pool.query<SampleFindingRow>(
        `WITH latest_checks AS (
           SELECT DISTINCT ON (task_id, phase)
                  task_id, phase, id, outcome
           FROM registry_harbor_check_results
           ORDER BY task_id, phase, completed_at DESC, id DESC
         )
         SELECT tf.task_version_id AS task_id, tf.id, tf.check_run_id, tf.check_phase, tf.finding
         FROM registry_task_findings tf
         JOIN latest_checks latest
           ON latest.task_id = tf.task_version_id
          AND latest.phase = tf.check_phase
          AND latest.id = tf.check_run_id
         WHERE tf.check_run_id IS NOT NULL
           AND tf.check_phase IN ('environment', 'oracle', 'nop')
           AND latest.outcome = 'fail'
         ORDER BY tf.created_at, tf.id`,
      ),
      this.pool.query<{ task_version_id: string; source_item_id: string }>(
        `SELECT task_version_id, source_item_id
         FROM registry_task_source_items
         ORDER BY created_at, source_item_id`,
      ),
      this.pool.query<SampleSourceEventRow>(
        `SELECT bse.batch_id, bse.role, se.id, se.channel, se.external_ref, se.sender,
                se.received_at, se.raw_artifact_id,
                raw.kind AS raw_artifact_kind,
                raw.sha256 AS raw_artifact_sha256,
                raw.size_bytes AS raw_artifact_size_bytes,
                raw.content_type AS raw_artifact_content_type,
                raw.metadata->>'originalName' AS raw_artifact_original_name
         FROM registry_batch_source_events bse
         JOIN registry_source_events se ON se.id = bse.source_event_id
         JOIN registry_submission_batches b ON b.id = bse.batch_id
         LEFT JOIN registry_artifacts raw ON raw.id = se.raw_artifact_id
         WHERE b.catalog_visibility IN ('featured', 'available', 'log_only')
         ORDER BY se.received_at, se.created_at, se.id`,
      ),
      this.pool.query<SampleSourceItemRow>(
        `SELECT bse.batch_id, si.source_event_id, si.id, si.kind, si.display_name, si.locator,
                si.media_type, si.artifact_id, si.content_sha256, si.size_bytes,
                si.fetch_status, si.parse_status, si.mutable, si.captured_at, si.metadata,
                si.created_at, artifact.kind AS artifact_kind,
                array_remove(array_agg(DISTINCT bsi.role), NULL) AS submission_roles
         FROM registry_batch_source_events bse
         JOIN registry_submission_batches b ON b.id = bse.batch_id
         JOIN registry_source_items si ON si.source_event_id = bse.source_event_id
         LEFT JOIN registry_batch_source_items bsi
           ON bsi.batch_id = bse.batch_id AND bsi.source_item_id = si.id
         LEFT JOIN registry_artifacts artifact ON artifact.id = si.artifact_id
         WHERE b.catalog_visibility IN ('featured', 'available', 'log_only')
           AND (
             bsi.source_item_id IS NOT NULL
             OR NOT EXISTS (
               SELECT 1
               FROM registry_batch_source_items explicit_link
               JOIN registry_source_items explicit_item ON explicit_item.id = explicit_link.source_item_id
               WHERE explicit_link.batch_id = bse.batch_id
                 AND explicit_item.source_event_id = bse.source_event_id
             )
           )
         GROUP BY bse.batch_id, si.source_event_id, si.id, si.kind, si.display_name, si.locator,
                  si.media_type, si.artifact_id, si.content_sha256, si.size_bytes,
                  si.fetch_status, si.parse_status, si.mutable, si.captured_at, si.metadata,
                  si.created_at, artifact.kind
         ORDER BY bse.batch_id, si.source_event_id, si.created_at, si.id`,
      ),
    ]);

    const checksByTask = group(checksResult.rows, (row) => row.task_id);
    const attemptsByTask = group(attemptsResult.rows, (row) => row.task_id);
    const findingsByTask = group(findingsResult.rows, (row) => row.task_id);
    const sourcesByTask = group(taskSourcesResult.rows, (row) => row.task_version_id);
    const tasksBySubmission = new Map<string, SampleCatalogTask[]>();
    for (const row of tasksResult.rows) {
      const checks: Partial<Record<HarborCheckPhase, SampleCatalogCheck>> = {};
      for (const check of checksByTask.get(row.id) ?? []) {
        checks[check.phase] = {
          id: check.id,
          phase: check.phase,
          outcome: check.outcome,
          summary: check.summary,
          score: check.score,
          completedAt: new Date(check.completed_at).toISOString(),
        };
      }
      const attempts: Partial<Record<HarborCheckPhase, SampleCatalogAttempt>> = {};
      for (const attempt of attemptsByTask.get(row.id) ?? []) {
        attempts[attempt.phase] = {
          id: attempt.id,
          phase: attempt.phase,
          status: attempt.status,
          summary: attempt.summary,
          completedAt: new Date(attempt.completed_at).toISOString(),
        };
      }
      const findings: SampleCatalogFinding[] = (findingsByTask.get(row.id) ?? []).map((finding) => ({
        id: finding.id,
        phase: finding.check_phase,
        checkRunId: finding.check_run_id,
        finding: finding.finding,
      }));
      append(tasksBySubmission, row.submission_id, {
        id: row.id,
        stableKey: row.stable_key,
        title: row.title,
        summary: row.summary,
        kind: row.task_kind,
        format: row.format_kind,
        benchmark: { id: row.benchmark_id, displayName: row.benchmark_name },
        gpuRequired: row.gpu_required,
        sourcePath: row.source_path,
        artifactId: row.artifact_id,
        contentSha256: row.content_sha256,
        sourceItemIds: (sourcesByTask.get(row.id) ?? []).map((source) => source.source_item_id),
        checks,
        attempts,
        findings,
      });
    }

    const sourceItemsByEvent = group(sourceItemsResult.rows, (row) => `${row.batch_id}\u0000${row.source_event_id}`);
    const sourceEventsBySubmission = new Map<string, SampleCatalogSubmission["sourceEvents"]>();
    for (const row of sourceEventsResult.rows) {
      append(sourceEventsBySubmission, row.batch_id, {
        id: row.id,
        channel: row.channel,
        externalRef: row.external_ref,
        sender: row.sender,
        receivedAt: new Date(row.received_at).toISOString(),
        rawArtifactId: row.raw_artifact_id,
        rawArtifact: row.raw_artifact_id && row.raw_artifact_kind && row.raw_artifact_sha256 ? {
          id: row.raw_artifact_id,
          kind: row.raw_artifact_kind,
          contentSha256: row.raw_artifact_sha256,
          sizeBytes: row.raw_artifact_size_bytes === null ? null : Number(row.raw_artifact_size_bytes),
          contentType: row.raw_artifact_content_type,
          originalName: row.raw_artifact_original_name,
        } : null,
        items: (sourceItemsByEvent.get(`${row.batch_id}\u0000${row.id}`) ?? []).map((item) => ({
          id: item.id,
          kind: item.kind,
          displayName: item.display_name,
          locator: item.locator,
          mediaType: item.media_type,
          artifactId: item.artifact_id,
          artifactKind: item.artifact_kind,
          contentSha256: item.content_sha256,
          sizeBytes: item.size_bytes === null ? null : Number(item.size_bytes),
          submissionRoles: item.submission_roles,
        })),
      });
    }

    const submissionsByVendor = new Map<string, SampleCatalogSubmission[]>();
    for (const row of submissionsResult.rows) {
      const tasks = tasksBySubmission.get(row.id) ?? [];
      const recordedFormats = row.formats.filter((format): format is "harbor" | "non_harbor" =>
        format === "harbor" || format === "non_harbor");
      const formats = [...new Set([...recordedFormats, ...tasks.map((task) => task.format)])];
      append(submissionsByVendor, row.vendor_id, {
        id: row.id,
        date: isoDate(row.submission_date),
        label: row.label,
        source: row.source_label,
        formats,
        sourceEvents: sourceEventsBySubmission.get(row.id) ?? [],
        tasks,
      });
    }

    const interactionsByVendor = group(interactionsResult.rows, (row) => row.vendor_id);
    const vendors = vendorsResult.rows.map((row) => ({
      id: row.id,
      name: row.name,
      short: row.short,
      interactions: (interactionsByVendor.get(row.id) ?? []).map((interaction) => ({
        id: interaction.id,
        kind: interaction.kind,
        eventType: interaction.event_type,
        title: interaction.title,
        summary: interaction.summary,
        channel: interaction.channel,
        evidence: interaction.evidence,
        occurredAt: new Date(interaction.occurred_at).toISOString(),
      })),
      submissions: submissionsByVendor.get(row.id) ?? [],
    }));
    const submissions = vendors.flatMap((vendor) => vendor.submissions);
    const tasks = submissions.flatMap((submission) => submission.tasks);
    return {
      generatedAt: new Date().toISOString(),
      vendors,
      totals: {
        vendors: vendors.length,
        submissions: submissions.length,
        tasks: tasks.length,
        harborTasks: tasks.filter((task) => task.format === "harbor").length,
      },
    };
  }

  async getSampleSubmission(id: string): Promise<SampleCatalogSubmission | null> {
    return (await this.sampleCatalogSnapshot()).vendors
      .flatMap((vendor) => vendor.submissions)
      .find((submission) => submission.id === id) ?? null;
  }

  async getSampleTask(id: string): Promise<SampleCatalogTask | null> {
    return (await this.sampleCatalogSnapshot()).vendors
      .flatMap((vendor) => vendor.submissions)
      .flatMap((submission) => submission.tasks)
      .find((task) => task.id === id) ?? null;
  }

  private async getVendor(id: string, scope: CatalogScope): Promise<CatalogVendor | null> {
    return (await this.catalogSnapshot(scope)).vendors.find((vendor) => vendor.id === id) ?? null;
  }

  private async getBatch(id: string, scope: CatalogScope): Promise<CatalogBatch | null> {
    return (await this.catalogSnapshot(scope)).vendors.flatMap((vendor) => vendor.batches).find((batch) => batch.id === id) ?? null;
  }

  private async getTask(id: string, scope: CatalogScope): Promise<CatalogTask | null> {
    return (await this.catalogSnapshot(scope)).vendors
      .flatMap((vendor) => vendor.batches)
      .flatMap((batch) => batch.categories)
      .flatMap((category) => category.tasks)
      .find((task) => task.id === id) ?? null;
  }

  async getSourceEvent(id: string): Promise<CatalogSourceEvent | null> {
    const [eventResult, itemsResult, relationsResult] = await Promise.all([
      this.pool.query<SourceEventRow>(
        `SELECT ''::text AS batch_id, NULL::text AS role, id, channel, external_ref, sender, received_at, raw_artifact_id
         FROM registry_source_events WHERE id = $1`,
        [id],
      ),
      this.pool.query<SourceItemRow>(
        `SELECT source_event_id, id, kind, display_name, locator, media_type, artifact_id,
                content_sha256, size_bytes, fetch_status, parse_status, mutable, captured_at, metadata
         FROM registry_source_items WHERE source_event_id = $1 ORDER BY created_at, id`,
        [id],
      ),
      this.pool.query<SourceRelationRow>(
        `SELECT source_event_id, from_item_id, to_item_id, relation, position
         FROM registry_source_relations WHERE source_event_id = $1
         ORDER BY position NULLS LAST, created_at`,
        [id],
      ),
    ]);
    const row = eventResult.rows[0];
    return row ? {
      id: row.id,
      role: row.role,
      channel: row.channel,
      externalRef: row.external_ref,
      sender: row.sender,
      receivedAt: new Date(row.received_at).toISOString(),
      rawArtifactId: row.raw_artifact_id,
      items: itemsResult.rows.map(sourceItemFromRow),
      relations: relationsResult.rows.map(sourceRelationFromRow),
    } : null;
  }

  async operationsSummary(): Promise<OperationsSummary> {
    const [vendorCount, sourceEventCount, submissions, tasks, checks, workItems, artifacts] = await Promise.all([
      this.pool.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM registry_vendors"),
      this.pool.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM registry_source_events"),
      this.pool.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM registry_submission_batches"),
      this.pool.query<{ task_kind: string; format_kind: string; count: string }>(
        `SELECT task_kind, format_kind, COUNT(*)::text AS count
         FROM registry_sample_tasks
         GROUP BY task_kind, format_kind`,
      ),
      this.pool.query<{ phase: string; outcome: "pass" | "fail"; count: string }>(
        `SELECT phase, outcome, COUNT(*)::text AS count
         FROM registry_harbor_check_results
         GROUP BY phase, outcome`,
      ),
      this.pool.query<{ count: string }>(
        "SELECT COUNT(*)::text AS count FROM registry_work_items WHERE status IN ('queued', 'leased')",
      ),
      this.pool.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM registry_artifacts"),
    ]);
    const countTasks = (field: "task_kind" | "format_kind", value: string) => tasks.rows
      .filter((row) => row[field] === value)
      .reduce((sum, row) => sum + Number(row.count), 0);
    const harborChecks: Record<string, { pass: number; fail: number }> = Object.fromEntries(
      (["environment", "oracle", "nop"] as const).map((phase) => [phase, { pass: 0, fail: 0 }]),
    );
    for (const row of checks.rows) harborChecks[row.phase]![row.outcome] = Number(row.count);
    return {
      vendors: Number(vendorCount.rows[0]?.count ?? 0),
      sourceEvents: Number(sourceEventCount.rows[0]?.count ?? 0),
      submissions: Number(submissions.rows[0]?.count ?? 0),
      tasks: {
        tasks: countTasks("task_kind", "task"),
        traces: countTasks("task_kind", "trace"),
        harbor: countTasks("format_kind", "harbor"),
        nonHarbor: countTasks("format_kind", "non_harbor"),
      },
      harborChecks,
      pendingWorkItems: Number(workItems.rows[0]?.count ?? 0),
      artifacts: Number(artifacts.rows[0]?.count ?? 0),
    };
  }

  private async ingestSourceEnvelopeWithClient(
    client: PoolClient,
    envelope: SourceEnvelopeInput,
    actor: string,
  ): Promise<boolean> {
    const payloadSha256 = hashSourceEnvelope(envelope);
    const existingEvent = await client.query<{ payload_sha256: string | null }>(
      "SELECT payload_sha256 FROM registry_source_events WHERE id = $1",
      [envelope.sourceEvent.id],
    );
    const created = !existingEvent.rows[0];
    const previousSha = existingEvent.rows[0]?.payload_sha256;
    if (previousSha && previousSha !== payloadSha256) {
      throw new RegistryConflictError(`Source event ${envelope.sourceEvent.id} already exists with different immutable contents`);
    }

    if (created) {
      await client.query(
        `INSERT INTO registry_source_events(
           id, vendor_id, channel, external_ref, sender, received_at, raw_artifact_id, metadata, payload_sha256
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)`,
        [envelope.sourceEvent.id, envelope.vendor.id, envelope.sourceEvent.channel, envelope.sourceEvent.externalRef,
          envelope.sourceEvent.sender ?? null, envelope.sourceEvent.receivedAt, envelope.sourceEvent.rawArtifactId ?? null,
          json(envelope.sourceEvent.metadata ?? {}), payloadSha256],
      );
    } else if (!previousSha) {
      await client.query(
        `UPDATE registry_source_events
         SET channel = $2, external_ref = $3, sender = $4, received_at = $5,
             raw_artifact_id = $6, metadata = $7::jsonb, payload_sha256 = $8, updated_at = now()
         WHERE id = $1`,
        [envelope.sourceEvent.id, envelope.sourceEvent.channel, envelope.sourceEvent.externalRef,
          envelope.sourceEvent.sender ?? null, envelope.sourceEvent.receivedAt, envelope.sourceEvent.rawArtifactId ?? null,
          json(envelope.sourceEvent.metadata ?? {}), payloadSha256],
      );
    }

    for (const item of envelope.items) {
      const itemSha256 = hashValue(item);
      const existingItem = await client.query<{ payload_sha256: string }>(
        "SELECT payload_sha256 FROM registry_source_items WHERE id = $1",
        [item.id],
      );
      if (existingItem.rows[0]?.payload_sha256 && existingItem.rows[0].payload_sha256 !== itemSha256) {
        throw new RegistryConflictError(`Source item ${item.id} already exists with different immutable contents`);
      }
      if (!existingItem.rows[0]) {
        await client.query(
          `INSERT INTO registry_source_items(
             id, source_event_id, kind, display_name, locator, media_type, artifact_id,
             content_sha256, size_bytes, fetch_status, parse_status, mutable, captured_at, metadata, payload_sha256
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb, $15)`,
          [item.id, envelope.sourceEvent.id, item.kind, item.displayName, item.locator ?? null, item.mediaType ?? null,
            item.artifactId ?? null, item.contentSha256 ?? null, item.sizeBytes ?? null, item.fetchStatus, item.parseStatus,
            item.mutable, item.capturedAt ?? null, json(item.metadata ?? {}), itemSha256],
        );
        if (item.fetchStatus === "queued") {
          await this.enqueueWork(client, "fetch_source_item", "source_item", item.id, { sourceEventId: envelope.sourceEvent.id });
        }
        if (item.parseStatus === "queued") {
          await this.enqueueWork(client, "parse_source_item", "source_item", item.id, { sourceEventId: envelope.sourceEvent.id });
        }
      }
    }

    for (const relation of envelope.relations ?? []) {
      await client.query(
        `INSERT INTO registry_source_relations(
           source_event_id, from_item_id, to_item_id, relation, position, metadata
         ) VALUES ($1, $2, $3, $4, $5, $6::jsonb)
         ON CONFLICT(from_item_id, to_item_id, relation) DO NOTHING`,
        [envelope.sourceEvent.id, relation.fromItemId, relation.toItemId, relation.relation,
          relation.position ?? null, json(relation.metadata ?? {})],
      );
    }

    for (const link of envelope.batchLinks ?? []) {
      await client.query(
        `INSERT INTO registry_batch_source_events(batch_id, source_event_id, role)
         VALUES ($1, $2, $3)
         ON CONFLICT(batch_id, source_event_id) DO UPDATE SET
           role = CASE WHEN registry_batch_source_events.role = 'primary' THEN 'primary' ELSE EXCLUDED.role END`,
        [link.batchId, envelope.sourceEvent.id, link.role],
      );
      const linkedItems = await client.query<{
        id: string;
        kind: CatalogSourceItem["kind"];
        artifact_id: string | null;
        artifact_kind: ArtifactInput["kind"] | null;
      }>(
        `SELECT si.id, si.kind, si.artifact_id, artifact.kind AS artifact_kind
         FROM registry_source_items si
         LEFT JOIN registry_artifacts artifact ON artifact.id = si.artifact_id
         WHERE si.source_event_id = $1 AND si.id = ANY($2::text[])
         ORDER BY si.created_at, si.id`,
        [envelope.sourceEvent.id, link.sourceItemIds ?? []],
      );
      for (const item of linkedItems.rows) {
        await client.query(
          `INSERT INTO registry_batch_source_items(batch_id, source_item_id, role)
           VALUES ($1, $2, $3)
           ON CONFLICT(batch_id, source_item_id, role) DO NOTHING`,
          [
            link.batchId,
            item.id,
            defaultSubmissionSourceItemRole(
              item.kind,
              item.artifact_id ?? undefined,
              item.artifact_kind ?? undefined,
            ),
          ],
        );
      }
    }

    for (const link of envelope.taskLinks ?? []) {
      await client.query(
        `INSERT INTO registry_task_source_items(task_version_id, source_item_id, role)
         VALUES ($1, $2, $3)
         ON CONFLICT(task_version_id, source_item_id, role) DO NOTHING`,
        [link.taskVersionId, link.sourceItemId, link.role],
      );
    }

    if (created || !previousSha) {
      await this.enqueueWork(client, "parse_source_event", "source_event", envelope.sourceEvent.id, {
        payloadSha256,
        sourceItems: envelope.items.length,
      });
      await this.insertStatusEvent(client, "source_event", envelope.sourceEvent.id, "source.ingested", actor, {
        payloadSha256,
        sourceItems: envelope.items.length,
        relations: envelope.relations?.length ?? 0,
      });
    }
    return created;
  }

  private async registerArtifactWithClient(client: PoolClient, input: ArtifactInput): Promise<void> {
    const existing = await client.query<{ storage_key: string; sha256: string }>(
      "SELECT storage_key, sha256 FROM registry_artifacts WHERE id = $1",
      [input.id],
    );
    if (existing.rows[0]) {
      if (existing.rows[0].storage_key !== input.storageKey || existing.rows[0].sha256 !== input.sha256) {
        throw new RegistryConflictError(`Artifact ${input.id} already exists with different immutable contents`);
      }
      return;
    }
    await client.query(
      `INSERT INTO registry_artifacts(id, kind, storage_key, sha256, size_bytes, content_type, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
      [input.id, input.kind, input.storageKey, input.sha256, input.sizeBytes ?? null,
        input.contentType ?? null, json(input.metadata ?? {})],
    );
  }

  private async upsertVendor(client: PoolClient, vendor: SubmissionManifest["vendor"]): Promise<void> {
    await client.query(
      `INSERT INTO registry_vendors(id, name, short, description, aliases)
       VALUES ($1, $2, $3, $4, $5::jsonb)
       ON CONFLICT(id) DO UPDATE SET
         name = EXCLUDED.name,
         short = EXCLUDED.short,
         description = EXCLUDED.description,
         aliases = EXCLUDED.aliases,
         updated_at = now()`,
      [vendor.id, vendor.name, vendor.short, vendor.description, json(vendor.aliases ?? [])],
    );
  }

  private async enqueueWork(
    client: PoolClient,
    kind: string,
    entityType: string,
    entityId: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    await client.query(
      `INSERT INTO registry_work_items(id, kind, entity_type, entity_id, status, payload)
       VALUES ($1, $2, $3, $4, 'queued', $5::jsonb)`,
      [randomUUID(), kind, entityType, entityId, json(payload)],
    );
  }

  private async insertStatusEvent(
    client: PoolClient,
    entityType: string,
    entityId: string,
    eventType: string,
    actor: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    await client.query(
      `INSERT INTO registry_status_events(id, entity_type, entity_id, event_type, actor, payload, occurred_at)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, now())`,
      [randomUUID(), entityType, entityId, eventType, actor, json(payload)],
    );
  }
}

export class RegistryConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RegistryConflictError";
  }
}

export class RegistryNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RegistryNotFoundError";
  }
}

function stableTaskId(vendorId: string, stableKey: string): string {
  return `${vendorId}:task:${createHash("sha256").update(stableKey).digest("hex").slice(0, 24)}`;
}

function benchmarkAssignmentId(requestSha256: string, taskVersionId: string): string {
  return `benchmark-assignment:${createHash("sha256")
    .update(`${requestSha256}\u0000${taskVersionId}`)
    .digest("hex")}`;
}

function gpuRequirementAssignmentId(requestSha256: string, taskVersionId: string): string {
  return `gpu-requirement-assignment:${createHash("sha256")
    .update(`${requestSha256}\u0000${taskVersionId}`)
    .digest("hex")}`;
}

function legacyTaskKind(metadata: Record<string, unknown> | undefined): "task" | "trace" {
  const value = metadata?.taskKind ?? metadata?.task_kind;
  return value === "trace" || value === "trajectory" ? "trace" : "task";
}

function legacyFormatKind(
  format: string,
  representationPath: string | undefined,
  normalizationOutcome: string | undefined,
): "harbor" | "non_harbor" {
  return representationPath === "already_harbor"
    || normalizationOutcome === "already_harbor"
    || format.trim().toLowerCase() === "harbor"
    ? "harbor"
    : "non_harbor";
}

type StoredTaskVersion = {
  id: string;
  task_id: string;
  batch_id: string;
  category_id: string;
  source_path: string | null;
  format: string;
  representation_kind: CatalogTask["representation"]["kind"];
  representation_path: CatalogTask["representation"]["path"];
  normalization_outcome: CatalogTask["representation"]["normalizationOutcome"];
  representation_basis: CatalogTask["representation"]["basis"];
  artifact_id: string | null;
  content_sha256: string | null;
  workflow_status: string;
  catalog_visibility: string;
  metadata: Record<string, unknown>;
};

function registeredTaskVersionMatches(current: StoredTaskVersion, expected: StoredTaskVersion): boolean {
  return current.id === expected.id
    && current.task_id === expected.task_id
    && current.batch_id === expected.batch_id
    && current.category_id === expected.category_id
    && current.source_path === expected.source_path
    && current.format === expected.format
    && current.representation_kind === expected.representation_kind
    && current.representation_path === expected.representation_path
    && current.normalization_outcome === expected.normalization_outcome
    && current.representation_basis === expected.representation_basis
    && current.artifact_id === expected.artifact_id
    && current.content_sha256 === expected.content_sha256
    && metadataContains(current.metadata, expected.metadata);
}

function canFinalizeUnboundTaskVersion(current: StoredTaskVersion, expected: StoredTaskVersion): boolean {
  return current.id === expected.id
    && current.task_id === expected.task_id
    && current.batch_id === expected.batch_id
    && current.category_id === expected.category_id
    && current.source_path === expected.source_path
    && current.format === expected.format
    && current.artifact_id === null
    && current.content_sha256 === null
    && expected.artifact_id !== null
    && expected.content_sha256 !== null
    && ["received", "unchecked", "normalizing"].includes(current.workflow_status)
    && expected.workflow_status === "unchecked"
    && current.catalog_visibility === expected.catalog_visibility;
}

function mergeCompatibleMetadata(
  current: Record<string, unknown>,
  additional: Record<string, unknown>,
  taskVersionId: string,
): Record<string, unknown> {
  for (const [key, value] of Object.entries(additional)) {
    if (key in current && hashValue(current[key]) !== hashValue(value)) {
      throw new RegistryConflictError(
        `Task version ${taskVersionId} metadata.${key} conflicts with its immutable catalog record`,
      );
    }
  }
  return { ...current, ...additional };
}

function metadataContains(current: Record<string, unknown>, expected: Record<string, unknown>): boolean {
  return Object.entries(expected).every(([key, value]) => key in current && hashValue(current[key]) === hashValue(value));
}

function hashManifest(manifest: SubmissionManifest): string {
  return createHash("sha256").update(JSON.stringify(canonical(manifest))).digest("hex");
}

function hashSourceEnvelope(envelope: SourceEnvelopeInput): string {
  return hashValue({ sourceEvent: envelope.sourceEvent, items: envelope.items, relations: envelope.relations ?? [] });
}

function hashValue(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
}

function defaultSubmissionSourceItemRole(
  itemKind: CatalogSourceItem["kind"],
  artifactId: string | undefined,
  artifactKind: ArtifactInput["kind"] | undefined,
): "original_vendor_file" | "provenance" {
  if (!artifactId) return "provenance";
  if (artifactKind === "source_snapshot"
    || artifactKind === "submission_manifest"
    || artifactKind === "check_evidence"
    || artifactKind === "extracted_text") {
    return "provenance";
  }
  return ORIGINAL_VENDOR_SOURCE_ITEM_KINDS.has(itemKind) ? "original_vendor_file" : "provenance";
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => [key, canonical(child)]));
  }
  return value;
}

function taskFromRow(
  row: TaskRow,
  sourceItemIds: string[] = [],
  findings: CatalogTask["findings"] = [],
  runtimeFacts: RuntimeCheckFact[] = [],
): CatalogTask {
  return {
    id: row.id,
    stableKey: row.stable_key,
    title: row.title,
    summary: row.summary,
    sourcePath: row.source_path,
    format: row.format,
    representation: {
      kind: row.representation_kind,
      isHarbor: row.representation_kind === "unknown" ? null : row.representation_kind === "harbor",
      path: row.representation_path,
      normalizationOutcome: row.normalization_outcome,
      basis: row.representation_basis,
    },
    runtimeVerification: deriveRuntimeVerification(runtimeFacts, Number(row.unclassified_check_count)),
    artifactId: row.artifact_id,
    contentSha256: row.content_sha256,
    workflowStatus: row.workflow_status,
    catalogVisibility: row.catalog_visibility,
    checks: {
      pass: Number(row.pass_count),
      fail: Number(row.fail_count),
      blocked: Number(row.blocked_count),
      notRun: Number(row.not_run_count),
    },
    sourceItemIds,
    findings,
  };
}

function runtimeCheckFactFromRow(row: RuntimeCheckRow): RuntimeCheckFact {
  return {
    id: row.id,
    evidenceRole: row.evidence_role,
    outcome: row.outcome,
    completedAt: new Date(row.completed_at).toISOString(),
  };
}

function taskFindingFromRow(row: TaskFindingRow): CatalogTask["findings"][number] {
  return {
    id: row.id,
    finding: row.finding,
  };
}

function sourceItemFromRow(row: SourceItemRow): CatalogSourceItem {
  return {
    id: row.id,
    kind: row.kind,
    displayName: row.display_name,
    locator: row.locator,
    mediaType: row.media_type,
    artifactId: row.artifact_id,
    contentSha256: row.content_sha256,
    sizeBytes: row.size_bytes === null ? null : Number(row.size_bytes),
    fetchStatus: row.fetch_status,
    parseStatus: row.parse_status,
    mutable: row.mutable,
    capturedAt: row.captured_at === null ? null : new Date(row.captured_at).toISOString(),
    metadata: row.metadata,
  };
}

function artifactFromRow(row: ArtifactRow): ArtifactRecord {
  return {
    id: row.id,
    kind: row.kind,
    storageKey: row.storage_key,
    sha256: row.sha256,
    sizeBytes: row.size_bytes === null ? undefined : Number(row.size_bytes),
    contentType: row.content_type ?? undefined,
    metadata: row.metadata,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

function benchmarkFromRow(row: BenchmarkRow): RegistryBenchmark {
  return {
    id: row.id,
    displayName: row.display_name,
    aliases: row.aliases,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

function normalizedBenchmarkLabel(value: string): string {
  return value.normalize("NFKC").trim().toLowerCase().replace(/[\s_-]+/g, "-");
}

function sourceRelationFromRow(row: SourceRelationRow): CatalogSourceRelation {
  return {
    fromItemId: row.from_item_id,
    toItemId: row.to_item_id,
    relation: row.relation,
    position: row.position,
  };
}

function submissionReviewFromRow(row: SubmissionReviewRow): SubmissionReview {
  return {
    id: row.id,
    batchId: row.batch_id,
    signal: row.signal,
    scope: row.scope,
    categoryIds: row.category_ids,
    reviewer: {
      openId: row.reviewer_open_id,
      unionId: row.reviewer_union_id ?? undefined,
      tenantKey: row.reviewer_tenant_key,
      name: row.reviewer_name,
    },
    comment: row.comment,
    metadata: row.metadata,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

function vendorEventFromRow(row: VendorEventRow): VendorEvent {
  return {
    id: row.id,
    vendorId: row.vendor_id,
    kind: row.kind,
    eventType: row.event_type,
    summary: row.summary,
    actor: row.actor,
    occurredAt: new Date(row.occurred_at).toISOString(),
    sourceEventIds: row.source_event_ids,
    batchIds: row.batch_ids,
    metadata: row.metadata,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

function catalogVisibility(scope: CatalogScope): string[] {
  if (scope === "research") return ["featured", "available"];
  if (scope === "portal") return ["featured", "available", "log_only"];
  return ["featured", "available", "log_only", "internal"];
}

function archiveContextFromRow(row: VendorArchiveRow): VendorArchiveContext | null {
  if (!row.archived_at) return null;
  if (!row.archived_by || !row.archive_reason) {
    throw new Error(`Archived vendor ${row.id} has incomplete archive context`);
  }
  return {
    archivedAt: new Date(row.archived_at).toISOString(),
    archivedBy: row.archived_by,
    archiveReason: row.archive_reason,
  };
}

function requiredArchiveContext(row: VendorArchiveRow): VendorArchiveContext {
  const context = archiveContextFromRow(row);
  if (!context) throw new Error(`Vendor ${row.id} was not archived by its update`);
  return context;
}

function append<T>(map: Map<string, T[]>, key: string, value: T): void {
  const values = map.get(key);
  if (values) values.push(value);
  else map.set(key, [value]);
}

function group<T>(values: T[], key: (value: T) => string): Map<string, T[]> {
  const result = new Map<string, T[]>();
  for (const value of values) append(result, key(value), value);
  return result;
}

function isoDate(value: string | Date): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10);
}

function json(value: unknown): string {
  return JSON.stringify(value);
}
