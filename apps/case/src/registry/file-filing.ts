import type { Pool, PoolClient } from "pg";
import type { ArtifactRecord } from "./types.js";
import { collisionName, readableFileKey, safeFileLocation, type FileContext } from "./file-names.js";

export type FilingContext = FileContext & { sourceDate?: string; sourceKind?: string };
export type FilingArtifact = ArtifactRecord & { contexts: FilingContext[]; names: string[] };
export type FileMoveInput = { artifactId: string; fromKey: string; toKey: string };
export type FileMove = FileMoveInput & { id: string; fromReference: string; toReference: string; switchedAt: string | null; oldCopyDeletedAt: string | null };

/** Supported storage operations: identity and every evidence link survive a location change. */
export class FileFilingRepository {
  constructor(private readonly pool: Pool) {}

  async submissionContext(id: string): Promise<FileContext> {
    const { rows } = await this.pool.query(`SELECT vendor_id AS "vendorId", id AS "submissionId", submission_date::text AS date, label FROM registry_submission_batches WHERE id = $1`, [id]);
    if (!rows[0]) throw new Error(`Submission ${id} does not exist`);
    return rows[0];
  }

  async reserve(filename: string, context: FileContext = {}): Promise<{ id: string; reference: string; storageKey: string }> {
    return transaction(this.pool, async (client) => {
      const id = (await client.query("SELECT 'file-' || nextval('registry_file_reference_seq') AS id")).rows[0].id as string;
      const base = readableFileKey(filename, context);
      for (let n = 1; n <= 100_000; n++) {
        const reference = n === 1 ? base : collisionName(base, n);
        const claimed = await client.query("INSERT INTO registry_file_names(name, artifact_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING name", [reference, id]);
        if (claimed.rowCount) {
          await client.query("INSERT INTO registry_file_names(name, artifact_id) VALUES ($1, $1)", [id]);
          return { id, reference, storageKey: reference };
        }
      }
      throw new Error("Too many files with the same name");
    });
  }

  async inventory(): Promise<FilingArtifact[]> {
    const { rows } = await this.pool.query(`
      WITH event_batches AS (
        SELECT source_event_id, batch_id FROM registry_batch_source_events
        UNION SELECT source_event_id, id FROM registry_submission_batches
      ), source_files AS (
        SELECT si.artifact_id, se.vendor_id, eb.batch_id, se.received_at, si.kind, si.display_name
        FROM registry_source_items si JOIN registry_source_events se ON se.id = si.source_event_id
        LEFT JOIN event_batches eb ON eb.source_event_id = se.id WHERE si.artifact_id IS NOT NULL
        UNION ALL
        SELECT se.raw_artifact_id, se.vendor_id, eb.batch_id, se.received_at, 'raw_source', NULL
        FROM registry_source_events se LEFT JOIN event_batches eb ON eb.source_event_id = se.id WHERE se.raw_artifact_id IS NOT NULL
      ), task_files AS (
        SELECT artifact_id, batch_id FROM registry_task_versions WHERE artifact_id IS NOT NULL
        UNION SELECT tr.artifact_id, tv.batch_id FROM registry_trajectories tr JOIN registry_task_versions tv ON tv.id = tr.task_version_id WHERE tr.artifact_id IS NOT NULL
        UNION SELECT cr.evidence_artifact_id, tv.batch_id FROM registry_check_runs cr JOIN registry_task_versions tv ON tv.id = cr.task_version_id WHERE cr.evidence_artifact_id IS NOT NULL
        UNION SELECT ca.evidence_artifact_id, tv.batch_id FROM registry_harbor_check_attempts ca JOIN registry_task_versions tv ON tv.id = ca.task_version_id
      ), contexts AS (
        SELECT sf.artifact_id, sf.display_name,
          jsonb_build_object('vendorId',sf.vendor_id,'submissionId',b.id,'date',b.submission_date::text,
            'label',b.label,'sourceDate',to_char(sf.received_at AT TIME ZONE 'Asia/Shanghai','YYYY-MM-DD'),'sourceKind',sf.kind) AS context
        FROM source_files sf LEFT JOIN registry_submission_batches b ON b.id = sf.batch_id
        UNION ALL
        SELECT tf.artifact_id, NULL, jsonb_build_object('vendorId',b.vendor_id,'submissionId',b.id,'date',b.submission_date::text,'label',b.label)
        FROM task_files tf JOIN registry_submission_batches b ON b.id = tf.batch_id
      )
      SELECT a.id, a.reference, a.kind, a.storage_key AS "storageKey", a.sha256,
        a.size_bytes::float8 AS "sizeBytes", a.content_type AS "contentType", a.metadata, a.created_at AS "createdAt",
        COALESCE(jsonb_agg(DISTINCT c.context) FILTER (WHERE c.context IS NOT NULL),'[]') AS contexts,
        COALESCE(jsonb_agg(DISTINCT c.display_name) FILTER (WHERE c.display_name IS NOT NULL),'[]') AS names
      FROM registry_artifacts a LEFT JOIN contexts c ON c.artifact_id = a.id
      GROUP BY a.id ORDER BY a.created_at, a.id`);
    return rows.map((row) => ({ ...row, sizeBytes: row.sizeBytes ?? undefined, contentType: row.contentType ?? undefined, createdAt: new Date(row.createdAt).toISOString() }));
  }

