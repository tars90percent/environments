export type PortalLanguage = "en" | "zh";
export const portalLanguageCookie = "portal-language";

export function resolvePortalLanguage(value: unknown, saved?: string): PortalLanguage {
  return value === "en" || value === "zh" ? value : saved === "en" ? "en" : "zh";
}

export function localizedHref(href: string, language: PortalLanguage): string {
  const url = new URL(href, "https://portal.local");
  url.searchParams.set("lang", language);
  return `${url.pathname}${url.search}${url.hash}`;
}
