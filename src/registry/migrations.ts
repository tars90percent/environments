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
  {
    id: "007_research_demand_catalog",
    sql: `
      CREATE TABLE IF NOT EXISTS registry_research_demands (
        id text PRIMARY KEY,
        domain_en text NOT NULL,
        domain_zh text NOT NULL,
        subdomain_en text NOT NULL,
        subdomain_zh text NOT NULL,
        title_en text NOT NULL,
        title_zh text NOT NULL,
        note_en text NOT NULL,
        note_zh text NOT NULL,
        source_label_en text NOT NULL,
        source_label_zh text NOT NULL,
        source_date date NOT NULL,
        sort_order integer NOT NULL CHECK (sort_order >= 0),
        created_at timestamptz NOT NULL DEFAULT now()
      );

      INSERT INTO registry_research_demands(
        id, domain_en, domain_zh, subdomain_en, subdomain_zh,
        title_en, title_zh, note_en, note_zh,
        source_label_en, source_label_zh, source_date, sort_order
      ) VALUES
        (
          'greenfield-program-creation', 'Software engineering', '软件工程', 'Program creation', '程序创建',
          'Greenfield program creation', '从零创建程序',
          'Build a new application, service, library, or tool from a functional specification.',
          '根据功能规格新建应用、服务、库或工具。',
          'TARS working demand outline', 'TARS 研究需求工作草案', '2026-08-17', 10
        ),
        (
          'software-defect-repair', 'Software engineering', '软件工程', 'Debugging', '调试',
          'Diagnose and repair software defects', '诊断并修复软件缺陷',
          'Start broad, then split into concrete issue families such as build, correctness, performance, concurrency, or integration defects.',
          '先保持宽泛，随后再按构建、正确性、性能、并发或集成等具体问题族细分。',
          'TARS working demand outline', 'TARS 研究需求工作草案', '2026-08-17', 20
        ),
        (
          'existing-codebase-feature', 'Software engineering', '软件工程', 'Feature development', '功能开发',
          'Extend an existing codebase', '扩展现有代码库',
          'Implement a scoped feature while preserving existing behavior and working within the repository''s conventions.',
          '在遵循代码库既有约定并保持现有行为的前提下，实现范围明确的功能。',
          'TARS working demand outline', 'TARS 研究需求工作草案', '2026-08-17', 30
        ),
        (
          'repository-maintenance', 'Software engineering', '软件工程', 'Maintenance & migration', '维护与迁移',
          'Maintain or modernize a repository', '维护或现代化改造代码库',
          'Refactors, dependency upgrades, migrations, or multi-repository changes with a verifiable outcome.',
          '完成重构、依赖升级、迁移或跨仓库变更，并提供可验证的结果。',
          'TARS working demand outline', 'TARS 研究需求工作草案', '2026-08-17', 40
        ),
        (
          'quantitative-investigation', 'Quantitative research', '定量研究', 'Research analysis', '研究分析',
          'Conduct a quantitative research investigation', '开展定量研究分析',
          'Turn a research question and source data into a defensible method, analysis, and reproducible result.',
          '将研究问题和源数据转化为可论证的方法、分析过程和可复现结果。',
          'TARS working demand outline', 'TARS 研究需求工作草案', '2026-08-17', 50
        ),
        (
          'quantitative-modeling', 'Quantitative research', '定量研究', 'Modeling', '建模',
          'Build and validate a quantitative model', '构建并验证定量模型',
          'Statistical, econometric, forecasting, or optimization work with inspectable assumptions and validation.',
          '完成统计、计量、预测或优化建模，并使假设和验证过程可检查。',
          'TARS working demand outline', 'TARS 研究需求工作草案', '2026-08-17', 60
        ),
        (
          'data-diagnostics', 'Quantitative research', '定量研究', 'Data diagnostics', '数据诊断',
          'Investigate anomalies or conflicting results', '调查异常或矛盾结果',
          'Trace a discrepancy, test plausible explanations, and reconcile the evidence.',
          '追查差异，检验合理解释，并对证据进行核对与统一。',
          'TARS working demand outline', 'TARS 研究需求工作草案', '2026-08-17', 70
        ),
        (
          'structured-document-work', 'Knowledge work', '知识工作', 'Documents', '文档',
          'Produce or revise a structured document', '创建或修订结构化文档',
          'Create a usable document from source material, or repair an existing one against explicit requirements.',
          '根据源材料创建可用文档，或按照明确要求修订现有文档。',
          'TARS working demand outline', 'TARS 研究需求工作草案', '2026-08-17', 80
        ),
        (
          'spreadsheet-model-work', 'Knowledge work', '知识工作', 'Spreadsheets', '电子表格',
          'Build or repair a spreadsheet model', '构建或修复电子表格模型',
          'Work with formulas, structure, source data, and a reviewable final workbook.',
          '处理公式、结构和源数据，并交付可复核的最终工作簿。',
          'TARS working demand outline', 'TARS 研究需求工作草案', '2026-08-17', 90
        ),
        (
          'multi-step-browser-workflow', 'Computer use', '计算机操作', 'Browser workflows', '浏览器工作流',
          'Complete a multi-step browser workflow', '完成多步骤浏览器工作流',
          'Carry a realistic workflow through multiple states with an inspectable and verifiable final result.',
          '完成跨越多个状态的真实工作流，并产出可检查、可验证的最终结果。',
          'TARS working demand outline', 'TARS 研究需求工作草案', '2026-08-17', 100
        )
      ON CONFLICT (id) DO NOTHING;

      CREATE INDEX IF NOT EXISTS registry_research_demands_order_idx
        ON registry_research_demands(sort_order, id);
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
