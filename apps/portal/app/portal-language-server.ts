import { cookies } from "next/headers";
import { portalLanguageCookie, resolvePortalLanguage } from "./portal-language";
import type { PageSearchParams } from "./task-navigation";

export async function getPortalLanguage(params: PageSearchParams) {
  return resolvePortalLanguage(params.lang, (await cookies()).get(portalLanguageCookie)?.value);
}
