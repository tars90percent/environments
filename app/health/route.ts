export function GET() {
  return Response.json({ status: "ok", service: "env-portal-proto" }, { headers: { "cache-control": "no-store" } });
}
