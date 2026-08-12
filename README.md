# env-portal-proto — 小环境 vendor sample registry

A local prototype for preserving vendor RL-environment submissions as an append-only hierarchy: vendor, dated batch, task category, then package evidence.

The interface intentionally does not rank task quality, estimate learning signal, or recommend research decisions. It records package contents and submission-to-submission changes, then keeps the current deterministic intake criteria available as a separate reference.

## Safety boundary

- Feishu is disconnected: there are no Feishu credentials, API calls, webhooks, or connector code.
- Only high-level, workspace-derived submission metadata is represented in the frontend source; vendor payloads are not copied into the app.
- Filters and evidence panels operate in local browser state only.
- No vendor messages are sent and no procurement records are created or updated.
- The prototype is privately deployed through Sites.

## What to inspect

- Browse every vendor represented in the workspace.
- Open dated submission batches without replacing earlier iterations.
- Review task-category composition and observed deltas between submissions.
- Inspect batch format labels and the dedicated deterministic-check reference.
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

The test suite builds the application, checks the server-rendered safety banner and core hierarchy, and rejects network-call patterns in the page source.

## Deliberate omissions

Authentication, persistence, file ingestion, live agent execution, event delivery, and Feishu synchronization are intentionally absent. The displayed metadata is a static workspace snapshot and must not be treated as an evaluation result.
