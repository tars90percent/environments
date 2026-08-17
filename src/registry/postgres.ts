import { createHash, randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import { runRegistryMigrations } from "./migrations.js";
import { PROCUREMENT_EVENT_KINDS, procurementSummaryFromEvent } from "./procurement-summary.js";
import type { RegistryRepository } from "./repository.js";
import type {
  ArtifactInput,
  ArtifactRecord,
  CatalogBatch,
  CatalogCategory,
  CatalogScope,
  CatalogSnapshot,
  CatalogSourceEvent,
  CatalogSourceItem,
  CatalogSourceRelation,
  CatalogTask,
  CatalogVendor,
  CheckResultInput,
  FollowUpInput,
  OperationsSummary,
  SourceEnvelopeInput,
  StatusUpdateInput,
  SubmissionManifest,
  SubmissionRemovalInput,
  SubmissionRemovalResult,
  SubmissionReview,
  SubmissionReviewInput,
  TaskSourceLinksInput,
  VendorArchiveContext,
  VendorArchiveInput,
  VendorArchiveResult,
  VendorDirectoryEntry,
  VendorEvent,
  VendorEventInput,
  WorkCompletionInput,
  WorkItem,
} from "./types.js";

type VendorRow = { id: string; name: string; short: string; description: string };
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
  workflow_status: CatalogTask["workflowStatus"];
  catalog_visibility: CatalogTask["catalogVisibility"];
  pass_count: string;
  fail_count: string;
  blocked_count: string;
  not_run_count: string;
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
type VendorDirectoryRow = {
  id: string;
  name: string;
  short: string;
  description: string;
  aliases: string[];
  source_event_count: string;
  submission_count: string;
  vendor_event_count: string;
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

  async ingestSourceEnvelope(envelope: SourceEnvelopeInput): Promise<{ sourceEventId: string; created: boolean }> {
    const payloadSha256 = hashSourceEnvelope(envelope);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await this.upsertVendor(client, envelope.vendor);
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
           ON CONFLICT(batch_id, source_event_id) DO UPDATE SET role = EXCLUDED.role`,
          [link.batchId, envelope.sourceEvent.id, link.role],
        );
        for (const itemId of link.sourceItemIds ?? []) {
          await client.query(
            `INSERT INTO registry_batch_source_items(batch_id, source_item_id, role)
             VALUES ($1, $2, $3)
             ON CONFLICT(batch_id, source_item_id, role) DO NOTHING`,
            [link.batchId, itemId, link.role],
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
        await this.enqueueWork(client, "normalize_source_event", "source_event", envelope.sourceEvent.id, {
          payloadSha256,
          sourceItems: envelope.items.length,
        });
        await this.insertStatusEvent(client, "source_event", envelope.sourceEvent.id, "source.ingested", "case", {
          payloadSha256,
          sourceItems: envelope.items.length,
          relations: envelope.relations?.length ?? 0,
        });
      }
      await client.query("COMMIT");
      return { sourceEventId: envelope.sourceEvent.id, created };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async recordVendorEvent(input: VendorEventInput): Promise<{ eventId: string; created: boolean }> {
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

  async listVendorEvents(vendorId: string): Promise<VendorEvent[]> {
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

  async vendorDirectory(includeArchived = false): Promise<VendorDirectoryEntry[]> {
    const result = await this.pool.query<VendorDirectoryRow>(
      `SELECT v.id, v.name, v.short, v.description, v.aliases, v.updated_at,
              v.archived_at, v.archived_by, v.archive_reason,
              COALESCE(se.event_count, 0)::text AS source_event_count,
              COALESCE(sb.batch_count, 0)::text AS submission_count,
              COALESCE(ve.event_count, 0)::text AS vendor_event_count,
              GREATEST(se.latest_at, sb.latest_at, ve.latest_at) AS latest_activity_at
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
           revises_batch_id, delta, metadata, manifest_sha256
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, $12::jsonb, $13::jsonb, $14)`,
        [manifest.batch.id, manifest.vendor.id, manifest.sourceEvent.id, manifest.batch.date, manifest.batch.label,
          manifest.batch.sourceLabel, manifest.batch.taskCount, json(manifest.batch.formats), manifest.batch.workflowStatus,
          manifest.batch.catalogVisibility, manifest.batch.revisesBatchId ?? null, json(manifest.batch.delta),
          json(manifest.batch.metadata ?? {}), manifestSha256],
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
             workflow_status, catalog_visibility, metadata
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)`,
          [task.id, stableTaskId(manifest.vendor.id, task.stableKey), manifest.batch.id, task.categoryId,
            task.sourcePath ?? null, task.format, task.contentSha256 ?? null,
            task.workflowStatus ?? manifest.batch.workflowStatus,
            task.catalogVisibility ?? manifest.batch.catalogVisibility,
            json(task.metadata ?? {})],
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
      await this.enqueueWork(client, "check_submission", "submission_batch", manifest.batch.id, { manifestSha256 });
      await client.query("COMMIT");
      return { batchId: manifest.batch.id, created: true };
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

      const normalized = await client.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM (
           SELECT id FROM registry_task_versions WHERE batch_id = $1
           UNION ALL
           SELECT id FROM registry_tasks WHERE first_seen_batch_id = $1
         ) normalized_entities`,
        [input.batchId],
      );
      if (Number(normalized.rows[0]?.count ?? 0) > 0) {
        throw new RegistryConflictError(
          `Submission ${input.batchId} has normalized task records and cannot be removed by the sample-only cleanup`,
        );
      }

      const linkedEvents = await client.query<{ id: string }>(
        `SELECT source_event_id AS id FROM registry_batch_source_events WHERE batch_id = $1
         UNION
         SELECT source_event_id AS id FROM registry_submission_batches WHERE id = $1`,
        [input.batchId],
      );
      const linkedEventIds = linkedEvents.rows.map((row) => row.id);
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
           )`,
        [linkedEventIds, input.batchId],
      ) : { rows: [] as Array<{ id: string }> };
      const removedSourceEventIds = removableEvents.rows.map((row) => row.id);
      const retainedSourceEventIds = linkedEventIds.filter((id) => !removedSourceEventIds.includes(id));

      const handoffOnlyEvents = retainedSourceEventIds.length ? await client.query<{ id: string }>(
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
           )`,
        [retainedSourceEventIds, input.batchId],
      ) : { rows: [] as Array<{ id: string }> };
      const handoffOnlyEventIds = handoffOnlyEvents.rows.map((row) => row.id);
      const cancelledEventIds = [...new Set([...removedSourceEventIds, ...handoffOnlyEventIds])];

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
      const candidateArtifactIds = candidateArtifacts.rows.map((row) => row.id);

      await client.query(
        `DELETE FROM registry_work_items
         WHERE (entity_type = 'submission_batch' AND entity_id = $1)
            OR (entity_type = 'source_event' AND entity_id = ANY($2::text[]))
            OR (entity_type = 'source_item' AND entity_id = ANY($3::text[]))`,
        [input.batchId, cancelledEventIds, sourceItemIds],
      );
      await client.query(
        `DELETE FROM registry_status_events
         WHERE (entity_type = 'submission_batch' AND entity_id = $1)
            OR (entity_type = 'source_event' AND entity_id = ANY($2::text[]))
            OR (entity_type = 'source_item' AND entity_id = ANY($3::text[]))`,
        [input.batchId, removedSourceEventIds, removedSourceItemIds],
      );
      if (handoffOnlyEventIds.length) {
        await client.query(
          `UPDATE registry_source_items
           SET fetch_status = CASE WHEN fetch_status IN ('queued', 'fetching') THEN 'blocked' ELSE fetch_status END,
               parse_status = CASE WHEN parse_status IN ('queued', 'parsing') THEN 'blocked' ELSE parse_status END,
               metadata = metadata || $2::jsonb,
               updated_at = now()
           WHERE source_event_id = ANY($1::text[])`,
          [handoffOnlyEventIds, json({ scopeBoundary: "purchased_delivery_handed_off", handoffReason: input.reason })],
        );
        for (const sourceEventId of handoffOnlyEventIds) {
          await this.insertStatusEvent(client, "source_event", sourceEventId, "source.handed_off", input.actor, {
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
        reason: input.reason,
        vendorId,
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
         ORDER BY a.size_bytes DESC NULLS LAST, a.id`,
        [candidateArtifactIds],
      ) : { rows: [] as ArtifactRow[] };
      await client.query("COMMIT");
      return {
        batchId: input.batchId,
        vendorId,
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

  async recordCheckResult(input: CheckResultInput): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO registry_check_definitions(id, version, kind, name, description, required)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT(id, version) DO NOTHING`,
        [input.definitionId, input.definitionVersion, input.kind, input.name, input.description, input.required],
      );
      await client.query(
        `INSERT INTO registry_check_runs(
           id, task_version_id, definition_id, definition_version, outcome, summary,
           runner, evidence, started_at, completed_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, $10)
         ON CONFLICT(id) DO NOTHING`,
        [input.id, input.taskVersionId, input.definitionId, input.definitionVersion, input.outcome, input.summary,
          json(input.runner), json(input.evidence), input.startedAt, input.completedAt],
      );
      await this.insertStatusEvent(client, "task_version", input.taskVersionId, "check.completed", "case", {
        checkRunId: input.id,
        definition: `${input.definitionId}@${input.definitionVersion}`,
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

  async recordFollowUp(input: FollowUpInput): Promise<void> {
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

  async recordSubmissionReview(input: SubmissionReviewInput): Promise<SubmissionReview> {
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

  async listSubmissionReviews(batchId: string): Promise<SubmissionReview[]> {
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

  async updateStatus(input: StatusUpdateInput): Promise<void> {
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

  async linkTaskSources(input: TaskSourceLinksInput): Promise<{ linked: number }> {
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

  async catalogSnapshot(scope: CatalogScope): Promise<CatalogSnapshot> {
    const visibility = catalogVisibility(scope);
    const [demandsResult, vendorsResult, batchesResult, categoriesResult, tasksResult, sourceEventsResult, sourceItemsResult, sourceRelationsResult, taskSourcesResult, procurementEventsResult] = await Promise.all([
      this.pool.query<ResearchDemandRow>(
        `SELECT id, domain_en, domain_zh, subdomain_en, subdomain_zh,
                title_en, title_zh, note_en, note_zh,
                source_label_en, source_label_zh, source_date
         FROM registry_research_demands
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
                tv.source_path, tv.format, tv.workflow_status, tv.catalog_visibility,
                COUNT(cr.id) FILTER (WHERE cr.outcome = 'pass')::text AS pass_count,
                COUNT(cr.id) FILTER (WHERE cr.outcome = 'fail')::text AS fail_count,
                COUNT(cr.id) FILTER (WHERE cr.outcome = 'blocked')::text AS blocked_count,
                COUNT(cr.id) FILTER (WHERE cr.outcome = 'not_run')::text AS not_run_count
         FROM registry_task_versions tv
         JOIN registry_tasks t ON t.id = tv.task_id
         LEFT JOIN registry_check_runs cr ON cr.task_version_id = tv.id
         WHERE tv.catalog_visibility = ANY($1::text[])
         GROUP BY tv.batch_id, tv.category_id, tv.id, t.stable_key, t.title, t.summary,
                  tv.source_path, tv.format, tv.workflow_status, tv.catalog_visibility
         ORDER BY t.title`,
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
      this.pool.query<SourceItemRow>(
        `SELECT DISTINCT si.source_event_id, si.id, si.kind, si.display_name, si.locator,
                si.media_type, si.artifact_id, si.content_sha256, si.size_bytes,
                si.fetch_status, si.parse_status, si.mutable, si.captured_at, si.metadata,
                si.created_at
         FROM registry_source_items si
         JOIN registry_batch_source_events bse ON bse.source_event_id = si.source_event_id
         JOIN registry_submission_batches b ON b.id = bse.batch_id
         WHERE b.catalog_visibility = ANY($1::text[])
         ORDER BY si.created_at, si.id`,
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
         ORDER BY tsi.created_at`,
        [visibility],
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
    const tasksByCategory = group(tasksResult.rows, (row) => `${row.batch_id}\u0000${row.category_id}`);
    const categoriesByBatch = new Map<string, CatalogCategory[]>();
    for (const row of categoriesResult.rows) {
      const tasks = (tasksByCategory.get(`${row.batch_id}\u0000${row.id}`) ?? [])
        .map((task) => taskFromRow(task, (taskSourceIds.get(task.id) ?? []).map((source) => source.source_item_id)));
      append(categoriesByBatch, row.batch_id, {
        id: row.id,
        name: row.name,
        description: row.description,
        count: row.declared_count,
        examples: row.examples,
        tasks,
      });
    }

    const sourceItemsByEvent = group(sourceItemsResult.rows, (row) => row.source_event_id);
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
        items: (sourceItemsByEvent.get(row.id) ?? []).map(sourceItemFromRow),
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
      })),
      vendors,
      totals: {
        vendors: vendors.length,
        batches: batches.length,
        taskVersions: batches.reduce((sum, batch) => sum + batch.taskCount, 0),
      },
    };
  }

  async getVendor(id: string, scope: CatalogScope): Promise<CatalogVendor | null> {
    return (await this.catalogSnapshot(scope)).vendors.find((vendor) => vendor.id === id) ?? null;
  }

  async getBatch(id: string, scope: CatalogScope): Promise<CatalogBatch | null> {
    return (await this.catalogSnapshot(scope)).vendors.flatMap((vendor) => vendor.batches).find((batch) => batch.id === id) ?? null;
  }

  async getTask(id: string, scope: CatalogScope): Promise<CatalogTask | null> {
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
    const [vendorCount, sourceEventCount, vendorEventCount, submissions, checks, workItems, followUps, fetchStatuses, parseStatuses, artifacts] = await Promise.all([
      this.pool.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM registry_vendors"),
      this.pool.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM registry_source_events"),
      this.pool.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM registry_vendor_events"),
      this.pool.query<{ workflow_status: string; count: string }>(
        "SELECT workflow_status, COUNT(*)::text AS count FROM registry_submission_batches GROUP BY workflow_status",
      ),
      this.pool.query<{ outcome: string; count: string }>(
        "SELECT outcome, COUNT(*)::text AS count FROM registry_check_runs GROUP BY outcome",
      ),
      this.pool.query<{ count: string }>(
        "SELECT COUNT(*)::text AS count FROM registry_work_items WHERE status IN ('queued', 'leased')",
      ),
      this.pool.query<{ count: string }>(
        "SELECT COUNT(*)::text AS count FROM registry_follow_ups WHERE status <> 'closed'",
      ),
      this.pool.query<{ fetch_status: string; count: string }>(
        "SELECT fetch_status, COUNT(*)::text AS count FROM registry_source_items GROUP BY fetch_status",
      ),
      this.pool.query<{ parse_status: string; count: string }>(
        "SELECT parse_status, COUNT(*)::text AS count FROM registry_source_items GROUP BY parse_status",
      ),
      this.pool.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM registry_artifacts"),
    ]);
    return {
      vendors: Number(vendorCount.rows[0]?.count ?? 0),
      sourceEvents: Number(sourceEventCount.rows[0]?.count ?? 0),
      vendorEvents: Number(vendorEventCount.rows[0]?.count ?? 0),
      submissionsByStatus: Object.fromEntries(submissions.rows.map((row) => [row.workflow_status, Number(row.count)])),
      checksByOutcome: Object.fromEntries(checks.rows.map((row) => [row.outcome, Number(row.count)])),
      pendingWorkItems: Number(workItems.rows[0]?.count ?? 0),
      openFollowUps: Number(followUps.rows[0]?.count ?? 0),
      sourceItemsByFetchStatus: Object.fromEntries(fetchStatuses.rows.map((row) => [row.fetch_status, Number(row.count)])),
      sourceItemsByParseStatus: Object.fromEntries(parseStatuses.rows.map((row) => [row.parse_status, Number(row.count)])),
      artifacts: Number(artifacts.rows[0]?.count ?? 0),
    };
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

function hashManifest(manifest: SubmissionManifest): string {
  return createHash("sha256").update(JSON.stringify(canonical(manifest))).digest("hex");
}

function hashSourceEnvelope(envelope: SourceEnvelopeInput): string {
  return hashValue({ sourceEvent: envelope.sourceEvent, items: envelope.items, relations: envelope.relations ?? [] });
}

function hashValue(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => [key, canonical(child)]));
  }
  return value;
}

function taskFromRow(row: TaskRow, sourceItemIds: string[] = []): CatalogTask {
  return {
    id: row.id,
    stableKey: row.stable_key,
    title: row.title,
    summary: row.summary,
    sourcePath: row.source_path,
    format: row.format,
    workflowStatus: row.workflow_status,
    catalogVisibility: row.catalog_visibility,
    checks: {
      pass: Number(row.pass_count),
      fail: Number(row.fail_count),
      blocked: Number(row.blocked_count),
      notRun: Number(row.not_run_count),
    },
    sourceItemIds,
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
