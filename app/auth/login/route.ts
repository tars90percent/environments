import { createOAuthAttempt, feishuAuthorizeUrl, setOAuthAttempt } from "../../feishu-auth";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const attempt = createOAuthAttempt(url.searchParams.get("return_to") ?? "/");
  await setOAuthAttempt(attempt);
  return Response.redirect(feishuAuthorizeUrl(attempt.state).href, 302);
}
