import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { installWorkspaceInstructions } from "../src/agent.js";

test("installs the source-controlled guide into the persistent agent workspace", async () => {
  const root = await mkdtemp(join(tmpdir(), "case-instructions-"));
  const source = join(root, "source.md");
  const workspace = join(root, "workspace");

  try {
    await writeFile(source, "# Current CASE guide\n", "utf8");
    await installWorkspaceInstructions(workspace, source);
    assert.equal(await readFile(join(workspace, "AGENTS.md"), "utf8"), "# Current CASE guide\n");

    await writeFile(join(workspace, "AGENTS.md"), "# Stale guide\n", "utf8");
    await installWorkspaceInstructions(workspace, source);
    assert.equal(await readFile(join(workspace, "AGENTS.md"), "utf8"), "# Current CASE guide\n");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("the CASE guide defines one complete registration workflow", async () => {
  const guide = await readFile(new URL("../AGENTS.md", import.meta.url), "utf8");

  assert.match(guide, /turn messy evaluation-sample deliveries into exact, runnable, evidence-backed task versions/);
  assert.match(guide, /Registration is one end-to-end process/);
  assert.match(guide, /accumulating completeness steps, not separate products or organizational handoffs/);
  assert.match(guide, /Storing the original payload first is a crash-safe checkpoint/);
  assert.match(guide, /Complete registration does not require every task to pass/);
  assert.doesNotMatch(guide, /case-harbor-normalization/);
});

test("the CASE guide defines architectural and decision boundaries", async () => {
  const guide = await readFile(new URL("../AGENTS.md", import.meta.url), "utf8");

  assert.match(guide, /PostgreSQL registry:.*authoritative relational record/s);
  assert.match(guide, /S3-compatible object storage:.*immutable, content-addressed/s);
  assert.match(guide, /Durable work queue:.*scheduling and recovery/s);
  assert.match(guide, /Final upstreaming and purchasing authority:.*designated post-training researchers/);
  assert.match(guide, /fresh disposable remote sandbox/);
  assert.match(guide, /zero exit code or sandbox completion is not by itself a passing task result/);
});

test("the CASE guide resolves live requirements from governing evidence", async () => {
  const guide = await readFile(new URL("../AGENTS.md", import.meta.url), "utf8");

  assert.match(guide, /latest dated requirement or decision from the designated post-training researcher/);
  assert.match(guide, /数据采购.*Wiki/);
  assert.match(guide, /legacy.*Base.*read-only historical reference/s);
  assert.match(guide, /package format, repeat counts, models, harnesses, trajectory counts, pass-rate bands/);
});

test("the default clean-runnable policy uses one Oracle and one Nop control", async () => {
  const runtimeEvidence = await readFile(
    new URL("../skills/case-sample-registration/references/runtime-evidence.md", import.meta.url),
    "utf8",
  );

  assert.match(runtimeEvidence, /baseline is one successful Oracle\/gold trial/);
  assert.match(runtimeEvidence, /baseline is one expected-negative Nop\/untouched trial/);
  assert.doesNotMatch(runtimeEvidence, /minimum is two (successful|expected-negative) trials/);
});

test("ships the complete-registration and registry skills referenced by the guide", async () => {
  const guide = await readFile(new URL("../AGENTS.md", import.meta.url), "utf8");
  const registrationSkill = await readFile(
    new URL("../skills/case-sample-registration/SKILL.md", import.meta.url),
    "utf8",
  );
  const registrySkill = await readFile(
    new URL("../skills/case-registry/SKILL.md", import.meta.url),
    "utf8",
  );
  const dockerfile = await readFile(new URL("../Dockerfile", import.meta.url), "utf8");
  const references = [
    "registry-recording.md",
    "runtime-evidence.md",
    "harbor-contract.md",
    "interpretation.md",
  ];

  assert.match(guide, /Use the `case-sample-registration` skill.*`case-registry`/);
  assert.match(registrationSkill, /Registration is one workflow with resumable checkpoints/);
  assert.match(registrySkill, /It does not define a separate capture or processing lifecycle/);

  for (const reference of references) {
    assert.match(registrationSkill, new RegExp(`references/${reference.replace(".", "\\.")}`));
    assert.match(
      await readFile(
        new URL(`../skills/case-sample-registration/references/${reference}`, import.meta.url),
        "utf8",
      ),
      /\S/,
    );
  }

  assert.match(dockerfile, /cp -R \/app\/skills\/\. \/root\/\.agents\/skills\//);
  assert.match(
    dockerfile,
    /test -f \/root\/\.agents\/skills\/case-sample-registration\/SKILL\.md/,
  );
  assert.match(dockerfile, /test -f \/root\/\.agents\/skills\/case-registry\/SKILL\.md/);
});
