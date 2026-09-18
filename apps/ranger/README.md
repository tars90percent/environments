# RANGER

RANGER is the persistent Feishu colleague on the development machine. It runs the
official DeepSeek Harness through its ACP automation interface as a native systemd user service. Its code
handles transport and durability; DeepSeek Harness composes shell, Python, curl, jq, standard
filesystem tools, lark-cli, and the machine's existing publication programs.
There is no RANGER operations CLI or service-specific tool abstraction.

The root [AGENTS.md](../../AGENTS.md) is the sole source-controlled agent policy.
Read its linked operating references before changing data or submitting work.

## Runtime

```text
Allowed Feishu DM → lark-cli event stream → SQLite inbox
  → persistent DeepSeek Harness conversation → ordinary tools on the dev machine
  → SQLite outbox → Feishu reply

Conversation follow-up JSON → SQLite wakeup → same DeepSeek Harness conversation
systemd restart → saved thread + external-state reconciliation
```

The official `@deepseek-ai/dsh` package is pinned at **0.1.5-rc.2**, the npm
`latest` release verified on 2026-09-18. It is a developer preview; the separate
`alpha` tag is not used. The ACP client is pinned at **1.4.0**, matching upstream.
Lark CLI is **1.0.96** and Node 24 is required. The selected API model is
`deepseek-flash` (DeepSeek-V4.1-Flash), with `high` reasoning and a 16,384-token
per-request output cap. The cap is not a whole-turn or spend limit.

`npm run smoke` checks installed versions and SQLite without credentials. The
integration tests boot the actual upstream harness against a local fixture API,
verify conversation history across separate processes, and cancel an active
model stream. Update the pinned harness and lockfile together after checking the
registry and rerun the integration tests before deployment.

Only allowlisted users in direct messages are accepted. One model turn runs at a
time; new requests queue durably. Each chat resumes its own DeepSeek Harness thread. The
session ID is stored before the first prompt is sent. A restart creates a reconciliation
turn before queued requests: inspect existing transfers/evaluations and recorded
IDs before continuing, because a crash can happen after an external side effect.
This does not guarantee exactly-once execution of external operations.

Replies use stable Feishu idempotency keys and a persistent outbox. Delivery is
retried with bounded backoff; an unavailable reply target can block later replies
and needs operator inspection. Messages received while the event stream is down
are subject to Feishu's replay behavior; the inbox deduplicates received IDs but
is not a substitute for a server-side message archive.

Feishu controls:

- `/status` reports service/model/conversation state without a model call.
- `/stop` aborts the current DeepSeek Harness turn in that chat. External jobs continue until
  explicitly cancelled using the underlying service.
- `/new` starts a fresh conversation after the current turn, cancels pending
  follow-ups, and retains the old transcript. External operations are unchanged.

Text and Markdown messages are normalized by lark-cli. The current message ID is
available in the per-turn context JSON and as `RANGER_MESSAGE_ID`; use normal lark-cli operations to inspect rich
content or retrieve attachments when needed. Tool outputs and reasoning are not
forwarded to chat automatically. Committed assistant text is forwarded. The harness uses its upstream general
tools; RANGER does not implement Beagle/EVE/JFS tool wrappers.

## Operating context

Deployment uses the existing **TARS Unix identity** so JFS ownership and the
installed mirror/archive programs keep their established permissions. RANGER has
its own HOME, DeepSeek API credentials, Feishu profile, database, and workspace under
`/var/lib/ranger`. It does not use the developer's interactive DeepSeek Harness session.

The user service has lingering enabled so it starts at boot and survives logout.
It uses an unprivileged user namespace for its filesystem restrictions.
The systemd unit makes the OS and release read-only, hides the ordinary home,
exposes only the existing mirror/archive configuration and state directories,
and permits writes to RANGER state and TARS JFS staging. Privilege escalation is
disabled. The deployed harness uses `danger-full-access` inside that systemd boundary
because its filesystem policy currently supports only one writable workspace.
Interactive permission requests are denied; escalation is unavailable. For local
development outside the service unit, the default remains `workspace-write`. This is service confinement, not a separate Unix identity: processes
running outside the unit as TARS retain that account's existing access.

- **Beagle:** use its documented HTTP API and source contract in
  [the operating reference](../../docs/beagle.md). SSO/JWT authentication is
  separate from DeepSeek Harness and Feishu. There is no unattended renewal contract yet;
  an expired/missing credential must be reported. Preserve request and result IDs.
- **JFS:** `/jfs-dialogue-alishprod01` is the actual shared mount. Staging is
  `/jfs-dialogue-alishprod01/data/users/TARS`; do not substitute local-disk paths.
  Shared publication is performed through EVE. Native Beagle results under
  `/oss/algeng-ali-shanghai-agent-02/minimax-dialogue/data/beagle/run` are read-only.
- **EVE and publication:** compose ordinary HTTP/filesystem tools and reuse
  `/usr/local/sbin/harbor-tasks-pipeline` and
  `/usr/local/sbin/harbor-task-archives` where appropriate. Read the
  [mirror](../../ops/harbor-mirror/README.md) and
  [archive](../../ops/harbor-archives/README.md) guides. Respect their locks, cron,
  credentials, state, and reconciliation behavior. Do not start duplicate jobs.
