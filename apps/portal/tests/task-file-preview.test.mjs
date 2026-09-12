import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";

const result = await build({ entryPoints: [new URL("../app/task-file-preview.ts", import.meta.url).pathname], bundle: true, format: "esm", platform: "node", write: false });
const { isMacMetadataPath, decodeTaskText } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);

test("macOS sidecars are identified without hiding real task files or ordinary dotfiles", () => {
  for (const path of ["._solution", "environment/._data.json", ".DS_Store", "__MACOSX/task/instruction.md"]) assert.equal(isMacMetadataPath(path), true, path);
  for (const path of ["solution/solve.sh", "instruction.md", ".env", ".gitignore", "environment/data.json"]) assert.equal(isMacMetadataPath(path), false, path);
});

test("binary payloads and malformed UTF-8 are never decoded into replacement-character gibberish", () => {
  const appleDouble = Uint8Array.from([0, 5, 22, 7, 0, 2, 0, 0, ...Buffer.from("Mac OS X        ")]);
  assert.equal(decodeTaskText(appleDouble), null);
  assert.equal(decodeTaskText(Uint8Array.from([0x61, 0xc3, 0x28])), null);
  assert.equal(decodeTaskText(Buffer.from("valid prefix\u0000binary tail")), null);
});

test("valid multilingual text, whitespace, and BOM-marked UTF-16 remain readable", () => {
  const text = "# 任务说明\n\tRepair the cache. café — 日本語\r\n";
  assert.equal(decodeTaskText(new TextEncoder().encode(text)), text);
  assert.equal(decodeTaskText(new Uint8Array()), "");
  assert.equal(decodeTaskText(Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(text, "utf16le")])), text);
  assert.equal(decodeTaskText(Uint8Array.from([0xfe, 0xff, 0, 65, 0, 10])), "A\n");
});
