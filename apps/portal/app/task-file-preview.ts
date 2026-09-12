/** Archive sidecars are preserved for download, but omitted from the task tree. */
export function isMacMetadataPath(path: string): boolean {
  return path.split("/").some((part) => part.startsWith("._") || part === ".DS_Store" || part === "__MACOSX");
}

/** Refuse lossy decoding so binary files and unsupported encodings never render as gibberish. */
export function decodeTaskText(bytes: Uint8Array): string | null {
  const encoding = bytes[0] === 0xff && bytes[1] === 0xfe ? "utf-16le"
    : bytes[0] === 0xfe && bytes[1] === 0xff ? "utf-16be" : "utf-8";
  try {
    const text = new TextDecoder(encoding, { fatal: true }).decode(bytes);
    for (const character of text) {
      const code = character.codePointAt(0)!;
      if ((code < 32 && ![9, 10, 12, 13].includes(code)) || code === 127) return null;
    }
    return text;
  } catch {
    return null;
  }
}
