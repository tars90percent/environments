# Harbor contract for CASE task versions

Use this reference when constructing or statically validating a Harbor representation. Validate against the version pinned by the live CASE controller; public documentation may describe a newer release.

CASE currently pins Harbor `0.21.0`. Documentation checked on 2026-08-18:

- https://www.harborframework.com/docs/tasks
- https://www.harborframework.com/docs/tasks/multi-step

## Harbor-valid and CASE-ready

**Harbor-valid** means the package satisfies the selected Harbor version and environment adapter.

**CASE-ready** additionally requires the provenance and execution evidence applicable to the procurement need. Harbor validity alone does not establish reproducibility, correct controls, usefulness, or research readiness.

A reviewed native-format exception uses its own named adapter contract and equivalent runtime evidence.

## Single-step task

```text
task/
├── instruction.md
├── task.toml
├── environment/
├── solution/
│   └── solve.sh
└── tests/
    └── test.sh
```

Additional task files are allowed. For the ordinary Linux shape:

- `instruction.md` and `task.toml` are required;
- `environment/` follows the selected adapter, such as a Dockerfile, Compose file, or configured image;
- `solution/solve.sh` supports the normal Oracle control, although Harbor itself allows solutions to be absent;
- `tests/test.sh` is the verifier entrypoint; Windows tasks use the corresponding `.bat` entrypoint;
- the verifier writes numeric rewards to `/logs/verifier/reward.json` or `/logs/verifier/reward.txt`.

CASE normally prefers coding environments rebuildable from public, pinned dependencies and a gold solution or task-appropriate golden deliverable. Record these as CASE requirements rather than universal Harbor rules.

## Multi-step task

```text
task/
├── task.toml
├── environment/
├── tests/
└── steps/
    ├── step-one/
    │   ├── instruction.md
    │   ├── workdir/
    │   ├── solution/
    │   └── tests/
    └── step-two/
        ├── instruction.md
        ├── solution/
        └── tests/
```

Declare ordered `[[steps]]` entries in `task.toml`. Steps share filesystem state; conversation-context resumption is a run-level option. Use this shape only when sequential shared-state semantics come from the source task. Root `instruction.md` is not part of the selected multi-step contract when step instructions replace it.

## Manifest and static checks

Preserve vendor-provided fields separately from generated fields. Validate the schema with the pinned CLI. Configuration can include identity metadata, environment resources, OS, build and run timeouts, workdir, network policy, declared environment variables, verifier isolation, solution variables, ordered steps, and reward aggregation.

`${VAR}` declares a runtime input; it does not provide authorization or prove availability. Never place literal secrets in the manifest.

Without executing task code, check:

- required single-step or multi-step paths;
- supported TOML fields and syntax;
- OS-appropriate solution and verifier entrypoints;
- existence of referenced files and build contexts;
- plausible modes, line endings, container paths, and workdirs;
- declared variables without secret values;
- accessible and reproducible images and dependencies;
- verifier output to a Harbor reward file;
- isolated-verifier entrypoints where configured;
- collisions among shared fixtures, step overrides, and artifact paths.

Record build, boot, controls, and behavioral claims as missing until remote execution produces evidence.
