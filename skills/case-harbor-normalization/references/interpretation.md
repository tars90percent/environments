# Interpretation and normalization judgments

Read this reference when the delivery does not map mechanically to obvious Harbor task roots.

## Inspect files safely

Work from an immutable capture or read-only source and create transformations elsewhere. Inventory paths, file types, sizes, modes, hashes, links, encodings, and archive nesting before reorganizing material.

Use archive tooling that refuses absolute paths, `..` traversal, links escaping the extraction root, device files, implausible decompression, and configured size or nesting-limit violations. Treat encrypted, corrupt, or unsupported archives as blocked until they can be handled without weakening the boundary.

Static parsing may read source text, manifests, documents, and archive entries as data. It must not execute macros, package hooks, notebooks, binaries, build steps, test entrypoints, or code encountered in the delivery.

## Choose authority deliberately

Different files may govern different facts. A vendor manifest may govern task identity while a test script governs actual scoring behavior and a dated message governs what the vendor claimed to have corrected. Do not collapse these into one undifferentiated “latest version.”

When sources conflict:

1. identify the exact conflicting claims or bytes;
2. determine which source is expected to govern that fact;
3. retain both sources and the discrepancy;
4. choose only when the governing evidence supports a choice;
5. otherwise record `needs_review` or request correction.

Do not treat an archive name, folder name, spreadsheet row, or repeated URL as proof of current contents or task identity.

## Decide task boundaries

Evidence that material is one task includes:

- one instruction or coherent objective;
- one initial environment state;
- one solution or golden deliverable;
- one verifier or unified reward contract;
- shared state that is essential rather than incidental;
- ordered stages whose later meaning depends on earlier work.

Evidence that material contains multiple tasks includes:

- independently meaningful instructions;
- independently constructible initial states;
- independent success conditions and rewards;
- separate stable vendor identifiers;
- the ability to run each unit without carrying state from another.

Use a Harbor multi-step task when ordered steps intentionally share one environment and contribute to one trial-level outcome. Do not use multi-step merely to bundle related tasks, group a category, or preserve a vendor folder layout.

If a purported task contains several variants, determine whether they are versions, parameterizations, fixtures, or distinct tasks. Do not decide from filename similarity alone.

## Choose the representation path

Harbor is CASE's default and preferred format for executable tasks. Apply this decision order:

1. retain an already-valid Harbor package;
2. normalize to Harbor when a behavior-preserving mapping is supported by the evidence; or
3. retain a reviewed native-format exception when Harbor cannot faithfully express or execute the task.

The presumption in favor of Harbor is operational, not semantic. Do not convert merely to improve format coverage when conversion would change the objective, initial state, environment behavior, solution, verifier, reward contract, or essential shared state.

A native-format exception requires a concrete reason, such as:

- Harbor lacks a capability essential to the task;
- the native runner provides behavior that a thin adapter cannot preserve;
- conversion would require inventing or repairing material;
- the task is not an executable environment task and a Harbor package would misrepresent it; or
- the required adapter is unavailable and the task must remain preserved pending support.

Record the native format and runner, exception reason, whether the gap is intrinsic or temporary, adapter name and version when available, equivalent positive and negative controls, confidence, and next action. Non-Harbor is an anomaly requiring explanation, not by itself evidence of low quality or incompleteness.

## Preserve stable identity

Prefer a vendor-supplied stable identifier supported by the source. Otherwise derive a provisional key deterministically from the vendor, source identity, and original task path, and record the derivation.

A later delivery is a new version of an existing task only when evidence supports continuity. Similar titles, prompts, or implementations can indicate duplication without proving shared identity. When continuity is unclear, preserve separate provisional tasks and record the possible relationship for review.

Corrections create a new submission and task version. Never rewrite an older version.

## Classify transformations

### Representational transformations

These can usually be applied when their equivalence is inspectable:

- moving or renaming a file to a canonical Harbor path;
- normalizing line endings without changing content;
- restoring an executable bit demonstrated by the source or required invocation;
- expressing unambiguous existing configuration in `task.toml`;
- adding a thin `solve.sh` or `test.sh` wrapper that invokes an existing command unchanged;
- copying required fixtures or helpers into a self-contained task package;
- translating a declared environment format when behavior and dependencies remain explicit.

A thin native execution adapter can also be representational when it invokes the original runner unchanged and does not reinterpret the task or reward contract.

Record the before path, after path, action, reason, and relevant hashes.

### Interpretive transformations

These require an accountable judgment and often human review:

- choosing among multiple candidate instructions, environments, tests, or solutions;
- combining fragments into one instruction;
- determining whether shared files belong in every task or at submission scope;
- converting an implicit workflow into Harbor multi-step structure;
- mapping a custom score to Harbor rewards;
- deciding which vendor identifier is stable.

State the alternatives considered, evidence used, chosen interpretation, confidence, and consequences.

### Reparative transformations

These are not normalization:

- changing task requirements or expected outputs;
- fixing or weakening a grader;
- writing a missing gold solution;
- inventing tests or hidden state;
- replacing inaccessible dependencies with guessed substitutes;
- adding unreported data needed to make the task pass;
- editing a task specifically to force desired Oracle or Nop results.

Preserve the defect and request a vendor correction, or create a separately reviewed repaired version whose derivation and authorship are explicit. Never present it as what the vendor originally delivered.

## Handle noise without losing provenance

Not every delivered file belongs in every normalized task. Pitch decks, screenshots, duplicate exports, unrelated examples, caches, generated build output, and explanatory messages may remain only at submission or source scope.

Before omitting a file from a normalized task, determine whether the environment, solution, tests, instruction, or provenance relies on it. Retain it in the original artifact and record the omission and reason. “Looked irrelevant” is not enough when the file may affect execution.

## Calibrate uncertainty

Use confidence to describe the interpretation, not task quality:

- `high`: direct and mutually consistent evidence supports the mapping;
- `medium`: some inference was necessary, but alternatives are unlikely to change task meaning;
- `low`: reasonable alternatives would materially change task boundaries, behavior, or scoring.

Do not finalize a low-confidence semantic interpretation without review. Do not convert absence of evidence into a negative fact.
