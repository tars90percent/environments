# env-portal-proto — 小环境 task-sample catalog

A researcher catalog for vendor RL-task samples, hosted on
Railway and available to authenticated members of TARS's Feishu organization.
小环境 loads vendors, dated submissions, original-source records, parsed tasks
or traces, three Harbor tags, non-conclusive attempt state, findings, and
downloads from CASE.

The interface intentionally contains no procurement, research-demand, category,
quality, status, scoring, recommendation, or review workflow.

This README describes the portal application and its access boundary. The
monorepo's root [`AGENTS.md`](../../AGENTS.md) is the sole authoritative
operating policy; CASE remains the canonical registry and check orchestrator.

## Safety boundary

- Feishu OAuth is used only for organization membership and display identity.
- Production uses the dedicated MiniMax custom app `小环境` (`cli_aaf7c9f277385cee`), with the Railway callback `https://env-portal-proto-production.up.railway.app/auth/callback` and organization-wide availability. It is separate from CASE's bot app.
- The Feishu app secret and CASE credentials stay in Railway runtime secrets.
- The application compares the verified `tenant_key` with one configured organization; it does not infer membership from email domains.
- No vendor snapshot data or source payloads are copied into the frontend.
- The portal server uses a read-only catalog credential.
- Catalog and artifact endpoints require the same signed, HTTP-only researcher session as the page.
- The portal exposes no submission-upload or other mutation endpoint.
- No vendor messages are sent, and the portal cannot create or edit CASE records.
- If CASE is unavailable, the portal shows no cached substitute and says so explicitly.

## What to inspect

- Browse vendors that have at least one recorded submission.
- Open dated submissions without replacing earlier observations.
- Follow the original Drive, Sheet, document, or message link and download CASE's captured copy when one exists.
- Inspect tasks or traces. Non-Harbor tasks have no checks. Harbor tasks show only Environment, Oracle, and Nop: pass/fail when conclusive, a distinct tried marker when a result was blocked or inconclusive, and a dash when not attempted. Directly supported findings remain separate.

## Prerequisites

- Node.js 22.13 or newer;
- access to the CASE catalog endpoint and its read-only credential; and
- a Feishu OAuth app configured for the local callback URL.

## Run locally

```bash
cd apps/portal
npm ci
cp .env.example .env.local
npm run dev
```

Fill `.env.local` with the CASE connection, narrow CASE credentials, and Feishu
OAuth settings. Runtime values remain in Railway; this repository contains only
the variable names and safe defaults.

Open [http://localhost:3000](http://localhost:3000).

## Verify

```bash
npm test
npm run lint
```

The test suite builds the application, checks the server-rendered CASE boundary,
and rejects embedded vendor snapshots and submission-mutation surfaces.

## Deliberate omissions

Persistence, capture, parsing, Harbor execution, event delivery, and Feishu
synchronization remain CASE responsibilities. The portal cannot create or edit
canonical records or turn check tags into a quality judgment.
