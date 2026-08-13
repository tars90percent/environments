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
  assert.match(guide, /Base is a legacy reference, not your canonical memory/);
  assert.doesNotMatch(guide, /not a research taste model/);
});
