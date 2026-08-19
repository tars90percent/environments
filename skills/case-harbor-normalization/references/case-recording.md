# Recording normalization in CASE

Read this reference only when the work includes registering normalization results or continuing CASE task processing into runtime verification. A request to inspect or propose a mapping does not itself authorize registry writes or sandbox execution.

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

For a reviewed native-format exception, the task version should instead point directly to the immutable native task artifact and identify the native runner or adapter contract. Do not create a cosmetic Harbor artifact merely to satisfy a preferred-format count.

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
- normalization outcome, observed format, representation path, and confidence;
- practitioner identity and normalizer-guidance version;
- declared, observed, and resolved verifier classification;
- transformation log;
- unresolved issues and next action.

The practitioner identity must name the actor that made the interpretation: normally CASE or a verified human reviewer. Do not attribute practitioner responsibility to a parser, validator, queue worker, or vendor manifest.

When the representation path is `native_format_exception`, also preserve:

- native format and runner;
- concrete Harbor-exception reason;
- whether the limitation is intrinsic or an adapter gap;
- adapter name and version, or the fact that none exists;
- native positive and negative controls and expected results;
- reviewer identity when the exception required human review.

The transformation log should name the source and destination paths, action, rationale, and hashes where meaningful. Record omitted material and why it remains only at source or submission scope.

## History and status

- Register a correction as a new submission linked to what it revises.
- Register changed task bytes as a new task version.
- Never replace an earlier task version or reinterpretation silently.
- Preserve failed or incomplete normalization attempts as ingestion history.
- Use `missing` when evidence was not supplied or could not be obtained. Use `failed` only when a named check actually ran and failed.
- Keep normalization outcomes separate from deterministic checks, heuristic assessments, vendor claims, human recommendations, and final researcher decisions.
- Keep normalized tasks `unchecked` until the required sandbox checks have recorded evidence.

## Clean and runnable milestone

Treat `clean_runnable` as a derived result over the exact immutable task version, never as a manually asserted workflow label. Read [clean-runnable.md](clean-runnable.md) for the gate.

The result must identify the task artifact and hash, normalization outcome, representation path, Harbor or native adapter contract, governing check policy, and every evidence-bearing check run. A task cannot inherit a clean-runnable result from another version, and a changed artifact, adapter, verifier, or check policy requires new evidence.

Normalization completion alone cannot satisfy this milestone. Conversely, expected runtime controls do not retroactively prove that an undocumented transformation was faithful. Preserve both records and their distinct accountable actors.

## Continue CASE task processing with runtime verification

Normalization completion is an intermediate result, not a handoff to researchers. When an exact task version exists and the supported sample-evaluation workflow is in scope, promptly queue or run its runtime checks through CASE's approved controller. Pass the exact immutable artifact, task-version ID, artifact hash, selected Harbor or native adapter, governing requirement snapshot, and requested check policy.

Keep the normalization record and runtime checks separate, but treat both as CASE-owned task processing. Do not execute vendor code in the normalization process, CASE service, or workstation. CASE's approved controller must force Harbor or approved native-adapter runs into a fresh disposable remote sandbox with no production credentials or private-network access.

## Purchased-delivery boundary

CASE is limited to evaluation samples. When purchase is confirmed, retain only the minimal handoff fact needed for audit and duplicate prevention, transfer the full delivery to the downstream pipeline, and remove purchased delivery packages and container bundles from CASE storage according to the approved handoff process.
