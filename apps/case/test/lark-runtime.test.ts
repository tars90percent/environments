import assert from "node:assert/strict";
import { readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtemp } from "node:fs/promises";
import test from "node:test";
import { prepareLarkRuntimeEnv } from "../src/lark-runtime.js";

test("turns Railway app credentials into a renewable file-based lark profile", async () => {
  const root = await mkdtemp(join(tmpdir(), "feishu-codex-lark-"));
  try {
    const result = await prepareLarkRuntimeEnv({
      LARKSUITE_CLI_APP_ID: "cli_test",
      LARKSUITE_CLI_APP_SECRET: "secret-value",
      LARKSUITE_CLI_BRAND: "feishu",
      LARKSUITE_CLI_CONFIG_DIR: root,
      LARKSUITE_CLI_TENANT_ACCESS_TOKEN: "short-lived-token",
    });

    assert.equal(result.LARKSUITE_CLI_CONFIG_DIR, root);
    assert.equal(result.LARKSUITE_CLI_APP_ID, undefined);
    assert.equal(result.LARKSUITE_CLI_APP_SECRET, undefined);
    assert.equal(result.LARKSUITE_CLI_TENANT_ACCESS_TOKEN, undefined);

    const secretPath = join(root, "app-secret");
    const config = JSON.parse(await readFile(join(root, "config.json"), "utf8"));
    assert.equal(await readFile(secretPath, "utf8"), "secret-value");
    assert.equal(config.apps[0].appSecret.source, "file");
    assert.equal(config.apps[0].appSecret.id, secretPath);
    assert.equal(JSON.stringify(config).includes("secret-value"), false);
    assert.equal((await stat(secretPath)).mode & 0o777, 0o600);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("leaves a normal local lark-cli environment unchanged", async () => {
  const source = { PATH: "/usr/bin" };
  assert.deepEqual(await prepareLarkRuntimeEnv(source), source);
});

test("preserves Railway user logins while removing the old bot-only restriction", async () => {
  const root = await mkdtemp(join(tmpdir(), "feishu-codex-lark-"));
  try {
    await writeFile(
      join(root, "config.json"),
      JSON.stringify({
        strictMode: "bot",
        apps: [
          {
            appId: "cli_test",
            appSecret: { source: "file", id: "/old/secret" },
            brand: "feishu",
            defaultAs: "bot",
            strictMode: "bot",
            users: [{ userOpenId: "ou_owner", userName: "Owner" }],
          },
        ],
      }),
    );

    await prepareLarkRuntimeEnv({
      LARKSUITE_CLI_APP_ID: "cli_test",
      LARKSUITE_CLI_APP_SECRET: "new-secret",
      LARKSUITE_CLI_CONFIG_DIR: root,
    });

    const config = JSON.parse(await readFile(join(root, "config.json"), "utf8"));
    assert.equal(config.strictMode, undefined);
    assert.equal(config.apps[0].strictMode, undefined);
    assert.equal(config.apps[0].defaultAs, "bot");
    assert.deepEqual(config.apps[0].users, [
      { userOpenId: "ou_owner", userName: "Owner" },
    ]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
