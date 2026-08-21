# env-portal-proto — 小环境 RL environment catalog

A researcher catalog for vendor RL-environment samples, hosted on
Railway and available to authenticated members of TARS's Feishu organization.
小环境 loads vendors, dated submissions, original-source records, parsed tasks
or traces, four Harbor tags, findings, and downloads from CASE.

The interface intentionally contains no procurement, research-demand, category,
quality, status, scoring, recommendation, or review workflow.

## Safety boundary

- Feishu OAuth is used only for organization membership and display identity.
- Production uses the dedicated MiniMax custom app `小环境` (`cli_aaf7c9f277385cee`), with the Railway callback `https://env-portal-proto-production.up.railway.app/auth/callback` and organization-wide availability. It is separate from CASE's bot app.
- The Feishu app secret and CASE credentials stay in Railway runtime secrets.
- The application compares the verified `tenant_key` with one configured organization; it does not infer membership from email domains.
- No vendor snapshot data or source payloads are copied into the frontend.
- The portal server uses separate read-only catalog and upload-only credentials.
- Catalog and artifact endpoints require the same signed, HTTP-only researcher session as the page.
- A researcher upload is streamed to CASE's content-addressed object store and registered as a new submission with the verified Feishu identity. The portal keeps no competing copy and does not parse tasks.
- No vendor messages are sent, and the portal cannot edit existing CASE records.
- If CASE is unavailable, the portal shows no cached substitute and says so explicitly.

## What to inspect

- Browse every vendor represented in the workspace.
- Open dated submissions without replacing earlier observations.
- Follow the original Drive, Sheet, document, or message link and download CASE's captured copy when one exists.
- Inspect tasks or traces. Non-Harbor tasks have no checks. Harbor tasks show only Build, Boot, Oracle, and Nop pass/fail tags plus directly supported findings.
- Upload a sample file for an existing vendor; CASE preserves it as a provenance-linked submission for later parsing.

## Run locally

```bash
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
and rejects embedded vendor snapshots or mutation methods broader than the
deliberate upload path.

## Deliberate omissions

Persistence, parsing, Harbor execution, event delivery, and Feishu
synchronization remain CASE responsibilities. Researcher uploads are stored by
CASE; the portal cannot edit canonical records or turn check tags into a quality
judgment.
