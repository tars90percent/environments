# Harbor task contract for CASE normalization

Read this reference when constructing or statically validating a Harbor task. Validate final output against the Harbor version pinned by CASE; current public documentation can be newer than the production controller.

CASE currently pins Harbor `0.21.0`. The official task documentation checked on 2026-08-18 is:

- https://www.harborframework.com/docs/tasks
- https://www.harborframework.com/docs/tasks/multi-step

## Distinguish two standards

**Harbor-valid** means the package satisfies the selected Harbor version and environment adapter.

**CASE-preferred review shape** adds procurement requirements such as a publicly rebuildable environment, a gold solution or task-appropriate golden deliverable, inspectable tests, provenance, and deterministic evidence. A package can be Harbor-valid without being review-ready for CASE.

Do not report a CASE preference as a universal Harbor requirement.

## Single-step shape

A conventional single-step task is:

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

Additional files are allowed where the task needs them.

Harbor requires `instruction.md` and `task.toml` for the ordinary single-step shape. The environment adapter determines what belongs in `environment/`: Docker Harbor can use a Dockerfile, Docker Compose, or a configured image. CASE nevertheless prefers a Dockerfile rebuildable from public, pinned dependencies for coding-environment samples because cloud portability and reproducibility matter.

Harbor treats the solution as optional, but without `solution/solve.sh` the Oracle agent cannot provide the normal gold sanity check. CASE normally requires a gold solution or task-appropriate golden deliverable before researcher review.

The tests directory must provide the OS-appropriate entrypoint, normally `tests/test.sh` for Linux or `tests/test.bat` for Windows. It may contain arbitrary helpers and fixtures.

The verifier entrypoint must write numeric rewards to `/logs/verifier/reward.json` or `/logs/verifier/reward.txt`. Named reward dimensions are allowed in JSON.

## Multi-step shape

A Harbor multi-step task uses one shared environment and ordered steps:

```text
task/
├── task.toml
├── environment/
├── tests/                  # optional shared helpers or fallback verifier
└── steps/
    ├── step-one/
    │   ├── instruction.md
    │   ├── workdir/        # optional staged files and setup.sh
    │   ├── solution/
    │   └── tests/
    └── step-two/
        ├── instruction.md
        ├── solution/
        └── tests/
```

Declare ordered `[[steps]]` entries in `task.toml`. Steps share filesystem state but do not necessarily share agent conversation context; context resumption is a run-level choice. Use multi-step only when this shared-state, sequential-trial semantics matches the source task.

Do not keep root `instruction.md` merely to resemble the single-step layout when the selected Harbor multi-step contract replaces it with step instructions.

## `task.toml`

Preserve vendor-provided fields and distinguish them from fields you generated. Validate the schema version with the pinned Harbor CLI.

Useful configuration includes:

- task name, version, description, authors, and keywords;
- environment resources, OS, build timeout, workdir, network baseline, and declared environment variables;
- agent and verifier timeouts, users, network overrides, and allowed hosts;
- shared or separate verifier environment;
- solution environment variables;
- ordered multi-step configuration and reward aggregation;
- arbitrary `[metadata]` fields.

Do not place literal secrets in the manifest. `${VAR}` references identify a runtime requirement; they do not supply authorization or prove the variable will be available.

Use `no-network` as the intended baseline when the task can be self-contained. Record any required build, agent, or verifier egress precisely rather than broadening access by convenience.

## Static normalization checks

Without executing vendor code, check:

- required paths for the selected single-step or multi-step contract;
- TOML syntax and fields supported by the pinned Harbor version;
- OS-appropriate solution and verifier entrypoints;
- referenced files and build contexts exist;
- executable modes and line endings are plausible;
- absolute and container paths are internally consistent;
- environment variables are declared without embedded secret values;
- public images and dependencies are pinned or otherwise reproducible enough to review;
- test logic writes a Harbor reward file;
- separate verifier environments include their own verifier entrypoint as required;
- shared fixtures, step overrides, and artifact paths do not collide unexpectedly.

Static validity does not establish that a Docker build succeeds, tests are correct, Oracle rewards `1`, Nop rewards `0`, or the task is useful. Record those as missing until the approved sandbox checks run.
