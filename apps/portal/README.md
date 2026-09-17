# env-portal-proto — research catalog

A researcher catalog for vendor RL-task samples, hosted on
Railway and available to authenticated members of TARS's Feishu organization.
The portal presents registered Harbor tasks, their classifications, task files,
and existing technical check evidence. Supplier history, inventory claims,
original deliveries, researcher feedback and procurement live in the
[SRM Feishu Base](https://vrfi1sk8a0.feishu.cn/base/WqS9bTgadatBNusLu7aciS7wn8f).
Vendor pages link there instead of displaying timelines or original submissions.

The portal projects the CASE catalog to Harbor tasks only and does not send
legacy source events or supplier interactions to the browser. Vendors and
batches without Harbor tasks are omitted. The internal CASE catalog remains
available to the JFS archive publisher during legacy-data retirement; its
integrity inputs are unchanged.

It also includes a separate public benchmark reference containing descriptive
metadata and authoritative links, without third-party task payloads. DeepSWE's
user-confirmed Mercor and Unipat shortlist remains a task-view filter; it does
not imply acceptance or procurement progress. All-vendor and shortlist Harbor
ZIP downloads continue through the gateway.

The root [`AGENTS.md`](../../AGENTS.md) defines the operating policy. See the
[SRM data boundary](../../docs/srm-data-boundary.md) for retained legacy data and
retirement conditions. Beagle is the Harbor rollout and evaluation service.

## Safety boundary

- Feishu OAuth is used only for organization membership and display identity.
- Production uses a dedicated MiniMax custom app (`cli_aaf7c9f277385cee`), with the Railway callback `https://env-portal-proto-production.up.railway.app/auth/callback` and organization-wide availability. It is separate from CASE's bot app.
- The Feishu app secret and CASE credentials stay in Railway runtime secrets.
- The application compares the verified `tenant_key` with one configured organization; it does not infer membership from email domains.
- No vendor snapshot data or source payloads are copied into the frontend.
- Public benchmark reference entries are source-controlled metadata, kept separate from the CASE submission registry and object store.
- The portal server uses a read-only catalog credential.
- Catalog and artifact endpoints require the same signed, HTTP-only researcher session as the page.
- The portal exposes no submission-upload or other mutation endpoint.
- No vendor messages are sent, and the portal cannot create or edit CASE records.
- If CASE is unavailable, the portal shows no cached substitute and says so explicitly.

## What to inspect

The `/trajectories` viewer opens local JSON or pasted JSON entirely in the browser.
It supports the MiniMax/Anthropic messages format (text, thinking, tool use, and
tool results) and OpenAI-style tool calls. An outline, role filters, full-content
search, and arrow-key navigation make long trajectories easier to inspect.
Tool results are paired by their explicit call IDs, with errors and missing
results distinguished. Request metadata and original messages remain available;
unknown content blocks are retained as JSON. There is a synthetic example, but
no real trajectory data is bundled, uploaded, persisted, or evaluated. This
standalone local-file utility needs no registry session and accesses no CASE
endpoints. Refreshing clears the loaded file. Inputs are limited to 50 MB.

- Browse vendors with registered Harbor tasks.
- Open any registered vendor Harbor task at `/tasks/<taskId>` from its title or **View files** link. The shared benchmark file browser selects `instruction.md` first and displays the folder tree, file sizes and roles, source submission, task identity, and technical provenance. The portal resolves the task's distribution prefix from CASE and uses the existing Harbor gateway for paginated listings and individual reads. `/api/tasks/<taskId>/files` and `/api/tasks/<taskId>/file?path=...` require the researcher session; gateway credentials stay server-side. Text, raster images and PDFs preview privately, with an 8 MiB preview limit. Office documents, binary files and larger files are downloadable. Vendor files are never passed to the public Office viewer. macOS metadata sidecars (`._*`, `.DS_Store`, and `__MACOSX`) are omitted from the task browser. Text previews reject binary control data and invalid encoding instead of displaying replacement-character gibberish; UTF-8 and BOM-marked UTF-16 are supported. Missing or incomplete mirrors are shown explicitly. File reads never execute task code or launch evaluation.
- Harbor tasks show only Environment, Oracle, and Nop: pass/fail when conclusive, a distinct tried marker when a result was blocked or inconclusive, and a dash when not attempted. Directly supported findings remain separate.
- Browse standalone benchmark families grouped by task domain, with their creators, canonical maintainers, task-set scale, release or access status when established, and publisher-maintained sources. Evaluation variants remain attached to their underlying benchmark family rather than becoming duplicate benchmarks.
- Open one bilingual, source-grounded guide for each of the 39 benchmark families. Each guide explains the domain, distribution, difficulty, reported time or interaction budget, recurring model failure modes, and how to interpret the score, with primary reading and a verification date.
- Browse aggregate benchmarks in a separate section. Each aggregate lists its constituent evaluations and weights and links them back to the standalone benchmark families; the Artificial Analysis Intelligence Index is the first aggregate recorded this way.
- Open 49 source-linked public-task profiles across 34 benchmark families with identified public problems, plus four documented format archetypes for two gated families. The profiles compare task objective, input shape, expected output, evaluation method, and capability pattern without reproducing protected questions.
- Open an individual page for any sample profile. Harbor-format samples include the complete upstream package tree with paths, roles, byte sizes, snapshot revision, and direct links to every source file. Non-Harbor samples map the publisher-native record fields, input identities, execution path, output contract, and grading contract without copying field payloads. Original task material stays in the publisher's language; Chinese copy is descriptive only.

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
validates the source-controlled benchmark composition, and rejects embedded
vendor snapshots and submission-mutation surfaces.

## Deliberate omissions

The portal has no delivery capture, supplier timeline, or Feishu synchronization
workflow. Those records are maintained in Base; CASE supplies Harbor distribution. Beagle is the execution boundary
for new Harbor samples. The portal cannot create or edit
canonical records or turn check tags into a quality judgment. The public
benchmark reference is not a second registry and does not preserve or execute
third-party benchmark tasks. Its sample profiles are source-controlled
descriptions and pointers, not copied prompts, answers, attachments, or packages.
Harbor filesystem views store tree metadata only; each file continues to live at
the publisher's repository.

Task files and Harbor ZIPs are served through the gateway. The old original,
artifact and submission-dataset download routes return HTTP 410 with a Base
link after authenticating the caller; they cannot download legacy delivery
material through the portal.

Vendor pages and individual benchmark-direction pages offer “Download all Harbor tasks”. Both use the Harbor gateway to build or reuse a ZIP from the exact published task folders in `harbor-tasks`. Benchmark downloads span all vendors and submissions for that benchmark, independently of the page's search filter. The ZIP preserves vendor/submission/task paths, and its manifest identifies the vendor and submission for each task. Incomplete task roots cause preparation to fail rather than producing a partial archive.
Export manifests retain task and submission identity, source paths and evidence,
without repeating internal content checksums.
