import type { ToolCallNotice } from "./harness-events.js";

const sensitiveField = /authorization|cookie|password|passwd|secret|api.?key|token|private.?key|credential/i;
const credentialName = "(?:[A-Za-z0-9_-]*(?:api[_-]?key|private[_-]?key|token|password|passwd|secret|credential)[A-Za-z0-9_-]*)";
const assignment = new RegExp(`(${credentialName}["']?\\s*(?:=|:|\\s)\\s*)(\\[redacted\\]|"[^"\\n]*"|'[^'\\n]*'|[^\\s,;\\]}]+)`,"gi");

function clip(text: string, limit: number) {
  const characters = Array.from(text);
  return characters.length <= limit ? text : characters.slice(0,limit).join("") + "\n… [arguments truncated]";
}

/** Redact before truncating so a shortened preview cannot expose a secret prefix. */
export function formatToolNotice(call: ToolCallNotice, environment: NodeJS.ProcessEnv) {
  const secrets = Object.entries(environment).filter(([key,value])=>sensitiveField.test(key) && value && value.length>=8).map(([,value])=>value!).sort((a,b)=>b.length-a.length);
  function clean(text: string) {
    for (const secret of secrets) text = text.replaceAll(secret,"[redacted]");
    return text
      .replace(/-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?(?:-----END [^-]*PRIVATE KEY-----|$)/g,"[redacted private key]")
      .replace(/\b(Bearer|Basic)\s+[^\s"'`]+/gi,"$1 [redacted]")
      .replace(/\b(Authorization|Proxy-Authorization|Cookie|Set-Cookie)\s*:\s*[^\r\n"']+/gi,"$1: [redacted]")
      .replace(/(https?:\/\/)[^\s/@]+:[^\s/@]+@/gi,"$1[redacted]@")
      .replace(assignment,"$1[redacted]");
  }
  function sanitize(value: unknown, depth = 0): unknown {
    if (typeof value === "string") return clean(value);
    if (depth > 10) return "[nested arguments omitted]";
    if (Array.isArray(value)) return value.slice(0,50).map(item=>sanitize(item,depth+1));
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).slice(0,50).map(([key,item])=>[clean(key),sensitiveField.test(key) ? "[redacted]" : sanitize(item,depth+1)]));
    return value;
  }
  const input = call.input === undefined ? "" : JSON.stringify(sanitize(call.input),null,2);
  return `🔧 Tool call: ${clip(clean(call.name),120)}${input ? `\n${clip(input,2200)}` : ""}`;
}