- **Feishu records:** use supported lark-cli operations. Bot login provides chat;
  user-context Base/docs access requires a separate user authorization. Store
  that authorization only in RANGER's private CLI profile.

## Durable follow-ups

When asked to monitor or return later, write a small JSON file using ordinary
filesystem tools in `$RANGER_WAKEUP_DIR`. The directory is scoped to the current
conversation generation; `/new` makes older unimported files inactive. Write a
`.tmp` file and atomically rename it to a unique `[A-Za-z0-9_-].json` filename.
Never reuse a filename for a different follow-up.

```json
{
  "runAt": "2026-09-19T02:00:00Z",
  "expiresAt": "2026-09-19T04:00:00Z",
  "prompt": "Inspect the previously recorded EVE transfer ID. Report completion or failure; otherwise schedule one bounded follow-up before the agreed deadline."
}
```

The harness imports the request into SQLite, renames it `.accepted`, and resumes
the same thread when due. It rejects invalid/expired files as `.rejected`.
Queued follow-ups also expire before execution. A follow-up supplies no new
authority: preserve the user's operation, retry, budget and time limits. Record
external IDs and checkpoints in workspace files. Do not re-submit work to obtain
status. Unless periodic updates were requested, report meaningful changes only;
finish unchanged follow-ups with exactly `RANGER_NO_UPDATE` to stay quiet.

## Development and deployment

```sh
cd apps/ranger
npm ci --ignore-scripts
node node_modules/@larksuite/cli/scripts/install.js
npm run check
npm test
npm run build
npm run smoke
```

Use an independent Feishu app/profile. Complete `lark-cli config init --new`, pair
the intended owner in a bounded listener, then set their verified `open_id` in
`ALLOWED_USER_IDS`. Never share CASE's event consumer/app or copy another agent's
credentials. Keep only one consumer of this app active during deployment.

Package a reviewed commit with `scripts/package-release.sh COMMIT /tmp/ranger.tar.gz`.
It includes an explicit source/documentation allowlist, never local deliveries,
secrets or node_modules. Transfer through the verified developer SSH/SFTP path
and verify the complete SHA-256 before extracting to `/opt/ranger/releases/COMMIT`.
Install/build/test there as TARS using the separate Node 24 runtime under
`/opt/ranger/runtime`, then make the release root-owned, readable/executable by TARS, and unwritable to TARS.

Copy `.env.example` to `/var/lib/ranger/service/ranger.env` (TARS, mode 0600), filling the
allowlist and absolute immutable `RANGER_SOURCE_ROOT`. Put `DEEPSEEK_API_KEY` in
`/var/lib/ranger/service/secrets.env` (TARS, mode 0600), separate from the source and ordinary
configuration. Keep the enclosing directory mode 0700. Only the intended service
receives that environment file.

Create `/var/lib/ranger/workspace`, `dsh`, `lark-cli` and `conversations` owned by
TARS with mode 0700. Transfer only the new Feishu app's config/secret profile into
its private configuration directory. Symlink the two existing Harbor configuration
and state directories into the isolated HOME so existing program defaults still
resolve to the established paths; the unit exposes their actual targets. Install the official Lark skills matching
the CLI tag under `/var/lib/ranger/.agents/skills`; do not copy developer SSH keys.

Verify authenticated access to `https://api.deepseek.com/models`, then run a
bounded DeepSeek turn under the service's actual systemd restrictions before
reporting the agent ready. This deployment does not use OpenAI services or a
ChatGPT login. The existing CASE agent is unchanged.

Install `deploy/ranger.service` into `~/.config/systemd/user`, run
`systemd-analyze --user verify`, and enable own-user lingering with
`loginctl enable-linger TARS`. Atomically point `/opt/ranger/current` at the release,
then `systemctl --user daemon-reload` and `systemctl --user enable --now ranger`.
The dev machine denies root systemctl operations; use its supported user manager. Do not touch
CASE's Railway deployment or the existing mirror/archive schedules.

Check `systemctl --user status ranger`, the private `health.json`, and an actual Feishu
round trip. Test an orderly restart and verify the saved thread resumes. A green
systemd service or `/status` response only establishes the harness is alive;
model access, Feishu user authorization, and Beagle credentials are separate checks.

Operator tools are standard: `journalctl --user -u ranger`, `systemctl --user restart ranger`,
authenticated DeepSeek API probes and read-only SQLite inspection. Journals contain lifecycle
metadata, not message bodies or credentials; transcripts and state are private.
Back up the database using SQLite's backup API while running, plus workspace,
DeepSeek Harness home and Feishu profile to an access-controlled destination. Never copy just
the SQLite main file while WAL writes are active. Rollback stops the service,
repoints `current` and `RANGER_SOURCE_ROOT` to a compatible prior release, and
restarts; preserve state and transcripts. Back up before any future schema change.
