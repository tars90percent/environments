---
name: case-registry
description: Query and update CASE's canonical RL environment vendor, submission, task, check, trajectory, and follow-up registry.
---

# CASE registry

Use the `case-registry` command for canonical RL-environment procurement data. The registry, not the Feishu conversation, is the source of truth for vendor samples and their evaluation history.

## Read operations

```sh
case-registry operations
case-registry vendors
case-registry vendor <vendor-id>
case-registry batch <batch-id>
case-registry task <task-version-id>
case-registry source-event <source-event-id>
case-registry submission-reviews <submission-id>
case-registry catalog
```

Use these before answering questions about what was received, which version changed, deterministic checks, and whether a task is visible to researchers.

## Writes

Write through validated JSON documents:

```sh
case-registry import /absolute/path/submission.json
case-registry import-source /absolute/path/source-envelope.json
case-registry record-vendor-event /absolute/path/vendor-event.json
case-registry store-file <source_payload|source_snapshot|submission_manifest|task_package|trajectory|check_evidence|extracted_text|other> /absolute/path/file
case-registry record-check /absolute/path/check-result.json
case-registry record-follow-up /absolute/path/follow-up.json
case-registry record-submission-review /absolute/path/review.json
case-registry register-artifact /absolute/path/artifact.json
case-registry set-status /absolute/path/status.json
case-registry link-task-sources /absolute/path/task-source-links.json
case-registry lease-work <worker-id>
case-registry complete-work /absolute/path/completion.json
case-intake capture-feishu-plan /absolute/path/plan.json
case-mail-intake capture-mail-plan /absolute/path/plan.json
```

Never replace an existing submission batch. A corrected vendor delivery is a new batch linked through `revisesBatchId`. Keep deterministic check evidence separate from heuristic review and human research judgment. Do not expose service tokens or direct database credentials in replies.

`vendors` includes contacted organizations that do not yet have a submission. `vendor <vendor-id>` returns the vendor directory record, any normalized submissions, and append-only vendor history. Record contact, sample, evaluation, commercial, delivery, acceptance, payment, and relationship events with `record-vendor-event`; link every event to the exact source events and submissions that support it. Do not represent a purchase or delivery by mutating a single current-stage label.

Use `link-task-sources` when immutable sample artifacts were captured after task normalization. It only appends provenance links from existing task versions to existing source items; it does not rewrite either record.

Use `case-intake capture-feishu-plan` for a reviewed list of Feishu file resources. It downloads each exact message/file-key pair through CASE's renewable user login, stores the bytes content-addressably, creates per-message source records, and groups them into visible `unchecked` submissions. The command never opens or executes downloaded vendor material. Re-running the same immutable plan is idempotent.

Use `case-mail-intake capture-mail-plan` for the equivalent workflow when samples arrive as Feishu Mail attachments. The plan uses exact message and attachment IDs, obtains short-lived download URLs through the renewable user login, stores immutable copies, and records the email provenance without exposing the signed URLs.

Human reviews are append-only records attached to a submission. Use `scope: "submission"` with no category ids for the whole submission, or `scope: "categories"` with one or more category ids for a scoped judgment. Preserve each researcher's identity and each later review separately; do not overwrite earlier judgments.

## Heterogeneous intake

Treat every inbound message or email as a source event, not as a task batch. Preserve its original payload first, then represent everything discovered inside it as an immutable source graph:

- messages, attachments, URLs, folders, Docs, Sheets, worksheets, rows, PDFs, archives, task packages, and container images are source items;
- `contains`, `links_to`, `derived_from`, `describes`, `mirrors`, and `supersedes` are explicit relations;
- mutable remote resources such as Google Drive folders and Sheets must be snapshotted on every submission or correction, even when the URL did not change;
- normalized batches and task versions link back to the exact source event and source items they came from;
- an unreachable resource remains recorded with its locator and `blocked` or `external_only` status. Never silently omit it.

Use [`references/source-envelope.md`](references/source-envelope.md) for the envelope contract and the required capture order. `store-file` streams an original payload or snapshot into content-addressed object storage, verifies the stored object, and records its immutable artifact entry before it is referenced from an envelope.
