import { createHash, randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import { runRegistryMigrations } from "./migrations.js";
import type { RegistryRepository } from "./repository.js";
import type {
  ArtifactInput,
  CatalogBatch,
  CatalogCategory,
  CatalogSnapshot,
  CatalogTask,
  CatalogVendor,
  CheckResultInput,
  FollowUpInput,
  OperationsSummary,
  StatusUpdateInput,
  SubmissionManifest,
  WorkCompletionInput,
  WorkItem,
} from "./types.js";

type VendorRow = { id: string; name: string; short: string; description: string };
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

  async ingestSubmission(manifest: SubmissionManifest): Promise<{ batchId: string; created: boolean }> {
    const manifestSha256 = hashManifest(manifest);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO registry_vendors(id, name, short, description, aliases)
         VALUES ($1, $2, $3, $4, $5::jsonb)
         ON CONFLICT(id) DO UPDATE SET
           name = EXCLUDED.name,
           short = EXCLUDED.short,
           description = EXCLUDED.description,
           aliases = EXCLUDED.aliases,
           updated_at = now()`,
        [manifest.vendor.id, manifest.vendor.name, manifest.vendor.short, manifest.vendor.description, json(manifest.vendor.aliases ?? [])],
      );

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
      }

      await this.insertStatusEvent(client, "submission_batch", manifest.batch.id, "submission.ingested", "case", {
        manifestSha256,
        sourceEventId: manifest.sourceEvent.id,
        taskVersions: manifest.tasks?.length ?? 0,
      });
      await client.query(
        `INSERT INTO registry_work_items(id, kind, entity_type, entity_id, status, payload)
         VALUES ($1, 'check_submission', 'submission_batch', $2, 'queued', $3::jsonb)`,
        [randomUUID(), manifest.batch.id, json({ manifestSha256 })],
      );
      await client.query("COMMIT");
      return { batchId: manifest.batch.id, created: true };
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

  async registerArtifact(input: ArtifactInput): Promise<void> {
    await this.pool.query(
      `INSERT INTO registry_artifacts(id, kind, storage_key, sha256, size_bytes, content_type, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
       ON CONFLICT(id) DO UPDATE SET
         kind = EXCLUDED.kind,
         storage_key = EXCLUDED.storage_key,
         sha256 = EXCLUDED.sha256,
         size_bytes = EXCLUDED.size_bytes,
         content_type = EXCLUDED.content_type,
         metadata = EXCLUDED.metadata`,
      [input.id, input.kind, input.storageKey, input.sha256, input.sizeBytes ?? null,
        input.contentType ?? null, json(input.metadata ?? {})],
    );
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

  async catalogSnapshot(scope: "research" | "all"): Promise<CatalogSnapshot> {
    const visibility = scope === "research" ? ["featured", "available"] : ["featured", "available", "log_only", "internal"];
    const [vendorsResult, batchesResult, categoriesResult, tasksResult] = await Promise.all([
      this.pool.query<VendorRow>(
        `SELECT DISTINCT v.id, v.name, v.short, v.description
         FROM registry_vendors v
         JOIN registry_submission_batches b ON b.vendor_id = v.id
         WHERE b.catalog_visibility = ANY($1::text[])
         ORDER BY v.name`,
        [visibility],
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
    ]);

    const tasksByCategory = group(tasksResult.rows, (row) => `${row.batch_id}\u0000${row.category_id}`);
    const categoriesByBatch = new Map<string, CatalogCategory[]>();
    for (const row of categoriesResult.rows) {
      const tasks = (tasksByCategory.get(`${row.batch_id}\u0000${row.id}`) ?? []).map(taskFromRow);
      append(categoriesByBatch, row.batch_id, {
        id: row.id,
        name: row.name,
        description: row.description,
        count: row.declared_count,
        examples: row.examples,
        tasks,
      });
    }

    const batchesByVendor = new Map<string, CatalogBatch[]>();
    for (const row of batchesResult.rows) {
      append(batchesByVendor, row.vendor_id, {
        id: row.id,
        date: isoDate(row.submission_date),
        label: row.label,
        source: row.source_label,
        taskCount: row.declared_task_count,
        formats: row.formats,
        workflowStatus: row.workflow_status,
        catalogVisibility: row.catalog_visibility,
        revisesBatchId: row.revises_batch_id,
        delta: row.delta,
        categories: categoriesByBatch.get(row.id) ?? [],
      });
    }

    const vendors = vendorsResult.rows.map((row) => ({
      id: row.id,
      name: row.name,
      short: row.short,
      description: row.description,
      batches: batchesByVendor.get(row.id) ?? [],
    }));
    const batches = vendors.flatMap((vendor) => vendor.batches);
    return {
      generatedAt: new Date().toISOString(),
      vendors,
      totals: {
        vendors: vendors.length,
        batches: batches.length,
        taskVersions: batches.reduce((sum, batch) => sum + batch.taskCount, 0),
      },
    };
  }

  async getVendor(id: string, scope: "research" | "all"): Promise<CatalogVendor | null> {
    return (await this.catalogSnapshot(scope)).vendors.find((vendor) => vendor.id === id) ?? null;
  }

  async getBatch(id: string, scope: "research" | "all"): Promise<CatalogBatch | null> {
    return (await this.catalogSnapshot(scope)).vendors.flatMap((vendor) => vendor.batches).find((batch) => batch.id === id) ?? null;
  }

  async getTask(id: string, scope: "research" | "all"): Promise<CatalogTask | null> {
    return (await this.catalogSnapshot(scope)).vendors
      .flatMap((vendor) => vendor.batches)
      .flatMap((batch) => batch.categories)
      .flatMap((category) => category.tasks)
      .find((task) => task.id === id) ?? null;
  }

  async operationsSummary(): Promise<OperationsSummary> {
    const [submissions, checks, workItems, followUps] = await Promise.all([
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
    ]);
    return {
      submissionsByStatus: Object.fromEntries(submissions.rows.map((row) => [row.workflow_status, Number(row.count)])),
      checksByOutcome: Object.fromEntries(checks.rows.map((row) => [row.outcome, Number(row.count)])),
      pendingWorkItems: Number(workItems.rows[0]?.count ?? 0),
      openFollowUps: Number(followUps.rows[0]?.count ?? 0),
    };
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

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => [key, canonical(child)]));
  }
  return value;
}

function taskFromRow(row: TaskRow): CatalogTask {
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
  };
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
