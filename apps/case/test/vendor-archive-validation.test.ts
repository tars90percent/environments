import assert from "node:assert/strict";
import test from "node:test";
import { parseVendorArchive, ValidationError } from "../src/registry/validation.js";

test("validates vendor archival requests", () => {
  assert.deepEqual(parseVendorArchive({
    vendorId: "vendor-one",
    reason: "The duplicate registry entry has been reconciled.",
    actor: "TARS",
  }), {
    vendorId: "vendor-one",
    reason: "The duplicate registry entry has been reconciled.",
    actor: "TARS",
  });
});

test("requires a reason and verified actor for vendor archival", () => {
  assert.throws(
    () => parseVendorArchive({ vendorId: "vendor-one", reason: "", actor: "TARS" }),
    ValidationError,
  );
  assert.throws(
    () => parseVendorArchive({ vendorId: "vendor-one", reason: "Duplicate entry.", actor: "" }),
    ValidationError,
  );
});

test("rejects malformed vendor archival requests", () => {
  assert.throws(
    () => parseVendorArchive({ vendorId: "vendor one", reason: "Duplicate entry.", actor: "TARS" }),
    ValidationError,
  );
  assert.throws(
    () => parseVendorArchive({ vendorId: "vendor-one", reason: "x".repeat(5_001), actor: "TARS" }),
    ValidationError,
  );
});
