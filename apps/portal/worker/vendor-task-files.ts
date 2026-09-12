import type { CatalogSnapshot } from "../app/catalog";
import { harborTaskBucketPrefix } from "../app/dataset-archive";
import { harborEntryRole, type UpstreamTaskFilesystemEntry } from "../app/model-benchmark-filesystems";

const previewLimit = 8 * 1024 * 1024;
const headers = { "cache-control": "private, no-store", "x-content-type-options": "nosniff" };

export function validTaskFilePath(path: string): boolean {
  return Boolean(path) && !path.includes("\\") && ![...path].some((character) => character.codePointAt(0)! < 32 || character.codePointAt(0) === 127)
    && path.split("/").every((part) => part !== "" && part !== "." && part !== "..");
}

export async function vendorTaskFiles(request: Request, taskId: string, action: string, catalog: CatalogSnapshot, gatewayUrl: string, gatewayToken: string): Promise<Response> {
  const context = catalog.vendors.flatMap((vendor) => vendor.submissions.flatMap((submission) => submission.tasks
    .filter((task) => task.id === taskId && task.kind === "task" && task.format === "harbor")
    .map((task) => ({ vendor, submission, task }))));
  if (context.length !== 1) return Response.json({ error: "task_not_found" }, { status: 404, headers });
  const { vendor, submission, task } = context[0];
  const details = {
    task,
    vendor: { id: vendor.id, name: vendor.name },
    submission: { id: submission.id, label: submission.label, date: submission.date },
  };
  if (!task.sourcePath) return Response.json({ ...details, entries: [], available: false }, { status: action === "files" ? 200 : 404, headers });
  const root = harborTaskBucketPrefix(vendor.id, submission.id, task.sourcePath, task.id);
  const rootUrl = `${gatewayUrl}/${root.split("/").map(encodeURIComponent).join("/")}/`;
  const auth = { authorization: `Bearer ${gatewayToken}` };

  if (action === "files") {
    const entries = new Map<string, UpstreamTaskFilesystemEntry>();
    const seenCursors = new Set<string>();
    let cursor: string | null = null;
    do {
      const url = new URL(rootUrl);
      url.searchParams.set("recursive", "true");
      url.searchParams.set("limit", "1000");
      if (cursor) url.searchParams.set("cursor", cursor);
      const response = await fetch(url.href, { headers: auth, redirect: "error" });
      if (!response.ok) throw new Error("Task listing unavailable");
      const page = await response.json() as { entries: Array<{ type: string; path: string; sizeBytes: number }>; nextCursor: string | null };
      if (!Array.isArray(page.entries)) throw new Error("Invalid task listing");
      for (const entry of page.entries) {
        if (entry.type !== "file") continue;
        if (!entry.path.startsWith(`${root}/`)) throw new Error("File outside task root");
        const path = entry.path.slice(root.length + 1);
        if (!validTaskFilePath(path) || !Number.isSafeInteger(entry.sizeBytes) || entry.sizeBytes < 0) throw new Error("Invalid task file");
        if (entries.has(path)) throw new Error("Duplicate task file");
        entries.set(path, { path, kind: "file", sizeBytes: entry.sizeBytes, role: harborEntryRole(path) });
      }
      cursor = page.nextCursor ?? null;
      if (cursor && (typeof cursor !== "string" || seenCursors.has(cursor) || seenCursors.size >= 100)) throw new Error("Invalid task pagination");
      if (cursor) seenCursors.add(cursor);
    } while (cursor);
    for (const path of [...entries.keys()]) {
      const parts = path.split("/");
      for (let i = 1; i < parts.length; i++) {
        const directory = parts.slice(0, i).join("/");
        if (entries.get(directory)?.kind === "file") throw new Error("Conflicting task paths");
        entries.set(directory, { path: directory, kind: "directory", sizeBytes: null, role: harborEntryRole(directory) });
      }
    }
    return Response.json({ ...details, available: entries.has("task.toml"), entries: [...entries.values()].sort((a, b) => a.path.localeCompare(b.path)) }, { headers });
  }

  const url = new URL(request.url);
  const path = url.searchParams.get("path") ?? "";
  if (!validTaskFilePath(path)) return Response.json({ error: "invalid_file_path" }, { status: 400, headers });
  const signed = await fetch(`${rootUrl}${path.split("/").map(encodeURIComponent).join("/")}`, { headers: auth, redirect: "manual" });
  if (signed.status === 404) return Response.json({ error: "file_not_found" }, { status: 404, headers });
  const location = signed.headers.get("location");
  if (signed.status !== 302 || !location || new URL(location).protocol !== "https:") throw new Error("File URL unavailable");
  // Storage requests deliberately receive no gateway credential.
  const file = await fetch(location, { redirect: "error" });
  if (!file.ok || !file.body) throw new Error("Task file unavailable");
  const download = url.searchParams.get("download") === "1";
  if (!download && Number(file.headers.get("content-length")) > previewLimit) {
    await file.body.cancel();
    return Response.json({ error: "preview_too_large" }, { status: 413, headers });
  }
  const mime = download ? "application/octet-stream" : previewMime(path);
  let received = 0;
  const body = download ? file.body : file.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      received += chunk.byteLength;
      if (received > previewLimit) throw new Error("Preview too large");
      controller.enqueue(chunk);
    },
  }));
  return new Response(body, { headers: {
    ...headers,
    "content-type": mime,
    "content-security-policy": "default-src 'none'; sandbox",
    "referrer-policy": "no-referrer",
    ...(download ? { "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(path.split("/").at(-1)!).replace(/'/g, "%27")}` } : {}),
  } });
}

function previewMime(path: string): string {
  const extension = path.split(".").at(-1)?.toLowerCase() ?? "";
  return ({ png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", pdf: "application/pdf" } as Record<string, string>)[extension] ?? "text/plain; charset=utf-8";
}
