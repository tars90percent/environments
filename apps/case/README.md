# CASE

TARS's always-on Feishu colleague for vendor task-sample operations, powered by
Codex.

CASE owns the canonical sample registry used by its own tools and the portal.
PostgreSQL holds vendors, original source graphs, dated submissions, parsed
tasks or traces, their general benchmark directions, three Harbor check phases,
non-conclusive check attempts, findings, and operational work.
S3-compatible object storage holds immutable payloads, task artifacts,
and check evidence.

Registered Harbor tasks are also copied, after their canonical registry
transaction commits, into the separate `harbor-tasks` distribution bucket as
individual files under `<vendor-id>/<submission-id>/<task-name>/`. This mirror
contains no archives, stable-key directory, or generated wrapper; the canonical
CASE artifact remains the source of truth.

CASE provides operations to preserve submissions, identify clear tasks or traces,
assign general benchmark directions, label task formats, and distribute Harbor
tasks. Humans and CASE choose how to use those operations as the process evolves. New evaluation belongs
to AutoQA; CASE does not run Environment, Oracle, or Nop checks. Historical
results remain attached to their exact task versions.

This README describes the CASE application and its runtime. The monorepo's root
[`AGENTS.md`](../../AGENTS.md) is the sole authoritative operating policy for
submission capture, parsing, classification, Harbor checks, and findings.

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
API or admin token. CASE retains a researcher-upload adapter for compatibility; the portal does
not expose it.

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
casectl registry capture-submission /absolute/path/capture.json
casectl registry store-file source_payload /absolute/path/original.pdf
casectl registry import /absolute/path/submission.json
casectl registry import-source /absolute/path/source-envelope.json
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
casectl intake feishu /absolute/path/plan.json
casectl intake mail /absolute/path/plan.json
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
vendor code. A task that fails this check remains in the registration with the
same identity and provenance, but its format is changed to `non_harbor`.
Missing artifacts, hash mismatches, unsafe archives, and other provenance or
capture failures still stop the operation instead of changing the format.

When `append-tasks` or `reconcile-submission-tasks` receives a desired set that
contains a Harbor task, it publishes every active Harbor task in that submission
to `harbor-tasks` after the database transaction succeeds. Exact reruns are
idempotent. A publication error makes the command fail without undoing the
canonical registration, so rerunning the same input safely completes or verifies
the mirror. The four `HARBOR_TASKS_S3_*` connection values and optional region
configure this destination independently from CASE's canonical artifact store.

Benchmark reviews are append-only annotations on an existing task or trace
version. `assign-task-benchmarks` changes the current benchmark without replacing
the task version, so its artifact, source links, Harbor checks, attempts, and
findings remain attached and visible. Task reconciliation ignores benchmark-only
changes and must never be used to manufacture a replacement version for them.

`casectl registry` and `casectl intake` do not call the registry HTTP API. The
capture commands place exact payload bytes in CASE's object store, then use one
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


The intake commands accept only plans that explicitly declare
`"purpose": "sample_evaluation"`. They capture exact Feishu message resources or Feishu Mail
attachments through CASE's renewable user login, store immutable bytes in the
registry bucket, and register visible `unchecked` submission checkpoints. CASE
then continues the registration by interpreting the preserved material,
creating task versions, and publishing Harbor tasks. Purchased
deliveries move to a downstream pipeline and must not be registered as samples
in CASE. Catalog task totals count only registered task versions;
vendor-declared quantities and raw file counts remain separate.

Each submission links to the exact source items that belong to it. Downloadable
vendor files use the contextual `original_vendor_file` link role; messages,
folders, URLs, receipts, and other arrival evidence use `provenance`. The role
lives on the submission-to-source-item relationship because one immutable
artifact can participate in different provenance contexts. Use the audited
`casectl registry reconcile-submission-source-items` operation to repair legacy
links without changing source records or stored object bytes.

The portal is read-only and does not expose submission uploads. CASE can capture Feishu message/file and Mail attachments directly, or register
other deliveries through `store-file`, `capture-submission`, and `import-source`.
These operations preserve arbitrary file formats and external links; CASE decides
which tools to use to inspect them.

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
handles message transport, `/new`, and the exact admin commands under `/auth`;
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
samples. AutoQA is the execution boundary, once its supported endpoint exists.

