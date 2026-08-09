import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import test from "node:test";
import {
  LarkAuthorizationManager,
  type LarkCommandRunner,
} from "../src/authorization.js";

test("persists a split OAuth request, completes it later, and verifies the same user", async () => {
  const fixture = await createFixture();
  const calls: string[][] = [];
  const runner: LarkCommandRunner = async (args, options) => {
    calls.push(args);
    if (args.includes("qrcode")) {
      const output = args.at(args.indexOf("--output") + 1);
      assert.ok(output && options?.cwd);
      await writeFile(join(options.cwd, basename(output)), "png");
      return { stdout: "", stderr: "" };
    }
    if (args.includes("--no-wait")) {
      return {
        stdout: JSON.stringify({
          ok: true,
          data: {
            device_code: "temporary-device-code",
            verification_url: "https://accounts.feishu.cn/device?code=opaque",
            expires_in: 600,
          },
        }),
        stderr: "",
      };
    }
    if (args.includes("--device-code")) {
      await setUsers(fixture.configPath, [
        { userOpenId: "ou_owner", userName: "Vincent" },
      ]);
      return {
        stdout: JSON.stringify({ ok: true, data: { user_open_id: "ou_owner" } }),
        stderr: "",
      };
    }
    if (args.includes("status")) {
      return { stdout: JSON.stringify({ ok: true }), stderr: "" };
    }
    throw new Error(`Unexpected lark-cli call: ${args.join(" ")}`);
  };

  const manager = fixture.manager(runner);
  await manager.initialize();
  const started = await manager.start("oc_chat", "ou_owner");
  assert.equal(started.kind, "user-authorization");
  assert.equal(started.verificationUrl, "https://accounts.feishu.cn/device?code=opaque");
  assert.equal((await stat(started.qrPath)).mode & 0o777, 0o600);
  assert.equal((await stat(fixture.statePath)).mode & 0o777, 0o600);

  const restarted = fixture.manager(runner);
  await restarted.initialize();
  const completed = await restarted.complete("oc_chat", "ou_owner");
  assert.deepEqual(completed, {
    kind: "ready",
    userName: "Vincent",
    userOpenId: "ou_owner",
  });
  assert.equal((await readFile(fixture.statePath, "utf8")).includes("temporary-device-code"), false);
  assert.equal(calls.some((args) => args.includes("--verify")), true);
});

test("returns an app configuration link and QR when the app lacks permission", async () => {
  const fixture = await createFixture();
  const runner: LarkCommandRunner = async (args, options) => {
    if (args.includes("qrcode")) {
      const output = args.at(args.indexOf("--output") + 1);
      assert.ok(output && options?.cwd);
      await writeFile(join(options.cwd, basename(output)), "png");
      return { stdout: "", stderr: "" };
    }
    return {
      stdout: JSON.stringify({
        ok: false,
        error: {
          message: "The app needs a user scope",
          console_url: "https://open.feishu.cn/app/permission/opaque",
        },
      }),
      stderr: "",
    };
  };

  const manager = fixture.manager(runner);
  await manager.initialize();
  const result = await manager.start("oc_chat", "ou_owner");
  assert.equal(result.kind, "app-configuration");
  assert.equal(result.verificationUrl, "https://open.feishu.cn/app/permission/opaque");
  await manager.discardQr(result.qrPath);
});

test("rejects and removes a login made by a different Feishu user", async () => {
  const fixture = await createFixture();
  const runner: LarkCommandRunner = async (args, options) => {
    if (args.includes("qrcode")) {
      const output = args.at(args.indexOf("--output") + 1);
      assert.ok(output && options?.cwd);
      await writeFile(join(options.cwd, basename(output)), "png");
      return { stdout: "", stderr: "" };
    }
    if (args.includes("--no-wait")) {
      return {
        stdout: JSON.stringify({
          ok: true,
          device_code: "temporary-device-code",
          verification_url: "https://accounts.feishu.cn/device?code=opaque",
        }),
        stderr: "",
      };
    }
    if (args.includes("--device-code")) {
      await setUsers(fixture.configPath, [
        { userOpenId: "ou_someone_else", userName: "Someone Else" },
      ]);
      return {
        stdout: JSON.stringify({
          ok: true,
          data: { user_open_id: "ou_someone_else" },
        }),
        stderr: "",
      };
    }
    throw new Error(`Unexpected lark-cli call: ${args.join(" ")}`);
  };

  const manager = fixture.manager(runner);
  await manager.initialize();
  await manager.start("oc_chat", "ou_owner");
  const result = await manager.complete("oc_chat", "ou_owner");
  assert.equal(result.kind, "wrong-user");

  const config = JSON.parse(await readFile(fixture.configPath, "utf8"));
  assert.deepEqual(config.apps[0].users, []);
});

async function createFixture() {
  const root = await mkdtemp(join(tmpdir(), "feishu-codex-auth-"));
  const configDirectory = join(root, "lark-config");
  const qrDirectory = join(root, "qr");
  const statePath = join(root, "authorization.json");
  const configPath = join(configDirectory, "config.json");
  await writeFile(join(root, ".placeholder"), "");
  await mkdir(configDirectory, { recursive: true });
  await writeFile(
    configPath,
    JSON.stringify({
      apps: [
        {
          appId: "cli_test",
          appSecret: { source: "file", id: join(configDirectory, "app-secret") },
          brand: "feishu",
          defaultAs: "bot",
          users: [],
        },
      ],
    }),
  );
  await chmod(configPath, 0o600);

  return {
    configPath,
    statePath,
    manager: (runner: LarkCommandRunner) =>
      new LarkAuthorizationManager({
        executable: "lark-cli",
        stateFile: statePath,
        qrDirectory,
        defaultDomains: ["all"],
        env: { LARKSUITE_CLI_CONFIG_DIR: configDirectory },
        runner,
        now: () => new Date("2026-08-08T00:00:00.000Z"),
      }),
  };
}

async function setUsers(
  configPath: string,
  users: Array<{ userOpenId: string; userName: string }>,
): Promise<void> {
  const config = JSON.parse(await readFile(configPath, "utf8"));
  config.apps[0].users = users;
  await writeFile(configPath, JSON.stringify(config));
}
