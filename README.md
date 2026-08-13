# env-portal-proto — 小环境 RL environment catalog

A read-only researcher catalog for vendor RL-environment samples, hosted on
Railway and available to authenticated members of TARS's Feishu organization.
小环境 loads its vendors, dated submissions, task categories, task versions,
statuses, original-source records, and checks from CASE's canonical registry.

The interface intentionally does not rank task quality, estimate learning signal, or recommend research decisions. It records package contents and submission-to-submission changes, then shows the current deterministic intake criteria alongside each task.

## Safety boundary

- Feishu OAuth is used only for organization membership and display identity.
- The Feishu app secret and CASE catalog credential stay in Railway runtime secrets.
- The application compares the verified `tenant_key` with one configured organization; it does not infer membership from email domains.
- No vendor snapshot data or source payloads are copied into the frontend.
- The portal server uses a read-only catalog credential and proxies only CASE catalog reads.
- Catalog and artifact endpoints require the same signed, HTTP-only researcher session as the page.
- No vendor messages are sent and no procurement records are created or updated.
- If CASE is unavailable, the portal shows no cached substitute and says so explicitly.

## What to inspect

- Browse every vendor represented in the workspace.
- Open dated submissions without replacing earlier observations.
- Review task-category composition and observed deltas between submissions.
- Follow the original Drive, Sheet, document, or message link and download CASE's captured copy when one exists.
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

Persistence, file ingestion, agent execution, event delivery, and Feishu
synchronization remain CASE responsibilities. The portal deliberately cannot
edit the registry or turn recorded checks into a quality judgment.
