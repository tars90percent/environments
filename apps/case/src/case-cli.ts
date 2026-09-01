#!/usr/bin/env node

import { spawn } from "node:child_process";
import { realpathSync } from "node:fs";
import { extname } from "node:path";
import { fileURLToPath } from "node:url";

const currentFile = fileURLToPath(import.meta.url);

if (process.argv[1] && realpathSync(process.argv[1]) === currentFile) {
  process.exitCode = await runCaseCli(process.argv.slice(2));
}

export async function runCaseCli(arguments_: string[]): Promise<number> {
  const [area, ...rest] = arguments_;
  if (!area || area === "help" || area === "--help" || area === "-h") {
    process.stdout.write(usage());
    return 0;
  }

  switch (area) {
    case "registry":
      if (!rest.length) return invalid("registry requires a command");
      return runNodeEntry("registry-cli", rest);
    case "intake": {
      const [source, planPath, ...extra] = rest;
      if (!planPath || extra.length) return invalid("intake requires a source and one plan file");
      if (source === "feishu") return runNodeEntry("intake-plan-cli", ["capture-feishu-plan", planPath]);
      if (source === "mail") return runNodeEntry("mail-intake-plan-cli", ["capture-mail-plan", planPath]);
      return invalid("intake source must be feishu or mail");
    }
    case "harbor-tasks":
      if (!rest.length) return invalid("harbor-tasks requires plan, publish, plan-all, or publish-all");
      return runNodeEntry("harbor-export-cli", rest);
    case "task-package":
      if (!rest.length) return invalid("task-package requires a package operation");
      return runProcess("python3", [fileURLToPath(new URL("../scripts/case-task-package.py", import.meta.url)), ...rest]);
    default:
      return invalid(`unknown command area: ${area}`);
  }
}

function runNodeEntry(name: string, arguments_: string[]): Promise<number> {
  const sourceMode = extname(currentFile) === ".ts";
  const entry = fileURLToPath(new URL(`./${name}.${sourceMode ? "ts" : "js"}`, import.meta.url));
  return runProcess(process.execPath, sourceMode ? ["--import", "tsx", entry, ...arguments_] : [entry, ...arguments_]);
}

function runProcess(command: string, arguments_: string[]): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, arguments_, { env: process.env, stdio: "inherit" });
    child.once("error", reject);
    child.once("close", (code, signal) => {
      if (signal) {
        process.stderr.write(`Command stopped by ${signal}\n`);
        resolve(1);
      } else {
        resolve(code ?? 1);
      }
    });
  });
}

function invalid(message: string): number {
  process.stderr.write(`${message}\n\n${usage()}`);
  return 1;
}

function usage(): string {
  return [
    "Usage:",
    "  casectl registry <command> [arguments]",
    "  casectl intake feishu <plan.json>",
    "  casectl intake mail <plan.json>",
    "  casectl harbor-tasks plan|publish <submission-id> [submission-id ...]",
    "  casectl harbor-tasks plan-all|publish-all",
    "  casectl task-package <command> [arguments]",
    "",
    "Run `casectl registry operations` for registry command schemas.",
    "Harbor execution remains available through the separate `harbor` command.",
    "",
  ].join("\n");
}
