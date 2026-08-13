# Training Data Procurement

We buy data to improve or measure frontier models. Optimize for learning signal, not vendor activity.

This repository focuses on:

- hard, verifiable agent environments;
- complete long-horizon trajectories;
- environment-and-trajectory packages;
- preference data with inspectable generations.

If researchers cannot inspect it, run it, score it, and explain why it is useful, do not buy it.

We operate as **TARS**. Use TARS's actual access and memberships. Do not confuse a discoverable channel or file with one TARS can access.

## Where truth lives

**Research demand and priorities:** [`数据采购` Wiki](https://vrfi1sk8a0.feishu.cn/wiki/Fii7wKxOKipox3kYrfVcuCSonrJ) and its linked requirement documents.

**Pipeline state:** [procurement Base](https://vrfi1sk8a0.feishu.cn/base/X6nbbx8XnanJbss0Cxpcq9YXn0c?table=tblhtxsKZF8YqjJZ&view=vewS64aBxe).

**Sample intake and evaluation operations:** CASE's canonical registry. CASE stores vendors, dated submissions, source provenance, task versions, artifacts, checks, trajectories, follow-ups, work items, statuses, and researcher responses. Query CASE before treating a local folder or portal screen as current.

**What someone said:** the dated Feishu, Slack, email, or meeting record.

**What the product is:** the actual demo or delivery and our evaluation output.

**Rights, price, volume, and remedies:** the executed agreement.

**Whether the data is worth accepting:** the receiving researcher, using acceptance criteria agreed before purchase.

`AGENTS.md` is not a vendor tracker. Do not put current vendors, owners, priorities, channel memberships, negotiations, or evaluation results here.

Base is the durable index, not automatically the latest truth. Check recent conversations and artifacts, then write material decisions and evidence back to Base.

Base and CASE have different jobs. Base indexes the procurement opportunity, ownership, commercial state, decision, and next action. CASE tracks the actual sample material and its operational evaluation history. Link them where possible; do not create a second vendor or sample database inside a UI.

Creating a row in the procurement Base automatically sends a **“新增数据采购项目”** card to the sourcing chat. **Never add or create a Base row without asking the user first and receiving explicit confirmation.** Editing an existing row is allowed when it is within the requested scope; ordinary edits do not trigger the new-record notification. Before every Base write, distinguish clearly between creating a record and updating one.

The most relevant Feishu chats are pinned in TARS's sidebar (`feed shortcuts` in `lark-cli`). List them with `lark-cli im +feed-shortcut-list --as user`; start there for the sourcing forum, internal coordination, the primary procurement DM, and active vendor discussions. Check the live list rather than maintaining channel names here.

## CASE and 小环境

### CASE

CASE is TARS's Codex-based Feishu colleague. It runs as an always-on Railway service, receives messages through the configured Feishu app, maps each Feishu chat to a persistent Codex thread, and replies through the app bot. Its renewable user-context `lark-cli` login is persisted on Railway, so CASE can use the same Feishu resources and TARS memberships available to that authenticated user. Chat transport, Feishu access, and Codex tool permissions are separate layers; never assume that bot delivery alone grants access to a document, chat, or user API.

The same CASE process hosts the canonical environment registry API and runs database migrations at startup:

- Railway PostgreSQL stores structured operational records;
- Railway S3-compatible object storage stores immutable original payloads, snapshots, task packages, trajectories, and check evidence;
- content-addressed objects and explicit source relations preserve provenance;
- a durable work queue lets CASE or a later worker lease intake and checking work;
- separate catalog, review, and admin credentials enforce least privilege.

CASE and trusted operators use the `case-registry` CLI or the registry API directly. The database and bucket are CASE resources, not portal resources. Do not scrape the portal, automate its UI, or introduce portal-owned persistence when CASE can expose the underlying operation.

The CASE source lives in the separate private repository [`tars90percent/feishu-codex-agent`](https://github.com/tars90percent/feishu-codex-agent). Its checked-in `skills/case-registry/SKILL.md`, `.env.example`, schema migrations, and README are the implementation-level references.

### 小环境

小环境 is the researcher-facing **Environment & Task Samples / 环境与任务样本** portal, hosted on Railway. It is a convenient view over CASE, not a required control plane and not a source of truth. A researcher should be able to obtain the same records by asking CASE.

The portal currently:

- admits members of the configured Feishu organization through ordinary per-user Feishu OAuth;
- organizes samples by vendor, then dated submission, then task category and task;
- retains every observed submission so vendor iteration remains inspectable;
- shows original source records, live links, and CASE-captured copies when present;
- shows recorded statuses and deterministic check summaries without turning them into quality claims;
- records append-only researcher responses at the submission level: `interested`, `needs_revision`, `not_interested`, or `comment`;
- allows a response to apply to the whole submission or selected task categories while retaining the written comment and verified Feishu identity.

Do not add task-level voting. If one task drives a submission-level judgment, name it in the submission or category-scoped comment. Do not add generic scores, rankings, inferred quality labels, recommendations, or decorative summaries that imply CASE knows whether the sample is good. Researchers make the quality and purchase judgment.

The portal uses a read-only catalog credential and a separate credential that can only list or append submission reviews. It cannot change vendors, submissions, tasks, statuses, checks, or intake records. If CASE is unavailable, the portal should fail clearly rather than serve a cached competing truth.

The portal source lives in the separate private repository [`tars90percent/env-portal-proto`](https://github.com/tars90percent/env-portal-proto). Production is currently deployed to [env-portal-proto-production.up.railway.app](https://env-portal-proto-production.up.railway.app/).

### Current implementation boundary

The registry, heterogeneous-source model, Postgres persistence, object-store integration, validated API/CLI, work queue, portal catalog, Feishu login, and submission-review flow exist. Environment execution does not: pulling vendor images, launching isolated sandboxes, running models, and producing trajectories will use a dedicated sandbox service selected later. Do not run untrusted vendor environments in the CASE or portal Railway services.

Automatic ingestion from every possible email, chat, Drive folder, PDF, spreadsheet, vendor portal, or website is the target topology, not a claim that every adapter is complete. Until an adapter is verified, CASE or an operator may need to invoke the same source-capture and normalization operations manually. Record that limitation; never represent a reachable link as already captured or parsed.

Both application repositories are private and pushed to GitHub. Railway currently deploys uploaded source snapshots rather than tracking those repositories automatically. A GitHub push therefore does not by itself update production. When a registry API or migration changes, deploy and verify CASE before deploying the portal that consumes it.

The parent [`tars90percent/environments`](https://github.com/tars90percent/environments) repository intentionally tracks only this operating guide. The nested application repositories and vendor sample folders are separate and must never be added to the parent repository.

## Intake topology

Model intake around what CASE needs, not around a portal form or an assumed ZIP file:

1. Preserve the inbound event and original payload first, whether it arrived by Feishu, email, Slack, website, Drive, PDF, spreadsheet, upload, or another channel.
2. Represent messages, attachments, URLs, folders, documents, spreadsheets, worksheets, rows, PDFs, archives, task packages, container images, and web pages as source items connected by explicit relations.
3. Store immutable copies in object storage when accessible. Keep the original locator, sender, timestamp, channel, fetch state, and parse state even when capture fails.
4. Snapshot mutable sources such as Drive folders or spreadsheets each time they constitute a new observed delivery. An unchanged URL is not an unchanged submission.
5. Normalize discovered material into a dated submission, categories, and task versions, with exact links back to the source event and source items.
6. Never replace an older submission. A correction or later observation is a new submission linked to what it revises.
7. Queue deterministic checks, store their evidence separately, and update operational status from recorded results.
8. Keep deterministic checks, later research-quality heuristics, vendor claims, and human researcher judgment as separate record types.
9. Preserve failed or incomplete samples for logging. CASE may record and send a vendor follow-up, while the portal can expose the submission as log-only rather than presenting it as research-ready.

Use **submission** in human-facing language. Some internal schema and CLI names still use `batch` for compatibility; do not let that legacy name leak into portal copy or procurement discussion.

## How to work

1. Read the relevant Wiki requirements.
2. Open the Base record.
3. Find the latest vendor and internal discussion linked to that record.
4. Query CASE for the current submissions, original sources, artifacts, checks, prior follow-ups, and researcher responses.
5. Inspect the exact demo and existing evaluation before asking for more work.
6. Identify the receiving researcher and the decision the data is meant to support.
7. Evaluate the sample against that research need.
8. Define pilot acceptance criteria before committing money.
9. Test the delivered pilot independently.
10. Record sample-level evidence and operational history in CASE; record the material decision and next action in Base.

Do not restart completed evaluation work unless the sample, requirement, or target model changed.

## Local demos

Local vendor samples in this workspace are valuable evidence. Inspect them early. They often contain more truth than a pitch, chat summary, or Base field.

- Discover them from the workspace instead of relying on a fixed directory name.
- Treat them as read-only unless the task explicitly requires derived analysis.
- Check whether they match the version linked from Base.
- Inspect manifests, prompts, traces, tests, solutions, rubrics, dependencies, and prior evaluation output.
- Record missing files, private dependencies, broken permissions, and schema mismatches.
- Do not publish or commit vendor material.
- Do not add vendor material or either nested application repository to the parent `environments` Git repository.
- Do not execute untrusted code outside an isolated environment.

A local demo is evidence of what was received, not proof that it is current, representative, licensed, or accepted.

## Target benchmarks and model

The current MiniMax flagship model for procurement evaluation is **M3**. Unless a requirement document specifies otherwise, references to the MiniMax flagship model mean M3.

For long-horizon environment procurement, use these as the standing target benchmark set:

- **Coding and systems:** DeepSWE, SWE-Marathon, FrontierSWE, SWE-fficiency, GSO, FrontierCS, KernelBench, and FlashInfer-Bench.
- **ML research and infrastructure:** MLE-Bench, PostTrainBench, MLS-Bench, EXP-Bench, AutoLab, and InferenceBench.

These benchmarks define the capability areas and difficulty regimes we want; a vendor's claim that a sample is similar is not evidence that it actually matches them.

## Demo requirements

No normal intake without a representative demo. A deck, website, screenshot, benchmark claim, or future promise is not a demo.

For every coding task, require:

- Harbor format, directly runnable with the Harbor CLI;
- a Dockerfile rebuildable from public dependencies, with no private image;
- a gold solution;
- tests and solution scripts that run inside the container without private local data or environment variables;
- repeated gold runs that consistently reward `1` and untouched runs that consistently reward `0`;
- at least four trajectories per task from both M3 and the designated frontier reference model;
- exact model and harness versions, per-run reward and turn count, and pass rate;
- model, harness, pass-rate, and turn-count targets agreed before delivery.

For document or rubric data, reject blank files, error pages, advertising contamination, PDFs with no usable text or missing OCR, and incorrect rubrics.

Difficulty must be measured on the agreed model and harness. Broken environments, ambiguous prompts, and faulty graders do not count as useful difficulty.

Before purchase, verify provenance, consent where required, permitted uses, privacy and redaction, duplication and contamination controls, exclusivity, and downstream-use restrictions.

## Evidence rules

Separate:

- **observed fact:** present in an artifact or reproduced by us;
- **vendor claim:** stated by the vendor but not independently verified;
- **internal judgment:** an evaluator's conclusion;
- **binding term:** present in an approved agreement.

Label vendor numbers, capabilities, timelines, and benchmark results as claimed or unverified until checked.

When sources conflict, use the source that governs the fact. Record the discrepancy; do not guess and do not silently pick the newest message.

Every active Base record should make the next decision possible. It needs a research use case, owner, evaluator, demo, evidence-backed conclusion, open issues, commercial state, and next action.

The work is done when the receiving researcher can use the delivery without the vendor's help and can defend the acceptance decision from the recorded evidence.
