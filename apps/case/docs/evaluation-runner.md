# CASE evaluation runner

## Decision

CASE itself is the initial evaluation controller. Its Railway image contains pinned Harbor and Modal CLIs, and its `harbor` command submits every run to a disposable Modal sandbox. A second always-on worker service is not required merely to invoke Harbor or retain results.

This does not make the CASE container an execution sandbox. CASE has a normal filesystem and persistent `/data` volume, but it must use them only for immutable inputs, controller state, and downloaded evidence. It has no Docker daemon and must never execute vendor task code locally.

The pinned toolchain is:

- Harbor `0.21.0` with its Modal provider extra;
- Modal CLI `1.5.4`;
- a uv-managed Python 3.12 runtime.

The public `harbor` command is a CASE launcher. For `harbor run`, it adds `--env modal` when omitted, rejects any other environment, assigns a unique per-run Modal App, enforces provider-side hard and idle timeouts, changes into `/data/evaluations`, and starts upstream Harbor with a scrubbed environment. When Harbor exits, the launcher stops the per-run App and verifies that it has no active containers; the run fails if cleanup cannot be verified. CASE database, object-store, Feishu, portal, and registry credentials are never inherited by Harbor. The direct `modal` command remains available for provider diagnostics.

## Modal identity

Create a dedicated Modal environment for CASE evaluations and grant a dedicated service user only the role needed to create and inspect sandboxes in that environment. Store its `MODAL_TOKEN_ID` and `MODAL_TOKEN_SECRET` only as Railway secrets, and set `MODAL_ENVIRONMENT` to the dedicated environment name.

Do not use a personal token in production. Do not put Modal tokens in task packages, registry records, logs, commits, or chat. The Modal identity must not have access to CASE's production database, object store, Feishu identity, or Railway private network.

If an agent or model needs an API key, use one dedicated to evaluation. Common model-provider keys are passed through by the launcher when present. Additional evaluation-only variables can be allowlisted with `CASE_HARBOR_ALLOWED_ENV`. The launcher refuses production credential names even if they are accidentally listed.

## Files and results

Unpack the exact content-addressed task artifact beneath `/data/evaluations/input/<artifact-sha256>`. A typical first run is:

```sh
harbor run -p /data/evaluations/input/<artifact-sha256> -a oracle
```

The launcher supplies `--env modal`. Harbor creates its normal `jobs/` result tree under `/data/evaluations`. That controller-side tree contains the job and trial configuration, results, agent trajectory, verifier output, logs, and collected artifacts downloaded from the sandbox. Treat the Modal filesystem as temporary: evidence is durable only after Harbor downloads it and CASE stores the relevant files as immutable registry artifacts.

For a source archive with known task boundaries, `case-task-package` performs bounded ZIP inspection and extraction and creates deterministic `tar.gz` task packages whose contents begin at the task root. It rejects traversal paths, links, devices, encrypted entries, duplicate paths, and configured size, depth, or compression-ratio violations. A catalog task record with no artifact may be finalized exactly once when its identity fields still match and the new content-addressed package is provenance-linked; an already bound task version remains immutable.

Record the invocation, artifact digest, Harbor version, Modal environment, agent and model versions, start and finish time, and sandbox outcome. A controller crash or missing download is missing evidence, not a failed deterministic check.

## Trust boundaries

- CASE may read and write canonical registry records, unpack an immutable input, invoke Harbor, and retain downloaded evidence.
- Harbor receives only Modal credentials and explicitly approved evaluation-model credentials.
- Vendor code, build scripts, tests, solutions, and agent-generated code execute only inside the disposable Modal sandbox.
- The sandbox receives no CASE admin token, database URL, object-store credential, Feishu login, portal credential, or production private-network access.
- Every sandbox must have a hard wall-clock timeout and be destroyed after the trial, including after build, agent, verifier, or collection failure.
- The CASE launcher defaults the hard lifetime to two hours and idle shutdown to ten minutes. Configure policy values with `CASE_HARBOR_SANDBOX_TIMEOUT_SECS` and `CASE_HARBOR_SANDBOX_IDLE_TIMEOUT_SECS`; values above Modal's 24-hour maximum or an idle timeout longer than the hard lifetime are rejected before a run starts.

## Evaluation sequence

For each immutable task version:

1. Validate the declared package shape without executing task code.
2. Record the exact artifact hash plus the pinned Harbor, agent, model, and harness versions.
3. Build the task environment from the declared public dependencies in Modal.
4. Run the Oracle/gold solution once in a fresh sandbox and retain its reward and log bundle.
5. Run the Nop/untouched baseline once in a different fresh sandbox and retain its reward and log bundle.
6. Run the currently designated target-model and frontier-reference trials with the required repetition count.
7. Collect complete trajectories, rewards, turn counts, timing, resource metadata, stdout/stderr, verifier output, and declared artifacts.
8. Write named deterministic check results and trajectory records through CASE, upload immutable evidence, and mark missing evidence separately from failed checks.

When recording those results, use the structured evidence roles `build`,
`boot`, `positive_control`, and `negative_control`, with
`executionScope: "remote_sandbox"`. Package/schema validation uses the separate
`contract` role. Do not encode these facts in a check name, task format string,
or workflow label; the catalog derives runtime state from the structured roles
on the exact task version.

Use no-network execution as the baseline when the provider and task support it. Grant only the minimum phase-scoped hosts required for dependency installation or model access. A successful process exit, sandbox completion, or image build is evidence for that step only; none is a quality endorsement.

## Checker, worker, queue, and scaling

The **task checker** is the head-to-toe operation for one exact immutable task version. It resolves the applicable check policy, validates the package, invokes the clean build and controls, collects evidence, records named outcomes, and derives the task's current technical state.

A **worker** is only the long-running process around that operation. It leases one task work item, calls the task checker, heartbeats and records the attempt, completes or requeues the item, and then leases another. Multiple worker slots provide bounded task-level parallelism; they must all use the same versioned checker and must not contain separate evaluation logic.

CASE can call the task checker directly for one evaluation. Introduce a separate evaluation-controller service when continuous queue consumption, concurrent work, long-running lease recovery, resource isolation, or deployment independence justifies it. That service runs worker slots around the same checker and Harbor launcher, while task code still executes only in Modal. It is an operational scaling boundary, not a different checking method or sandbox model.

If the durable queue is used, a work item must identify the immutable task version, artifact hash, requested check policy, harness version, and requirement snapshot. Lease one item, heartbeat the lease, append attempt records, and make retries idempotent. Never overwrite a prior trial or evaluation when the task, requirement, model, harness, or sandbox backend changes.

## Acceptance test for Modal

Modal is eligible for purchased-sample evaluation only after a disposable trial proves:

- a public Dockerfile can rebuild from scratch;
- a representative multi-container task works when the current task mix requires it;
- CPU, memory, disk, wall-clock, process, and output limits are enforced;
- default network isolation and explicit allowlists behave as recorded;
- one Oracle trial returns the expected positive reward;
- one Nop trial returns the expected negative reward;
- a deliberately hanging task is killed and its sandbox is destroyed;
- task code cannot reach production CASE services or credentials;
- logs and complete trajectories survive sandbox destruction and are registered against the exact task version.
