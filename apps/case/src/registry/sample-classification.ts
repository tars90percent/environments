import type { Pool } from "pg";
import { RegistryConflictError, RegistryNotFoundError } from "./postgres.js";

export type SampleCapability = { id: string; displayName: string; description: string };
export type SampleBenchmarkGroup = { id: string; family: string; version: string | null };
export type SampleTaxonomy = { capabilities: SampleCapability[]; benchmarkGroups: SampleBenchmarkGroup[] };
export type RegisterSampleTaxonomyInput = SampleTaxonomy & { actor: string; reason: string };
export type TaskClassification = {
  id: string;
  capability: SampleCapability;
  benchmarkGroup: SampleBenchmarkGroup | null;
  evidence: string;
  relationship: string;
  sourceBenchmark: { id: string; displayName: string };
  actor: string;
  reason: string;
  createdAt: string;
};
export type ClassifyTasksInput = {
  submissionId: string;
  assignments: Array<{
    taskId: string;
    capabilityId: string;
    benchmarkGroupId: string | null;
    evidence: string;
    relationship: string;
    expectedClassificationId: string | null;
    expectedBenchmarkId: string;
  }>;
  actor: string;
  reason: string;
};
export type ClassifyTasksResult = { submissionId: string; added: number; unchanged: number };

export async function sampleTaxonomy(pool: Pool): Promise<SampleTaxonomy> {
  const [capabilities, groups] = await Promise.all([
    pool.query<SampleCapability>('SELECT id, display_name AS "displayName", description FROM registry_sample_capabilities ORDER BY display_name'),
    pool.query<SampleBenchmarkGroup>('SELECT id, family, version FROM registry_sample_benchmark_groups ORDER BY family, version NULLS FIRST'),
  ]);
  return { capabilities: capabilities.rows, benchmarkGroups: groups.rows };
}

// Definitions have stable meaning. A materially different distribution gets a new
// group; a null version deliberately groups a family without claiming a release.
export async function registerSampleTaxonomy(pool: Pool, input: RegisterSampleTaxonomyInput): Promise<SampleTaxonomy> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("LOCK TABLE registry_sample_capabilities, registry_sample_benchmark_groups IN SHARE ROW EXCLUSIVE MODE");
    let added = 0;
    for (const capability of input.capabilities) {
      const existing = await client.query('SELECT display_name, description FROM registry_sample_capabilities WHERE id = $1', [capability.id]);
      if (existing.rows[0]) {
        if (existing.rows[0].display_name !== capability.displayName || existing.rows[0].description !== capability.description) {
          throw new RegistryConflictError(`Capability ${capability.id} already has different contents`);
        }
      } else {
        await client.query('INSERT INTO registry_sample_capabilities(id, display_name, description) VALUES ($1, $2, $3)', [capability.id, capability.displayName, capability.description]);
        added++;
      }
    }
    for (const group of input.benchmarkGroups) {
      const existing = await client.query('SELECT family, version FROM registry_sample_benchmark_groups WHERE id = $1', [group.id]);
      if (existing.rows[0]) {
        if (existing.rows[0].family !== group.family || existing.rows[0].version !== group.version) {
          throw new RegistryConflictError(`Benchmark group ${group.id} already has different contents`);
        }
      } else {
        await client.query('INSERT INTO registry_sample_benchmark_groups(id, family, version) VALUES ($1, $2, $3)', [group.id, group.family, group.version]);
        added++;
      }
    }
    if (added) await client.query('INSERT INTO registry_sample_taxonomy_events(actor, reason, definitions) VALUES ($1, $2, $3::jsonb)', [input.actor, input.reason, JSON.stringify({ capabilities: input.capabilities, benchmarkGroups: input.benchmarkGroups })]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  return sampleTaxonomy(pool);
}

