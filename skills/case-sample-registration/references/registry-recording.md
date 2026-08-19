# Recording complete sample registration in CASE

Use `$case-registry` and its installed operation schemas. Do not use raw SQL.

## Relationship model

```text
vendor
├── submissions observed over time
└── stable tasks
    └── immutable task versions

source event → source items → submission → task version
artifact ← original payload or snapshot
artifact ← derived runnable task package
task version → checks, trajectories, assessments, and resolution
submission → researcher responses
```

A task version is the exact runnable or inspectable unit associated with one submission. Link it directly to its governing source items, source path, original artifact, and represented task artifact.

For a native-format exception, link the immutable native task artifact and named adapter contract. Do not create a cosmetic Harbor copy.

Object keys remain content-addressed. Keep mutable identity, categories, relations, statuses, and judgments in PostgreSQL.

## Minimum task-version record

Preserve:

- vendor and submission IDs;
- stable or provisional task key and its basis;
- task-version ID and primary category;
- exact source-item IDs and internal source path;
- original artifact ID and hash;
- represented task artifact ID and hash when produced;
- observed format, interpretation outcome, representation path, and confidence;
- interpreting practitioner and guidance version;
- declared, observed, and resolved verifier classification;
- transformation and omission log;
- native runner, adapter, controls, and exception reason when applicable;
- unresolved issues, terminal state, and next action.

The practitioner is CASE or a verified human who made the interpretation. Parsers and validators may be recorded as tools or producers of evidence.

## History and checkpoints

- Register corrections as new submissions linked to what they revise.
- Register changed task bytes or substantive reinterpretations as new task versions.
- Preserve incomplete and failed attempts as registration history.
- Keep `unchecked` until applicable checks record evidence; use accurate partial or blocked states in the meantime.
- Attach checks and trajectories to the exact task version and artifact hash.
- Derive `clean_runnable` from its evidence rather than setting it as an unsupported label.
- Keep interpretation, deterministic checks, vendor claims, assessments, researcher responses, and final decisions as separate record types.

When a complete task artifact exists and execution is authorized, queue or invoke its checks with the task-version ID, artifact hash, adapter, governing requirement snapshot, and check policy. The queue is a recovery mechanism inside registration, not a handoff.

## Purchased-delivery boundary

Once purchase is confirmed, retain the dated handoff fact needed for audit and duplicate prevention, transfer the full delivery to the downstream system, and remove purchased delivery packages and container bundles from CASE storage according to the approved handoff process.