## Files and arbitrary deliveries

Use `casectl registry store-file <kind> <path>` for any local file, including an
untouched PDF, spreadsheet, archive, task package, trace, or other payload. It
returns a readable reference such as
`vendor-a/2026-09-07-september-samples/Sample index.pdf`, the original filename
and file metadata. Pass `--submission <existing-id>` to use its delivery details,
or `--context <file.json>` with `vendorId`, `date`, and `label` when capturing a
new delivery. Without context, files go under `unassigned/<date>-unfiled/`.
Name collisions receive ` (2)`, ` (3)`, and so on; files are never overwritten.
Checksums are computed and verified internally. Old identifiers and `file-N`
aliases remain usable. Add `--raw` to inspect retained identifiers and integrity
details.

For historical filing, save the output of `plan-file-filing --raw`, review its
`entries`, and add `actor` and `reason`. Run `migrate-file-locations <plan.json>`
with that same saved plan when resuming an interruption. It copies each original
object, verifies its complete bytes, then changes the central location and
readable reference. All vendor, submission, task, and source links survive.
Shared task packages use their first documented submission; correspondence uses
its actual evidence date. The plan is editable when provenance calls for a
different location. `file-inventory` and `file-moves` expose the record.

Old copies remain available for rollback for at least 24 hours.
`rollback-file-move <request.json>` accepts `moveId`, `actor`, and `reason` and
verifies the old copy before switching back. After review,
`prune-old-file-copies` verifies the current object again before removing an old
copy whose retention period has passed. Historical aliases remain accepted.
`merge-task-identities` can consolidate two identities for an exact repeated
package while preserving both submissions, task versions and original keys.
`correct-task-format` applies an audited correction only when it agrees with
the pinned static validator, then updates the Harbor distribution mirror.

`casectl registry capture-submission <capture.json>` registers a delivery before
parsing. It accepts existing source references or inline source graphs and has
no file-format restriction. A link-only delivery is a valid submission even
when access is blocked or no task boundaries have been identified. Example:

```json
{
  "purpose": "sample_evaluation",
  "vendor": { "id": "vendor-a", "name": "Vendor A", "short": "A", "description": "Vendor record" },
  "submission": { "id": "vendor-a-september-samples", "date": "2026-09-07", "label": "September samples", "sourceLabel": "Vendor email" },
  "sources": [{
    "sourceEvent": { "id": "september-email", "channel": "email", "externalRef": "mail://original-message", "sender": "Vendor contact", "receivedAt": "2026-09-07T08:00:00Z" },
    "items": [
      { "id": "sample-index", "kind": "pdf", "displayName": "Sample index.pdf", "artifactId": "vendor-a/2026-09-07-september-samples/Sample index.pdf", "fetchStatus": "snapshotted", "parseStatus": "not_requested", "mutable": false },
      { "id": "sample-folder", "kind": "folder", "displayName": "Linked sample folder", "locator": "https://drive.google.com/drive/folders/example", "fetchStatus": "external_only", "parseStatus": "not_requested", "mutable": true }
    ],
    "relations": [{ "fromItemId": "sample-index", "toItemId": "sample-folder", "relation": "links_to" }]
  }],
  "actor": "CASE"
}
```

After inspecting more material, use `import-source` to add source items and
relationships to the same arrival event, or preserve a new arrival as another
event. Previously recorded items and relationships remain intact. Use the
submission's exact source-item links to distinguish original vendor files from
supporting provenance.

When tasks or traces are clearly bounded, `append-tasks` accepts their file
references without `contentSha256`. The registry resolves file identity and
integrity itself. Source paths, kinds, benchmark directions, and source links
are still explicit. Use `unspecified` for an unclear direction. Harbor tasks
must pass the pinned static validator; successful registration publishes their
exact files to `harbor-tasks`. `casectl harbor-tasks publish <submission-id>` can
complete or verify that mirror after an interrupted publication. The archive
helper inspects/extracts/packages files without producing redundant hashes.

Record or update the vendor's sample-delivery timeline entry with
`record-vendor-interaction` / `update-vendor-interaction`, citing the submission
and supporting source events. CASE decides the narrative and next steps; capture
does not invent a timeline narrative or impose a procurement sequence.

`casectl registry operations` is the current command and input reference.
