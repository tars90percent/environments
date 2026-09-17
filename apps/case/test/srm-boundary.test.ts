import assert from "node:assert/strict";
import test from "node:test";
import { assertHarborTasks, harborSubmissionFromBase } from "../src/registry/srm-boundary.js";

const reference = {
  vendor: { id: "example", name: "Example", short: "EX" },
  submission: { id: "example-samples", date: "2026-09-17", label: "Samples" },
  baseRecordId: "recExample",
  actor: "test",
};

test("Base-linked registration is replayable and carries no original payload or narrative", () => {
  const capture = harborSubmissionFromBase(reference);
  assert.deepEqual(capture, harborSubmissionFromBase(reference));
  assert.deepEqual(capture.artifacts, []);
  assert.deepEqual(capture.submission.formats, ["harbor"]);
  assert.equal(capture.sources.length, 1);
  const source = capture.sources[0]!;
  assert.ok("sourceEvent" in source);
  assert.equal(source.sourceEvent.rawArtifactId, undefined);
  assert.equal(source.sourceEvent.sender, undefined);
  assert.equal(source.sourceEvent.metadata?.datePrecision, "day");
  assert.equal(source.items[0]!.artifactId, undefined);
  assert.match(source.items[0]!.locator!, /record=recExample$/);
  assert.equal(source.items[0]!.id, "base-harbor:example-samples:record");
});

test("registration rejects original metadata and invalid identities instead of silently losing them", () => {
  assert.throws(() => harborSubmissionFromBase({ ...reference, sources: ["original"] }), /technical grouping/);
  assert.throws(() => harborSubmissionFromBase({ ...reference, vendor: { ...reference.vendor, description: "supplier narrative" } }), /technical grouping/);
  assert.throws(() => harborSubmissionFromBase({ ...reference, baseRecordId: "a display name" }), /record ID/);
  assert.throws(() => harborSubmissionFromBase({ ...reference, submission: { ...reference.submission, date: "2026-02-30" } }), /valid YYYY-MM-DD/);
});

test("failed static classification and vendor traces cannot enter the Harbor registration", () => {
  assertHarborTasks([{ kind: "task", format: "harbor" }]);
  assert.throws(() => assertHarborTasks([{ kind: "task", format: "non_harbor" }]), /statically valid Harbor/);
  assert.throws(() => assertHarborTasks([{ kind: "trace", format: "harbor" }]), /statically valid Harbor/);
});
