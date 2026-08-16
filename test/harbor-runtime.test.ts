import assert from "node:assert/strict";
import test from "node:test";
import {
  assertModalCredentials,
  createHarborEnvironment,
  prepareHarborArguments,
} from "../src/harbor-runtime.js";

test("forces CASE Harbor runs onto Modal", () => {
  assert.deepEqual(
    prepareHarborArguments(["run", "--path", "/task"]),
    ["run", "--path", "/task", "--env", "modal"],
  );
  assert.deepEqual(
    prepareHarborArguments(["run", "--path", "/task", "-e", "modal"]),
    ["run", "--path", "/task", "-e", "modal"],
  );
  assert.throws(
    () => prepareHarborArguments(["run", "--path", "/task", "--env=docker"]),
    /must use the Modal environment/,
  );
  assert.deepEqual(prepareHarborArguments(["--version"]), ["--version"]);
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
  }));
  assert.throws(() => assertModalCredentials({ MODAL_TOKEN_ID: "modal-id" }), /Modal credentials are required/);
});
