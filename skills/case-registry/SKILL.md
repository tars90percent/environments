---
name: case-registry
description: Query and update CASE's canonical evaluation-sample registry with provenance-preserving validated operations. Use for vendors, submissions, sources, task versions, artifacts, checks, trajectories, work items, statuses, follow-ups, or researcher responses. Use case-sample-registration for the surrounding end-to-end workflow.
---

# CASE Registry

Use the registry as the durable record within complete sample registration. It stores what arrived, how task versions were derived, what ran, and what people decided. It does not define a separate capture or processing lifecycle.

Use the `case-registry` CLI or registry API. Never write the database directly.

## Read before writing

Inspect the current record and exact identifiers first:

```bash
case-registry operations
case-registry vendors --all
case-registry vendor <vendor-id>
case-registry batch <submission-id>
case-registry task <task-version-id>
case-registry source-event <source-event-id>
case-registry submission-reviews <submission-id>
case-registry catalog
```

Some internal commands still say `batch`; use **submission** in human-facing language.

## Validated writes

Choose the narrowest operation that represents the fact. Write operations use validated JSON documents:

```bash
case-registry import /absolute/path/submission.json
case-registry import-source /absolute/path/source-envelope.json
case-registry append-normalized-tasks /absolute/path/normalized-tasks.json
case-registry classify-submission /absolute/path/intake-classification.json
case-registry record-vendor-event /absolute/path/vendor-event.json
case-registry archive-vendor /absolute/path/vendor-archive.json
case-registry restore-vendor /absolute/path/vendor-restore.json
case-registry store-file <artifact-kind> /absolute/path/file
case-registry download-artifact <artifact-id> /absolute/path/output
case-registry record-check /absolute/path/check-result.json
case-registry record-task-finding /absolute/path/finding.json
case-registry update-task-finding /absolute/path/finding-update.json
case-registry delete-task-finding <finding-id>
case-registry record-follow-up /absolute/path/follow-up.json
case-registry record-submission-review /absolute/path/review.json
case-registry register-artifact /absolute/path/artifact.json
case-registry remove-submission /absolute/path/submission-removal.json
case-registry delete-artifact <unreferenced-artifact-id>
case-registry set-status /absolute/path/status.json
case-registry link-task-sources /absolute/path/task-source-links.json
case-registry lease-work <worker-id>
case-registry complete-work /absolute/path/completion.json
case-intake capture-feishu-plan /absolute/path/plan.json
case-mail-intake capture-mail-plan /absolute/path/plan.json
```

In particular:

- `store-file` and `register-artifact` for immutable objects and their metadata.
- `download-artifact` to obtain and checksum the exact registered bytes without exposing object-store credentials.
- `import-source` for an inbound event, connected source items, artifacts, and a submission checkpoint.
- `import` for a complete manifest that already contains source, submission, and task records.
- `append-normalized-tasks` to append task versions to an existing submission after source interpretation.
- `classify-submission` to mark a legacy submission as `sample_evaluation` exactly once, with governing linked source-event IDs, a reason, and an actor; do not use it for purchased deliveries or uncertain scope.
- `link-task-sources` to add exact task-to-source relations.
- `record-check`, `record-follow-up`, `record-submission-review`, and `record-vendor-event` for append-only evidence and history.
- `record-task-finding`, `update-task-finding`, and `delete-task-finding` for plain CASE-owned working notes attached to a task version. A finding is only `{id, taskVersionId, finding}` when created and must not be used as a substitute for a check, assessment, trajectory, or researcher response.
- `set-status`, `archive-vendor`, and `restore-vendor` for explicit lifecycle changes.
- `lease-work` and `complete-work` for durable queued work.
- `remove-submission` and `delete-artifact` for the purchased-delivery cleanup boundary or an unreferenced failed upload.

Run `case-registry operations` for the installed command schemas rather than guessing flags or payload fields.

## Source registration

Read [references/source-envelope.md](references/source-envelope.md) when constructing a source graph or retrying a failed source registration.

The reviewed Feishu and Feishu Mail capture-plan operations must declare:

```json
{"purpose": "sample_evaluation"}
```

These operations create the first durable checkpoint of registration. Continue interpreting and registering task versions from the preserved material; do not mistake an `unchecked` submission for completed registration.

## Invariants

- Store immutable bytes before registering relations that depend on them.
- Preserve the original locator, sender, time, channel, fetch state, parse state, and failure evidence.
- Link every task version to its governing source items and exact task-package artifact.
- `append-normalized-tasks` requires an existing `task_package` artifact and source item. Use stable idempotency keys so retries do not duplicate versions.
- Corrections are new submissions or task versions with explicit revision links such as `revisesBatchId`; never overwrite history.
- Reviews, checks, trajectories, assessments, and operational events are append-only records with identified producers. Plain task findings are mutable working notes and may be updated or deleted.
- Archive a vendor only after its submissions are internal. Archiving must not erase evidence.
- After purchase, retain only the minimal handoff fact and remove full purchased deliveries and production packages from CASE storage.
- Remove an uploaded object after registration failure only when it is confirmed unreferenced.

Registry presence is not evidence of quality or completion. Interpret statuses using the linked records and evidence.

## Working with the primary workflow

When the request involves receiving, interpreting, representing, running, or resolving sample tasks, use `$case-sample-registration` as the primary skill and this skill for persistence. A single registration may write source records early, append task versions later, and add execution evidence after sandbox runs; those are resumable checkpoints in one process.
