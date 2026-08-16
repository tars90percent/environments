#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import {
  assertModalCredentials,
  createHarborEnvironment,
  prepareHarborArguments,
} from "./harbor-runtime.js";

const arguments_ = prepareHarborArguments(process.argv.slice(2));
const workDirectory = resolve(process.env.CASE_HARBOR_WORKDIR ?? "/data/evaluations");
const home = resolve(process.env.CASE_HARBOR_HOME ?? "/data/harbor-home");
const environment = createHarborEnvironment(process.env, home);

if (arguments_[0] === "run") assertModalCredentials(environment);

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

if (result.signal) {
  process.stderr.write(`Harbor stopped by ${result.signal}\n`);
  process.exitCode = 1;
} else {
  process.exitCode = result.code ?? 1;
}
