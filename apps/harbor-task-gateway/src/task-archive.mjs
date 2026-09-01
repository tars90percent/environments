const encoder = new TextEncoder();

export async function* taskArchiveChunks({ roots, listObjects, readObject }) {
  const seen = new Set();
  let entryIndex = 0;

  for (const root of roots) {
    const prefix = `${root}/`;
    let cursor;
    do {
      const page = await listObjects({ prefix, cursor, limit: 1_000, recursive: true });
      const objects = [...(page.objects ?? [])].sort((left, right) => left.key.localeCompare(right.key));
      for (const object of objects) {
        if (!object.key.startsWith(prefix) || seen.has(object.key)) continue;
        const size = object.sizeBytes;
        if (!Number.isSafeInteger(size) || size < 0) throw new Error(`Object has no usable size: ${object.key}`);
        seen.add(object.key);
        entryIndex += 1;

        const source = await readObject(object.key);
        if (!source?.body) throw new Error(`Object has no readable body: ${object.key}`);
        if (source.contentLength !== undefined && source.contentLength !== size) throw new Error(`Object size changed while archiving: ${object.key}`);

        yield* tarEntryPrefix(object.key, size, entryIndex);
        let received = 0;
        for await (const chunk of bodyChunks(source.body)) {
          received += chunk.length;
          if (received > size) throw new Error(`Object exceeded its declared size: ${object.key}`);
          yield chunk;
        }
        if (received !== size) throw new Error(`Object was truncated: ${object.key}`);
        const padding = tarPadding(size);
        if (padding) yield new Uint8Array(padding);
      }
      cursor = page.nextCursor;
    } while (cursor);
  }

  yield new Uint8Array(1024);
}

async function* bodyChunks(body) {
  if (typeof body.getReader === "function") {
    const reader = body.getReader();
    let completed = false;
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) {
          completed = true;
          break;
        }
        yield asBytes(chunk.value);
      }
    } finally {
      if (!completed) await reader.cancel();
      reader.releaseLock();
    }
    return;
  }
  if (body[Symbol.asyncIterator]) {
    for await (const chunk of body) yield asBytes(chunk);
    return;
  }
  throw new Error("Object body is not streamable");
}

function* tarEntryPrefix(path, size, entryIndex) {
  if (path.includes("\0") || path.includes("\n") || path.includes("\r")) throw new Error("Object path contains a control character");
  if (encoder.encode(path).length <= 100) {
    yield tarHeader(path, size, 0o644);
    return;
  }

  const record = paxPathRecord(path);
  const paxName = `PaxHeaders/${String(entryIndex).padStart(8, "0")}`;
  yield tarHeader(paxName, record.length, 0o644, "x");
  yield record;
  const padding = tarPadding(record.length);
  if (padding) yield new Uint8Array(padding);
  yield tarHeader(`PaxFiles/${String(entryIndex).padStart(8, "0")}`, size, 0o644);
}

function paxPathRecord(path) {
  let length = encoder.encode(`0 path=${path}\n`).length;
  while (true) {
    const record = encoder.encode(`${length} path=${path}\n`);
    if (record.length === length) return record;
    length = record.length;
  }
}

function tarHeader(path, size, mode, type = "0") {
  if (encoder.encode(path).length > 100) throw new Error(`Tar header path is too long: ${path}`);
  const header = new Uint8Array(512);
  const write = (value, offset, length) => header.set(encoder.encode(value).subarray(0, length), offset);
  const octal = (value, length) => value.toString(8).padStart(length - 1, "0") + "\0";

  write(path, 0, 100);
  write(octal(mode, 8), 100, 8);
  write(octal(0, 8), 108, 8);
  write(octal(0, 8), 116, 8);
  write(octal(size, 12), 124, 12);
  write(octal(0, 12), 136, 12);
  header.fill(0x20, 148, 156);
  write(type, 156, 1);
  write("ustar\0", 257, 6);
  write("00", 263, 2);
  write("harbor", 265, 32);
  write("harbor", 297, 32);
  const checksum = header.reduce((sum, byte) => sum + byte, 0);
  write(checksum.toString(8).padStart(6, "0") + "\0 ", 148, 8);
  return header;
}

function tarPadding(size) {
  return (512 - (size % 512)) % 512;
}

function asBytes(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  throw new Error("Object stream yielded a non-binary chunk");
}
