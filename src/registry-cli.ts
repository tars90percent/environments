#!/usr/bin/env node

import { readFile } from "node:fs/promises";

const [command, argument] = process.argv.slice(2);
const baseUrl = (process.env.CASE_REGISTRY_URL ?? `http://127.0.0.1:${process.env.PORT ?? "3000"}`).replace(/\/$/, "");
const token = process.env.CASE_REGISTRY_ADMIN_TOKEN;

if (!token) fail("CASE_REGISTRY_ADMIN_TOKEN is required");

switch (command) {
  case "catalog":
    output(await request("GET", "/v1/catalog?scope=all"));
    break;
  case "vendors":
    output((await request("GET", "/v1/catalog?scope=all") as { vendors: unknown[] }).vendors);
    break;
  case "vendor":
    output(await request("GET", `/v1/vendors/${encode(argument, "vendor id")}?scope=all`));
    break;
  case "batch":
    output(await request("GET", `/v1/batches/${encode(argument, "batch id")}?scope=all`));
    break;
  case "task":
    output(await request("GET", `/v1/tasks/${encode(argument, "task version id")}?scope=all`));
    break;
  case "operations":
    output(await request("GET", "/v1/operations/summary"));
    break;
  case "import":
    output(await request("POST", "/v1/intake/submissions", await jsonFile(argument)));
    break;
  case "record-check":
    output(await request("POST", "/v1/check-results", await jsonFile(argument)));
    break;
  case "record-follow-up":
    output(await request("POST", "/v1/follow-ups", await jsonFile(argument)));
    break;
  case "register-artifact":
    output(await request("POST", "/v1/artifacts", await jsonFile(argument)));
    break;
  case "set-status":
    output(await request("POST", "/v1/status", await jsonFile(argument)));
    break;
  case "lease-work":
    output(await request("POST", "/v1/work/lease", { workerId: required(argument, "worker id"), leaseSeconds: 900 }));
    break;
  case "complete-work":
    output(await request("POST", "/v1/work/complete", await jsonFile(argument)));
    break;
  default:
    fail("Usage: case-registry <catalog|vendors|vendor|batch|task|operations|import|record-check|record-follow-up|register-artifact|set-status|lease-work|complete-work> [id|json-file]");
}

async function request(method: string, path: string, body?: unknown): Promise<unknown> {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const value = await response.json() as Record<string, unknown>;
  if (!response.ok) throw new Error(`${response.status} ${JSON.stringify(value)}`);
  return value;
}

async function jsonFile(path: string | undefined): Promise<unknown> {
  if (!path) fail("A JSON file path is required");
  return JSON.parse(await readFile(path, "utf8"));
}

function encode(value: string | undefined, name: string): string {
  if (!value) fail(`${name} is required`);
  return encodeURIComponent(value);
}

function required(value: string | undefined, name: string): string {
  if (!value?.trim()) fail(`${name} is required`);
  return value.trim();
}

function output(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function fail(message: string): never {
  throw new Error(message);
}
