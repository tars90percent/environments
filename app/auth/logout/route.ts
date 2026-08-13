import { clearPortalSession } from "../../feishu-auth";

export async function GET(request: Request) {
  await clearPortalSession();
  return Response.redirect(new URL("/auth/login", request.url).href, 302);
}
