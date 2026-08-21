import { consumeOAuthAttempt, exchangeFeishuCode, setPortalSession, TenantDeniedError } from "../../feishu-auth";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  if (!state || !code || url.searchParams.has("error")) return text("Feishu sign-in was not completed.", 400);

  const attempt = await consumeOAuthAttempt(state);
  if (!attempt) return text("This Feishu sign-in request is invalid or has expired.", 400);

  try {
    const user = await exchangeFeishuCode(code);
    await setPortalSession(user);
    return Response.redirect(new URL(attempt.returnTo, url.origin).href, 302);
  } catch (error) {
    if (error instanceof TenantDeniedError) return text("This portal is only available to members of the authorized Feishu organization.", 403);
    console.error("Feishu sign-in failed", error instanceof Error ? error.message : "unknown error");
    return text("Feishu sign-in is temporarily unavailable.", 502);
  }
}

function text(message: string, status: number) {
  return new Response(message, { status, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
}
