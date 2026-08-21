import { previewTaskPackage } from "../../preview-task-package";

export async function GET(_request: Request, context: { params: Promise<{ taskKey: string }> }) {
  if (process.env.NODE_ENV !== "development") return new Response("Not found", { status: 404 });
  const { taskKey } = await context.params;
  const archive = await previewTaskPackage(taskKey);
  if (!archive) return new Response("Not found", { status: 404 });
  return new Response(archive, {
    headers: {
      "content-type": "application/gzip",
      "content-disposition": `attachment; filename="${taskKey}.tar.gz"`,
      "cache-control": "no-store",
    },
  });
}
