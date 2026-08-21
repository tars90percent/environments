#!/usr/bin/env node

import { execFile, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { promisify } from "node:util";
import {
  assertModalCredentials,
  createHarborEnvironment,
  createHarborRunPolicy,
  createModalControlEnvironment,
  parseModalAppList,
  parseModalContainerList,
  prepareHarborArguments,
} from "./harbor-runtime.js";

const execFileAsync = promisify(execFile);
const requestedArguments = process.argv.slice(2);
const isRun = requestedArguments[0] === "run";
const runPolicy = isRun ? createHarborRunPolicy(process.env, randomUUID()) : undefined;
const arguments_ = prepareHarborArguments(requestedArguments, runPolicy);
const workDirectory = resolve(process.env.CASE_HARBOR_WORKDIR ?? "/data/evaluations");
const home = resolve(process.env.CASE_HARBOR_HOME ?? "/data/harbor-home");
const environment = createHarborEnvironment(process.env, home);

if (isRun) assertModalCredentials(environment);

await mkdir(workDirectory, { recursive: true });
await mkdir(home, { recursive: true });

const harborBinary = process.env.CASE_HARBOR_BIN ?? "/opt/harbor-bin/harbor";
const child = spawn(harborBinary, arguments_, {
  cwd: workDirectory,
  env: environment,
  stdio: "inherit",
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => child.kill(signal));
}

const result = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(
  (resolveResult, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => resolveResult({ code, signal }));
  },
);

let cleanupFailed = false;
if (isRun && runPolicy && !requestedArguments.includes("--print-config")) {
  try {
    await stopModalRunApp(runPolicy.appName, home);
  } catch (error) {
    cleanupFailed = true;
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`CASE Harbor failed to verify Modal cleanup for ${runPolicy.appName}: ${message}\n`);
  }
}

if (result.signal) {
  process.stderr.write(`Harbor stopped by ${result.signal}\n`);
  process.exitCode = 1;
} else {
  process.exitCode = cleanupFailed ? 1 : (result.code ?? 1);
}

async function stopModalRunApp(appName: string, modalHome: string): Promise<void> {
  const modalBinary = process.env.CASE_MODAL_BIN ?? "/usr/local/bin/modal";
  const modalEnvironment = createModalControlEnvironment(process.env, modalHome);
  assertModalCredentials(modalEnvironment);
  const environmentName = modalEnvironment.MODAL_ENVIRONMENT!;
  const commonOptions = {
    env: modalEnvironment,
    timeout: 60_000,
    maxBuffer: 10 * 1024 * 1024,
  };

  const before = await execFileAsync(
    modalBinary,
    ["app", "list", "--env", environmentName, "--json"],
    commonOptions,
  );
  const app = parseModalAppList(before.stdout).find((entry) => entry.description === appName);
  if (!app) return;

  await execFileAsync(
    modalBinary,
    ["app", "stop", app.appId, "--env", environmentName, "--yes"],
    commonOptions,
  );
  const after = await execFileAsync(
    modalBinary,
    ["container", "list", "--app-id", app.appId, "--env", environmentName, "--json"],
    commonOptions,
  );
  const containers = parseModalContainerList(after.stdout);
  if (containers.length > 0) {
    throw new Error(`Modal still reports ${containers.length} active container(s)`);
  }
}