  async prepare(input: FileMoveInput, actor: string, reason: string): Promise<FileMove> {
    safeFileLocation(input.toKey);
    if (!actor?.trim() || !reason?.trim()) throw new Error("File filing needs an actor and reason");
    return transaction(this.pool, async (client) => {
      const { rows } = await client.query("SELECT * FROM registry_artifacts WHERE id=$1 FOR UPDATE", [input.artifactId]);
      const artifact = rows[0];
      if (!artifact) throw new Error(`Artifact ${input.artifactId} does not exist`);
      const previous = (await client.query("SELECT * FROM registry_file_moves WHERE from_key=$1 FOR UPDATE", [input.fromKey])).rows[0];
      if (previous) {
        if (previous.artifact_id !== input.artifactId || previous.to_key !== input.toKey) throw new Error("File move disagrees with the recorded plan");
        if (artifact.storage_key !== input.fromKey && artifact.storage_key !== input.toKey) throw new Error("File location has changed since this plan");
        return moveFromRow(previous);
      }
      if (artifact.storage_key !== input.fromKey || input.fromKey === input.toKey) throw new Error("File location has changed since this plan");
      await client.query("INSERT INTO registry_file_names(name,artifact_id) VALUES ($1,$2) ON CONFLICT DO NOTHING", [input.toKey, input.artifactId]);
      const owner = (await client.query("SELECT artifact_id FROM registry_file_names WHERE name=$1", [input.toKey])).rows[0];
      if (owner.artifact_id !== input.artifactId) throw new Error("Destination name already belongs to a different file");
      const inserted = await client.query(`INSERT INTO registry_file_moves(artifact_id,from_key,to_key,from_reference,to_reference,actor,reason)
        VALUES ($1,$2,$3,$4,$3,$5,$6) RETURNING *`, [input.artifactId, input.fromKey, input.toKey, artifact.reference, actor, reason]);
      return moveFromRow(inserted.rows[0]);
    });
  }

  async complete(moveId: string): Promise<void> {
    await transaction(this.pool, async (client) => {
      const row = (await client.query("SELECT * FROM registry_file_moves WHERE id=$1 FOR UPDATE", [moveId])).rows[0];
      if (!row) throw new Error("Unknown file move");
      const artifact = (await client.query("SELECT * FROM registry_artifacts WHERE id=$1 FOR UPDATE", [row.artifact_id])).rows[0];
      if (row.switched_at) {
        if (artifact.storage_key !== row.to_key) throw new Error("File moved again after this operation");
        return;
      }
      if (artifact.storage_key !== row.from_key) throw new Error("File location changed during verification");
      await client.query("UPDATE registry_artifacts SET storage_key=$2, reference=$3 WHERE id=$1", [row.artifact_id,row.to_key,row.to_reference]);
      await client.query("UPDATE registry_file_moves SET switched_at=now() WHERE id=$1", [moveId]);
      await audit(client, "artifact", row.artifact_id, "file.relocated", row.actor, { fromKey: row.from_key, toKey: row.to_key, fromReference: row.from_reference, reason: row.reason });
    });
  }

  async moves(): Promise<FileMove[]> {
    return (await this.pool.query("SELECT * FROM registry_file_moves ORDER BY id")).rows.map(moveFromRow);
  }

  async rollback(id: string, actor: string, reason: string): Promise<void> {
    if (!actor?.trim() || !reason?.trim()) throw new Error("Rollback needs an actor and reason");
    await transaction(this.pool,async(client)=>{
      const row=(await client.query("SELECT * FROM registry_file_moves WHERE id=$1 FOR UPDATE",[id])).rows[0];
      if (!row || row.old_copy_deleted_at) throw new Error("Rollback copy is not available");
      const artifact=(await client.query("SELECT storage_key FROM registry_artifacts WHERE id=$1 FOR UPDATE",[row.artifact_id])).rows[0];
      if (!row.switched_at && artifact.storage_key===row.from_key) return;
      if (artifact.storage_key!==row.to_key) throw new Error("File moved again after this operation");
      await client.query("UPDATE registry_artifacts SET storage_key=$2,reference=$3 WHERE id=$1",[row.artifact_id,row.from_key,row.from_reference]);
      await client.query("UPDATE registry_file_moves SET switched_at=NULL WHERE id=$1",[id]);
      await audit(client,"artifact",row.artifact_id,"file.relocation_rolled_back",actor,{moveId:id,reason});
    });
  }

