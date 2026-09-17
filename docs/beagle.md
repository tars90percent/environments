# Beagle operating reference

Technical details for imports, execution, result recovery, and API access. [Root AGENTS.md](../AGENTS.md) defines the operating policy; the issue board owns current issue status.

The interface and API observations below were checked against the live UI and [deployed frontend](https://beagle.xaminim.com/assets/index-DoKgXykM.js) on 2026-09-17. They describe current client behavior, not an official backend specification or compatibility promise. Read the current issue board and recheck the implementation before relying on mutable interfaces.

## Objects and identities

| Object | Meaning and relationship |
| --- | --- |
| Supplier | Beagle's source grouping, identified by `supplier_id`; map it to the vendor record explicitly. |
| Dataset | One import identified by `dataset_id`, with its source archive/URI, `sample` or `full` label, import state, and current parsed tasks. A CASE submission may map to multiple datasets, including deliberately selected subsets or corrected imports. |
| Task | A parsed runnable unit identified by `task_id`, associated with a dataset. Details include `spec_json`, delivered files, image state/references, and Oracle/Nop run references. A name or current Beagle task ID alone is not durable proof of an immutable CASE version. |
| Evaluation | A batch identified by `evaluation_run_id`, associated with a dataset, harness (`agent`), model, concurrency, and kind (`manual` or `check`). One batch contains individual task runs. |
| Task run | One Beagle execution record identified by `task_run_id`/returned run `id`, linked to its task and evaluation. Preserve status, phase, reward, error, timing, metrics, and `session_id` where present. |
| Native attempt and trial | Files produced by Harbor inside a task run. A Beagle run may have multiple internal attempt directories and trials; resolve the actual result rather than assuming `a0`. These are distinct from a campaign's planned rollout slots and separately submitted retry runs. |
| Model-log session | The `session_id` used for request/response logs and the UI trace viewer. It is not a CASE task version, Beagle run ID, or original Harbor trajectory file. |

## Import, preparation, and execution

Beagle offers two import routes. **Local upload** requests `create-upload-url`, PUTs original archive bytes to the signed object-store URL with its returned media type, then calls `create-import`. The bytes bypass the Beagle web server. **Cluster import** browses `list-eve-volume` / `list-eve-object`, selects an existing file, and supplies its `eve://<storage-type>/<volume>/<path>` source URI; Beagle transfers it through EVE into its object storage. Resolve the URI through the browser or returned metadata instead of treating a mounted JFS path as an interchangeable API value.

Both routes provide `supplier_id`, `dataset_name`, `data_type`, `storage_uri`, `filename`, and `size_bytes`. Retain the returned dataset ID and `reused` indication and reconcile actual contained task roots/counts against the selected CASE versions. A successful upload or reused import does not establish task readiness or a general idempotency guarantee.

The UI exposes dataset states `pending`, `transferring`, `importing`, `building`, `checking`, `valid`, `invalid`, and `failed`; import polling stops at the last three. Do not infer the full backend transition graph from these labels. Inspect per-task format findings, environment image status, verifier image status where applicable, and self-check results. An absent separate verifier image is not by itself a failure.

Import preparation can build images and execute **Oracle** and **Nop** controls. Oracle runs the task's supplied reference solution; Nop evaluates without a solving agent. For ordinary binary tasks the expected contrast is a passing solution and a nonpassing no-op, but use the task's actual scoring definition and recorded control outcome. These checks test execution and verifier behavior; they do not establish benchmark membership, model difficulty, freedom from reward hacking, or procurement acceptance. They consume execution resources and belong in the authorized import budget.

Model evaluation creation currently supplies one dataset, one harness, one model, and integer concurrency 1–32. Concurrency limits simultaneous work; it is not the number of rollouts per task. Discover current harnesses and models with `list-harness` and `list-model`; prior campaigns used `claude-code` and `codex`, but these are not a permanent supported list. The current creation payload exposes neither task-ID selection nor a repetition count. Dataset-level gating can prevent evaluating ready tasks inside a failed dataset. Do not invent targeted-run or repeat-count fields; a deliberate subset import or multiple batches needs explicit mappings and coverage accounting within the agreed scope.

Evaluation states and task-run states differ: batches expose `pending`, `running`, `completed`, `failed`, and `cancelled`, while runs expose `pending`, `running`, `completed`, `error`, and `cancelled`. Run phases include `queued`, `preparing_dataset`, `preparing_image`, `running_harbor`, `collecting`, and `finished`. Use the phase and native evidence to distinguish an environment failure before agent startup from a model attempt or collection failure. Batch completion does not mean every task run completed successfully.

## Authorization and retry semantics

Execution authority and task/model/budget limits are defined in [root AGENTS.md](../AGENTS.md#beagle). This reference does not authorize a campaign.

Before an approved import or evaluation, inspect existing datasets and runs to avoid duplicates; verify the input revision, task population, resource and network requirements, available backend, harness, model configuration, and budget. Preserve delivered network restrictions. Keep unsupported tasks and failed builds in the coverage record with a reason. Distinguish image retries, self-check retries, model retries, and full reimports; they have different effects. Preserve historical task details and mappings before a reimport that may replace them. Record any unresolved version mapping rather than guessing from a task name.

| Operation | Observed effect and operating rule |
| --- | --- |
| `retry-task-image` | Requeues image preparation for a task. Inspect the new image state; the request's success does not prove a build finished or a rollout ran. |
| `retry-dataset-check` | Runs Oracle and Nop again for every valid task in the dataset: approximately two sandbox executions per valid task. The dataset enters `checking` and cannot start model evaluations during that stage. This is not a targeted model retry. |
| `retry-dataset` | Downloads, parses, and builds the dataset again. The UI warns that existing tasks are deleted/replaced and historical evaluation task details can become unavailable. Preserve their files, configuration, and mappings first; do not use reimport as a routine status refresh. |
| `create-evaluation-run` | Creates a new model batch. Record which fixed rollout slots its runs are intended to fill and retain prior attempts. An uncertain response requires checking for an already-created batch before resubmission. |
| `cancel-evaluation-run` | The UI states that it terminates running tasks and retains completed results. Reconcile what actually stopped or completed; cancellation does not remove incurred work or evidence. |

Choose recovery from the failed stage and evidence, with bounded retries. A repeated infrastructure limitation is a blocker to diagnose, not a reason to spend the same budget again. Scope authorization persists across covered operations; it does not authorize changing task bytes, removing network restrictions, or choosing a materially different model/backend without recording the change and agreeing any scope or budget increase.

Keep a durable evaluation manifest linked from the Base: exact task versions and source locations, Beagle dataset/task/evaluation/run IDs, model and harness configuration, resources and timeouts, intended rollout slots, attempts, and original result/trajectory/log references. Capture configuration and artifact identities where available; identify missing evidence explicitly. Keep control runs, vendor traces, historical task versions, and different configurations separate from the selected model rollouts. Append retries as attempts; never erase failures or select attempts by their reward.

## Native results, trajectories, and Argus links

The native run-storage root observed through the development machine is:

```text
/oss/algeng-ali-shanghai-agent-02/minimax-dialogue/data/beagle/run/
  <evaluation-id>/<run-id>/jobs/task-run-<run-id>-a<attempt>/<trial>/
    result.json
    agent/trajectory.json
```

This OSS-mounted output store is separate from the JFS input mirrors. Resolve the actual job/attempt/trial inventory and match task/model metadata, result, and verifier artifacts. Do not choose the first directory, assume attempt zero, or manufacture a randomized trial name. Preserve original rewards and reward keys from the native result and verifier output, plus exceptions and termination details. Keep source run artifacts read-only.

Prefer the original Harbor `agent/trajectory.json` when present. Some Codex runs have original `agent/codex.txt` event logs instead; label them as raw events rather than claiming they are Harbor ATIF trajectories. Beagle's session-log/trace view is supplemental model request/response evidence, and the dataset download returns the input package. Neither is a native rollout export.

For this observed storage root, the Argus link format is `https://argus.xaminim.com/?p=<URL-encoded-absolute-file-path>&c=ALSH`. Retain the underlying path, evaluation/run IDs, selected attempt/trial, format, checksum when copied, and missing-artifact reason in the evidence manifest. Verify target existence and representative viewer access separately; a valid path does not prove a viewer rendered it. Link Run IDs to original files from the Base or its reports.

## Interpretation, coverage, and known limitations

Consult the live [Beagle issue board](https://vrfi1sk8a0.feishu.cn/docx/S6PadrdauovYcbx8O3FcSHsnnIb) for current issues and feature requests before interpreting anomalies or choosing recovery.

Preserve execution status, termination reason, scoring validity, native reward, and artifact completeness separately. A batch marked completed can contain errors; an error in Beagle can coexist with a completed native result. An empty rendered trace does not prove the agent did no work. Inspect the exact run/attempt/trial's native result, reward, trajectory, and logs before concluding or rerunning. Recover existing evidence before spending compute merely to recollect it. Keep the reported platform state and any evidence-based reconciliation visible together.

For fixed-k campaigns, define rollout slots and attempt selection before scoring. For binary tasks, observed `pass@k` is 1 once a selected valid rollout passes, 0 only when all k are valid and none passes, and otherwise unknown. Compute `avg@k` only with k valid numeric rewards. Preserve partial rewards and the task's actual full-credit rule. Normal agent-budget timeout with completed, valid verifier scoring remains scored with a timeout flag; it is not automatically a missing rollout. Missing evidence and infrastructure failure are not zero reward.

Report the selected population, coverage, known passes/failures, unknowns, and exclusions. Compare models on the same complete task/version cohort and configuration basis; do not average only the visible nonblank results and present that as whole-population performance. Publish multi-model results and basic trajectory findings with original artifact links and the method/date in the Base or linked reports. Use native trajectories when available, label fallback logs, and retain storage paths as well as viewer links. A QA result informs researcher acceptance; it does not make the purchase decision.

## Current API access and integration boundary

The deployed client uses JSON `POST https://beagle.xaminim.com/beagle/api/v1/<endpoint>`. Except for `get-login-url`, it attaches `Authorization: Bearer <token>`. Feishu company SSO supplies the token, the frontend checks OAuth state and stores it as `beagle_token` in browser localStorage. This is an observed interactive login mechanism; it does not establish a service-token or unattended renewal contract. Keep actual tokens, signed URLs, and production credentials out of the Base, Git, logs, task packages, and vendor-accessible systems.

Check both HTTP success and the JSON envelope `{status, msg, data}`. The client treats a truthy application `status` as failure and otherwise consumes `data`; HTTP 200 alone is insufficient. On unauthorized responses it clears the session and requires authentication again. Do not repeatedly submit mutations after an authentication or uncertain-response failure.

The table describes fields sent by the current frontend, not exhaustive backend schemas. `?` means the client may omit a field; it does not prove backend optionality. IDs and pagination values are numeric; names, paths, URIs, and harness/model identifiers are strings.

| Endpoints | Observed request and response use |
| --- | --- |
| `get-login-url`, `get-user` | Login takes `state` and returns `authorize_url`; user lookup takes `{}`. |
| `list-supplier`, `create-supplier` | List with `page`, `page_size`, `keyword?` returns `suppliers`, `total`; creation takes `name` and returns `supplier`. |
| `create-upload-url` | `filename` returns `upload_url`, `media_type`, and `storage_uri`; upload is a separate PUT. |
| `list-eve-volume`, `list-eve-object` | Volume lookup takes `{}`; object lookup takes `storage_type`, `volume`, `path`, `cursor?` and returns `objects`, `cursor`. |
| `create-import` | The six import fields above return `dataset` and `reused`. |
| `list-dataset`, `get-dataset` | List takes `page`, `page_size`, `keyword?`, `supplier_id?`, `data_type?`, `statuses?`; detail takes `dataset_id`, returning `dataset` and `validation`. |
| `get-dataset-download-url` | `dataset_id` returns a signed `download_url` for the input package. |
| `list-task`, `get-task`, `get-task-file` | List takes `page`, `page_size`, `keyword?`, `supplier_id?`, `dataset_id?`, `status?`; detail takes `task_id`; file read takes `task_id`, `path` and returns `content`. |
| `list-harness`, `list-model` | `{}` returns `harnesses`, or `models` and `default_model`. |
| `create-evaluation-run` | `dataset_id`, `agent`, `model`, `concurrency` returns `evaluation_run`. |
| `list-evaluation-run`, `list-evaluation-run-creator` | List takes `page`, `page_size`, `dataset_id?`, `statuses?`, `creator_ids?`, `kind`; returns `evaluation_runs`, `total`. Creator lookup takes `{}` and returns `creators`. |
| `get-evaluation-run` | `evaluation_run_id` returns `evaluation_run` and `summary`, including `total`, `pending`, `running`, `completed`, `error`, `cancelled`. |
| `list-task-run` | `page`, `page_size`, plus optional `evaluation_run_id`, `task_id`, `dataset_id`, `task_run_id`, `status`; returns `task_runs`, `total`. |
| `list-model-log` | `session_id`, `page`, `page_size` returns `logs`, `total`. |
| `retry-task-image`, `retry-dataset-check`, `retry-dataset`, `cancel-evaluation-run` | Respectively take `task_id`, `dataset_id`, `dataset_id`, or `evaluation_run_id`; effects are described above. |

Page-based lists start at 1. The current client retrieves a batch's task runs with `page_size: 100` until the reported total is covered; EVE object browsing uses its separate cursor. Use page-based `list-task-run`, not the older `limit`/`last_id` cursor loop. Fetch every relevant page, deduplicate by ID, record the snapshot time, and reconcile totals; concurrent changes can require another read. Evaluation listings default to `kind: manual` in the UI. Use the intended `manual`, `check`, or `all` scope and avoid creator filters that hide relevant attempts.

Beagle's deployed UI/API supports deliberate operations while integration work continues. Before unattended integration, establish supported authentication renewal, schemas, limits, idempotency, stable IDs, and durable task-version/result mapping. A generic CASE file upload does not establish a structured Beagle run relationship; retain the explicit evaluation manifest and link it from the Base until supported cross-system operations provide that association.
