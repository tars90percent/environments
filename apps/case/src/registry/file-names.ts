import { basename, extname } from "node:path";

export type FileContext = { vendorId?: string; submissionId?: string; date?: string; label?: string; correspondence?: boolean };

export function readableFileKey(filename: string, context: FileContext = {}): string {
  const vendor = segment(context.vendorId || "unassigned");
  const date = context.date?.slice(0, 10) || new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("File date must be YYYY-MM-DD");
  const folder = context.correspondence ? `correspondence/${date}`
    : context.label || context.submissionId ? `${date}-${segment(context.label || context.submissionId!)}`
    : `${date}-unfiled`;
  return `${vendor}/${folder}/${fileName(filename)}`;
}

export function fileName(value: string): string {
  const name = basename(value.replaceAll("\\", "/")).normalize("NFC")
    .replace(/[\x00-\x1f\x7f/:*?"<>|]/g, "_").trim();
  if (!name || name === "." || name === "..") return "original-file";
  const extension = extname(name).slice(0, 20);
  return shorten(name.slice(0, name.length - extension.length), 150) + extension;
}

export function collisionName(key: string, number: number): string {
  const extension = extname(key);
  return `${key.slice(0, key.length - extension.length)} (${number})${extension}`;
}

export function safeFileLocation(key: string): string {
  if (!key || key.startsWith("/") || key.includes("\\") || /[\x00-\x1f\x7f]/.test(key)
      || key.split("/").some((part) => !part || part === "." || part === "..")
      || Buffer.byteLength(key) > 950 || key.startsWith("objects/")) throw new Error("Invalid readable file location");
  return key;
}

function segment(value: string): string {
  return shorten(value.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}._-]+/gu, "-").replace(/^[._-]+|[._-]+$/g, ""), 100) || "unassigned";
}

function shorten(value: string, bytes: number): string {
  let result = "";
  for (const character of value) {
    if (Buffer.byteLength(result + character) > bytes) break;
    result += character;
  }
  return result;
}
