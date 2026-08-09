import type { AuthorizationRequest } from "./authorization.js";

export type AgentCommand =
  | { kind: "new" }
  | { kind: "authorize"; request?: AuthorizationRequest }
  | { kind: "authorized" }
  | { kind: "auth-status" }
  | { kind: "invalid"; message: string };

export function parseAgentCommand(content: string): AgentCommand | undefined {
  const trimmed = content.trim();
  const lower = trimmed.toLowerCase();

  if (lower === "/new") return { kind: "new" };
  if (lower === "/authorize" || lower === "authorize") {
    return { kind: "authorize" };
  }
  if (lower === "/authorized" || lower === "authorization complete") {
    return { kind: "authorized" };
  }
  if (lower === "/auth-status" || lower === "auth status") {
    return { kind: "auth-status" };
  }

  const domainMatch = trimmed.match(/^\/authorize\s+domains?\s+(.+)$/i);
  if (domainMatch?.[1]) {
    const domains = splitValues(domainMatch[1].toLowerCase());
    return domains.length > 0
      ? { kind: "authorize", request: { mode: "domains", domains } }
      : authorizationHelp();
  }

  const scopeMatch = trimmed.match(/^\/authorize\s+scopes?\s+(.+)$/i);
  if (scopeMatch?.[1]) {
    const scopes = splitValues(scopeMatch[1]);
    return scopes.length > 0
      ? { kind: "authorize", request: { mode: "scopes", scopes } }
      : authorizationHelp();
  }

  if (/^\/authorize\b/i.test(trimmed)) return authorizationHelp();
  return undefined;
}

function splitValues(value: string): string[] {
  return value
    .split(/[\s,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function authorizationHelp(): AgentCommand {
  return {
    kind: "invalid",
    message:
      "Use /authorize, /authorize domain docs,drive, or /authorize scope calendar:calendar:readonly.",
  };
}
