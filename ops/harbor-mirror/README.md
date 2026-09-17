# Harbor raw-file mirror

This directory is the source for the TARS development machine's hourly
Railway → JFS staging → shared JFS pipeline. It is an operations program run
by cron on that machine. It is not deployed as a Railway service or run inside
CASE. Keeping its source in this repository allows review, testing and
controlled installation on the machine that has the required access.

The three programs were retrieved from the installed machine on 2026-09-17
without changing their bytes. [source-snapshot.json](source-snapshot.json)
records that initial snapshot's paths and SHA-256 checksums. Configuration,
credentials, checkpoints, logs and vendor files stay outside Git. This source
capture does not establish current synchronization health.

## Pipeline and trigger

```text
CASE publishes registered Harbor files
  → Railway harbor-tasks bucket
      ← hourly pull initiated by the development machine's cron
  → /jfs-dialogue-alishprod01/data/users/TARS/harbor-tasks/
      → controller submits and waits for EVE when reconciliation is needed
  → /jfs-dialogue-alishprod01/alignment_data_forge/rl_tasks/harbor-tasks/
```

Both destinations are on mounted JFS, not the machine's local disk. The
development machine can write TARS staging and read the shared destination;
EVE supplies the authorized write operation into shared storage. Argus is a
browser view of storage. No file watcher, Railway push notification or separate
EVE cron triggers this raw pipeline.

The installed TARS crontab, read on 2026-09-17, contains:

```cron
17 * * * * /usr/bin/flock -n /home/TARS/.local/state/harbor-tasks-mirror/run.lock /usr/local/sbin/harbor-tasks-pipeline >> /home/TARS/.local/state/harbor-tasks-mirror/mirror.log 2>&1
```

This is a one-shot command, not a continuously running daemon. The nonblocking
lock skips an overlapping invocation. There is no overall controller deadline;
a pending EVE operation can keep it waiting across scheduled hours. The separate
[submission ZIP publisher](../harbor-archives/README.md) has its own cron at
minute 27 and takes this same raw lock while checking and building its inputs.
Its ZIPs come from TARS raw staging. Railway's `harbor-task-archives` download
cache is independent of both JFS jobs.

| Source file | Installed program | Role |
| --- | --- | --- |
| `harbor-tasks-pipeline` | `/usr/local/sbin/harbor-tasks-pipeline` | Python controller: staging, saved EVE operations, reconciliation and final verification. |
| `harbor-tasks-mirror` | `/usr/local/sbin/harbor-tasks-mirror` | Bash/rclone puller: discover task roots and copy individual Railway objects into staging. |
| `harbor-eve-retire.py` | `/usr/local/libexec/harbor-eve-retire.py` | Trusted Python helper executed through EVE to preserve destination-only files outside the shared mirror. |

## How each run decides what to do

1. **Resume first.** If `eve-active.json` exists, the controller resumes that
   generation before allowing another Railway pull. The caller holds the raw
   lock throughout the operation.
2. **Discover and stage.** Otherwise, the puller lists vendor, submission and
   task prefixes from Railway. It queues new task roots and checkpointed roots
   missing a local `task.toml`. Four workers copy task payloads with rclone,
   excluding that marker; each downloads and atomically publishes `task.toml`
   only after its payload succeeds. Retired roots move into recovery storage.
   Failed copying leaves the prior checkpoint and staging success timestamp
   unchanged. An empty discovery is refused, not interpreted as deleting all
   tasks.
3. **Decide whether EVE is needed.** The controller validates the staging
   checkpoint and inventories both JFS trees. If the source inventory digest
   matches the last success and the destination has matching paths and sizes,
   it records success without an EVE request. An unchanged source with only
   destination extras needs retirement alone. Otherwise it submits an EVE copy.
4. **Transfer and reconcile.** EVE uses `cover`, with `delete_src: false`.
   The controller waits for success, rejects reported failed files and checks
   that staging stayed unchanged. Destination-only files are moved by the
   trusted helper into a sibling recovery tree; vendor code is never executed.
5. **Verify and record.** Success requires the expected source inventory and
   matching destination relative paths and sizes. Only then are the end-to-end
   success record and run history written and active state removed.

Consequently, **no newly pulled files does not always mean no EVE work**. A saved
operation, first publication, missing shared file or destination-only file can
still require work. A fully reconciled, unchanged run makes no EVE API calls.

### Verification limits

The puller is incremental by **task root**, not a complete rescan of each task's
contents. An already checkpointed root with `task.toml` is not downloaded again;
changes or missing payload files inside it are not automatically discovered by
the hourly pull. Do not describe this as a continuous byte-for-byte mirror.

Queued tasks use rclone `--size-only`. The controller's source digest hashes
relative paths, sizes and nanosecond modification times, not file contents.
Shared verification compares paths and sizes, not content hashes or permissions.
A completion marker and success timestamp are therefore not checksum evidence.
The ZIP publisher separately verifies source bytes and modes against the trusted
gateway manifest. Investigate a mismatch through the supported source and
recovery operations; do not repair vendor material merely to pass validation.

## Runtime and private configuration

The installed programs target the existing Linux development machine and its
fixed paths. Requirements are Bash 4+, GNU utilities (including `flock`, `xargs`
and `date`), `/usr/bin/rclone`, Python 3.9+ standard library, the mounted JFS
volume, and authorized Railway/EVE network access. EVE's execution environment
must also provide Python 3.9+. Changing hosts or roots requires reviewing all
three programs together.

