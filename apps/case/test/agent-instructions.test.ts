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

  assert.match(guide, /maps the landscape of RL environment & data vendors/);
  assert.match(guide, /Preserve the arrival event and exact original payload/);
  assert.match(guide, /Assign each parsed item one registered general benchmark direction/);
  assert.match(guide, /Use `unspecified` when no direction is clear/);
  assert.match(guide, /The agent interprets; code validates and preserves/);
  assert.match(guide, /Classify every other task as `non_harbor`/);
  assert.match(guide, /Record it and stop; Harbor checks do not apply/);
  assert.match(guide, /Environment, Oracle, and Nop/);
  assert.match(guide, /Keep this project descriptive/);
  assert.match(guide, /A benchmark review is not a task-version change/);
  assert.match(guide, /case-registry assign-task-benchmarks/);
  assert.match(guide, /case-registry purge-erroneous-benchmarks/);
  assert.match(guide, /Never supersede, replace, or mutate a task version merely to change its benchmark/);
  assert.match(guide, /case-registry assign-task-gpu-requirements/);
  assert.match(guide, /never represent a deliberate GPU skip as a Harbor attempt or failure/i);
});

test("the CASE guide permits only the three Modal-backed Harbor checks", async () => {
  const guide = await readFile(rootGuide, "utf8");

  assert.match(guide, /\*\*Environment pass\/fail:\*\*.*clean image construction.*environment startup.*declared healthcheck/);
  assert.match(guide, /\*\*Oracle pass\/fail:\*\*.*score `1`/);
  assert.match(guide, /\*\*Nop pass\/fail:\*\*.*score `0`/);
  assert.match(guide, /Modal as the sandbox provider/);
  assert.match(guide, /only when `gpu_required` is false/);
  assert.match(guide, /When `gpu_required` is true, skip Environment, Oracle, and Nop/);
  assert.match(guide, /do not run a separate Environment trial/i);
  assert.match(guide, /An unset phase with such a record means the check was tried without a conclusive result/);
  assert.match(guide, /Attempt state is not a fourth check/);
  assert.match(guide, /Do not add.*package-quality/);
  assert.match(guide, /model trials/);
  assert.match(guide, /DeepSeek diagnostics/);
});

test("the CASE guide narrowly permits Modal's named COPY chown adapter", async () => {
  const guide = await readFile(rootGuide, "utf8");

  assert.match(guide, /Modal Dockerfile compatibility adapter/);
  assert.match(guide, /Do not count that Modal-only parser limitation as an Environment failure/);
  assert.match(guide, /replace only the ownership operand with the equivalent numeric form/);
  assert.match(guide, /not a modification of the stored artifact.*new task version.*permission to repair the task/s);
  assert.match(guide, /Apply no other source transformation under this exception/);
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
  assert.match(guide, /HTTP API serves the portal-facing catalog/);
  assert.match(guide, /Researcher upload through 小环境 is disabled/);
  assert.match(guide, /Inspect the existing record first/);
  assert.match(guide, /run `case-registry operations` for the current command schemas/);
});

test("the CASE guide defines automatic exact-file Harbor task distribution", async () => {
  const guide = await readFile(rootGuide, "utf8");

  assert.match(guide, /Railway `harbor-tasks` bucket is the programmatic distribution mirror/);
  assert.match(guide, /<vendor-id>\/<submission-id>\/<task-name>\//);
  assert.match(guide, /Do not add a task stable key, version directory, generated manifest, archive, or other wrapper/);
  assert.match(guide, /publish regular files separately with their original relative paths and bytes/);
  assert.match(guide, /first commit the ordinary canonical metadata.*Only after that transaction succeeds/s);
  assert.match(guide, /Non-Harbor tasks and traces are never published there/);
  assert.match(guide, /Distribution failure does not roll back.*successful registry transaction/s);
  assert.match(guide, /every active Harbor task has been published or exactly verified/);
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