  async markOldCopyDeleted(id: string): Promise<void> {
    await this.pool.query("UPDATE registry_file_moves SET old_copy_deleted_at=now() WHERE id=$1 AND switched_at IS NOT NULL", [id]);
  }

  async mergeTaskIdentities(input: { targetTaskVersionId: string; sourceTaskVersionId: string; actor: string; reason: string }): Promise<unknown> {
    if (!input.actor?.trim() || !input.reason?.trim()) throw new Error("Task identity correction needs an actor and reason");
    return transaction(this.pool, async (client) => {
      const rows = (await client.query(`SELECT tv.id,tv.task_id,tv.artifact_id,tv.content_sha256,t.vendor_id FROM registry_task_versions tv JOIN registry_tasks t ON t.id=tv.task_id WHERE tv.id=ANY($1::text[]) FOR UPDATE OF tv,t`, [[input.targetTaskVersionId,input.sourceTaskVersionId]])).rows;
      const target = rows.find((r) => r.id === input.targetTaskVersionId); const source = rows.find((r) => r.id === input.sourceTaskVersionId);
      if (!target || !source || target.vendor_id !== source.vendor_id || !target.artifact_id || target.artifact_id !== source.artifact_id || target.content_sha256 !== source.content_sha256) throw new Error("Task identity merge requires the same vendor and exact stored package");
      if (target.task_id === source.task_id) return { merged: false, taskIdentityId: target.task_id };
      const overlap = await client.query(`SELECT 1 FROM registry_task_versions a JOIN registry_task_versions b ON a.batch_id=b.batch_id WHERE a.task_id=$1 AND b.task_id=$2 LIMIT 1`, [target.task_id,source.task_id]);
      if (overlap.rowCount) throw new Error("Cannot merge task identities that coexist in one submission");
      const versions = (await client.query("SELECT id FROM registry_task_versions WHERE task_id=$1 FOR UPDATE", [source.task_id])).rows.map((r) => r.id);
      await client.query("UPDATE registry_task_versions SET task_id=$2 WHERE task_id=$1", [source.task_id,target.task_id]);
      await client.query("UPDATE registry_tasks SET merged_into_id=$2 WHERE id=$1 OR merged_into_id=$1", [source.task_id,target.task_id]);
      await audit(client,"task",target.task_id,"task.identities_merged",input.actor,{ sourceTaskIdentityId: source.task_id, taskVersionIds: versions, reason: input.reason });
      return { merged: true, taskIdentityId: target.task_id, sourceTaskIdentityId: source.task_id, taskVersionIds: versions };
    });
  }

  async correctTaskFormat(input: { taskId: string; format: "harbor" | "non_harbor"; actor: string; reason: string }): Promise<{ changed: boolean; submissionId: string }> {
    if (!input.actor?.trim() || !input.reason?.trim() || !["harbor","non_harbor"].includes(input.format)) throw new Error("Invalid task format correction");
    return transaction(this.pool, async (client) => {
      const row = (await client.query("SELECT * FROM registry_task_versions WHERE id=$1 AND superseded_at IS NULL FOR UPDATE",[input.taskId])).rows[0];
      if (!row || row.task_kind !== "task") throw new Error("Format correction requires an active task");
      const changed = row.format_kind !== input.format;
      if (changed) {
        await client.query("UPDATE registry_task_versions SET format_kind=$2,format=$2,updated_at=now() WHERE id=$1",[input.taskId,input.format]);
        await audit(client,"task_version",input.taskId,"task.format_corrected",input.actor,{ before: {format:row.format,formatKind:row.format_kind}, after:{format:input.format}, reason:input.reason });
      }
      return { changed, submissionId: row.batch_id };
    });
  }
}

export async function transaction<T>(pool: Pool, operation: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try { await client.query("BEGIN"); const result=await operation(client); await client.query("COMMIT"); return result; }
  catch (error) { await client.query("ROLLBACK"); throw error; }
  finally { client.release(); }
}

async function audit(client: PoolClient, type: string, id: string, event: string, actor: string, payload: unknown) {
  await client.query(`INSERT INTO registry_status_events(id,entity_type,entity_id,event_type,actor,payload,occurred_at) VALUES ('operation-'||nextval('registry_record_seq'),$1,$2,$3,$4,$5::jsonb,now())`,[type,id,event,actor,JSON.stringify(payload)]);
}

function moveFromRow(row: Record<string, any>): FileMove {
  return { id:String(row.id), artifactId:row.artifact_id,fromKey:row.from_key,toKey:row.to_key,fromReference:row.from_reference,toReference:row.to_reference,switchedAt:row.switched_at ? new Date(row.switched_at).toISOString():null,oldCopyDeletedAt:row.old_copy_deleted_at ? new Date(row.old_copy_deleted_at).toISOString():null };
}
