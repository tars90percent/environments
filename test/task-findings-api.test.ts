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
