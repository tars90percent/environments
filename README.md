# env-portal-proto — 小环境 vendor sample registry

A read-only researcher catalog for vendor RL-environment submissions. 小环境
loads its vendor, dated batch, task category, task-version, status, and check
records from CASE's canonical registry.

The interface intentionally does not rank task quality, estimate learning signal, or recommend research decisions. It records package contents and submission-to-submission changes, then keeps the current deterministic intake criteria available as a separate reference.

## Safety boundary

- Feishu is disconnected: there are no Feishu credentials, writes, webhooks, or connector code.
- No vendor snapshot data or source payloads are copied into the frontend.
- The Sites worker uses a read-only catalog credential and proxies only `GET /v1/catalog`.
- No vendor messages are sent and no procurement records are created or updated.
- If CASE is unavailable, the portal shows no cached substitute and says so explicitly.

## What to inspect

- Browse every vendor represented in the workspace.
- Open dated submission batches without replacing earlier iterations.
- Review task-category composition and observed deltas between submissions.
- Inspect task lists, workflow state, and recorded deterministic-check counts.
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

The test suite builds the application, checks the server-rendered CASE boundary,
and rejects embedded vendor snapshots or mutating network methods.

## Deliberate omissions

Authentication, persistence, file ingestion, agent execution, event delivery,
and Feishu synchronization remain CASE responsibilities. The portal deliberately
cannot edit the registry or turn recorded checks into a quality judgment.
