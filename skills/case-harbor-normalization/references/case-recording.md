# Recording normalization in CASE

Read this reference only when the work includes registering or handing off normalization results. A request to inspect or propose a mapping does not itself authorize registry writes.

Use the `case-registry` CLI or registry API. Never write raw SQL or expose registry, database, object-store, or source credentials.

## Preserve the source graph first

Before normalized records exist, ensure CASE retains:

- the inbound source event;
- the original immutable payload or captured snapshot;
- source items for messages, attachments, URLs, folders, documents, worksheets, rows, PDFs, archives, repositories, task packages, and pages as applicable;
- explicit `contains`, `links_to`, `derived_from`, `describes`, `mirrors`, or `supersedes` relations;
- original locator, sender, timestamp, fetch state, parse state, and content hash.

A stable URL is a locator, not a version. Snapshot mutable sources whenever newly observed contents constitute a delivery or correction.

## Registry relationships

Represent the result through these distinct identities:

```text
vendor
├── submissions observed over time
└── stable tasks
    └── immutable task versions

source event → source items → submission → task version
artifact ← original payload
artifact ← normalized task package
task version → checks and trajectories
submission → researcher responses
```

A task version is the exact runnable or inspectable version observed in one submission. It should point directly to its normalized task-package artifact when one exists, while also linking to the source items and internal source path from which it was derived.

Do not encode mutable categorization or quality judgments in object-storage keys. Artifacts remain content-addressed; PostgreSQL carries identity, relationships, categories, statuses, and assessments.

## Minimum normalization record

For each interpreted task, preserve:

- `vendor_id`;
- `submission_id`;
- stable task key and the evidence or derivation supporting it;
- task-version ID;
- primary category without using category as a quality label;
- exact source-item IDs and source path;
- observed format;
- original artifact ID and hash;
- normalized task-package artifact ID and hash, if produced;
- normalization outcome and confidence;
- practitioner identity and normalizer-guidance version;
- declared, observed, and resolved verifier classification;
- transformation log;
- unresolved issues and next action.

The transformation log should name the source and destination paths, action, rationale, and hashes where meaningful. Record omitted material and why it remains only at source or submission scope.

## History and status

- Register a correction as a new submission linked to what it revises.
- Register changed task bytes as a new task version.
- Never replace an earlier task version or reinterpretation silently.
- Preserve failed or incomplete normalization attempts as ingestion history.
- Use `missing` when evidence was not supplied or could not be obtained. Use `failed` only when a named check actually ran and failed.
- Keep normalization outcomes separate from deterministic checks, heuristic assessments, vendor claims, human recommendations, and final researcher decisions.
- Keep normalized tasks `unchecked` until the required sandbox checks have recorded evidence.

## Handoff to evaluation

When normalization is complete and evaluation is authorized, queue or hand off the exact immutable task artifact, task-version ID, artifact hash, selected requirement snapshot, and requested check policy.

Do not execute the task as part of normalization. CASE's approved controller must force Harbor runs into a fresh disposable remote sandbox with no production credentials or private-network access.

## Purchased-delivery boundary

CASE is limited to evaluation samples. When purchase is confirmed, retain only the minimal handoff fact needed for audit and duplicate prevention, transfer the full delivery to the downstream pipeline, and remove purchased delivery packages and container bundles from CASE storage according to the approved handoff process.
