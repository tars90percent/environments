import assert from "node:assert/strict";
import test from "node:test";
import { startRegistryServer } from "../src/registry/api.js";
import type { RegistryRepository } from "../src/registry/repository.js";
import type { TaskFindingInput, TaskFindingUpdateInput } from "../src/registry/types.js";

test("creates, updates, and deletes plain task findings through the admin API", async () => {
  const calls: Array<{ operation: string; value: unknown }> = [];
  const repository = {
    recordTaskFinding: async (input: TaskFindingInput) => {
      calls.push({ operation: "create", value: input });
      return { findingId: input.id, created: true };
    },
    updateTaskFinding: async (input: TaskFindingUpdateInput) => {
      calls.push({ operation: "update", value: input });
      return { findingId: input.id, updated: true };
    },
    deleteTaskFinding: async (id: string) => {
      calls.push({ operation: "delete", value: id });
      return { findingId: id, deleted: true };
    },
  } as RegistryRepository;
  const adminToken = "admin-token-with-at-least-32-characters";
  const catalogToken = "catalog-token-with-at-least-32-characters";
  const server = await startRegistryServer({
    repository,
    adminToken,
    catalogToken,
    reviewToken: "review-token-with-at-least-32-characters",
    uploadToken: "upload-token-with-at-least-32-characters",
    host: "127.0.0.1",
    port: 0,
  });

  try {
    const finding = {
      id: "finding:task-one:verifier",
      taskVersionId: "submission-one:task-one",
      finding: "The verifier reads the wrong filesystem.",
    };
    const created = await api(server.url, adminToken, "POST", "/v1/task-findings", finding);
    assert.equal(created.status, 201);
    assert.deepEqual(created.body, { findingId: finding.id, created: true });

    const updated = await api(server.url, adminToken, "PATCH", `/v1/task-findings/${finding.id}`, {
      id: finding.id,
      finding: "The verifier now reads the modified filesystem.",
    });
    assert.equal(updated.status, 200);
    assert.deepEqual(updated.body, { findingId: finding.id, updated: true });

    const forbidden = await api(server.url, catalogToken, "DELETE", `/v1/task-findings/${finding.id}`);
    assert.equal(forbidden.status, 403);

    const deleted = await api(server.url, adminToken, "DELETE", `/v1/task-findings/${finding.id}`);
    assert.equal(deleted.status, 200);
    assert.deepEqual(deleted.body, { findingId: finding.id, deleted: true });

    const legacy = await api(server.url, adminToken, "POST", "/v1/task-findings", {
      ...finding,
      kind: "deterministic_result",
    });
    assert.equal(legacy.status, 400);
    assert.match(String(legacy.body.message), /unsupported fields: kind/);

    assert.deepEqual(calls, [
      { operation: "create", value: finding },
      {
        operation: "update",
        value: { id: finding.id, finding: "The verifier now reads the modified filesystem." },
      },
      { operation: "delete", value: finding.id },
    ]);
  } finally {
    await server.close();
  }
});

async function api(
  baseUrl: string,
  token: string,
  method: "POST" | "PATCH" | "DELETE",
  path: string,
  body?: unknown,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() as Record<string, unknown> };
}
