import assert from "node:assert/strict";
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

test("the CASE Harbor launcher stops its private Modal App and verifies zero containers", async () => {
  const directory = await mkdtemp(join(tmpdir(), "case-harbor-cli-"));
  const tracePath = join(directory, "trace.json");
  const harborPath = join(directory, "fake-harbor.mjs");
  const modalPath = join(directory, "fake-modal.mjs");

  try {
    await writeFile(harborPath, `#!/usr/bin/env node
import { writeFileSync } from "node:fs";
writeFileSync(${JSON.stringify(tracePath)}, JSON.stringify({ harborArgs: process.argv.slice(2), modalCalls: [] }));
`, "utf8");
    await writeFile(modalPath, `#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
const tracePath = ${JSON.stringify(tracePath)};
const trace = JSON.parse(readFileSync(tracePath, "utf8"));
const args = process.argv.slice(2);
trace.modalCalls.push(args);
writeFileSync(tracePath, JSON.stringify(trace));
const appName = trace.harborArgs.find((value) => value.startsWith("app_name="))?.slice("app_name=".length);
if (args[0] === "app" && args[1] === "list") {
  process.stdout.write(JSON.stringify([{ app_id: "ap-test", description: appName, state: "deployed", tasks: "1" }]));
} else if (args[0] === "container" && args[1] === "list") {
  process.stdout.write("[]");
}
`, "utf8");
    await chmod(harborPath, 0o755);
    await chmod(modalPath, 0o755);

    const result = spawnSync(
      process.execPath,
      ["--import", "tsx", resolve("src/harbor-cli.ts"), "run", "--path", "/task"],
      {
        cwd: resolve("."),
        encoding: "utf8",
        env: {
          ...process.env,
          CASE_HARBOR_BIN: harborPath,
          CASE_MODAL_BIN: modalPath,
          CASE_HARBOR_WORKDIR: join(directory, "evaluations"),
          CASE_HARBOR_HOME: join(directory, "home"),
          MODAL_TOKEN_ID: "modal-id",
          MODAL_TOKEN_SECRET: "modal-secret",
          MODAL_ENVIRONMENT: "case-evaluation",
        },
      },
    );

    assert.equal(result.status, 0, result.stderr);
    const trace = JSON.parse(await readFile(tracePath, "utf8")) as {
      harborArgs: string[];
      modalCalls: string[][];
    };
    const appName = trace.harborArgs
      .find((value) => value.startsWith("app_name="))
      ?.slice("app_name=".length);
    assert.match(appName ?? "", /^case-harbor-[a-z0-9]+$/);
    assert.ok(trace.harborArgs.includes("sandbox_timeout_secs=7200"));
    assert.ok(trace.harborArgs.includes("sandbox_idle_timeout_secs=600"));
    assert.deepEqual(trace.modalCalls, [
      ["app", "list", "--env", "case-evaluation", "--json"],
      ["app", "stop", "ap-test", "--env", "case-evaluation", "--yes"],
      ["container", "list", "--app-id", "ap-test", "--env", "case-evaluation", "--json"],
    ]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
