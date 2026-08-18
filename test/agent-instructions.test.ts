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

test("the CASE guide develops taste while reserving final authority", async () => {
  const guide = await readFile(new URL("../AGENTS.md", import.meta.url), "utf8");
  assert.match(guide, /Develop taste rather than suppressing it/);
  assert.match(guide, /Final authority .* currently rests with the designated post-training researchers/);
  assert.doesNotMatch(guide, /not a research taste model/);
});

test("the CASE guide uses live requirements without routing to the legacy procurement Base", async () => {
  const guide = await readFile(new URL("../AGENTS.md", import.meta.url), "utf8");
  assert.match(guide, /Research demand and requirements:.*数据采购.*Wiki/);
  assert.doesNotMatch(guide, /procurement Base|Base is a legacy reference/);
});

test("ships the Harbor normalization guidance referenced by the CASE guide", async () => {
  const guide = await readFile(new URL("../AGENTS.md", import.meta.url), "utf8");
  const skill = await readFile(
    new URL("../skills/case-harbor-normalization/SKILL.md", import.meta.url),
    "utf8",
  );
  const dockerfile = await readFile(new URL("../Dockerfile", import.meta.url), "utf8");
  const references = [
    "case-recording.md",
    "harbor-contract.md",
    "interpretation.md",
    "verifier-classification.md",
  ];

  assert.match(guide, /Use the `case-harbor-normalization` skill/);
  assert.match(guide, /Distinguish \*\*Harbor-valid\*\* from \*\*CASE review-ready\*\*/);

  for (const reference of references) {
    assert.match(skill, new RegExp(`references/${reference.replace(".", "\\.")}`));
    assert.match(
      await readFile(
        new URL(`../skills/case-harbor-normalization/references/${reference}`, import.meta.url),
        "utf8",
      ),
      /\S/,
    );
  }

  assert.match(dockerfile, /cp -R \/app\/skills\/\. \/root\/\.agents\/skills\//);
  assert.match(
    dockerfile,
    /test -f \/root\/\.agents\/skills\/case-harbor-normalization\/SKILL\.md/,
  );
});
