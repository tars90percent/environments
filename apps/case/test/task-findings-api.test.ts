import assert from "node:assert/strict";
import test from "node:test";
import { startRegistryServer } from "../src/registry/api.js";
import type { RegistryRepository } from "../src/registry/repository.js";

test("does not expose trusted registry writes through the portal API", async () => {
  const catalogToken = "catalog-token-with-at-least-32-characters";
  const server = await startRegistryServer({
    repository: {} as RegistryRepository,
    catalogToken,
    uploadToken: "upload-token-with-at-least-32-characters",
    host: "127.0.0.1",
    port: 0,
  });

  try {
    for (const path of ["/v1/harbor-findings", "/v1/harbor-checks", "/v1/intake/submissions", "/v1/artifacts"]) {
      const response = await fetch(`${server.url}${path}`, {
        method: "POST",
        headers: { authorization: `Bearer ${catalogToken}`, "content-type": "application/json" },
        body: "{}",
      });
      assert.equal(response.status, 404, path);
    }
  } finally {
    await server.close();
  }
});

test("serves submissions without the former batch route", async () => {
  const catalogToken = "catalog-token-with-at-least-32-characters";
  const submission = { id: "submission-one", tasks: [] };
  const repository = {
    getSampleSubmission: async (id: string) => id === submission.id ? submission : null,
  } as unknown as RegistryRepository;
  const server = await startRegistryServer({
    repository,
    catalogToken,
    uploadToken: "upload-token-with-at-least-32-characters",
    host: "127.0.0.1",
    port: 0,
  });

  try {
    const current = await fetch(`${server.url}/v1/submissions/${submission.id}`, {
      headers: { authorization: `Bearer ${catalogToken}` },
    });
    assert.equal(current.status, 200);
    assert.deepEqual(await current.json(), submission);

    const former = await fetch(`${server.url}/v1/batches/${submission.id}`, {
      headers: { authorization: `Bearer ${catalogToken}` },
    });
    assert.equal(former.status, 404);
  } finally {
    await server.close();
  }
});
