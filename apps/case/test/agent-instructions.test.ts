import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { installWorkspaceInstructions } from "../src/agent.js";

const rootGuide = new URL("../../../AGENTS.md", import.meta.url);

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

test("the CASE guide defines the narrow submission-processing workflow", async () => {
  const guide = await readFile(rootGuide, "utf8");

  assert.match(guide, /preserve each original submission and its arrival provenance/);
  assert.match(guide, /exactly one of `harbor` or `non_harbor`/);
  assert.match(guide, /For `non_harbor`, record the task and stop\. Do not check it/);
  assert.match(guide, /exactly four results: Build, Boot, Oracle, and Nop/);
  assert.match(guide, /complete sample-processing workflow/);
});

test("the CASE guide permits only the four Modal-backed Harbor checks", async () => {
  const guide = await readFile(rootGuide, "utf8");

  assert.match(guide, /\*\*Build pass\/fail:\*\*.*Dockerfile builds an image/);
  assert.match(guide, /\*\*Boot pass\/fail:\*\*.*container.*start/);
  assert.match(guide, /\*\*Oracle pass\/fail:\*\*.*score `1`/);
  assert.match(guide, /\*\*Nop pass\/fail:\*\*.*score `0`/);
  assert.match(guide, /Modal as the sandbox provider/);
  assert.match(guide, /Do not add.*package-quality/);
  assert.match(guide, /model trials/);
  assert.match(guide, /DeepSeek diagnostics/);
});

test("the CASE guide limits findings to demonstrated check issues", async () => {
  const guide = await readFile(rootGuide, "utf8");

  assert.match(guide, /Findings are short factual notes/);
  assert.match(guide, /Limit them to/);
  assert.match(guide, /Do not use findings for infrastructure failures/);
  assert.match(guide, /recommended next actions/);
  assert.match(guide, /Do not philosophize about the sample/);
});

test("the CASE guide keeps registry mechanics self-describing", async () => {
  const guide = await readFile(rootGuide, "utf8");

  assert.match(guide, /Use the `case-registry` CLI (?:rather than|instead of) raw database writes/);
  assert.match(guide, /HTTP API is only the portal-facing catalog and researcher-upload adapter/);
  assert.match(guide, /Inspect the existing record first/);
  assert.match(guide, /run `case-registry operations` for the current command schemas/);
});

test("the image does not package CASE-specific skills", async () => {
  const dockerfile = await readFile(new URL("../Dockerfile", import.meta.url), "utf8");
  const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");

  assert.doesNotMatch(dockerfile, /COPY skills \.\/skills/);
  assert.doesNotMatch(dockerfile, /\/root\/\.agents\/skills\/case-/);
  assert.match(dockerfile, /COPY AGENTS\.md \.\/AGENTS\.md/);
  assert.match(dockerfile, /AGENT_INSTRUCTIONS_FILE=\/app\/AGENTS\.md/);
  assert.match(readme, /complete sample-processing policy lives in the source-controlled/);
  assert.match(readme, /case-registry operations/);

  await assert.rejects(() => stat(new URL("../skills", import.meta.url)), /ENOENT/);
});
