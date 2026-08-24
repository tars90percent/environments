# CASE

TARS's always-on Feishu colleague for vendor task-sample operations, powered by
Codex.

CASE owns the canonical sample registry used by its own tools and 小环境.
PostgreSQL holds vendors, original source graphs, dated submissions, parsed
tasks or traces, four Harbor check phases, findings, and operational work.
S3-compatible object storage holds immutable payloads, task artifacts,
and check evidence.

The workflow is deliberately narrow: preserve a submission, identify clear tasks
or traces, label each task `harbor` or `non_harbor`, and run Build, Boot, Oracle,
and Nop only for Harbor tasks.

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
API or admin token. CASE retains a dormant researcher-upload adapter for
compatibility, but 小环境 does not expose it and it is not a current capture path.

The installed `case-registry` command gives CASE and Codex the same operations:

```sh
case-registry operations
case-registry summary
case-registry catalog
case-registry import /absolute/path/submission.json
case-registry import-source /absolute/path/source-envelope.json
case-registry append-tasks /absolute/path/tasks.json
case-registry archive-vendor /absolute/path/vendor-archive.json
case-registry restore-vendor /absolute/path/vendor-restore.json
case-registry lease-work case-checker
case-registry record-harbor-check /absolute/path/harbor-check.json
case-registry record-harbor-finding /absolute/path/harbor-finding.json
case-registry remove-submission /absolute/path/submission-removal.json
case-registry delete-artifact <unreferenced-artifact-id>
case-intake capture-feishu-plan /absolute/path/plan.json
case-mail-intake capture-mail-plan /absolute/path/plan.json
```

Registration preserves an immutable submission checkpoint and queues parsing.
`append-tasks` adds only clearly bounded tasks or traces, each with an exact
artifact, source path, source-item links, task kind, and one of the two format
labels. Non-Harbor tasks stop there.

`case-registry`, `case-intake`, and `case-mail-intake` do not call the registry
HTTP API. The capture commands
place exact payload bytes in CASE's content-addressed object store, then use one
database transaction to register artifact records, source events and items, the
dated submission, and every source link. A capture plan contains the vendor,
submission ID/date/label, attachments, and an optional explicit `harbor` or
`non_harbor` classification. File extensions are never treated as formats, and
categories are not part of capture.

`record-harbor-check` accepts only Build, Boot, Oracle, or Nop pass/fail evidence
for Harbor tasks. Oracle and Nop must include the observed score, which must
agree with the outcome. No phase is inferred from another. A Harbor finding is
immutable and must cite a failed check for the same task.

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
creating task versions, and recording remote execution evidence. Purchased
deliveries move to a downstream pipeline and must not be registered as samples
in CASE. Catalog task totals count only registered task versions;
vendor-declared quantities and raw file counts remain separate.

小环境 is read-only and does not expose submission uploads. New sample
submissions currently enter CASE only through the reviewed Feishu message/file
or Feishu Mail message/attachment capture paths.

Send `/new` as a message, or select the app's native `/new` slash command, to
disconnect that Feishu chat from its current Codex thread. The next ordinary
message starts a fresh Codex session with no prior conversation context. The old
Codex transcript remains on disk but is no longer used by the chat.

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

CASE's complete sample-processing policy lives in the source-controlled root
[`AGENTS.md`](../../AGENTS.md). The registry CLI remains self-describing: run
`case-registry operations` for current command schemas rather than relying on a
separate CASE-specific skill package.

The resulting renewable user login is stored by `lark-cli` under its configured
directory. On Railway, `LARKSUITE_CLI_CONFIG_DIR` points to `/data/lark-cli`, so
the login survives image rebuilds and service restarts. The outer harness only
handles message transport and `/new`; phrases such as `authorize`,
`authorization complete`, and `auth status` are passed directly to Codex.

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

CASE is the initial evaluation controller; a second always-on worker service is
not required. The image includes pinned Harbor and Modal CLIs. Its `harbor`
launcher forces `harbor run` onto Modal, gives Harbor only evaluation-specific
credentials, and keeps downloaded job results under `/data/evaluations` on the
persistent Railway volume. Vendor code executes in a fresh remote sandbox, not
inside the CASE service.

Configure a dedicated Modal service-user token with `MODAL_TOKEN_ID` and
`MODAL_TOKEN_SECRET`, and select its least-privilege Modal environment with
`MODAL_ENVIRONMENT`. The direct `modal` command is available for provider
diagnostics. A normal invocation is:

```sh
harbor run -p /data/evaluations/input/<artifact-sha256> -a oracle
```

The launcher adds `--env modal`; a different execution environment is rejected.
Each invocation also receives a unique CASE-owned Modal App, a two-hour hard
sandbox lifetime, and a ten-minute idle timeout. After Harbor exits, the
launcher stops that App and verifies that it has no active containers. These
provider-side limits remain a cleanup backstop if the controller is killed
before its exit handler can run. Harbor creates its normal `jobs/` result tree
beneath `/data/evaluations`, where CASE can inspect it and register immutable
evidence. A separate controller service remains a future scaling option, not a
prerequisite for remote sandbox execution.

The execution boundary, run sequence, and sandbox acceptance test are in
[`docs/evaluation-runner.md`](docs/evaluation-runner.md).
