# env-portal-proto — RL environment evidence registry

A local prototype for documenting deterministic checks on RL environment and task packages.

The interface intentionally does not rank task quality, estimate learning signal, or recommend research decisions. It records package contents, clean builds, container-local execution, reward baselines, rollout coverage, declared evaluation settings, and Harbor compatibility or mappings.

## Safety boundary

- Feishu is disconnected: there are no Feishu credentials, API calls, webhooks, or connector code.
- All sample packages, checks, and runs are synthetic and live in the frontend source.
- Filters and evidence panels operate in local browser state only.
- No vendor messages are sent and no procurement records are created or updated.
- The prototype has not been deployed or published.

## What to inspect

- Filter tasks by package format or check exceptions.
- Select a task to inspect its files, check outputs, and rollout manifests.
- Review cohort-level deterministic check counts.
- Compare Harbor-native, mapped, and source-format packages.
- Read the exact criteria and interpretation boundary.

## Run locally

```bash
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Verify

```bash
npm test
npm run lint
```

The test suite builds the application, checks the server-rendered safety banner and core UI, and rejects network-call patterns in the page source.

## Deliberate omissions

Authentication, persistence, file ingestion, live agent execution, event delivery, and Feishu synchronization are intentionally absent. The displayed evidence is not connected to vendor deliveries and must not be treated as an actual evaluation result.
