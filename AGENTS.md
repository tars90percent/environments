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

**What someone said:** the dated Feishu, Slack, email, or meeting record.

**What the product is:** the actual demo or delivery and our evaluation output.

**Rights, price, volume, and remedies:** the executed agreement.

**Whether the data is worth accepting:** the receiving researcher, using acceptance criteria agreed before purchase.

`AGENTS.md` is not a vendor tracker. Do not put current vendors, owners, priorities, channel memberships, negotiations, or evaluation results here.

Base is the durable index, not automatically the latest truth. Check recent conversations and artifacts, then write material decisions and evidence back to Base.

Creating a row in the procurement Base automatically sends a **“新增数据采购项目”** card to the sourcing chat. **Never add or create a Base row without asking the user first and receiving explicit confirmation.** Editing an existing row is allowed when it is within the requested scope; ordinary edits do not trigger the new-record notification. Before every Base write, distinguish clearly between creating a record and updating one.

The most relevant Feishu chats are pinned in TARS's sidebar (`feed shortcuts` in `lark-cli`). List them with `lark-cli im +feed-shortcut-list --as user`; start there for the sourcing forum, internal coordination, the primary procurement DM, and active vendor discussions. Check the live list rather than maintaining channel names here.

## How to work

1. Read the relevant Wiki requirements.
2. Open the Base record.
3. Find the latest vendor and internal discussion linked to that record.
4. Inspect the demo and existing evaluation before asking for more work.
5. Identify the receiving researcher and the decision the data is meant to support.
6. Evaluate the sample against that research need.
7. Define pilot acceptance criteria before committing money.
8. Test the delivered pilot independently.
9. Record the evidence, decision, and next action in Base.

Do not restart completed evaluation work unless the sample, requirement, or target model changed.

## Local demos

Local vendor samples in this workspace are valuable evidence. Inspect them early. They often contain more truth than a pitch, chat summary, or Base field.

- Discover them from the workspace instead of relying on a fixed directory name.
- Treat them as read-only unless the task explicitly requires derived analysis.
- Check whether they match the version linked from Base.
- Inspect manifests, prompts, traces, tests, solutions, rubrics, dependencies, and prior evaluation output.
- Record missing files, private dependencies, broken permissions, and schema mismatches.
- Do not publish or commit vendor material.
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
