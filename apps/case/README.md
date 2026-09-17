# CASE

TARS's always-on Feishu colleague for vendor task-sample operations, powered by
Codex.

The [SRM Feishu Base](https://vrfi1sk8a0.feishu.cn/base/WqS9bTgadatBNusLu7aciS7wn8f)
owns supplier history, original deliveries, receipt/source metadata, feedback and
procurement. CASE maintains the Harbor task catalog and technical storage used
by the portal and JFS distribution. Beagle is the rollout and evaluation service.

Registered Harbor task files are published under
`<vendor-id>/<submission-id>/<task-name>/` in `harbor-tasks`. The current exporter
also retains technical task packages in the legacy artifacts store. That mixed
store contains historical originals and evidence awaiting verified preservation
and retirement; it is not a destination for new vendor deliveries.

The root [`AGENTS.md`](../../AGENTS.md) is the sole operating policy. Read the
[SRM data boundary](../../docs/srm-data-boundary.md) for ownership and the legacy
retirement gate. The legacy schema and recovery descriptions later in this guide
explain existing records, not permission to capture new originals or timelines.

## Registering Harbor tasks from Base

1. Preserve the original delivery and its metadata on the matching Base event.
2. Use `casectl registry register-harbor-submission <reference.json>` to create
   the technical task grouping. Its input is:

   ```json
   {
     "vendor": {"id": "example-vendor", "name": "Example Vendor", "short": "Example"},
     "submission": {"id": "example-2026-09-17", "date": "2026-09-17", "label": "Harbor samples"},
     "baseRecordId": "recExampleRecord",
     "actor": "CASE"
   }
   ```

   Read the actual Base record first. Use its stable event record ID, not a name.
   Existing vendor descriptions and aliases are preserved. The technical source
   item `base-harbor:<submission-id>:record` points to Base; use it in new tasks'
   `sourceItemIds`. It does not copy correspondence or original attachments.
3. Extract exact delivered task roots locally without executing vendor code.
   Store only task packages with `casectl registry store-file task_package
   <path> --submission <id>`; do not upload a mixed vendor-delivery archive.
4. Register with `append-tasks` or `reconcile-submission-tasks`. Only tasks that
   pass the pinned Harbor static validator are accepted by these commands.
   Invalid tasks and traces stay with their Base delivery. Publication to
   `harbor-tasks` follows the committed task registration and is safely retryable.
5. Keep timeline entries, original files, and evaluation reports in Base.

The installed CLI rejects timeline mutation commands, legacy `capture-submission`,
`import`, `import-source`, source-link reconciliation and Feishu/mail intake.
`store-file` and `register-artifact` accept only `task_package`. The legacy HTTP
upload endpoints return 410 before issuing a signed upload URL or recording data.
Read-only legacy commands remain available for preservation verification. This
boundary does not delete existing records or replace the exporter dependency.

The service currently has a deliberately narrow chat-transport boundary:

- receives direct messages through the configured Feishu app;
- keeps a persistent Codex conversation for each Feishu chat;
- gives every Codex thread the monorepo's source-controlled root guide in `AGENTS.md`;
- passes each message directly to the underlying Codex thread without an
  application-written prompt;
- replies as the app bot;
- ignores duplicate event deliveries;
- includes the official Lark/Feishu Agent Skills so Codex can operate
  `lark-cli` and handle authentication conversationally.

The login makes user-context APIs available to `lark-cli`. The actual Codex tool
permissions remain controlled separately by the container and `CODEX_*`
settings below.

At startup, CASE copies the monorepo's root `AGENTS.md` into `AGENT_WORKSPACE`. This
keeps the persistent Codex workspace current across new and resumed Feishu
threads. Update the source-controlled guide and redeploy CASE to change these
instructions; do not hand-edit the runtime copy.

The guide stays concise and links to detailed references. Its local references
are bundled under `/app/` at their repository-relative paths; read them there
instead of assuming they were copied into the persistent workspace.

## Prerequisites

- Node.js 20 or newer;
- `codex` logged in locally for development, or OpenAI API credentials in deployment;
- `lark-cli` configured with a Feishu self-built app whose bot is enabled;
- the official Lark skills installed locally with `npx skills add larksuite/cli -y -g`;
- the app subscribed to `im.message.receive_v1` with the required IM scopes.

## Run locally

```sh
cd apps/case
npm ci
cp .env.example .env
npm run check
npm run dev
```

Before messaging the local bot, set `ALLOWED_USER_IDS` in the ignored `.env` to
the Feishu `open_id` values allowed to use it. For a production-style local run,
build first and then start the compiled service:

```sh
npm run build
npm start
```

The vendor-archival repository/API integration test creates and drops an isolated schema in a disposable PostgreSQL test database. Run it with `CASE_REGISTRY_TEST_DATABASE_URL=... npm run test:postgres`; never point that variable at the production registry.

Then send the bot a direct message in Feishu. Stop the service with Ctrl-C.

When the registry variables in `.env.example` are configured, the same process
also serves the portal-facing catalog on `PORT`. It runs built-in migrations at
startup. Trusted local CASE commands use the registry library directly with
`DATABASE_URL` and the CASE object-store credentials; there is no internal write
API or admin token. Original-delivery upload routes are retired and return HTTP 410.

The installed `casectl` command groups CASE-owned operations by area:

```sh
casectl registry operations
casectl registry summary
casectl registry catalog
casectl registry benchmarks
casectl registry register-benchmark /absolute/path/benchmark.json
casectl registry remove-unused-benchmarks /absolute/path/benchmark-removal.json
casectl registry purge-erroneous-benchmarks /absolute/path/benchmark-purge.json
casectl registry assign-task-benchmarks /absolute/path/benchmark-assignments.json
casectl registry append-tasks /absolute/path/tasks.json
casectl registry archive-vendor /absolute/path/vendor-archive.json
casectl registry restore-vendor /absolute/path/vendor-restore.json
casectl registry lease-work case-checker
casectl registry record-harbor-attempt /absolute/path/harbor-attempt.json
casectl registry record-harbor-check /absolute/path/harbor-check.json
casectl registry reconcile-harbor-work-items /absolute/path/work-reconciliation.json
casectl registry record-harbor-finding /absolute/path/harbor-finding.json
casectl registry remove-submission /absolute/path/submission-removal.json
casectl registry delete-artifact <unreferenced-artifact-id>
casectl harbor-tasks plan <submission-id>
casectl task-package <command> [arguments]
```

Registration preserves an immutable submission checkpoint and queues parsing.
`append-tasks` adds only clearly bounded tasks or traces, each with an exact
artifact, source path, source-item links, task kind, registered general benchmark
direction, and one of the two format labels. Source-item benchmark assignments
provide a bulk default for every supplied task linked to that item; a task-level
benchmark ID is available for a mixed package. Benchmark versions are not
tracked. Historical task versions are assigned `unspecified` rather than being
inferred from filenames. Before registration, each task submitted with the
`harbor` label is checked with the static task-format validator from CASE's
pinned Harbor installation. The validator reads package structure and
configuration but does not build an image, start an environment, or execute
vendor code. The CLI rejects a registration containing a task that fails this check; preserve
the delivery and failed validation in Base.
Missing artifacts, hash mismatches, unsafe archives, and other provenance or
capture failures still stop the operation instead of changing the format.

When `append-tasks` or `reconcile-submission-tasks` receives a desired set that
contains a Harbor task, it publishes every active Harbor task in that submission
to `harbor-tasks` after the database transaction succeeds. Exact reruns are
idempotent. A publication error makes the command fail without undoing the
canonical registration, so rerunning the same input safely completes or verifies
the mirror. The four `HARBOR_TASKS_S3_*` connection values and optional region
configure this destination independently from the retained technical artifact store.

Benchmark reviews are append-only annotations on an existing task or trace
version. `assign-task-benchmarks` changes the current benchmark without replacing
the task version, so its artifact, source links, Harbor checks, attempts, and
findings remain attached and visible. Task reconciliation ignores benchmark-only
changes and must never be used to manufacture a replacement version for them.

The retired capture implementation did not call the registry HTTP API. It
placed payload bytes in CASE's object store, then used one
database transaction to register artifact records, source events and items, the
dated submission, and every source link. A capture plan contains the vendor,
submission ID/date/label, attachments, and an optional explicit `harbor` or
`non_harbor` classification. File extensions are never treated as formats, and
categories and benchmark directions are not part of capture; benchmark direction
is assigned only when parsed tasks or traces are registered.

`record-harbor-check` accepts only Environment, Oracle, or Nop pass/fail evidence
for Harbor tasks. Environment covers Harbor's clean image construction,
environment startup, and any declared healthcheck. Oracle and Nop must include
the observed score, which must agree with the outcome. A passing historical
Oracle or Nop result supplies an inferred Environment pass because Harbor could
not have produced that score before preparing the environment. Passing latest
historical Build and Boot results also supply an inferred Environment pass;
otherwise, an explicit failure in either latest legacy setup result supplies an
Environment fail even if the other setup result is absent. Setup evidence stays
unset only when it contains no failure and is insufficient to prove both steps
passed. A Harbor finding is immutable and must cite a failed check for the same
task.

`record-harbor-attempt` records a phase that was actually tried but could not
produce a conclusive pass/fail result. Its status is `blocked` or
`inconclusive`, and it requires immutable check evidence plus the command,
versions, and timing. This operational state does not add another check result:
an unset phase with an attempt was tried, while an unset phase without one was
not tried.

`reconcile-harbor-work-items` completes exact queued Harbor-check work after the
corresponding active Harbor task versions have sufficient check or attempt
records. It is an audited, idempotent alternative to FIFO leasing when checks
were performed directly by CASE. It refuses unrelated, unresolved, leased,
failed, duplicate, missing, superseded, and non-Harbor targets.

If CASE created a submission record in error, `remove-submission` can hard-remove
it with the explicit `erroneous_registration` disposition, an actor, and a
reason. The operation preserves a tombstone and any shared sources, artifacts,
task identities, or later submissions; it is not a substitute for recording a
real delivery as failed, incomplete, superseded, or low quality.


Legacy submissions link to exact source items. Original vendor files have the
contextual `original_vendor_file` role, and messages, folders and receipts use
`provenance`. These relationships matter during preservation verification because
a file can participate in several deliveries. Retained legacy metadata must not
be deleted on the basis of catalog counts alone.

The portal is read-only. Register original materials and supplier history in Base,
then register only the Harbor task grouping and packages as described above.

Send `/new` as a message, or select the app's native `/new` slash command, to
disconnect that Feishu chat from its current Codex thread in the active
credential slot. The next ordinary message starts a fresh Codex session with no
prior conversation context in that slot. The other slot's conversation and the
old Codex transcript remain on disk.

CASE supports two independent Codex login directories. Configure
`CASE_CODEX_PRIMARY_HOME` and `CASE_CODEX_BACKUP_HOME`, then list the Feishu
open_ids allowed to administer them in `ADMIN_USER_IDS`. Administrators can use:

```text
/auth status
/auth use primary
/auth use backup
```

The selected slot persists across restarts. Conversation IDs are stored
separately for each slot. Switching is always manual: CASE does not select the
other credential automatically when authentication or a request fails. A switch
is refused unless `codex login status` confirms that the target slot is signed
in. Replies and logs report only slot names and status, never credential data.

## Feishu capabilities and authorization

### Model and reasoning

CASE explicitly selects `gpt-6-astra` with `high` reasoning by default for both
new and resumed conversations, in either credential slot. `CODEX_MODEL` and
`CODEX_REASONING_EFFORT` can override these application defaults. These explicit
SDK options take precedence over each login directory's Codex configuration.

Administrators listed in `ADMIN_USER_IDS` can send ordinary Feishu text messages:

```text
/reasoning
/reasoning high
```

`/reasoning` (or `/reasoning status`) shows the model, current reasoning level,
and valid choices. `/reasoning low`, `/reasoning medium`, `/reasoning high`, and
`/reasoning xhigh` change CASE's reasoning level. These are the levels supported
by both Astra and the pinned SDK's typed thread options; `max` and `ultra` are
not exposed by this command. Invalid values return help without reaching the
model. No Feishu developer-console slash-command registration is needed.

The chosen level is stored in `AGENT_STATE` and overrides
`CODEX_REASONING_EFFORT` across restarts and deployments. It applies to the next
response in every chat and both credential slots. Running responses keep their
existing settings, and subsequent responses resume the same conversation with
the new effort. `/new` resets conversation history without resetting reasoning.

### Feishu access

The deployment image installs the official Lark skill bundle with:

```sh
npx skills add larksuite/cli -y -g
```

The skills teach Codex how to select user or bot identity, operate Feishu
services, diagnose missing scopes, and complete the split device-code login
flow. Authentication is ordinary agent work rather than a special harness
command: ask the agent whether it can access a calendar, document, mailbox, or
other Feishu resource, then follow its explanation.

CASE's operating policy lives in the source-controlled root
[`AGENTS.md`](../../AGENTS.md). The registry namespace remains self-describing: run
`casectl registry operations` for current command schemas rather than relying on a
separate CASE-specific skill package.

The resulting renewable user login is stored by `lark-cli` under its configured
directory. On Railway, `LARKSUITE_CLI_CONFIG_DIR` points to `/data/lark-cli`, so
the login survives image rebuilds and service restarts. The outer harness
handles message transport, `/new`, and admin commands under `/auth` and `/reasoning`;
other authorization language is passed directly to Codex.

The checked-in `.env.example` is safe by default: group chats and broad user
access are disabled. A local ignored `.env` must explicitly set
`ALLOWED_USER_IDS` before the bot accepts pilot users.

## Agent permissions

The inner Codex process is read-only and offline by default. For an isolated
cloud container that should act as the agent's machine, configure:

```env
CODEX_SANDBOX_MODE=danger-full-access
CODEX_NETWORK_ACCESS=true
CODEX_WEB_SEARCH_MODE=live
CODEX_APPROVAL_POLICY=on-request
CODEX_APPROVALS_REVIEWER=auto_review
```

With this profile, Codex does not apply its own filesystem or network sandbox.
The container, its Unix user, mounted volumes, and injected credentials become
the security boundary. Persist important working data under `AGENT_WORKSPACE`
(on Railway, under `/data`); files elsewhere may disappear on redeploy.

`on-request` lets Codex raise approval requests for actions that use the
approval mechanism. `auto_review` has an additional model review those requests
instead of waiting for a person in the Feishu chat. Full-access actions do not
need sandbox-escalation approval, so the Railway container remains the effective
boundary for ordinary commands and file changes.

User authorization alone does not grant the inner Codex process network or
filesystem access. Those permissions must still be enabled deliberately with
the `CODEX_*` variables above.

## Production boundary

Production uses a dedicated Feishu app, a persistent user-context `lark-cli`
profile, Railway PostgreSQL, and Railway object storage. Store credentials only
in Railway secrets. Chat transport, Feishu authorization, Codex permissions,
registry roles, and portal OAuth are independent permission layers.

The image retains the pinned Harbor library for static task-format validation.
Legacy Harbor/Modal execution utilities and historical evaluation documentation
remain for compatibility; they are not authorized execution paths for new
samples. Beagle is the execution boundary for new samples, within the agreed
task/model/budget scope in root `AGENTS.md`.

## Task files and retained legacy storage

`store-file task_package <path> --submission <id>` returns a readable task-file
reference. Hashes are computed and verified internally. `append-tasks` accepts
that reference without a caller-supplied checksum, plus the exact task root and
source-item link to the Base event. Use `unspecified` when a direction is unclear.
Static validation never executes task code. Failed tasks and non-Harbor material
remain in Base. `casectl harbor-tasks publish <submission-id>` completes or
verifies an interrupted publication.

`file-inventory` and legacy source/timeline reads remain available for migration
verification. File relocation operations preserve identities and links, verify
bytes before switching locations, and retain rollback copies. They do not prove
preservation in Base. Do not purge legacy originals or metadata until the
[retirement gate](../../docs/srm-data-boundary.md#existing-data-and-deletion-gate)
is satisfied. Record new deliveries and all timeline activity in Base.

`casectl registry operations` is the current command and input reference.

### Reviewed sample classifications

`casectl registry sample-taxonomy` lists capability definitions and benchmark/version
 groups. Register definitions with `register-sample-taxonomy <taxonomy.json>`;
 use `casectl registry operations` for the complete input contracts.

Use `classify-tasks <classifications.json>` to assign each exact task or trace version
 a capability and, when supported, a benchmark/version group. Keep different known
 distributions separate; use a null group version when a family cannot usefully be
 split by release. Use a null benchmark group when benchmark attribution is not
 established, and the registered `unspecified` capability when the objective is unclear.
 Evidence should retain source declarations, version uncertainty, and whether the
 sample targets a benchmark rather than being a verified benchmark task.

Read the catalog before writing and supply its current classification id (null when
 absent) and original benchmark id as preconditions. Changes are atomic per
 submission, safe to replay, and reject stale reviews. Definitions have stable meaning
 and cannot be silently repurposed. `task-classification-history <task-id>` returns
 prior decisions with their evidence, actor and reason. The catalog's `classification`
 is the reviewed taxonomy; `benchmark` remains the retained source direction for
 compatibility and provenance. Sample files, versions, evaluations and timelines are
 unaffected by classification updates.
