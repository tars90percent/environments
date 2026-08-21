import assert from "node:assert/strict";
import test from "node:test";
import {
  assertModalCredentials,
  createHarborEnvironment,
  createHarborRunPolicy,
  createModalControlEnvironment,
  parseModalAppList,
  parseModalContainerList,
  prepareHarborArguments,
} from "../src/harbor-runtime.js";

const policy = {
  appName: "case-harbor-test123",
  sandboxTimeoutSecs: 7200,
  sandboxIdleTimeoutSecs: 600,
};

test("forces CASE Harbor runs onto Modal with bounded per-run lifecycle settings", () => {
  assert.deepEqual(
    prepareHarborArguments(["run", "--path", "/task"], policy),
    [
      "run", "--path", "/task", "--env", "modal",
      "--ek", "app_name=case-harbor-test123",
      "--ek", "sandbox_timeout_secs=7200",
      "--ek", "sandbox_idle_timeout_secs=600",
    ],
  );
  assert.deepEqual(
    prepareHarborArguments(["run", "--path", "/task", "-e", "modal"], policy),
    [
      "run", "--path", "/task", "-e", "modal",
      "--ek", "app_name=case-harbor-test123",
      "--ek", "sandbox_timeout_secs=7200",
      "--ek", "sandbox_idle_timeout_secs=600",
    ],
  );
  assert.throws(
    () => prepareHarborArguments(["run", "--path", "/task", "--env=docker"], policy),
    /must use the Modal environment/,
  );
  assert.throws(
    () => prepareHarborArguments(["run", "--path", "/task"]),
    /require a lifecycle policy/,
  );
  assert.throws(
    () => prepareHarborArguments([
      "run", "--path", "/task", "--ek", "sandbox_timeout_secs=86400",
    ], policy),
    /reserved by CASE lifecycle policy/,
  );
  assert.deepEqual(prepareHarborArguments(["--version"]), ["--version"]);
});

test("builds a unique bounded Modal run policy", () => {
  assert.deepEqual(
    createHarborRunPolicy({}, "A1-b2_C3"),
    {
      appName: "case-harbor-a1b2c3",
      sandboxTimeoutSecs: 7200,
      sandboxIdleTimeoutSecs: 600,
    },
  );
  assert.deepEqual(
    createHarborRunPolicy({
      CASE_HARBOR_SANDBOX_TIMEOUT_SECS: "3600",
      CASE_HARBOR_SANDBOX_IDLE_TIMEOUT_SECS: "300",
    }, "run1"),
    {
      appName: "case-harbor-run1",
      sandboxTimeoutSecs: 3600,
      sandboxIdleTimeoutSecs: 300,
    },
  );
  assert.throws(
    () => createHarborRunPolicy({ CASE_HARBOR_SANDBOX_TIMEOUT_SECS: "86401" }, "run1"),
    /must be an integer/,
  );
  assert.throws(
    () => createHarborRunPolicy({
      CASE_HARBOR_SANDBOX_TIMEOUT_SECS: "300",
      CASE_HARBOR_SANDBOX_IDLE_TIMEOUT_SECS: "600",
    }, "run1"),
    /must be an integer/,
  );
});

test("passes evaluation credentials but strips CASE production credentials", () => {
  const environment = createHarborEnvironment({
    PATH: "/usr/bin",
    MODAL_TOKEN_ID: "modal-id",
    MODAL_TOKEN_SECRET: "modal-secret",
    OPENAI_API_KEY: "model-key",
    DATABASE_URL: "postgres://production",
    CASE_REGISTRY_ADMIN_TOKEN: "registry-secret",
    AWS_SECRET_ACCESS_KEY: "artifact-secret",
    LARKSUITE_CLI_APP_SECRET: "feishu-secret",
    EVALUATION_ONLY_TOKEN: "evaluation-key",
    CASE_HARBOR_ALLOWED_ENV: "EVALUATION_ONLY_TOKEN",
  }, "/data/harbor-home");

  assert.equal(environment.MODAL_TOKEN_ID, "modal-id");
  assert.equal(environment.OPENAI_API_KEY, "model-key");
  assert.equal(environment.EVALUATION_ONLY_TOKEN, "evaluation-key");
  assert.equal(environment.DATABASE_URL, undefined);
  assert.equal(environment.CASE_REGISTRY_ADMIN_TOKEN, undefined);
  assert.equal(environment.AWS_SECRET_ACCESS_KEY, undefined);
  assert.equal(environment.LARKSUITE_CLI_APP_SECRET, undefined);
  assert.equal(environment.HOME, "/data/harbor-home");
});

test("refuses an attempt to opt production credentials into Harbor", () => {
  assert.throws(
    () => createHarborEnvironment({
      DATABASE_URL: "postgres://production",
      CASE_HARBOR_ALLOWED_ENV: "DATABASE_URL",
    }, "/tmp/harbor-home"),
    /cannot expose production credential DATABASE_URL/,
  );
});

test("requires both Modal token fields for a run", () => {
  assert.doesNotThrow(() => assertModalCredentials({
    MODAL_TOKEN_ID: "modal-id",
    MODAL_TOKEN_SECRET: "modal-secret",
    MODAL_ENVIRONMENT: "case-evaluation",
  }));
  assert.throws(
    () => assertModalCredentials({
      MODAL_TOKEN_ID: "modal-id",
      MODAL_TOKEN_SECRET: "modal-secret",
    }),
    /Modal credentials and environment are required/,
  );
});

test("Modal control subprocess receives no model or production credentials", () => {
  const environment = createModalControlEnvironment({
    PATH: "/usr/bin",
    MODAL_TOKEN_ID: "modal-id",
    MODAL_TOKEN_SECRET: "modal-secret",
    MODAL_ENVIRONMENT: "case-evaluation",
    OPENAI_API_KEY: "model-key",
    DATABASE_URL: "postgres://production",
    CASE_REGISTRY_ADMIN_TOKEN: "registry-secret",
  }, "/data/harbor-home");

  assert.equal(environment.MODAL_TOKEN_ID, "modal-id");
  assert.equal(environment.MODAL_ENVIRONMENT, "case-evaluation");
  assert.equal(environment.OPENAI_API_KEY, undefined);
  assert.equal(environment.DATABASE_URL, undefined);
  assert.equal(environment.CASE_REGISTRY_ADMIN_TOKEN, undefined);
});

test("parses Modal cleanup inventory", () => {
  assert.deepEqual(parseModalAppList(JSON.stringify([{
    app_id: "ap-123",
    description: "case-harbor-run1",
    state: "deployed",
    tasks: "1",
  }])), [{
    appId: "ap-123",
    description: "case-harbor-run1",
    state: "deployed",
    tasks: 1,
  }]);
  assert.deepEqual(parseModalContainerList("[]"), []);
  assert.throws(() => parseModalAppList("{}"), /did not return an array/);
});
