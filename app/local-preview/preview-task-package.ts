import { tarBytes } from "../dataset-archive";

type PreviewTask = { title: string; expected: string };

export const previewTasks: Record<string, PreviewTask> = {
  "repair-cache-invalidation": { title: "Repair cache invalidation across workers", expected: "cache repaired" },
  "audit-release-manifest": { title: "Audit release manifest provenance", expected: "provenance audited" },
  "compare-quarterly-reports": { title: "Compare quarterly reports across sources", expected: "reports compared" },
};

export async function previewTaskPackage(taskKey: string): Promise<ArrayBuffer | null> {
  const task = previewTasks[taskKey];
  if (!task) return null;
  const encode = (value: string) => new TextEncoder().encode(value);
  const taskToml = `schema_version = "1.3"

[task]
name = "preview/${taskKey}"
description = "${task.title}"
authors = [{ name = "CASE local preview" }]
keywords = ["preview", "harbor"]

[metadata]
difficulty = "easy"
category = "portal-preview"

[agent]
timeout_sec = 300.0

[verifier]
timeout_sec = 60.0

[environment]
network_mode = "none"
os = "linux"
build_timeout_sec = 300.0
`;
  const tar = tarBytes([
    { path: "task.toml", bytes: encode(taskToml) },
    { path: "instruction.md", bytes: encode(`# ${task.title}\n\nCreate /app/submission/result.txt containing exactly: ${task.expected}\n`) },
    { path: "environment/Dockerfile", bytes: encode("FROM alpine:3.21\nRUN mkdir -p /app/submission\nWORKDIR /app/submission\n") },
    { path: "solution/solve.sh", bytes: encode(`#!/usr/bin/env sh\nset -eu\nprintf '%s\\n' '${task.expected}' > /app/submission/result.txt\n`), mode: 0o755 },
    { path: "tests/test.sh", bytes: encode(`#!/usr/bin/env sh\nset -eu\ntest "$(cat /app/submission/result.txt)" = '${task.expected}'\n`), mode: 0o755 },
  ]);
  const compressed = new Blob([tar]).stream().pipeThrough(new CompressionStream("gzip"));
  return await new Response(compressed).arrayBuffer();
}
