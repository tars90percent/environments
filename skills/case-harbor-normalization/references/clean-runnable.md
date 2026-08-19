# Clean and runnable task milestone

Read this reference when deciding or reporting whether an exact task version is clean and runnable. Runtime verification is part of CASE's task parsing and cleaning work. It follows normalization as soon as an exact task version is available; it is not a later researcher-owned job. This milestone prepares material for researcher inspection but is not a quality endorsement or approval for training.

## Decision rule

Treat `clean_runnable` as a derived result, never a manually asserted label:

```text
clean_runnable =
  faithful_task
  AND immutable_version
  AND complete_execution_contract
  AND (
    harbor_contract_pass
    OR reviewed_native_exception_contract_pass
  )
  AND clean_build_and_boot_pass
  AND positive_control_repeat_pass
  AND negative_control_repeat_pass
  AND no_hidden_dependencies
  AND complete_evidence
```

Every term must be supported by a named, versioned check or an identified practitioner record. A missing, blocked, stale, or superseded result does not satisfy the gate.

Routine model trials are not part of this gate. Do not require a target-model or frontier-reference trajectory, pass rate, or turn count to call a task clean and runnable. A declared model-based verifier still runs when required by the reward contract for the Oracle or negative controls; that is verifier execution, not an agent model trial. CASE may optionally use DeepSeek to investigate a bounded question, but that diagnostic evidence remains separate and does not satisfy or replace any term above.

## CASE execution resources

The current CASE image exposes `harbor` and `case-harbor` as the supported Harbor controller commands. The wrapper forces task execution onto Modal and filters out production credentials; do not bypass it by invoking the upstream Harbor binary named by `CASE_HARBOR_BIN`. The `modal` CLI is available for authentication checks and provider diagnostics. Verify the live CLI versions, `MODAL_TOKEN_ID`, `MODAL_TOKEN_SECRET`, Modal authentication, and wrapper configuration without printing credential values. If the controller is unavailable or invalid, record the check as blocked instead of executing task code locally.

In CASE's Railway deployment, `DEEPSEEK_API_KEY` is the designated credential name for optional diagnostic model runs; verify its presence before use. If CASE chooses to use it, state the diagnostic question and retain the exact model, harness, commands, outputs, and trajectory separately. Never expose the credential value or make the diagnostic a prerequisite for this milestone.

## Common procedure

### 1. Fix the exact version

Identify the task-version ID, immutable artifact, content hash, source items, original source path, representation path, and execution adapter. Run every check against those exact bytes. A later correction or changed package is a new task version and requires new evidence.

### 2. Confirm static coherence

Without executing task code, confirm that the instruction, initial state, environment, solution or positive control, verifier, and reward contract describe the same task. Required fixtures and referenced paths must exist. Record ambiguity, contradiction, missing material, private data, and any repair separately; do not change the task to obtain passing runtime results.

### 3. Validate the selected contract

For Harbor, validate against CASE's pinned Harbor version and selected environment adapter. For a native-format exception, validate against the named and versioned native runner or thin adapter contract and retain the reviewed exception reason.

The execution contract must declare:

- environment build or provisioning and startup;
- agent input, workdir, and output interface;
- solution or equivalent positive control;
- verifier entrypoint and expected result;
- untouched, blank, or other meaningful negative control;
- required files, environment variables, network access, credentials by variable name, resources, and timeouts.

### 4. Build and boot cleanly

Use the exact artifact in a fresh disposable remote sandbox. For coding environments, rebuild without cache from public, accessible dependencies. Remove production credentials and private-network access; allow only declared phase-scoped egress. Confirm the complete environment starts and reaches its required ready state within the recorded timeout. An image build alone is insufficient when services fail to boot.

For a native exception that does not use an image, perform the equivalent clean provisioning and launch through its declared adapter. All external requirements must be declared and reproducibly available.

### 5. Run the positive control twice

Create a fresh environment for each run. Execute the gold solution or native equivalent, then the effective verifier. Both runs must complete without timeout or infrastructure error and return the declared positive result. For the ordinary Harbor binary-reward contract, require rewards `[1, 1]`.

Two runs are CASE's minimum clean-runnable consistency check. A dated procurement requirement may require more repetitions for later review readiness.

### 6. Run the negative control twice

Create a new fresh environment for each run with no state carried from the positive trials. Execute the untouched/Nop, blank, or other declared negative baseline. Both runs must complete normally and return the declared negative result. For the ordinary Harbor binary-reward contract, require rewards `[0, 0]`.

The negative control must be meaningful for the task. If untouched state is expected to succeed, define and justify another baseline that should fail; do not force a Nop convention that contradicts the task.

### 7. Confirm hermeticity

The build, task, solution, and verifier must not depend on workstation files, production credentials, undeclared variables, inaccessible private images or data, state from another trial, or undeclared network access. A declared model- or service-based verifier may use dedicated evaluation credentials and minimal egress when its contract records those requirements.

### 8. Retain complete evidence

Record at least:

- task-version ID, artifact ID, and content hash;
- normalization outcome, representation path, and Harbor or native adapter version;
- exact commands and configuration;
- build, boot, solution, and verifier logs;
- every control result and reward artifact;
- sandbox provider, environment metadata, resource limits, timing, and timeouts;
- runner identity and tool versions;
- evidence artifact IDs and check-run IDs.

Destroy each sandbox after evidence collection, including on timeout or error.

## Result semantics

Use `pass` only when every applicable term in the decision rule has current evidence for the same immutable task version.

- Use `missing` when evidence was not supplied or a check did not run.
- Use `blocked` when a concrete access, adapter, infrastructure, or safety condition prevented the check.
- Use `fail` when a named check ran and produced a failing result.
- Invalidate or supersede the derived result when the task artifact, adapter, verifier, check policy, or governing contract changes.

`clean_runnable` does not establish difficulty, novelty, realism, usefulness, grader alignment beyond the recorded controls, licensing, privacy clearance, purchase approval, or readiness for a training run. Researchers make the final review and purchasing decision from this evidence and any separately recorded assessments.
