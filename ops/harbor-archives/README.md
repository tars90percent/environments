# Harbor submission archive publisher

This builds submission ZIPs on the TARS development machine from the completed
raw JFS mirror. CASE supplies the exact task selection; the gateway supplies a
trusted file manifest. The Railway `harbor-task-archives` bucket serves portal
downloads independently. The publisher does not read or write that ZIP cache,
and does not import or evaluate anything in Beagle.

## Data flow and identity

1. CASE publishes registered Harbor files into Railway `harbor-tasks`, including
   file hashes, original modes, and immutable source artifact identities.
2. The raw mirror stages those individual files under
   `/jfs-dialogue-alishprod01/data/users/TARS/harbor-tasks/`, then EVE publishes
   them under `/jfs-dialogue-alishprod01/alignment_data_forge/rl_tasks/harbor-tasks/`.
3. The publisher reads CASE's supported catalog and asks the authenticated gateway
   `POST /submission-manifest` for the exact task versions in each submission.
   The gateway scans source listings and conditional HEAD metadata, checks the
   artifact identities, and checks that the inventory remains stable. It reads
   no task bodies and generates no ZIP. HTTP 202 means poll; HTTP 409 means the
   scan failed. HTTP 200 carries the exact manifest string and its SHA-256.
4. Under the raw mirror's lock, the local builder hashes raw staging files and
   creates a ZIP64 archive with task directories at its root plus `manifest.json`.
   The publisher independently verifies the manifest, every member's bytes and
   mode, and the complete raw task inventory. No delivered code is executed.
5. The ZIP's own checksum defines its immutable path. EVE copies it to shared
   JFS; a trusted helper verifies the transferred checksum and commits the
   shared index only after all referenced archives are present.

The development machine controls the process. These are mounted JFS locations,
not storage on the development machine's local disk:

```text
/jfs-dialogue-alishprod01/data/users/TARS/harbor-task-archives/
/jfs-dialogue-alishprod01/alignment_data_forge/rl_tasks/harbor-task-archives/
    index.json
    <vendor>/<submission>/<selection-revision>/<archive-sha256>.zip
```

The selection revision hashes exact CASE task versions and source artifact
identities. The manifest checksum binds the expected files. The ZIP checksum
identifies the packaged bytes; a different compression encoding can be valid
when its members match the same manifest. EVE must preserve the chosen ZIP's
bytes exactly. Classification, timeline, and evaluation notes do not change the
selection revision.

Read the exact path from `index.json`. Its entries expose status, revision,
task count, and, when ready, path, ZIP checksum, size, and manifest checksum.
Previously published `<revision>.zip` paths and their verification receipts
remain supported. Unchanged archives are reused; there is no automatic deletion
or forced repackaging. An explicitly rebuilt archive can become current while
its predecessor and receipt remain available. A failed rebuild retains the
previous verified archive in the index and records the failure in private status.
CASE's retained original deliveries remain source evidence.

## Development machine and JFS locations

The remote TARS development machine (`dev-alsh-dialogue-TARS-cpu`, reached through JumpServer) controls the transfer and archive jobs. It is separate from the maintainer's laptop and Beagle's execution workers. The four paths below are on mounted JFS, not the machine's local disk. TARS writes staging; EVE publishes into the shared locations. Argus provides a browser view of those files.

| Content | TARS staging | Shared publication |
| --- | --- | --- |
| Raw task files | `/jfs-dialogue-alishprod01/data/users/TARS/harbor-tasks/` | `/jfs-dialogue-alishprod01/alignment_data_forge/rl_tasks/harbor-tasks/` |
| Submission ZIPs | `/jfs-dialogue-alishprod01/data/users/TARS/harbor-task-archives/` | `/jfs-dialogue-alishprod01/alignment_data_forge/rl_tasks/harbor-task-archives/` |

Read the actual submission path from the Base and the ZIP path from the shared `index.json`; vendor display names are not storage identifiers. Shared-JFS publication and Beagle's later EVE-based cluster import are separate operations.

The [raw mirror guide](../harbor-mirror/README.md) documents the Railway pull,
staging completion markers, EVE reconciliation, cron, and verification limits.
Its source lives in `ops/harbor-mirror/`; it runs on the development machine.
A staging success alone does not establish shared availability.

## Installed jobs and health evidence

The archive publisher runs at minute 27 of each hour. Its schedule is independent
of the raw pipeline; publication is not guaranteed to finish between cron ticks.
The publisher has its own lock and also acquires the raw lock while verifying
and building. Inspect the live crontab and state before reporting current health.

| Stage | Program on the development machine | Evidence under `/home/TARS/.local/state/` |
| --- | --- | --- |
| Submission ZIP publication | `/usr/local/sbin/harbor-task-archives` and `/usr/local/lib/harbor-task-archives/build.mjs` | `harbor-task-archives/status.json`, `active.json`, `last-success.json`, `last-audit.json`, `publisher.log`, retained manifests, and verification receipts. |

Use `harbor-task-archives --plan` to inspect the catalog selection and `--status` for saved publisher state. `--submission <exact-id>` limits reconciliation; `--rebuild` additionally requires explicit submission selections and preserves prior archives and receipts. `--audit` re-hashes current ZIPs in both JFS locations. An ordinary unchanged run can reuse size/mtime verification; its success is not a fresh full checksum audit. Read historical errors alongside later successes.

