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
  {
    id: "008_source_backed_research_demands",
    sql: `
      ALTER TABLE registry_research_demands
        ADD COLUMN IF NOT EXISTS source_url text;
      ALTER TABLE registry_research_demands
        ADD COLUMN IF NOT EXISTS superseded_at timestamptz;

      UPDATE registry_research_demands
      SET source_url = 'https://vrfi1sk8a0.feishu.cn/wiki/Fii7wKxOKipox3kYrfVcuCSonrJ',
          superseded_at = now()
      WHERE superseded_at IS NULL;

      ALTER TABLE registry_research_demands
        ALTER COLUMN source_url SET NOT NULL;

      INSERT INTO registry_research_demands(
        id, domain_en, domain_zh, subdomain_en, subdomain_zh,
        title_en, title_zh, note_en, note_zh,
        source_label_en, source_label_zh, source_date, source_url, sort_order
      ) VALUES
        (
          'long-horizon-greenfield-coding', 'Software engineering', '软件工程', 'Greenfield development', '从零开发',
          'Long-horizon 0→1 greenfield development', '长程 0→1 从零开发',
          'Create a large project from scratch from a product requirement. ProgramBench and NL2Repo are references, and at least 100 model steps are requested.',
          '根据产品需求从零创建大型项目。参考 ProgramBench 和 NL2Repo，并要求至少 100 个模型步骤。',
          'TARS sample requirement', 'TARS 样本需求', '2026-08-12',
          'https://applink.feishu.cn/client/chat/open?openChatId=oc_4e735446cffdf7e72eecbcdf0b3f2856&position=4', 10
        ),
        (
          'long-horizon-feature-development', 'Software engineering', '软件工程', 'Existing codebases', '现有代码库',
          'Long-horizon feature development', '长程功能开发',
          'Develop a substantial feature within an existing codebase; DeepSWE and EvoCode are reference task families.',
          '在现有代码库中完成大型功能开发；参考 DeepSWE 和 EvoCode 任务族。',
          'Data Procurement Wiki — demand matrix', '《数据采购》Wiki — 需求矩阵', '2026-08-14',
          'https://vrfi1sk8a0.feishu.cn/wiki/Fii7wKxOKipox3kYrfVcuCSonrJ', 20
        ),
        (
          'repository-aligned-code-quality', 'Software engineering', '软件工程', 'Code quality', '代码质量',
          'Code changes that match the repository', '符合代码库风格的改动',
          'Produce verifiable changes consistent with the repository''s existing developer style and conventions; FrontierCode is the reference.',
          '产出可验证、且符合代码库既有开发者风格与约定的改动；参考 FrontierCode。',
          'Data Procurement Wiki — demand matrix', '《数据采购》Wiki — 需求矩阵', '2026-08-14',
          'https://vrfi1sk8a0.feishu.cn/wiki/Fii7wKxOKipox3kYrfVcuCSonrJ', 30
        ),
        (
          'difficult-standard-bugfix', 'Software engineering', '软件工程', 'Bug fixing', '缺陷修复',
          'Difficult ordinary bug fixes', '高难度常规缺陷修复',
          'Normal bug-fix tasks that a strong frontier model completes inconsistently and M3 does not; difficulty must come from the task rather than broken infrastructure.',
          '强前沿模型也只能不稳定完成、而 M3 无法完成的正常缺陷修复任务；难度必须来自任务本身，而非损坏的基础设施。',
          'Data Procurement Wiki — demand matrix', '《数据采购》Wiki — 需求矩阵', '2026-08-14',
          'https://vrfi1sk8a0.feishu.cn/wiki/Fii7wKxOKipox3kYrfVcuCSonrJ', 40
        ),
        (
          'cuda-optimization', 'ML & systems engineering', '机器学习与系统工程', 'CUDA optimization', 'CUDA 优化',
          'CUDA optimization environments', 'CUDA 优化环境',
          'Optimization work represented by KernelBench and FlashInferBench; the source marks this need as urgent.',
          '以 KernelBench 和 FlashInferBench 为代表的优化任务；来源将该需求标为紧急。',
          'Data Procurement Wiki — demand matrix', '《数据采购》Wiki — 需求矩阵', '2026-08-14',
          'https://vrfi1sk8a0.feishu.cn/wiki/Fii7wKxOKipox3kYrfVcuCSonrJ', 50
        ),
        (
          'ml-research-environments', 'ML & systems engineering', '机器学习与系统工程', 'ML research', '机器学习研究',
          'ML research environments', '机器学习研究环境',
          'Research tasks similar to MLE Bench, PostTrainBench, MLS Bench, ExpBench, AutoLab, InferenceBench, and SWE-Marathon.',
          '类似 MLE Bench、PostTrainBench、MLS Bench、ExpBench、AutoLab、InferenceBench 和 SWE-Marathon 的研究任务。',
          'TARS sample requirement', 'TARS 样本需求', '2026-08-12',
          'https://applink.feishu.cn/client/chat/open?openChatId=oc_4e735446cffdf7e72eecbcdf0b3f2856&position=4', 60
        ),
        (
          'ml-inference-engineering', 'ML & systems engineering', '机器学习与系统工程', 'ML engineering', '机器学习工程',
          'ML and inference engineering', '机器学习与推理工程',
          'Inspectable environments for infrastructure debugging, vLLM inference, and related ML engineering work; no single benchmark is yet designated.',
          '用于基础设施调试、vLLM 推理及相关机器学习工程工作的可检查环境；目前尚未指定单一 benchmark。',
          'TARS sample requirement', 'TARS 样本需求', '2026-08-12',
          'https://applink.feishu.cn/client/chat/open?openChatId=oc_4e735446cffdf7e72eecbcdf0b3f2856&position=4', 70
        ),
        (
          'general-systems-optimization', 'ML & systems engineering', '机器学习与系统工程', 'Systems optimization', '系统优化',
          'General systems optimization', '通用系统优化',
          'Optimization tasks represented by FrontierSWE, SWEfficiency, GSO Bench, and FrontierCS.',
          '以 FrontierSWE、SWEfficiency、GSO Bench 和 FrontierCS 为代表的优化任务。',
          'Data Procurement Wiki — demand matrix', '《数据采购》Wiki — 需求矩阵', '2026-08-14',
          'https://vrfi1sk8a0.feishu.cn/wiki/Fii7wKxOKipox3kYrfVcuCSonrJ', 80
        ),
        (
          'paper-reproduction', 'ML & systems engineering', '机器学习与系统工程', 'Paper reproduction', '论文复现',
          'Paper reproduction tasks', '论文复现任务',
          'Reproduce research results in inspectable environments; PaperBench and NatureBench are references, including non-ML papers.',
          '在可检查环境中复现研究结果；参考 PaperBench 和 NatureBench，也包括非机器学习论文。',
          'Data Procurement Wiki — demand matrix', '《数据采购》Wiki — 需求矩阵', '2026-08-14',
          'https://vrfi1sk8a0.feishu.cn/wiki/Fii7wKxOKipox3kYrfVcuCSonrJ', 90
        ),
        (
          'terminal-tool-use', 'Tool use', '工具使用', 'Terminal workflows', '终端工作流',
          'Terminal and tool-use tasks', '终端与工具使用任务',
          'The demand matrix tracks terminal-benchmark and tool-use tasks and notes that one batch has already been purchased; the next increment still needs researcher confirmation.',
          '需求矩阵记录了终端 benchmark 与工具使用任务，并注明已采购过一批；下一批具体需求仍需研究员确认。',
          'Data Procurement Wiki — demand matrix', '《数据采购》Wiki — 需求矩阵', '2026-08-14',
          'https://vrfi1sk8a0.feishu.cn/wiki/Fii7wKxOKipox3kYrfVcuCSonrJ', 100
        ),
        (
          'cybersecurity-environments-trajectories', 'Cybersecurity', '网络安全', 'Security environments', '安全环境',
          'Cybersecurity environments and trajectories', '网络安全环境与轨迹',
          'High-quality security tasks with environments and verifiers, plus cyber trajectories; demos are required for inspection.',
          '带环境和 verifier 的高质量安全任务，以及网络安全轨迹；需要提供 demo 供审查。',
          'Data Procurement Wiki — demand matrix', '《数据采购》Wiki — 需求矩阵', '2026-08-14',
          'https://vrfi1sk8a0.feishu.cn/wiki/Fii7wKxOKipox3kYrfVcuCSonrJ', 110
        ),
        (
          'finance-work-scenarios', 'Finance', '金融', 'Professional work', '专业工作',
          'Difficult finance work scenarios', '高难度金融工作场景',
          'High-quality, correct, comparatively difficult tasks grounded in realistic finance work.',
          '以真实金融工作为基础、质量高、答案正确且难度较大的任务。',
          'Data Procurement Wiki — demand matrix', '《数据采购》Wiki — 需求矩阵', '2026-08-14',
          'https://vrfi1sk8a0.feishu.cn/wiki/Fii7wKxOKipox3kYrfVcuCSonrJ', 120
        ),
        (
          'computer-use-office-workflows', 'Computer use', '计算机操作', 'Office workflows', '办公工作流',
          'Computer-use and Office workflows', '计算机操作与办公工作流',
          'RL tasks and trajectories in professional software, including domain documents such as finance or legal work and educational presentations.',
          '专业软件中的 RL 任务与轨迹，包括金融、法律等领域文档以及教学类演示文稿。',
          'Data Procurement Wiki — demand matrix', '《数据采购》Wiki — 需求矩阵', '2026-08-14',
          'https://vrfi1sk8a0.feishu.cn/wiki/Fii7wKxOKipox3kYrfVcuCSonrJ', 130
        ),
        (
          'wide-time-sensitive-search', 'Information work', '信息检索', 'Search', '搜索',
          'Wide and time-sensitive search', '广度搜索与时效搜索',
          'Query-and-answer tasks for wide research and time-sensitive search; WideSearch and SealQA are the named references.',
          '面向广度研究和时效搜索的问答任务；指定参考为 WideSearch 和 SealQA。',
          'Data Procurement Wiki — demand matrix', '《数据采购》Wiki — 需求矩阵', '2026-08-14',
          'https://vrfi1sk8a0.feishu.cn/wiki/Fii7wKxOKipox3kYrfVcuCSonrJ', 140
        );

      CREATE INDEX IF NOT EXISTS registry_research_demands_active_order_idx
        ON registry_research_demands(sort_order, id)
        WHERE superseded_at IS NULL;
    `,
  },
  {
    id: "009_task_findings",
    sql: `
      CREATE TABLE IF NOT EXISTS registry_task_findings (
        id text PRIMARY KEY,
        task_version_id text NOT NULL REFERENCES registry_task_versions(id) ON DELETE CASCADE,
        kind text NOT NULL CHECK (kind IN (
          'observed_fact', 'vendor_claim', 'deterministic_result',
          'heuristic_assessment', 'human_judgment', 'binding_term'
        )),
        title text NOT NULL,
        summary text NOT NULL,
        resolution text,
        actor text NOT NULL,
        occurred_at timestamptz NOT NULL,
        evidence_check_run_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
        visibility text NOT NULL CHECK (visibility IN ('portal', 'internal')),
        metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
        payload_sha256 text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS registry_task_findings_task_idx
        ON registry_task_findings(task_version_id, occurred_at DESC, created_at DESC);
    `,
  },
  {
    id: "010_submission_intake_purpose",
    sql: `
      ALTER TABLE registry_submission_batches
        ADD COLUMN IF NOT EXISTS intake_purpose text;

      UPDATE registry_submission_batches
      SET intake_purpose = metadata->>'intakePurpose'
      WHERE intake_purpose IS NULL
        AND metadata ? 'intakePurpose';

      CREATE INDEX IF NOT EXISTS registry_submission_batches_intake_purpose_idx
        ON registry_submission_batches(intake_purpose);
    `,
  },
  {
    id: "011_plain_mutable_task_findings",
    sql: `
      ALTER TABLE registry_task_findings
        ADD COLUMN IF NOT EXISTS finding text,
        ADD COLUMN IF NOT EXISTS updated_at timestamptz;

      UPDATE registry_task_findings
      SET finding = concat_ws(E'\n\n',
            NULLIF(btrim(title), ''),
            NULLIF(btrim(summary), ''),
            NULLIF(btrim(resolution), '')
          ),
          updated_at = created_at
      WHERE finding IS NULL OR updated_at IS NULL;

      ALTER TABLE registry_task_findings
        ALTER COLUMN finding SET NOT NULL,
        ALTER COLUMN updated_at SET DEFAULT now(),
        ALTER COLUMN updated_at SET NOT NULL,
        ALTER COLUMN visibility SET DEFAULT 'portal';

      DROP INDEX IF EXISTS registry_task_findings_task_idx;

      ALTER TABLE registry_task_findings
        DROP COLUMN IF EXISTS kind,
        DROP COLUMN IF EXISTS title,
        DROP COLUMN IF EXISTS summary,
        DROP COLUMN IF EXISTS resolution,
        DROP COLUMN IF EXISTS actor,
        DROP COLUMN IF EXISTS occurred_at,
        DROP COLUMN IF EXISTS evidence_check_run_ids,
        DROP COLUMN IF EXISTS metadata,
        DROP COLUMN IF EXISTS payload_sha256;

      ALTER TABLE registry_task_findings
        ADD CONSTRAINT registry_task_findings_finding_nonempty
        CHECK (length(btrim(finding)) > 0);

      CREATE INDEX registry_task_findings_task_idx
        ON registry_task_findings(task_version_id, updated_at DESC, created_at DESC);

      UPDATE registry_status_events
      SET payload = payload - 'kind' - 'visibility'
      WHERE event_type = 'finding.recorded';
    `,
  },
  {
    id: "012_structured_task_evidence",
    sql: `
      ALTER TABLE registry_task_versions
        ADD COLUMN IF NOT EXISTS representation_kind text NOT NULL DEFAULT 'unknown',
        ADD COLUMN IF NOT EXISTS representation_path text,
        ADD COLUMN IF NOT EXISTS normalization_outcome text,
        ADD COLUMN IF NOT EXISTS representation_basis text NOT NULL DEFAULT 'unknown';

      UPDATE registry_task_versions
      SET representation_path = COALESCE(metadata->>'representationPath', metadata->>'representation_path')
      WHERE COALESCE(metadata->>'representationPath', metadata->>'representation_path')
        IN ('already_harbor', 'normalized_to_harbor', 'native_format_exception');

      UPDATE registry_task_versions
      SET normalization_outcome = COALESCE(metadata->>'normalizationOutcome', metadata->>'normalization_outcome')
      WHERE COALESCE(metadata->>'normalizationOutcome', metadata->>'normalization_outcome')
        IN ('already_harbor', 'normalized', 'needs_review', 'incomplete', 'blocked', 'not_a_task');

      UPDATE registry_task_versions
      SET representation_kind = CASE
            WHEN representation_path IN ('already_harbor', 'normalized_to_harbor') THEN 'harbor'
            WHEN representation_path = 'native_format_exception' THEN 'native'
            ELSE representation_kind
          END,
          representation_basis = CASE
            WHEN representation_path IS NOT NULL OR normalization_outcome IS NOT NULL THEN 'recorded'
            ELSE representation_basis
          END;

      UPDATE registry_task_versions
      SET representation_kind = 'harbor',
          representation_path = COALESCE(representation_path, 'already_harbor'),
          representation_basis = 'recorded'
      WHERE normalization_outcome = 'already_harbor';

      UPDATE registry_task_versions
      SET representation_kind = 'harbor',
          representation_basis = 'legacy_format_backfill'
      WHERE representation_kind = 'unknown'
        AND lower(format) ~ '^harbor($|[ _])';

      UPDATE registry_task_versions
      SET representation_kind = 'native',
          representation_basis = 'legacy_format_backfill'
      WHERE representation_kind = 'unknown'
        AND lower(format) ~ '^native($|[ _])';

      ALTER TABLE registry_task_versions
        ADD CONSTRAINT registry_task_versions_representation_kind_check
          CHECK (representation_kind IN ('harbor', 'native', 'unknown')),
        ADD CONSTRAINT registry_task_versions_representation_path_check
          CHECK (representation_path IS NULL OR representation_path IN ('already_harbor', 'normalized_to_harbor', 'native_format_exception')),
        ADD CONSTRAINT registry_task_versions_normalization_outcome_check
          CHECK (normalization_outcome IS NULL OR normalization_outcome IN ('already_harbor', 'normalized', 'needs_review', 'incomplete', 'blocked', 'not_a_task')),
        ADD CONSTRAINT registry_task_versions_representation_basis_check
          CHECK (representation_basis IN ('recorded', 'legacy_format_backfill', 'unknown'));

      ALTER TABLE registry_check_definitions
        ADD COLUMN IF NOT EXISTS evidence_role text NOT NULL DEFAULT 'other';

      UPDATE registry_check_definitions
      SET evidence_role = COALESCE(config->>'evidenceRole', config->>'evidence_role')
      WHERE COALESCE(config->>'evidenceRole', config->>'evidence_role')
        IN ('contract', 'build', 'boot', 'positive_control', 'negative_control', 'hermeticity', 'evidence_completeness', 'other');

      UPDATE registry_check_definitions
      SET evidence_role = CASE
        WHEN lower(concat_ws(' ', id, name, description)) ~ '(^|[^a-z])(oracle|gold|positive[ _-]?control)([^a-z]|$)' THEN 'positive_control'
        WHEN lower(concat_ws(' ', id, name, description)) ~ '(^|[^a-z])(nop|untouched|negative[ _-]?control)([^a-z]|$)' THEN 'negative_control'
        WHEN lower(concat_ws(' ', id, name, description)) ~ 'harbor.*(validate|schema|contract)|(validate|schema|contract).*harbor' THEN 'contract'
        WHEN lower(concat_ws(' ', id, name, description)) ~ '(^|[^a-z])(build|provision)([^a-z]|$)' THEN 'build'
        WHEN lower(concat_ws(' ', id, name, description)) ~ '(^|[^a-z])(boot|startup|ready[ _-]?state)([^a-z]|$)' THEN 'boot'
        WHEN lower(concat_ws(' ', id, name, description)) ~ '(^|[^a-z])(hermetic|hidden[ _-]?dependenc)([^a-z]|$)' THEN 'hermeticity'
        ELSE evidence_role
      END
      WHERE evidence_role = 'other';

      ALTER TABLE registry_check_definitions
        ADD CONSTRAINT registry_check_definitions_evidence_role_check
          CHECK (evidence_role IN ('contract', 'build', 'boot', 'positive_control', 'negative_control', 'hermeticity', 'evidence_completeness', 'other'));

      ALTER TABLE registry_check_runs
        ADD COLUMN IF NOT EXISTS execution_scope text NOT NULL DEFAULT 'unknown';

      UPDATE registry_check_runs
      SET execution_scope = COALESCE(
        NULLIF(runner->>'executionScope', ''),
        NULLIF(runner->>'execution_scope', ''),
        NULLIF(evidence->>'executionScope', ''),
        NULLIF(evidence->>'execution_scope', ''),
        execution_scope
      )
      WHERE COALESCE(
        NULLIF(runner->>'executionScope', ''),
        NULLIF(runner->>'execution_scope', ''),
        NULLIF(evidence->>'executionScope', ''),
        NULLIF(evidence->>'execution_scope', '')
      ) IN ('static', 'remote_sandbox', 'unknown');

      ALTER TABLE registry_check_runs
        ADD CONSTRAINT registry_check_runs_execution_scope_check
          CHECK (execution_scope IN ('static', 'remote_sandbox', 'unknown'));

      CREATE INDEX IF NOT EXISTS registry_task_versions_representation_idx
        ON registry_task_versions(representation_kind, representation_path);
      CREATE INDEX IF NOT EXISTS registry_check_runs_runtime_idx
        ON registry_check_runs(task_version_id, execution_scope, completed_at DESC);
    `,
  },
  {
    id: "013_legacy_runtime_evidence_backfill",
    sql: `
      -- Migration 012 used broad text matching to classify legacy definitions. Correct
      -- the known static definitions before deriving any runtime-attempt state.
      UPDATE registry_check_definitions
      SET evidence_role = 'contract'
      WHERE id IN (
        'case.task-contract-static',
        'case-harbor-static-package-validation',
        'case-harbor-package-validate',
        'case-native-runtime-adapter-availability'
      );

      -- These definitions are the legacy checks that actually requested a build,
      -- Oracle, or Nop run. Keep this mapping explicit: names and descriptions of
      -- static checks often mention Oracle/Nop and are not runtime evidence.
      UPDATE registry_check_definitions
      SET evidence_role = 'build'
      WHERE id IN (
        'case.harbor.clean-build-boot',
        'case-public-container-rebuild'
      );

      UPDATE registry_check_definitions
      SET evidence_role = 'positive_control'
      WHERE id IN (
        'case-oracle-gold-control',
        'case-oracle-gold-consistency',
        'case-oracle-gold-consistency-repeat',
        'case.harbor.oracle-control',
        'case.harbor.oracle-repeat',
        'case.harbor.oracle-repeatability',
        'case.harbor-oracle-control',
        'case.harbor-modal-oracle-smoke',
        'case.harbor.positive-control-repeat'
      );

      UPDATE registry_check_definitions
      SET evidence_role = 'negative_control'
      WHERE id IN (
        'case-nop-untouched-consistency',
        'case-untouched-nop-consistency-repeat',
        'case.harbor.nop-control',
        'case.harbor.nop-repeat',
        'case.harbor.nop-repeatability',
        'case.harbor-nop-control',
        'case.harbor-modal-nop-smoke',
        'case.harbor.negative-control-repeat'
      );

      -- A pass or fail from one of the explicit runtime definitions records an
      -- attempted remote check. A blocked result counts only when its retained
      -- evidence proves that a job/trial actually started. not_run remains unknown.
      UPDATE registry_check_runs
      SET execution_scope = 'remote_sandbox'
      WHERE definition_id IN (
          'case.harbor.clean-build-boot',
          'case-public-container-rebuild',
          'case-oracle-gold-control',
          'case-oracle-gold-consistency',
          'case-oracle-gold-consistency-repeat',
          'case.harbor.oracle-control',
          'case.harbor.oracle-repeat',
          'case.harbor.oracle-repeatability',
          'case.harbor-oracle-control',
          'case.harbor-modal-oracle-smoke',
          'case.harbor.positive-control-repeat',
          'case-nop-untouched-consistency',
          'case-untouched-nop-consistency-repeat',
          'case.harbor.nop-control',
          'case.harbor.nop-repeat',
          'case.harbor.nop-repeatability',
          'case.harbor-nop-control',
          'case.harbor-modal-nop-smoke',
          'case.harbor.negative-control-repeat'
        )
        AND (
          outcome IN ('pass', 'fail')
          OR (
            outcome = 'blocked'
            AND (
              (runner ? 'jobId' AND runner ? 'trialId')
              OR (evidence->>'runtimeSecondsBeforeStop') ~ '^[1-9][0-9]*$'
            )
          )
        )
        -- These records describe a shared representative environment rather than
        -- an execution attempt for the task version carrying the check record.
        AND NOT (
          definition_id = 'case.harbor.clean-build-boot'
          AND evidence ? 'representativeTaskVersionId'
        )
        -- Legacy preflight failures explicitly recorded that no sandbox existed.
        AND NOT (
          definition_id = 'case.harbor.clean-build-boot'
          AND COALESCE(evidence->>'sandboxProvisioned', '') = 'false'
        );
    `,
  },
  {
    id: "014_narrow_sample_registry",
    sql: `
      -- The active CASE contract has two task kinds, two formats, and four
      -- Harbor check phases. Older normalization/check columns remain only so
      -- historical rows can be retained while callers move to this contract.
      ALTER TABLE registry_task_versions
        ADD COLUMN IF NOT EXISTS task_kind text,
        ADD COLUMN IF NOT EXISTS format_kind text,
        ADD COLUMN IF NOT EXISTS task_stable_key text,
        ADD COLUMN IF NOT EXISTS task_title text,
        ADD COLUMN IF NOT EXISTS task_summary text;

      UPDATE registry_task_versions tv
      SET task_stable_key = t.stable_key,
          task_title = t.title,
          task_summary = t.summary
      FROM registry_tasks t
      WHERE t.id = tv.task_id
        AND (tv.task_stable_key IS NULL OR tv.task_title IS NULL);

      UPDATE registry_task_versions
      SET task_kind = CASE
            WHEN lower(COALESCE(metadata->>'taskKind', metadata->>'task_kind', '')) IN ('trace', 'trajectory')
              THEN 'trace'
            WHEN lower(btrim(format)) IN (
              'native jsonl instruction and chat-trajectory record',
              'metadata-only agentic trajectory session boundary',
              'native trajectory record with embedded coding prompt'
            )
              THEN 'trace'
            ELSE 'task'
          END
      WHERE task_kind IS NULL;

      UPDATE registry_task_versions
      SET format_kind = CASE
            -- A task converted into Harbor was not delivered in Harbor format.
            WHEN representation_path = 'normalized_to_harbor'
              OR normalization_outcome = 'normalized'
              THEN 'non_harbor'
            WHEN representation_path = 'already_harbor'
              OR normalization_outcome = 'already_harbor'
              OR lower(btrim(format)) ~ '^harbor($|[ _-])'
              OR lower(btrim(format)) = 'deepswe material package (incomplete harbor)'
              THEN 'harbor'
            ELSE 'non_harbor'
          END
      WHERE format_kind IS NULL;

      ALTER TABLE registry_task_versions
        ALTER COLUMN task_kind SET DEFAULT 'task',
        ALTER COLUMN task_kind SET NOT NULL,
        ALTER COLUMN format_kind SET DEFAULT 'non_harbor',
        ALTER COLUMN format_kind SET NOT NULL,
        ALTER COLUMN task_stable_key SET NOT NULL,
        ALTER COLUMN task_title SET NOT NULL,
        ADD CONSTRAINT registry_task_versions_task_kind_check
          CHECK (task_kind IN ('task', 'trace')),
        ADD CONSTRAINT registry_task_versions_format_kind_check
          CHECK (format_kind IN ('harbor', 'non_harbor'));

      ALTER TABLE registry_check_runs
        ADD COLUMN IF NOT EXISTS check_phase text,
        ADD COLUMN IF NOT EXISTS evidence_artifact_id text REFERENCES registry_artifacts(id),
        ADD COLUMN IF NOT EXISTS harbor_version text,
        ADD COLUMN IF NOT EXISTS modal_version text,
        ADD COLUMN IF NOT EXISTS command text,
        ADD COLUMN IF NOT EXISTS sandbox_ref text,
        ADD COLUMN IF NOT EXISTS score double precision;

      UPDATE registry_check_runs cr
      SET check_phase = CASE cd.evidence_role
            WHEN 'build' THEN 'build'
            WHEN 'boot' THEN 'boot'
            WHEN 'positive_control' THEN 'oracle'
            WHEN 'negative_control' THEN 'nop'
          END
      FROM registry_check_definitions cd
      WHERE cd.id = cr.definition_id
        AND cd.version = cr.definition_version
        AND cr.check_phase IS NULL
        AND cr.execution_scope = 'remote_sandbox'
        AND cr.outcome IN ('pass', 'fail')
        AND cd.evidence_role IN ('build', 'boot', 'positive_control', 'negative_control');

      ALTER TABLE registry_check_runs
        ADD CONSTRAINT registry_check_runs_check_phase_check
          CHECK (check_phase IS NULL OR check_phase IN ('build', 'boot', 'oracle', 'nop'));

      ALTER TABLE registry_task_findings
        ADD COLUMN IF NOT EXISTS check_run_id text REFERENCES registry_check_runs(id),
        ADD COLUMN IF NOT EXISTS check_phase text;

      ALTER TABLE registry_task_findings
        ADD CONSTRAINT registry_task_findings_check_phase_check
          CHECK (check_phase IS NULL OR check_phase IN ('build', 'boot', 'oracle', 'nop'));

      CREATE INDEX IF NOT EXISTS registry_task_versions_active_format_idx
        ON registry_task_versions(batch_id, format_kind, task_kind);
      CREATE INDEX IF NOT EXISTS registry_check_runs_active_phase_idx
        ON registry_check_runs(task_version_id, check_phase, completed_at DESC)
        WHERE check_phase IS NOT NULL AND outcome IN ('pass', 'fail');

      CREATE OR REPLACE VIEW registry_sample_tasks AS
      SELECT tv.id,
             tv.batch_id AS submission_id,
             t.vendor_id,
             tv.task_stable_key AS stable_key,
             tv.task_title AS title,
             tv.task_summary AS summary,
             tv.task_kind,
             tv.format_kind,
             tv.source_path,
             tv.artifact_id,
             tv.content_sha256,
             tv.created_at
      FROM registry_task_versions tv
      JOIN registry_tasks t ON t.id = tv.task_id;

      CREATE OR REPLACE VIEW registry_harbor_check_results AS
      SELECT id,
             task_version_id AS task_id,
             check_phase AS phase,
             outcome,
             summary,
             evidence_artifact_id,
             harbor_version,
             modal_version,
             command,
             sandbox_ref,
             score,
             started_at,
             completed_at
      FROM registry_check_runs
      WHERE check_phase IS NOT NULL
        AND outcome IN ('pass', 'fail');

      COMMENT ON VIEW registry_sample_tasks IS
        'Active CASE task record: one clearly identified task or trace from one submission.';
      COMMENT ON VIEW registry_harbor_check_results IS
        'Active CASE check abstraction: Build, Boot, Oracle, or Nop pass/fail only.';

      -- Remove only records belonging exclusively to workflows that CASE no
      -- longer performs. Original payloads, sources, submissions, tasks, task
      -- links, artifacts, and content-addressed objects are deliberately not
      -- touched by this cleanup.
      DELETE FROM registry_task_findings
      WHERE check_run_id IS NULL OR check_phase IS NULL;

      DELETE FROM registry_check_runs
      WHERE check_phase IS NULL OR outcome NOT IN ('pass', 'fail');

      DELETE FROM registry_check_definitions cd
      WHERE NOT EXISTS (
        SELECT 1 FROM registry_check_runs cr
        WHERE cr.definition_id = cd.id AND cr.definition_version = cd.version
      );

      DELETE FROM registry_work_items
      WHERE kind IN ('normalize_source_event', 'check_submission');

      DELETE FROM registry_submission_reviews;
      DELETE FROM registry_follow_ups;
      DELETE FROM registry_research_demands;
    `,
  },
  {
    id: "015_environment_oracle_nop_checks",
    sql: `
      -- Harbor exposes image construction, environment startup, and any declared
      -- healthcheck as one environment-setup operation. Preserve historical
      -- Build/Boot rows, but make Environment, Oracle, and Nop the active contract.
      ALTER TABLE registry_check_definitions
        DROP CONSTRAINT registry_check_definitions_evidence_role_check,
        ADD CONSTRAINT registry_check_definitions_evidence_role_check
          CHECK (evidence_role IN (
            'contract', 'environment', 'build', 'boot', 'positive_control',
            'negative_control', 'hermeticity', 'evidence_completeness', 'other'
          ));

      ALTER TABLE registry_check_runs
        DROP CONSTRAINT registry_check_runs_check_phase_check,
        ADD CONSTRAINT registry_check_runs_check_phase_check
          CHECK (check_phase IS NULL OR check_phase IN (
            'environment', 'oracle', 'nop', 'build', 'boot'
          ));

      ALTER TABLE registry_task_findings
        DROP CONSTRAINT registry_task_findings_check_phase_check,
        ADD CONSTRAINT registry_task_findings_check_phase_check
          CHECK (check_phase IS NULL OR check_phase IN (
            'environment', 'oracle', 'nop', 'build', 'boot'
          ));

      INSERT INTO registry_check_definitions(
        id, version, kind, name, description, required, evidence_role
      ) VALUES (
        'case.harbor.environment', 1, 'deterministic', 'environment',
        'Harbor environment setup pass/fail', true, 'environment'
      )
      ON CONFLICT(id, version) DO NOTHING;

      UPDATE registry_work_items
      SET payload = jsonb_set(payload, '{phases}', '["environment", "oracle", "nop"]'::jsonb),
          updated_at = now()
      WHERE kind = 'harbor_checks'
        AND status IN ('queued', 'leased');

      -- A passing Oracle or Nop control could only have produced its expected
      -- score after Harbor prepared the environment. Add a new provenance-linked
      -- Environment result instead of rewriting the historical control record.
      WITH passing_controls AS (
        SELECT DISTINCT ON (task_version_id)
               id, task_version_id, evidence_artifact_id, harbor_version,
               modal_version, command, sandbox_ref, started_at, completed_at,
               check_phase
        FROM registry_check_runs
        WHERE check_phase IN ('oracle', 'nop')
          AND outcome = 'pass'
        ORDER BY task_version_id, completed_at, created_at, id
      )
      INSERT INTO registry_check_runs(
        id, task_version_id, definition_id, definition_version, outcome, summary,
        runner, evidence, started_at, completed_at, execution_scope, check_phase,
        evidence_artifact_id, harbor_version, modal_version, command, sandbox_ref, score
      )
      SELECT 'case:environment-inferred-from:' || pc.id,
             pc.task_version_id,
             'case.harbor.environment',
             1,
             'pass',
             'Environment usability inferred from passing historical ' || initcap(pc.check_phase) || ' evidence.',
             jsonb_build_object(
               'inferred', true,
               'basis', 'passing_control',
               'sourceCheckRunId', pc.id
             ),
             jsonb_build_object(
               'inferred', true,
               'basis', 'passing_control',
               'sourceCheckRunId', pc.id
             ),
             pc.started_at,
             pc.completed_at,
             'remote_sandbox',
             'environment',
             pc.evidence_artifact_id,
             pc.harbor_version,
             pc.modal_version,
             pc.command,
             pc.sandbox_ref,
             NULL
      FROM passing_controls pc
      WHERE NOT EXISTS (
        SELECT 1
        FROM registry_check_runs existing
        WHERE existing.task_version_id = pc.task_version_id
          AND existing.check_phase = 'environment'
          AND existing.outcome IN ('pass', 'fail')
      )
      ON CONFLICT(id) DO NOTHING;

      -- Some historical tasks have explicit successful Build and Boot evidence
      -- but no completed control. Treat the latest result for each legacy phase
      -- as authoritative and infer Environment only when both are passes.
      WITH latest_legacy_phases AS (
        SELECT DISTINCT ON (task_version_id, check_phase)
               id, task_version_id, evidence_artifact_id, harbor_version,
               modal_version, command, sandbox_ref, started_at, completed_at,
               check_phase, outcome
        FROM registry_check_runs
        WHERE check_phase IN ('build', 'boot')
          AND outcome IN ('pass', 'fail')
        ORDER BY task_version_id, check_phase, completed_at DESC, created_at DESC, id DESC
      ),
      passing_build_and_boot AS (
        SELECT boot.id AS boot_id,
               build.id AS build_id,
               boot.task_version_id,
               boot.evidence_artifact_id,
               boot.harbor_version,
               boot.modal_version,
               boot.command,
               boot.sandbox_ref,
               LEAST(build.started_at, boot.started_at) AS started_at,
               GREATEST(build.completed_at, boot.completed_at) AS completed_at
        FROM latest_legacy_phases build
        JOIN latest_legacy_phases boot
          ON boot.task_version_id = build.task_version_id
         AND boot.check_phase = 'boot'
        WHERE build.check_phase = 'build'
          AND build.outcome = 'pass'
          AND boot.outcome = 'pass'
      )
      INSERT INTO registry_check_runs(
        id, task_version_id, definition_id, definition_version, outcome, summary,
        runner, evidence, started_at, completed_at, execution_scope, check_phase,
        evidence_artifact_id, harbor_version, modal_version, command, sandbox_ref, score
      )
      SELECT 'case:environment-inferred-from:' || pair.boot_id,
             pair.task_version_id,
             'case.harbor.environment',
             1,
             'pass',
             'Environment usability inferred from passing historical Build and Boot evidence.',
             jsonb_build_object(
               'inferred', true,
               'basis', 'passing_build_and_boot',
               'sourceCheckRunIds', jsonb_build_array(pair.build_id, pair.boot_id)
             ),
             jsonb_build_object(
               'inferred', true,
               'basis', 'passing_build_and_boot',
               'sourceCheckRunIds', jsonb_build_array(pair.build_id, pair.boot_id)
             ),
             pair.started_at,
             pair.completed_at,
             'remote_sandbox',
             'environment',
             pair.evidence_artifact_id,
             pair.harbor_version,
             pair.modal_version,
             pair.command,
             pair.sandbox_ref,
             NULL
      FROM passing_build_and_boot pair
      WHERE NOT EXISTS (
        SELECT 1
        FROM registry_check_runs existing
        WHERE existing.task_version_id = pair.task_version_id
          AND existing.check_phase = 'environment'
          AND existing.outcome IN ('pass', 'fail')
      )
      ON CONFLICT(id) DO NOTHING;

      CREATE OR REPLACE VIEW registry_harbor_check_results AS
      SELECT id,
             task_version_id AS task_id,
             check_phase AS phase,
             outcome,
             summary,
             evidence_artifact_id,
             harbor_version,
             modal_version,
             command,
             sandbox_ref,
             score,
             started_at,
             completed_at
      FROM registry_check_runs
      WHERE check_phase IN ('environment', 'oracle', 'nop')
        AND outcome IN ('pass', 'fail');

      COMMENT ON VIEW registry_harbor_check_results IS
        'Active CASE check abstraction: Environment, Oracle, or Nop pass/fail only.';
    `,
  },
  {
    id: "016_unify_legacy_environment_failures",
    sql: `
      -- Complete the legacy Build/Boot migration. Migration 015 already gives
      -- passing controls precedence and handles a fully passing setup pair.
      -- When no Environment result exists, either latest setup failure is a
      -- conclusive Environment failure; incomplete setup evidence stays unset.
      WITH latest_legacy_phases AS (
        SELECT DISTINCT ON (task_version_id, check_phase)
               id, task_version_id, evidence_artifact_id, harbor_version,
               modal_version, command, sandbox_ref, started_at, completed_at,
               check_phase, outcome
        FROM registry_check_runs
        WHERE check_phase IN ('build', 'boot')
          AND outcome IN ('pass', 'fail')
        ORDER BY task_version_id, check_phase, completed_at DESC, created_at DESC, id DESC
      ),
      failed_legacy_setup AS (
        SELECT DISTINCT ON (task_version_id)
               id, task_version_id, evidence_artifact_id, harbor_version,
               modal_version, command, sandbox_ref, started_at, completed_at,
               check_phase
        FROM latest_legacy_phases
        WHERE outcome = 'fail'
        ORDER BY task_version_id, completed_at DESC, id DESC
      )
      INSERT INTO registry_check_runs(
        id, task_version_id, definition_id, definition_version, outcome, summary,
        runner, evidence, started_at, completed_at, execution_scope, check_phase,
        evidence_artifact_id, harbor_version, modal_version, command, sandbox_ref, score
      )
      SELECT 'case:environment-inferred-failure-from:' || failure.id,
             failure.task_version_id,
             'case.harbor.environment',
             1,
             'fail',
             'Environment failure inferred from failed historical ' || initcap(failure.check_phase) || ' evidence.',
             jsonb_build_object(
               'inferred', true,
               'basis', 'failed_legacy_setup',
               'sourceCheckRunId', failure.id
             ),
             jsonb_build_object(
               'inferred', true,
               'basis', 'failed_legacy_setup',
               'sourceCheckRunId', failure.id
             ),
             failure.started_at,
             failure.completed_at,
             'remote_sandbox',
             'environment',
             failure.evidence_artifact_id,
             failure.harbor_version,
             failure.modal_version,
             failure.command,
             failure.sandbox_ref,
             NULL
      FROM failed_legacy_setup failure
      WHERE NOT EXISTS (
        SELECT 1
        FROM registry_check_runs existing
        WHERE existing.task_version_id = failure.task_version_id
          AND existing.check_phase = 'environment'
          AND existing.outcome IN ('pass', 'fail')
      )
      ON CONFLICT(id) DO NOTHING;

      -- Keep the original Build/Boot findings for provenance, and add immutable
      -- Environment-phase copies for the latest legacy setup failures so the
      -- active three-check catalog continues to expose those factual findings.
      WITH latest_legacy_phases AS (
        SELECT DISTINCT ON (task_version_id, check_phase)
               id, task_version_id, check_phase, outcome, completed_at
        FROM registry_check_runs
        WHERE check_phase IN ('build', 'boot')
          AND outcome IN ('pass', 'fail')
        ORDER BY task_version_id, check_phase, completed_at DESC, created_at DESC, id DESC
      ),
      failed_legacy_setup AS (
        SELECT DISTINCT ON (task_version_id)
               id, task_version_id, completed_at
        FROM latest_legacy_phases
        WHERE outcome = 'fail'
        ORDER BY task_version_id, completed_at DESC, id DESC
      )
      INSERT INTO registry_task_findings(
        id, task_version_id, finding, visibility, created_at, updated_at,
        check_run_id, check_phase
      )
      SELECT 'case:environment-finding-from:' || finding.id,
             finding.task_version_id,
             finding.finding,
             finding.visibility,
             finding.created_at,
             finding.updated_at,
             environment.id,
             'environment'
      FROM latest_legacy_phases legacy
      JOIN failed_legacy_setup failure
        ON failure.task_version_id = legacy.task_version_id
      JOIN registry_task_findings finding
        ON finding.check_run_id = legacy.id
      JOIN registry_check_runs environment
        ON environment.id = 'case:environment-inferred-failure-from:' || failure.id
       AND environment.task_version_id = failure.task_version_id
       AND environment.check_phase = 'environment'
       AND environment.outcome = 'fail'
      WHERE legacy.outcome = 'fail'
      ON CONFLICT(id) DO NOTHING;
    `,
  },
];

export async function runRegistryMigrations(client: PoolClient): Promise<void> {
  await client.query("SELECT pg_advisory_lock(hashtext('case_registry_migrations'))");
  try {
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
  } finally {
    await client.query("SELECT pg_advisory_unlock(hashtext('case_registry_migrations'))");
  }
}