Keep these existing files private; do not copy their values into Git, logs or
command-line arguments:

| File | Contents |
| --- | --- |
| `/home/TARS/.config/harbor-tasks-mirror/railway.env` | Trusted shell environment configuring rclone's `harbor:` S3 remote and `RCLONE_S3_BUCKET`. The puller sources it and forces `RCLONE_CONFIG=/dev/null`. |
| `/home/TARS/.config/harbor-tasks-mirror/eve.json` | JSON with `access_key` and `secret_key`, used for EVE HTTP Basic authentication. Mode 0600; the controller rejects group/other access. |

Use TARS ownership, private parent directories and mode 0600 for both files.
The shell environment is executable configuration and must never come from
vendor material. Even a no-op controller run loads EVE configuration locally.
The API base is `https://transfer.xaminim.com/api/v1`; the helper execution region
is `ali-shanghai-prod-01` and the volume is `jfs-dialogue-alishprod01`.

## Status and recovery

State lives under `/home/TARS/.local/state/harbor-tasks-mirror/`:

| Evidence | Meaning |
| --- | --- |
| `current-tasks.list`, `last-success` | Successfully staged task roots and the most recent completed Railway pull. |
| `eve-active.json` | Persisted generation, phase, operation payload, task ID when known, and retry count. Its presence blocks new staging. |
| `eve-progress.json` | Last observed EVE status and file/byte counters. |
| `eve-last-success.json`, `eve-runs/` | Verified end-to-end inventory, task IDs and successful generation history. |
| `eve-last-error.json`, `eve-verification-difference.json` | Failure evidence; compare with later successes before reporting an ongoing failure. |
| `mirror.log`, `run.lock` | Cron output and concurrency lock. The lock file's existence alone does not mean it is held. |

Inspect the live crontab, process/lock, active operation and success timestamps
before claiming availability. A staging success is insufficient to establish
shared publication. Preserve error evidence and recovery copies:

- Staging replacements and retired tasks:
  `/jfs-dialogue-alishprod01/data/users/TARS/.harbor-tasks-mirror-history/`.
- Shared destination-only files:
  `/jfs-dialogue-alishprod01/alignment_data_forge/rl_tasks/.harbor-tasks-mirror-history/<generation>/retired/`.
- Trusted helper copies used by EVE:
  `/jfs-dialogue-alishprod01/data/users/TARS/.harbor-tasks-pipeline/`.

The controller persists each operation before submitting it. A lost transfer
response is reconciled through EVE's `/transfers/v2` listing by source,
destination and time window; exactly one match is required. Zero or multiple
matches stop for inspection. An uncertain `/fs/execute` submission also stops
for inspection. Never blindly resubmit or delete active state to bypass this.
Known `Failed`/`Timeout` transfers retry the same task ID at most three times;
retirement operations are not automatically retried after failure.

For an authorized manual reconciliation, invoke the controller as TARS with the
same lock used by cron:

```sh
/usr/bin/flock -n /home/TARS/.local/state/harbor-tasks-mirror/run.lock \
  /usr/local/sbin/harbor-tasks-pipeline
```

Do not invoke the staging-only puller while a saved EVE operation might still
use that source, even when the local lock is free. If an incident needs manual
repair, inspect the recorded EVE task first, preserve recovery evidence and hold
the raw lock for the whole intervention. Do not hand-edit managed task contents.

## Installation and rollback

GitHub CI tests this source; it does not deploy it to TARS. Install only a reviewed,
committed version during an authorized development-machine rollout. CASE bundles
this guide for reference, but does not receive these executable programs or
their credentials.

1. Verify the TARS SSH session using the local `tars-dev-machine-ssh` skill.
   Transfer the three source files to a private staging directory and verify
   their SHA-256 checksums against the reviewed checkout.
2. Acquire `/home/TARS/.local/state/harbor-tasks-mirror/run.lock` exclusively and
   hold it through backup and installation. Under that lock, check that
   `eve-active.json` is absent. If it exists, finish or investigate the saved
   operation before replacing programs. A free local lock alone is insufficient.
3. Back up all three installed programs, their checksums and the current TARS
   crontab into a private rollout directory. Record the source commit. Do not
   replace credential files, state, recovery trees or JFS content.
4. Install the three files at the paths in the table above, owned by root with
   mode 0755. Install temporary sibling files and rename them while the lock
   remains held; verify all installed checksums before releasing it. The
   retirement helper is launched with `python3` and has no executable shebang.
5. Preserve the existing cron entry; do not add a duplicate schedule or a new
   native EVE schedule. Observe an authorized run through its end-to-end success
   record. Inspect the related ZIP publisher separately if verifying archives.

A source import alone requires no reinstall. For rollback, apply the same lock
and active-operation checks, restore the backed-up program set and verify its
checksums. Preserve all state and published data, and verify that the restored
version can interpret saved state before allowing it to run.

## Tests

```sh
bash -n ops/harbor-mirror/harbor-tasks-mirror
python3 -m unittest discover -s ops/harbor-mirror/tests -p 'test_*.py' -v
```

Tests use synthetic temporary trees, a fake rclone and a fake EVE client. They
exercise completion markers, checkpoint preservation, retired-file recovery,
no-op decisions, interrupted submissions, bounded retries and verification
failures without accessing production services. Bash tests require Linux/GNU
utilities and are skipped on macOS; the CI workflow runs the full suite on Linux.
