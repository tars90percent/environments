import assert from "node:assert/strict";
import { chmod, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { inspectCodexLogin } from "../src/auth.js";

test("reports signed-in, signed-out, and unavailable Codex credential slots", async () => {
  const directory = await mkdtemp(join(tmpdir(), "case-auth-status-"));
  const executable = join(directory, "codex-status");
  await writeFile(executable, [
    "#!/bin/sh",
    "case \"$CASE_TEST_AUTH_STATE\" in",
    "  signed-in) echo 'Logged in using ChatGPT'; exit 0 ;;",
    "  signed-out) echo 'Not logged in'; exit 1 ;;",
    "  *) echo 'status check failed' >&2; exit 2 ;;",
    "esac",
    "",
  ].join("\n"));
  await chmod(executable, 0o700);

  assert.equal(await inspectCodexLogin(executable, join(directory, "primary"), {
    CASE_TEST_AUTH_STATE: "signed-in",
  }), "signed-in");
  assert.equal(await inspectCodexLogin(executable, join(directory, "backup"), {
    CASE_TEST_AUTH_STATE: "signed-out",
  }), "signed-out");
  assert.equal(await inspectCodexLogin(executable, join(directory, "backup"), {
    CASE_TEST_AUTH_STATE: "broken",
  }), "unavailable");
});
