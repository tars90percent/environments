# Task interpretation and faithful representation

Use this reference when task boundaries, identity, authoritative sources, transformations, or execution semantics require judgment.

## Inspect safely

Work from immutable captures or read-only sources. Inventory paths, file types, sizes, modes, hashes, links, encodings, and archive nesting before reorganizing material.

Extract archives with traversal, escaping-link, device-file, size, nesting, and decompression limits. Treat encrypted, corrupt, unsupported, or unsafe archives as blocked until they can be handled within those limits. Static inspection may parse text, manifests, and archive entries but may not execute macros, package hooks, notebooks, binaries, build steps, tests, or scripts.

## Determine authority

Different records can govern different facts: a manifest may identify the task, a test may define scoring behavior, and a dated message may define the vendor's correction claim. When they conflict:

1. identify the exact conflicting claims or bytes;
2. decide which source governs that fact;
3. retain the sources and discrepancy;
4. choose only when the governing evidence supports the choice;
5. otherwise record `needs_review` or request a correction.

## Determine task boundaries

Evidence for one task includes one coherent objective, initial state, solution or golden deliverable, reward contract, and essential shared state. Ordered stages belong to one multi-step task when later work genuinely depends on earlier state and contributes to one trial-level outcome.

Evidence for multiple tasks includes independently meaningful instructions, constructible initial states, success conditions, stable identifiers, and the ability to run each unit independently. Folder structure and filename similarity are clues rather than authority.

For variants, distinguish task versions, parameterizations, fixtures, and genuinely separate tasks.

## Preserve task identity

Prefer a stable vendor identifier supported by the source. Otherwise derive a provisional key deterministically from vendor, source identity, and original task path, and record the derivation.

Treat a later delivery as a version of an earlier task only when evidence supports continuity. Similar tasks can be duplicates without sharing identity. Corrections create new submissions and task versions with explicit revision relations.

## Choose the representation

Use `already_harbor`, `normalized_to_harbor`, or `native_format_exception` according to the primary skill. Preserve the objective, initial state, environment behavior, solution, verifier, reward contract, and essential shared state.

Classify each material transformation:

- **Representational:** path or filename normalization, evidenced permission repair, explicit configuration of existing behavior, thin wrappers around unchanged commands, copying required fixtures, or equivalent environment translation.
- **Interpretive:** selecting among conflicting instructions or graders, combining fragments, deciding shared scope, expressing an implicit multi-step workflow, mapping custom rewards, or choosing stable identity.
- **Reparative:** changing requirements or expected output, modifying a grader, inventing a gold solution or tests, substituting inaccessible dependencies, supplying unreported data, or editing specifically to force desired controls.

Record representational and interpretive changes with source and destination paths, action, rationale, hashes when meaningful, alternatives considered, confidence, and consequences. A reparative change requires a separately identified derived version and authorship or a vendor correction.

Files omitted from the runnable task remain in the source artifact. Record omissions when their relevance could reasonably affect execution or interpretation.

## Classify the verifier

Record three fields when available:

- `declared`: what the manifest or vendor says;
- `observed`: what static inspection of the effective verifier shows;
- `resolved`: the classification CASE uses for execution planning.

Use `deterministic`, `llm_judge`, `agent_based`, `hybrid`, or `unresolved`. Also record whether the verifier requires a model or network, provider and model identifiers, credential variable names without values, evidence paths, conflicts, and classifier version.

Static classification describes the apparent contract. Sandbox evidence establishes actual behavior.

## Interpretation outcomes

- `already_harbor`: delivered package satisfies the selected Harbor contract.
- `normalized`: faithful Harbor or native representation produced.
- `needs_review`: reasonable alternatives would materially change meaning.
- `incomplete`: a task is identifiable but required material is absent.
- `blocked`: access, corruption, safety, adapter, or infrastructure prevents progress.
- `not_a_task`: preserved material does not define an evaluation task.

These outcomes are task-version facts within registration. Runtime results and usefulness assessments remain separate evidence.