Check the expected submission/revision in the shared index and the relevant inventory, receipt, and success/audit timestamp before reporting availability. Preserve active operations on failure. Do not run staging-only synchronization while a saved EVE transfer may still be using that source, clear active state to bypass reconciliation, hand-edit managed indexes, or treat a temporary `.builds/` file as a completed archive. Failed rebuilds retain the previously verified archive. Programs and credentials are local to the controller; the existence of a mounted path or an SSH connection does not grant write authority over shared publication.

Raw-controller recovery is documented in the [raw mirror guide](../harbor-mirror/README.md).
SSH access is described by the local `tars-dev-machine-ssh` skill; do not assume
that skill or SSH credentials are available inside CASE.

## Installation

Requires Python 3.9+, JFS, the existing completed raw mirror, and EVE credentials.
Install committed `publisher.py` as root-owned
`/usr/local/sbin/harbor-task-archives`, mode 0755. Keep credentials private:
`/home/TARS/.config/harbor-task-archives/config.json`, mode 0600:

```json
{
  "case_url": "https://feishu-codex-agent-production.up.railway.app",
  "case_token": "<existing read-only CASE catalog token>",
  "gateway_url": "https://harbor-task-gateway-production.up.railway.app",
  "gateway_token": "<existing gateway token>"
}
```

EVE credentials remain in
`/home/TARS/.config/harbor-tasks-mirror/eve.json`. Never pass secrets on the command
line or put them in archives. Catalog and manifest reads negotiate gzip.

Install an isolated Node 24 runtime at
`/usr/local/lib/harbor-task-archives/runtime/`, with this directory's `build.mjs`,
`package.json`, `package-lock.json`, and production `node_modules` alongside it.
Verify the official Node download SHA-256 and install dependencies with
`npm ci --ignore-scripts --omit=dev`. Keep this prefix root-owned and preserve the
system Node installation. The builder is required. Missing or inconsistent raw
files leave publication pending. Small files are read ahead in batches of at
most 16 files and 32 MiB; larger files are streamed individually.

Keep the existing raw-mirror cron and executable intact. The archive cron is:

```cron
27 * * * * /usr/bin/timeout -k 30s 45m /usr/local/sbin/harbor-task-archives --seconds 2100 --retry-failed >> /home/TARS/.local/state/harbor-task-archives/publisher.log 2>&1
```

Create the private state directory first. Nonblocking locks prevent concurrent
archive runs and protect raw readiness/build verification. The run budget and
outer timeout bound work. Verified manifests and completed archives survive a
restart. Interrupted local ZIP builds are rebuilt on the next run; `.builds/`
files are never evidence of a completed archive. Normal handled failures remove
their temporary ZIP; after a hard kill, inspect any orphan only while the
publisher lock is free before removing that temporary file.

## Verification and recovery

```sh
harbor-task-archives --plan
harbor-task-archives --submission <exact-submission-id> --seconds 2100
harbor-task-archives --submission <exact-submission-id> --rebuild --seconds 2100
harbor-task-archives --status
harbor-task-archives --seconds 2100 --retry-failed
harbor-task-archives --audit --seconds 3300
```

`--plan` reads the CASE catalog without building or copying. Repeat `--submission`
to select pilots. Unselected verified archives remain available; unselected
missing archives are pending. An unfiltered run reconciles the current catalog.
`--rebuild` requires explicit submission selections and preserves previous
receipts in `verified-history/`. Gateway retries are limited to once per revision
per invocation. Integrity failures remain pending; they never trigger a download
fallback. Task files, modes, or manifests must not be repaired to make them pass.

State under `/home/TARS/.local/state/harbor-task-archives/` includes `manifests/`,
`manifest-receipts/`, and per-selection `verified/` receipts. Manifests retained
for a selection revision must not silently change. Normal unchanged runs reuse
size/mtime verification; `--audit` re-hashes every current ZIP in both JFS locations.
Finish a rollout with an audit and a no-op reconciliation.

EVE copies new current archives and a candidate index from a unique `.outbox`
generation to shared `.incoming`. A content-addressed copy of this trusted
publisher verifies SHA-256, exclusively links each archive into its final path,
and commits `index.json` last. A conflicting existing archive is never overwritten.
The base-index checksum prevents an older helper replacing a newer index.
Promotion is locked and idempotent, including recovery after partial publication.
Tiny plans and receipts remain; completed outbox hard links are removed.

`active.json` records an EVE operation before submission. An uncertain copy POST
is reconciled through EVE's task listing by unique source/destination paths;
it is never blindly duplicated. A lost promotion response can be retried because
the helper is idempotent. Known copy/helper failures have at most three retries.
Restart resumes the saved operation before preparing another publication.
For zero or multiple matches to an uncertain copy, inspect the recorded operation
before retrying. Never clear active state to bypass verification.

`status.json`, `eve-progress.json`, `last-success.json`, `last-error.json`, and
`last-audit.json` provide health evidence. Historical errors must be read alongside
later success timestamps. Storage readiness does not establish Beagle import
compatibility or evaluation success; follow the agreed scope in root `AGENTS.md`.

## Deployment

Gateway changes deploy through GitHub CI/CD. Install the publisher and builder
on TARS from a reviewed, committed version, backing up installed programs and
crontab first. Finish any active publication before replacing them. To pause,
remove only the archive cron entry. Preserve the raw pipeline, state, receipts,
and published generations. A rollback must retain support for all paths already
recorded in the index; do not install a reader that assumes revision-only paths.

```sh
python3 -m unittest discover -s ops/harbor-archives -p 'test_*.py' -v
npm test --prefix apps/harbor-task-gateway
npm ci --ignore-scripts --prefix ops/harbor-archives
npm test --prefix ops/harbor-archives
```
