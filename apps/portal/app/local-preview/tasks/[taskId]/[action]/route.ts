import { previewTaskFiles, previewTasks, previewTaskPackage } from "../../../preview-task-package";
import { harborEntryRole } from "../../../../model-benchmark-filesystems";

export async function GET(request: Request, { params }: { params: Promise<{ taskId: string; action: string }> }) {
  if (process.env.NODE_ENV !== "development") return new Response("Not found", { status: 404 });
  const { taskId, action } = await params;
  const files = previewTaskFiles(taskId);
  if (!files) return new Response("Not found", { status: 404 });
  if (action === "download") {
    return new Response(await previewTaskPackage(taskId), { headers: {
      "content-type": "application/gzip",
      "content-disposition": `attachment; filename="${taskId}.tar.gz"`,
    } });
  }
  if (action === "file") {
    const file = files.find((entry) => entry.path === new URL(request.url).searchParams.get("path"));
    return file ? new Response(new TextDecoder().decode(file.bytes), { headers: { "content-type": "text/plain; charset=utf-8" } }) : new Response("Not found", { status: 404 });
  }
  if (action !== "files") return new Response("Not found", { status: 404 });
  const directories = [...new Set(files.flatMap((file) => file.path.includes("/") ? [file.path.split("/")[0]] : []))];
  return Response.json({
    task: { id: taskId, title: previewTasks[taskId].title, summary: "A synthetic Harbor task for inspecting the vendor task browser.", sourcePath: `tasks/${taskId}`, format: "harbor", kind: "task", artifactId: null, contentSha256: null },
    vendor: (taskId === "preview-terminal-two" || taskId.startsWith("preview-two-")) ? { id: "preview-vendor-two", name: "Second Vendor" } : { id: "preview-vendor", name: "Example Vendor" },
    submission: { id: "preview-submission", label: "Harbor task samples", date: "2026-09-12" },
    available: true,
    entries: [
      ...directories.map((path) => ({ path, kind: "directory", sizeBytes: null, role: harborEntryRole(path) })),
      ...files.map((file) => ({ path: file.path, kind: "file", sizeBytes: file.bytes.length, role: harborEntryRole(file.path) })),
    ].sort((a, b) => a.path.localeCompare(b.path)),
  });
}
