---
name: case-registry
description: Query and update CASE's canonical environment-sample intake, evaluation, and provenance registry.
---

# CASE registry

Use the `case-registry` command for canonical environment-sample data. The registry, not the Feishu conversation, is the source of truth for samples and their evaluation history. Purchased deliveries belong to the downstream production-data pipeline and must not be copied into CASE object storage or normalized as CASE submissions.

## Read operations

```sh
case-registry operations
case-registry vendors
case-registry vendors --all
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
case-registry append-normalized-tasks /absolute/path/normalized-tasks.json
case-registry record-vendor-event /absolute/path/vendor-event.json
case-registry archive-vendor /absolute/path/vendor-archive.json
case-registry restore-vendor /absolute/path/vendor-restore.json
case-registry store-file <source_payload|source_snapshot|submission_manifest|task_package|trajectory|check_evidence|extracted_text|other> /absolute/path/file
case-registry record-check /absolute/path/check-result.json
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

Never replace an existing sample submission. A corrected sample is a new submission linked through `revisesBatchId`. Keep deterministic check evidence separate from heuristic review and human research judgment. Do not expose service tokens or direct database credentials in replies.

When a sample is purchased, hand it off to the downstream pipeline. CASE may retain the dated purchase/handoff fact, but remove the purchased delivery submission and package bytes. `remove-submission` refuses normalized task records, removes only source events exclusive to that submission, retains source evidence referenced by vendor history, and deletes only artifacts that become unreferenced. `delete-artifact` is restricted to already-unreferenced artifacts and is used to clean interrupted captures.

`vendors` includes contacted organizations that do not yet have a submission. `vendor <vendor-id>` returns the vendor directory record, any normalized submissions, and append-only vendor history. Record contact, sample, evaluation, commercial, delivery, acceptance, payment, and relationship events with `record-vendor-event`; link every event to the exact source events and submissions that support it. Do not represent a purchase or delivery by mutating a single current-stage label.

Archive a vendor instead of deleting it. Archival is allowed only after every submission is `internal`; it removes the vendor from normal directory and research/portal catalog reads while preserving sources, artifacts, submissions, events, and admin audit access. Use a verified operator identity and a concrete reason:

```json
{
  "vendorId": "vendor-id",
  "reason": "Why this vendor is being archived or restored",
  "actor": "Verified operator identity"
}
```

`vendors --all` and `vendor <vendor-id>` include archived vendors for admin audit. New intake never silently restores an archived vendor; restore it explicitly when it should return to active directories.

An unresolved attribution placeholder is a provenance identity, not an actionable vendor relationship. Preserve its source graph, but keep it out of normal vendor and catalog views by making its submissions `internal` and archiving the placeholder identity.

Use `link-task-sources` when immutable sample artifacts were captured after task normalization. It only appends provenance links from existing task versions to existing source items; it does not rewrite either record.

Use `append-normalized-tasks` after an attachment-first capture created an immutable submission before its task boundaries were known. The request atomically adds categories and task versions to that existing submission, requires each task to cite a registered `task_package` artifact and source item already linked to the submission, and is idempotent for identical contents. It preserves the original declared intake count; catalog `taskCount` is derived from the normalized task-version rows. Never use this operation to revise an existing task version or represent a later vendor correction; those require a new submission.

Use `case-intake capture-feishu-plan` for a reviewed list of Feishu sample resources. The plan must declare `"purpose": "sample_evaluation"`; this is an explicit assertion that purchased delivery files have been excluded. It downloads each exact message/file-key pair through CASE's renewable user login, stores the bytes content-addressably, creates per-message source records, and groups them into visible `unchecked` submissions. The command never opens or executes downloaded vendor material. Re-running a successful immutable plan is idempotent; a failed capture can be retried as a provenance-preserving retry event.

Use `case-mail-intake capture-mail-plan` for the equivalent workflow when samples arrive as Feishu Mail attachments. Its plan also requires `"purpose": "sample_evaluation"`. The plan uses exact message and attachment IDs, obtains short-lived download URLs through the renewable user login, stores immutable copies, and records the email provenance without exposing the signed URLs.

Human reviews are append-only records attached to a submission. Use `scope: "submission"` with no category ids for the whole submission, or `scope: "categories"` with one or more category ids for a scoped judgment. Preserve each researcher's identity and each later review separately; do not overwrite earlier judgments.

## Heterogeneous intake

Treat every in-scope sample message or email as a source event, not as a task batch. Preserve its original payload first, then represent everything discovered inside it as an immutable source graph:

- messages, attachments, URLs, folders, Docs, Sheets, worksheets, rows, PDFs, archives, task packages, and container images are source items;
- `contains`, `links_to`, `derived_from`, `describes`, `mirrors`, and `supersedes` are explicit relations;
- mutable remote resources such as Google Drive folders and Sheets must be snapshotted on every submission or correction, even when the URL did not change;
- normalized batches and task versions link back to the exact source event and source items they came from;
- an unreachable resource remains recorded with its locator and `blocked` or `external_only` status. Never silently omit it.

Use [`references/source-envelope.md`](references/source-envelope.md) for the envelope contract and the required capture order. `store-file` streams an original payload or snapshot into content-addressed object storage, verifies the stored object, and records its immutable artifact entry before it is referenced from an envelope.
