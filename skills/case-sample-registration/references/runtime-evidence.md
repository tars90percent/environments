# Runtime evidence and clean-runnable status

Use this reference for remote execution checks and for deriving `clean_runnable` for one exact immutable task version.

## Decision rule

```text
clean_runnable =
  faithful_task
  AND immutable_version
  AND complete_execution_contract
  AND (harbor_contract_pass OR reviewed_native_exception_contract_pass)
  AND clean_build_and_boot_pass
  AND positive_control_pass
  AND negative_control_pass
  AND no_hidden_dependencies
  AND complete_evidence
```

Every term requires a named, versioned check or an identified interpretation record for the same task artifact. Missing, blocked, stale, or superseded evidence does not satisfy the rule.

Routine target-model trials are not part of this technical property unless the current governing requirement explicitly redefines it. A model-based verifier used by a control is verifier execution, not a target-agent trial.

## Controller boundary

The CASE image exposes `harbor` and `case-harbor`. The wrapper forces execution onto Modal and filters production credentials. Do not bypass it by invoking the upstream binary named by `CASE_HARBOR_BIN`.

Before a run, verify the live CLI versions, wrapper configuration, Modal authentication, and the presence of required credential variables without printing their values. If the controller is unavailable, record the check as blocked; do not run the task locally.

`DEEPSEEK_API_KEY` is available in the current Railway design for optional bounded diagnostics. A diagnostic must name its question and retain its model, harness, commands, outputs, and trajectory separately. It neither replaces nor satisfies deterministic evidence.

## Procedure

1. **Fix the version.** Identify the task-version ID, artifact ID and hash, sources, representation path, adapter, and governing check policy.
2. **Confirm static coherence.** Ensure the instruction, initial state, environment, solution or positive control, verifier, and reward contract describe the same task.
3. **Validate the contract.** Use the pinned Harbor contract or the named, versioned native adapter contract.
4. **Build and boot cleanly.** Use a fresh disposable remote sandbox and the exact artifact. Rebuild coding environments without cache from accessible declared dependencies, start all required services, and record readiness and timeouts.
5. **Run the positive control.** Use a fresh sandbox. The current CASE baseline is one successful Oracle/gold trial; for an ordinary binary Harbor task the expected reward is `1`.
6. **Run the negative control.** Use a different fresh sandbox. The current CASE baseline is one expected-negative Nop/untouched trial; for an ordinary binary Harbor task the expected reward is `0`. If untouched state should succeed, define an evidence-backed alternative negative baseline.
7. **Confirm hermeticity.** Exclude workstation files, production credentials, undeclared variables, inaccessible private assets, prior-trial state, and undeclared network access.
8. **Retain evidence and destroy the sandbox.** Do this after success, timeout, and error.

The execution contract must identify provisioning and startup, agent input and output, workdir, positive and negative controls, verifier and expected result, required files, resource limits, timeouts, variables, credential names, and operation-scoped network requirements.

Current procurement requirements may add trials or stricter conditions. Repeat a control only when a dated requirement calls for repetition or when investigating suspected nondeterminism; preserve the reason and every result. Preserve the governing source and apply it in addition to this technical baseline.

## Evidence record

Retain:

- task-version ID, artifact ID, and hash;
- interpretation outcome, representation path, and adapter version;
- controller, Harbor, harness, model, and runner versions as applicable;
- exact commands and configuration;
- build, boot, solution, verifier, and infrastructure logs;
- every reward artifact, timeout, and control result;
- sandbox provider, environment metadata, resources, timing, and network policy;
- complete trajectories for required model trials;
- evidence artifact IDs and check-run IDs.

## Result semantics

- `pass`: every applicable term ran and passed for the same version.
- `missing`: required evidence was not supplied or the check did not run.
- `blocked`: an identified access, adapter, infrastructure, or safety condition prevented execution.
- `fail`: a named check ran and failed.

Supersede the derived result when the task artifact, adapter, verifier, controller, or governing check policy changes.

`clean_runnable` is a technical property. Difficulty, novelty, usefulness, licensing, privacy clearance, and purchase or upstream approval require their own evidence and decisions.
