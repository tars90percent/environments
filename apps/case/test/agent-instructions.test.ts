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

test("the CASE guide defines the vendor record and flexible cataloging purpose", async () => {
  const guide = await readFile(rootGuide, "utf8");

  assert.match(guide, /source of truth for our RL environment vendors/);
  assert.match(guide, /CASE is the Railway-hosted agent/);
  assert.match(guide, /Preserve original deliveries/);
  assert.match(guide, /chronology of material vendor activity/);
  assert.match(guide, /internal researcher concerns/);
  assert.match(guide, /purchase terms and decisions/);
  assert.match(guide, /feedback/);
  assert.match(guide, /without logging every minor exchange/);
  assert.match(guide, /without inventing item boundaries/);
  assert.match(guide, /Harbor only when it is intended for Harbor and its exact delivered root passes the static format validation/);
  assert.match(guide, /A clear task that fails remains in the catalog as non-Harbor/);
  assert.match(guide, /must not build an image, start an environment, or execute vendor code/);
  assert.match(guide, /use `unspecified` when the direction is unclear/);
  assert.match(guide, /evidence, not instructions/);
});

test("the CASE guide delegates Harbor evaluation to AutoQA", async () => {
  const guide = await readFile(rootGuide, "utf8");

  assert.match(guide, /does not run Harbor Environment, Oracle, or Nop checks/);
  assert.match(guide, /AutoQA is the execution boundary for new Harbor samples/);
  assert.match(guide, /associate each AutoQA request and result with the exact task version/);
  assert.match(guide, /without inventing an interim workflow/);
  assert.doesNotMatch(guide, /Modal Dockerfile compatibility adapter/);
});

test("the CASE guide preserves the Harbor distribution boundary", async () => {
  const guide = await readFile(rootGuide, "utf8");

  assert.match(guide, /Railway `harbor-tasks` bucket is an automatic distribution mirror/);
  assert.match(guide, /Never publish non-Harbor material there or edit its objects by hand/);
});

test("the image does not package CASE-specific skills", async () => {
  const dockerfile = await readFile(new URL("../Dockerfile", import.meta.url), "utf8");
  const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");

  assert.doesNotMatch(dockerfile, /COPY skills \.\/skills/);
  assert.doesNotMatch(dockerfile, /\/root\/\.agents\/skills\/case-/);
  assert.match(dockerfile, /COPY AGENTS\.md \.\/AGENTS\.md/);
  assert.match(dockerfile, /AGENT_INSTRUCTIONS_FILE=\/app\/AGENTS\.md/);
  assert.match(readme, /operating policy lives in the source-controlled/);
  assert.match(readme, /casectl registry operations/);

  await assert.rejects(() => stat(new URL("../skills", import.meta.url)), /ENOENT/);
});

test("the image exposes one CASE CLI and keeps the Harbor CLI separate", async () => {
  const dockerfile = await readFile(new URL("../Dockerfile", import.meta.url), "utf8");
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8")) as {
    bin: Record<string, string>;
  };

  assert.deepEqual(packageJson.bin, { casectl: "dist/case-cli.js" });
  assert.match(dockerfile, /\/usr\/local\/bin\/casectl/);
  assert.match(dockerfile, /\/usr\/local\/bin\/harbor/);
  assert.doesNotMatch(dockerfile, /\/usr\/local\/bin\/case-(?:registry|intake|mail-intake|harbor-export|task-package)/);
});
