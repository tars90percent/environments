# Harbor submission archive publisher

This publishes one ZIP per CASE submission containing its registered Harbor task
versions. It reuses the gateway's `submission-archives-v1/` cache namespace in
Railway's `harbor-task-archives` bucket. It does **not** mirror vendor-wide or
benchmark-wide ZIPs from that mixed cache bucket, and does not import, validate,
or evaluate anything in Beagle.

CASE's original artifacts remain canonical. Railway `harbor-tasks` and the raw
JFS mirror remain unchanged. Only the following dedicated archive locations are
managed:

```text
/jfs-dialogue-alishprod01/data/users/TARS/harbor-task-archives/
/jfs-dialogue-alishprod01/alignment_data_forge/rl_tasks/harbor-task-archives/
    index.json
    <vendor>/<submission>/<full-revision-sha256>.zip
```

The index lists the current revision of every Harbor submission, explicitly
marking unavailable revisions `pending`. A new submission or changed task version
gets a new archive revision. Unchanged content reuses its verified archive;
classification, timeline and evaluation notes do not cause repackaging. Retired
versions stay on disk for reproducibility; no automated archive deletion occurs.
The gateway's ZIP contains task directories at its root and a provenance and
integrity manifest. Beagle ingestion compatibility has not been established by
an actual import; submission there still requires the user's explicit approval.

## Installation

Requires Python 3.9+, JFS, the existing completed raw mirror, and the existing EVE
credentials. No new Python packages, daemon, Railway service or bucket are needed.
Install the committed program as root-owned `/usr/local/sbin/harbor-task-archives`
with mode 0755. Keep runtime credentials out of this repository:

`/home/TARS/.config/harbor-task-archives/config.json`, mode 0600:

```json
{
  "case_url": "https://feishu-codex-agent-production.up.railway.app",
  "case_token": "<existing read-only CASE catalog token>",
  "gateway_url": "https://harbor-task-gateway-production.up.railway.app",
  "gateway_token": "<existing gateway token>"
}
```

EVE credentials are reused in place from
`/home/TARS/.config/harbor-tasks-mirror/eve.json`. Secrets are not passed on the
command line or copied into JFS archives. The publisher ignores signed URLs and
uses the authenticated, resumable gateway download endpoint.
Catalog/API reads negotiate gzip compression; the full CASE catalog is large
and uncompressed transfers from Railway to the dev machine are slow.

To avoid downloading large ZIPs over the external network, install an isolated
Node 24 runtime at `/usr/local/lib/harbor-task-archives/runtime/`, and this
directory's `rebuild.mjs`, `package.json`, `package-lock.json`, and production
`node_modules` alongside it. Verify the official Node download SHA-256 and use
`npm ci --ignore-scripts --omit=dev` with the committed lockfile. Keep this prefix
root-owned; do not replace the machine's system Node installation.

The optional builder reads just the cached ZIP's manifest through HTTP ranges,
checks its expected checksum and exact task identities, then recreates the ZIP
from the already completed raw JFS mirror using the gateway's pinned ZIP writer.
Every source file is hashed during compression. The resulting ZIP is accepted
only if its full SHA-256 is identical to the Railway cache receipt. A different
compression encoding falls back to the verified gateway download; that fallback
is remembered for the current runtime, helper, lockfile, and archive checksum.
Source mismatches remain pending. The normal independent ZIP/member/raw checks
still run before publication. No delivered code is executed.

Keep the existing raw-mirror cron and executable intact. Add a separate TARS cron
entry, offset from the raw mirror's minute 17 schedule:

```cron
27 * * * * /usr/bin/timeout -k 30s 45m /usr/local/sbin/harbor-task-archives --seconds 2100 --retry-failed >> /home/TARS/.local/state/harbor-task-archives/publisher.log 2>&1
```

Create the private state directory before installing cron. The program acquires
its own nonblocking flock; concurrent invocations skip safely. It acquires the
raw mirror's lock for local builds and readiness/integrity checks, and never writes raw task
files. The run budget leaves time before the next raw-mirror schedule. The outer
timeout bounds stalled I/O as well. A stopped run retains recoverable progress.

## Verification and recovery

```sh
harbor-task-archives --plan
harbor-task-archives --submission <exact-submission-id> --seconds 2100
harbor-task-archives --status
harbor-task-archives --seconds 2100 --retry-failed
harbor-task-archives --audit --seconds 3300
```

`--plan` reads the supported CASE catalog without building or copying archives.
Select pilot submissions with repeated `--submission` arguments; all other
submissions remain explicit pending index entries. An ordinary unfiltered run
reconciles the full current catalog. Gateway retries are limited to once per
revision per invocation; deterministic integrity failures stay pending.

The publisher verifies the archive's checksum, ZIP member bytes, original modes,
manifest, exact task versions, and raw staging JFS inventory. It never extracts
or executes delivered code. Per-revision verification receipts are stored under
`/home/TARS/.local/state/harbor-task-archives/verified/`.

EVE copies only new current archives and a candidate index from a unique `.outbox`
generation to a shared `.incoming` generation. A trusted, content-addressed copy
of this program checks SHA-256 again in shared JFS, renames archives into place,
and commits `index.json` last. A base-index checksum prevents an old helper from
overwriting a newer publication. Repeating promotion after a crash is safe.
Tiny plans/receipts remain for diagnostics; transferred ZIP bytes are moved into
their final paths and completed local outbox hard links are removed.

`active.json` persists the EVE operation before submission. An uncertain copy POST
is reconciled against EVE's task listing by its unique source/destination paths;
it is never blindly duplicated. A lost promotion POST may be retried because the
helper is locked, idempotent and generation-guarded. Known transfer failures and
helper failures have at most three retries. A process restart resumes the saved
operation before starting another publication. Small partial downloads resume
with validated byte ranges. Archives larger than 32 MiB use eight concurrent
16 MiB ranges; complete pieces receive local checksum receipts before reuse.
Each interrupted range retains its sequentially written prefix, bound to its
offsets and expected archive checksum, and retries at most four times per run.
Assembly writes a contiguous file in order and checks the expected full-ZIP
SHA-256 before promotion. Interrupted or sparse file lengths are never treated
as evidence that all bytes arrived.

For an uncertain transfer with zero or multiple matching tasks, inspect EVE using
the recorded operation identity and resolve it before retrying. Do not delete
`active.json` to skip verification. `status.json`, `eve-progress.json`,
`last-success.json`, `last-error.json`, and `last-audit.json` provide local health
evidence; `last-error.json` retains historical failures and must be interpreted
alongside the success timestamps. No extra notification system is installed.

`--audit` re-hashes every current ZIP in both JFS locations. Normal unchanged runs
reuse saved local size/mtime verification and do not rescan all archive bytes.
Initial rollout must finish with an audit and a no-op run.

## Deployment and rollback

Gateway changes deploy only from the GitHub-connected main branch after CI. The
publisher itself is installed on TARS from a reviewed, committed version, with a
backup of any existing executable and crontab. To pause publication, remove only
the marked archive cron entry; the existing raw mirror continues independently.
Restore the previous executable if needed. Retain active operation state and
archive generations when rolling back. No registry or original delivery is
changed by this program.

Run tests locally with:

```sh
python3 -m unittest discover -s ops/harbor-archives -p 'test_*.py' -v
npm test --prefix apps/harbor-task-gateway
npm ci --ignore-scripts --prefix ops/harbor-archives
npm test --prefix ops/harbor-archives
```
