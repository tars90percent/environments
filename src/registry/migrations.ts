import type { PoolClient } from "pg";

type Migration = { id: string; sql: string };

const migrations: Migration[] = [
  {
    id: "001_registry_core",
    sql: `
      CREATE TABLE IF NOT EXISTS registry_vendors (
        id text PRIMARY KEY,
        name text NOT NULL,
        short text NOT NULL,
        description text NOT NULL,
        aliases jsonb NOT NULL DEFAULT '[]'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS registry_artifacts (
        id text PRIMARY KEY,
        kind text NOT NULL,
        storage_key text NOT NULL UNIQUE,
        sha256 text NOT NULL,
        size_bytes bigint,
        content_type text,
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS registry_source_events (
        id text PRIMARY KEY,
        vendor_id text NOT NULL REFERENCES registry_vendors(id),
        channel text NOT NULL,
        external_ref text NOT NULL,
        sender text,
        received_at timestamptz NOT NULL,
        raw_artifact_id text REFERENCES registry_artifacts(id),
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE(channel, external_ref)
      );

      CREATE TABLE IF NOT EXISTS registry_submission_batches (
        id text PRIMARY KEY,
        vendor_id text NOT NULL REFERENCES registry_vendors(id),
        source_event_id text NOT NULL REFERENCES registry_source_events(id),
        submission_date date NOT NULL,
        label text NOT NULL,
        source_label text NOT NULL,
        declared_task_count integer NOT NULL CHECK (declared_task_count >= 0),
        formats jsonb NOT NULL DEFAULT '[]'::jsonb,
        workflow_status text NOT NULL,
        catalog_visibility text NOT NULL,
        revises_batch_id text REFERENCES registry_submission_batches(id),
        delta jsonb NOT NULL DEFAULT '{}'::jsonb,
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        manifest_sha256 text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS registry_categories (
        id text PRIMARY KEY,
        name text NOT NULL,
        description text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS registry_batch_categories (
        batch_id text NOT NULL REFERENCES registry_submission_batches(id) ON DELETE CASCADE,
        category_id text NOT NULL REFERENCES registry_categories(id),
        declared_count integer NOT NULL CHECK (declared_count >= 0),
        examples jsonb NOT NULL DEFAULT '[]'::jsonb,
        PRIMARY KEY(batch_id, category_id)
      );

      CREATE TABLE IF NOT EXISTS registry_tasks (
        id text PRIMARY KEY,
        vendor_id text NOT NULL REFERENCES registry_vendors(id),
        stable_key text NOT NULL,
        title text NOT NULL,
        summary text,
        first_seen_batch_id text NOT NULL REFERENCES registry_submission_batches(id),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE(vendor_id, stable_key)
      );

      CREATE TABLE IF NOT EXISTS registry_task_versions (
        id text PRIMARY KEY,
        task_id text NOT NULL REFERENCES registry_tasks(id),
        batch_id text NOT NULL REFERENCES registry_submission_batches(id) ON DELETE CASCADE,
        category_id text NOT NULL REFERENCES registry_categories(id),
        source_path text,
        format text NOT NULL,
        artifact_id text REFERENCES registry_artifacts(id),
        content_sha256 text,
        workflow_status text NOT NULL,
        catalog_visibility text NOT NULL,
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE(batch_id, task_id)
      );

      CREATE TABLE IF NOT EXISTS registry_check_definitions (
        id text NOT NULL,
        version integer NOT NULL,
        kind text NOT NULL,
        name text NOT NULL,
        description text NOT NULL,
        required boolean NOT NULL DEFAULT true,
        config jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY(id, version)
      );

      CREATE TABLE IF NOT EXISTS registry_check_runs (
        id text PRIMARY KEY,
        task_version_id text NOT NULL REFERENCES registry_task_versions(id) ON DELETE CASCADE,
        definition_id text NOT NULL,
        definition_version integer NOT NULL,
        outcome text NOT NULL,
        summary text NOT NULL,
        runner jsonb NOT NULL DEFAULT '{}'::jsonb,
        evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
        started_at timestamptz NOT NULL,
        completed_at timestamptz NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        FOREIGN KEY(definition_id, definition_version)
          REFERENCES registry_check_definitions(id, version)
      );

      CREATE TABLE IF NOT EXISTS registry_trajectories (
        id text PRIMARY KEY,
        task_version_id text NOT NULL REFERENCES registry_task_versions(id) ON DELETE CASCADE,
        model text NOT NULL,
        model_version text NOT NULL,
        harness text NOT NULL,
        harness_version text NOT NULL,
        reward double precision,
        turn_count integer,
        artifact_id text REFERENCES registry_artifacts(id),
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS registry_follow_ups (
        id text PRIMARY KEY,
        batch_id text NOT NULL REFERENCES registry_submission_batches(id) ON DELETE CASCADE,
        channel text NOT NULL,
        recipient text NOT NULL,
        status text NOT NULL,
        reason text NOT NULL,
        evidence_check_run_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
        sent_at timestamptz,
        external_ref text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS registry_status_events (
        id text PRIMARY KEY,
        entity_type text NOT NULL,
        entity_id text NOT NULL,
        event_type text NOT NULL,
        actor text NOT NULL,
        payload jsonb NOT NULL DEFAULT '{}'::jsonb,
        occurred_at timestamptz NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS registry_work_items (
        id text PRIMARY KEY,
        kind text NOT NULL,
        entity_type text NOT NULL,
        entity_id text NOT NULL,
        status text NOT NULL DEFAULT 'queued',
        attempts integer NOT NULL DEFAULT 0,
        available_at timestamptz NOT NULL DEFAULT now(),
        lease_expires_at timestamptz,
        payload jsonb NOT NULL DEFAULT '{}'::jsonb,
        last_error text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS registry_batches_vendor_idx
        ON registry_submission_batches(vendor_id, submission_date DESC);
      CREATE INDEX IF NOT EXISTS registry_task_versions_batch_idx
        ON registry_task_versions(batch_id, category_id);
      CREATE INDEX IF NOT EXISTS registry_check_runs_task_idx
        ON registry_check_runs(task_version_id, completed_at DESC);
      CREATE INDEX IF NOT EXISTS registry_work_items_ready_idx
        ON registry_work_items(status, available_at);
      CREATE INDEX IF NOT EXISTS registry_status_events_entity_idx
        ON registry_status_events(entity_type, entity_id, occurred_at DESC);
    `,
  },
  {
    id: "002_work_item_leases",
    sql: `
      ALTER TABLE registry_work_items
        ADD COLUMN IF NOT EXISTS leased_by text;
      ALTER TABLE registry_task_versions
        ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
    `,
  },
  {
    id: "003_source_graph",
    sql: `
      ALTER TABLE registry_source_events
        ADD COLUMN IF NOT EXISTS payload_sha256 text;
      ALTER TABLE registry_source_events
        ADD COLUMN IF NOT EXISTS workflow_status text NOT NULL DEFAULT 'received';
      ALTER TABLE registry_source_events
        ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

      CREATE TABLE IF NOT EXISTS registry_source_items (
        id text PRIMARY KEY,
        source_event_id text NOT NULL REFERENCES registry_source_events(id) ON DELETE CASCADE,
        kind text NOT NULL,
        display_name text NOT NULL,
        locator text,
        media_type text,
        artifact_id text REFERENCES registry_artifacts(id),
        content_sha256 text,
        size_bytes bigint,
        fetch_status text NOT NULL,
        parse_status text NOT NULL,
        mutable boolean NOT NULL DEFAULT true,
        captured_at timestamptz,
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        payload_sha256 text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS registry_source_relations (
        source_event_id text NOT NULL REFERENCES registry_source_events(id) ON DELETE CASCADE,
        from_item_id text NOT NULL REFERENCES registry_source_items(id) ON DELETE CASCADE,
        to_item_id text NOT NULL REFERENCES registry_source_items(id) ON DELETE CASCADE,
        relation text NOT NULL,
        position integer,
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY(from_item_id, to_item_id, relation)
      );

      CREATE TABLE IF NOT EXISTS registry_batch_source_events (
        batch_id text NOT NULL REFERENCES registry_submission_batches(id) ON DELETE CASCADE,
        source_event_id text NOT NULL REFERENCES registry_source_events(id),
        role text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY(batch_id, source_event_id)
      );

      CREATE TABLE IF NOT EXISTS registry_batch_source_items (
        batch_id text NOT NULL REFERENCES registry_submission_batches(id) ON DELETE CASCADE,
        source_item_id text NOT NULL REFERENCES registry_source_items(id),
        role text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY(batch_id, source_item_id, role)
      );

      CREATE TABLE IF NOT EXISTS registry_task_source_items (
        task_version_id text NOT NULL REFERENCES registry_task_versions(id) ON DELETE CASCADE,
        source_item_id text NOT NULL REFERENCES registry_source_items(id),
        role text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY(task_version_id, source_item_id, role)
      );

      CREATE TABLE IF NOT EXISTS registry_ingestion_runs (
        id text PRIMARY KEY,
        source_event_id text NOT NULL REFERENCES registry_source_events(id) ON DELETE CASCADE,
        source_item_id text REFERENCES registry_source_items(id) ON DELETE CASCADE,
        stage text NOT NULL,
        runner text NOT NULL,
        runner_version text NOT NULL,
        status text NOT NULL,
        metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
        error text,
        started_at timestamptz NOT NULL,
        completed_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now()
      );

      INSERT INTO registry_batch_source_events(batch_id, source_event_id, role)
      SELECT id, source_event_id, 'primary'
      FROM registry_submission_batches
      ON CONFLICT(batch_id, source_event_id) DO NOTHING;

      CREATE INDEX IF NOT EXISTS registry_source_items_event_idx
        ON registry_source_items(source_event_id, kind);
      CREATE INDEX IF NOT EXISTS registry_source_items_fetch_idx
        ON registry_source_items(fetch_status, created_at);
      CREATE INDEX IF NOT EXISTS registry_source_items_parse_idx
        ON registry_source_items(parse_status, created_at);
      CREATE INDEX IF NOT EXISTS registry_source_relations_event_idx
        ON registry_source_relations(source_event_id, relation);
      CREATE INDEX IF NOT EXISTS registry_ingestion_runs_event_idx
        ON registry_ingestion_runs(source_event_id, started_at DESC);
      CREATE INDEX IF NOT EXISTS registry_artifacts_sha_idx
        ON registry_artifacts(sha256);
    `,
  },
  {
    id: "004_submission_reviews",
    sql: `
      CREATE TABLE IF NOT EXISTS registry_submission_reviews (
        id text PRIMARY KEY,
        batch_id text NOT NULL REFERENCES registry_submission_batches(id) ON DELETE CASCADE,
        signal text NOT NULL,
        scope text NOT NULL,
        category_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
        reviewer_open_id text NOT NULL,
        reviewer_union_id text,
        reviewer_tenant_key text NOT NULL,
        reviewer_name text NOT NULL,
        comment text NOT NULL DEFAULT '',
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now(),
        CHECK (signal IN ('interested', 'not_interested', 'needs_revision', 'comment')),
        CHECK (scope IN ('submission', 'categories'))
      );

      CREATE INDEX IF NOT EXISTS registry_submission_reviews_batch_idx
        ON registry_submission_reviews(batch_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS registry_submission_reviews_reviewer_idx
        ON registry_submission_reviews(reviewer_open_id, created_at DESC);
    `,
  },
  {
    id: "005_vendor_history",
    sql: `
      CREATE TABLE IF NOT EXISTS registry_vendor_events (
        id text PRIMARY KEY,
        vendor_id text NOT NULL REFERENCES registry_vendors(id),
        kind text NOT NULL,
        event_type text NOT NULL,
        summary text NOT NULL,
        actor text NOT NULL,
        occurred_at timestamptz NOT NULL,
        source_event_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
        batch_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        payload_sha256 text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        CHECK (kind IN ('contact', 'sample', 'evaluation', 'commercial', 'delivery', 'acceptance', 'payment', 'relationship', 'note'))
      );

      CREATE INDEX IF NOT EXISTS registry_vendor_events_vendor_idx
        ON registry_vendor_events(vendor_id, occurred_at DESC, created_at DESC);
      CREATE INDEX IF NOT EXISTS registry_vendor_events_type_idx
        ON registry_vendor_events(event_type, occurred_at DESC);
    `,
  },
  {
    id: "006_vendor_archival",
    sql: `
      ALTER TABLE registry_vendors
        ADD COLUMN IF NOT EXISTS archived_at timestamptz;
      ALTER TABLE registry_vendors
        ADD COLUMN IF NOT EXISTS archived_by text;
      ALTER TABLE registry_vendors
        ADD COLUMN IF NOT EXISTS archive_reason text;

      CREATE INDEX IF NOT EXISTS registry_vendors_active_directory_idx
        ON registry_vendors(name, id)
        WHERE archived_at IS NULL;
    `,
  },
];

export async function runRegistryMigrations(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS registry_migrations (
      id text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  for (const migration of migrations) {
    const result = await client.query<{ id: string }>(
      "SELECT id FROM registry_migrations WHERE id = $1",
      [migration.id],
    );
    if (result.rowCount) continue;
    await client.query("BEGIN");
    try {
      await client.query(migration.sql);
      await client.query("INSERT INTO registry_migrations(id) VALUES ($1)", [migration.id]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }
}
