// Run inside the built image without network access or production credentials.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Codex } from "@openai/codex-sdk";

const root = mkdtempSync(join(tmpdir(), "case-runtime-smoke-"));
const env = {
  ...process.env,
  PATH: `/app/node_modules/.bin:${process.env.PATH}`,
  CODEX_HOME: join(root, "codex"),
  LARKSUITE_CLI_CONFIG_DIR: join(root, "lark-config"),
  LARKSUITE_CLI_DATA_DIR: join(root, "lark-data"),
  LARKSUITE_CLI_NO_UPDATE_NOTIFIER: "1",
  LARKSUITE_CLI_NO_SKILLS_NOTIFIER: "1",
  CASE_HARBOR_WORKDIR: join(root, "evaluations"),
  CASE_HARBOR_HOME: join(root, "harbor-home"),
  NO_COLOR: "1",
  TERM: "dumb",
};
const run = (command, args) => execFileSync(command, args, {
  env, encoding: "utf8", timeout: 30_000, maxBuffer: 2 * 1024 * 1024,
});

try {
  const { dependencies } = JSON.parse(readFileSync("/app/package.json", "utf8"));
  assert.ok(run("codex", ["--version"]).includes(dependencies["@openai/codex-sdk"]));
  assert.ok(run("lark-cli", ["--version"]).includes(dependencies["@larksuite/cli"]));
  assert.match(run("codex", ["exec", "--experimental-json", "--help"]), /--json/);
  assert.match(run("codex", ["exec", "resume", "--help"]), /--skip-git-repo-check/);
  const consumer = run("lark-cli", ["event", "consume", "--help"]);
  assert.match(consumer, /NDJSON/);
  assert.match(consumer, /--as/);
  const reply = run("lark-cli", ["im", "+messages-reply", "--help"]);
  for (const flag of ["--as", "--message-id", "--text", "--idempotency-key", "--json"]) {
    assert.ok(reply.includes(flag), `Lark reply is missing ${flag}`);
  }
  assert.match(run("casectl", ["--help"]), /registry/);
  assert.match(run("harbor", ["--version"]), /0\.22\.0/);
  assert.match(run("modal", ["--version"]), /1\.5\.5/);
  for (const args of [["app", "list"], ["app", "stop"], ["container", "list"]]) {
    assert.match(run("modal", [...args, "--help"]), /--env/);
  }
  // Exercise SDK subprocess/event handling with a fixture, never a live model call.
  const fixture = join(root, "codex-fixture.mjs");
  const trace = join(root, "codex-args.json");
  writeFileSync(fixture, `#!/usr/bin/env node
import { writeFileSync } from "node:fs";
let input = "";
for await (const chunk of process.stdin) input += chunk;
writeFileSync(${JSON.stringify(trace)}, JSON.stringify({ args: process.argv.slice(2), input, home: process.env.CODEX_HOME }));
for (const event of [
  { type: "thread.started", thread_id: "smoke-thread" },
  { type: "item.completed", item: { id: "reply", type: "agent_message", text: "smoke reply" } },
  { type: "turn.completed", usage: { input_tokens: 1, cached_input_tokens: 0, output_tokens: 1 } },
]) console.log(JSON.stringify(event));
`);
  chmodSync(fixture, 0o755);
  const codex = new Codex({ codexPathOverride: fixture, env, config: { approvals_reviewer: "auto_review" } });
  const options = {
    workingDirectory: root, skipGitRepoCheck: true, sandboxMode: "read-only",
    approvalPolicy: "never", networkAccessEnabled: false, webSearchMode: "disabled",
  };
  const thread = codex.startThread(options);
  assert.equal((await thread.run("synthetic prompt")).finalResponse, "smoke reply");
  assert.equal(thread.id, "smoke-thread");
  const fresh = JSON.parse(readFileSync(trace, "utf8"));
  assert.equal(fresh.input, "synthetic prompt");
  assert.equal(fresh.home, env.CODEX_HOME);
  assert.ok(fresh.args.some((arg) => arg === "--json" || arg === "--experimental-json"));
  for (const option of ["--skip-git-repo-check", 'approvals_reviewer="auto_review"', 'approval_policy="never"']) {
    assert.ok(fresh.args.includes(option), `SDK invocation is missing ${option}`);
  }
  const resumed = codex.resumeThread(thread.id, options);
  assert.equal((await resumed.run("resume prompt")).finalResponse, "smoke reply");
  const resumeArgs = JSON.parse(readFileSync(trace, "utf8")).args;
  assert.equal(resumeArgs[resumeArgs.indexOf("resume") + 1], "smoke-thread");
  run("python3", ["-c", `
import importlib.metadata, json, pathlib, subprocess, tempfile
assert importlib.metadata.version("harbor") == "0.22.0"
assert importlib.metadata.version("modal") == "1.5.5"
with tempfile.TemporaryDirectory() as directory:
    root = pathlib.Path(directory)
    (root / "environment").mkdir()
    (root / "tests").mkdir()
    (root / "task.toml").write_text('version = "1.0"\\n')
    (root / "instruction.md").write_text("Synthetic format fixture; never execute.\\n")
    (root / "environment" / "Dockerfile").write_text("FROM scratch\\n")
    (root / "tests" / "test.sh").write_text("exit 99\\n")
    def validate():
        return json.loads(subprocess.check_output(["python3", "/app/scripts/case-harbor-format.py", str(root)]))
    assert validate()["valid"] is True
    (root / "task.toml").write_text("not valid TOML [")
    assert validate()["valid"] is False
    (root / "task.toml").unlink()
    assert validate()["valid"] is False
`]);
  console.log("CASE runtime smoke checks passed (offline; no task execution).");
} finally {
  rmSync(root, { recursive: true, force: true });
}
