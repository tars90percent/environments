---
name: case-registry
description: Query and update CASE's canonical RL environment vendor, submission, task, check, trajectory, and follow-up registry.
---

# CASE registry

Use the `case-registry` command for canonical RL-environment procurement data. The registry, not the Feishu conversation, is the source of truth for vendor samples and their evaluation history.

## Read operations

```sh
case-registry operations
case-registry vendors
case-registry vendor <vendor-id>
case-registry batch <batch-id>
case-registry task <task-version-id>
case-registry catalog
```

Use these before answering questions about what was received, which version changed, deterministic checks, and whether a task is visible to researchers.

## Writes

Write through validated JSON documents:

```sh
case-registry import /absolute/path/submission.json
case-registry record-check /absolute/path/check-result.json
case-registry record-follow-up /absolute/path/follow-up.json
case-registry register-artifact /absolute/path/artifact.json
case-registry set-status /absolute/path/status.json
case-registry lease-work <worker-id>
case-registry complete-work /absolute/path/completion.json
```

Never replace an existing submission batch. A corrected vendor delivery is a new batch linked through `revisesBatchId`. Keep deterministic check evidence separate from heuristic review and human research judgment. Do not expose service tokens or direct database credentials in replies.