export async function classifyTasks(pool: Pool, input: ClassifyTasksInput): Promise<ClassifyTasksResult> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const submission = (await client.query(`SELECT COALESCE(intake_purpose, metadata->>'intakePurpose') AS purpose
      FROM registry_submission_batches WHERE id = $1 FOR UPDATE`, [input.submissionId])).rows[0];
    if (!submission) throw new RegistryNotFoundError(`Submission ${input.submissionId} does not exist`);
    if (submission.purpose !== "sample_evaluation") throw new RegistryConflictError(`Submission ${input.submissionId} is not a sample submission`);
    const tasks = await client.query(`SELECT tv.id, b.benchmark_id, rb.display_name
      FROM registry_task_versions tv
      JOIN registry_current_task_benchmarks b ON b.task_version_id = tv.id
      JOIN registry_benchmarks rb ON rb.id = b.benchmark_id
      WHERE tv.batch_id = $1 AND tv.superseded_at IS NULL AND tv.id = ANY($2::text[]) FOR UPDATE OF tv`,
    [input.submissionId, input.assignments.map((a) => a.taskId)]);
    const currentTasks = new Map(tasks.rows.map((row) => [row.id, row]));
    let added = 0;
    let unchanged = 0;
    for (const assignment of input.assignments) {
      const task = currentTasks.get(assignment.taskId);
      if (!task) throw new RegistryNotFoundError(`Active task ${assignment.taskId} does not belong to submission ${input.submissionId}`);
      if (task.benchmark_id !== assignment.expectedBenchmarkId) throw new RegistryConflictError(`Source benchmark changed for ${assignment.taskId}; refresh before classifying`);
      const previous = (await client.query(`SELECT id::text, capability_id, benchmark_group_id, evidence, relationship
        FROM registry_task_classifications WHERE task_version_id = $1 ORDER BY id DESC LIMIT 1`, [assignment.taskId])).rows[0];
      if (previous && previous.capability_id === assignment.capabilityId && previous.benchmark_group_id === assignment.benchmarkGroupId
          && previous.evidence === assignment.evidence && previous.relationship === assignment.relationship) {
        unchanged++;
        continue;
      }
      if ((previous?.id ?? null) !== assignment.expectedClassificationId) throw new RegistryConflictError(`Classification changed for ${assignment.taskId}; refresh before classifying`);
      await client.query(`INSERT INTO registry_task_classifications(task_version_id, capability_id, benchmark_group_id,
        evidence, relationship, source_benchmark, actor, reason) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)`,
      [assignment.taskId, assignment.capabilityId, assignment.benchmarkGroupId, assignment.evidence, assignment.relationship,
        JSON.stringify({ id: task.benchmark_id, displayName: task.display_name }), input.actor, input.reason]);
      added++;
    }
    if (added) await client.query('UPDATE registry_submission_batches SET updated_at = now() WHERE id = $1', [input.submissionId]);
    await client.query("COMMIT");
    return { submissionId: input.submissionId, added, unchanged };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function taskClassifications(pool: Pool, taskId?: string): Promise<Array<{ taskId: string; classification: TaskClassification }>> {
  const rows = await pool.query<{ taskId: string; classification: TaskClassification }>(`
    SELECT c.task_version_id AS "taskId", jsonb_build_object(
      'id', c.id::text, 'capability', jsonb_build_object('id', cap.id, 'displayName', cap.display_name, 'description', cap.description),
      'benchmarkGroup', CASE WHEN bg.id IS NULL THEN NULL ELSE jsonb_build_object('id', bg.id, 'family', bg.family, 'version', bg.version) END,
      'evidence', c.evidence, 'relationship', c.relationship, 'sourceBenchmark', c.source_benchmark,
      'actor', c.actor, 'reason', c.reason, 'createdAt', c.created_at) AS classification
    FROM ${taskId ? 'registry_task_classifications' : 'registry_current_task_classifications'} c
    JOIN registry_sample_capabilities cap ON cap.id = c.capability_id
    LEFT JOIN registry_sample_benchmark_groups bg ON bg.id = c.benchmark_group_id
    ${taskId ? 'WHERE c.task_version_id = $1' : ''} ORDER BY c.id DESC`, taskId ? [taskId] : []);
  return rows.rows;
}
