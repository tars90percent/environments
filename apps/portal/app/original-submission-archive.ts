import { Zip, ZipPassThrough } from "fflate";
import {
  originalSubmissionEntryNames,
  type OriginalSubmissionArtifact,
} from "./original-submission";

export type OriginalArtifactResolver = (artifact: OriginalSubmissionArtifact) => Promise<Response>;

export function originalSubmissionArchive(
  artifacts: OriginalSubmissionArtifact[],
  resolveArtifact: OriginalArtifactResolver,
): ReadableStream<Uint8Array> {
  const transport = new TransformStream<Uint8Array, Uint8Array>();
  const writer = transport.writable.getWriter();
  let writes = Promise.resolve();
  let failed = false;
  const zip = new Zip((error, chunk, final) => {
    if (error) {
      failed = true;
      writes = writes.then(() => writer.abort(error));
      return;
    }
    writes = writes.then(() => writer.write(chunk));
    if (final) writes = writes.then(() => writer.close());
  });

  const names = originalSubmissionEntryNames(artifacts);
  void (async () => {
    try {
      for (const [index, artifact] of artifacts.entries()) {
        const response = await resolveArtifact(artifact);
        if (!response.ok || !response.body) throw new Error(`Original artifact unavailable: ${artifact.artifactId}`);
        const responseSize = Number(response.headers.get("content-length"));
        const expectedSize = artifact.sizeBytes ?? (Number.isSafeInteger(responseSize) && responseSize >= 0 ? responseSize : null);
        const file = new ZipPassThrough(names[index]!);
        zip.add(file);
        const reader = response.body.getReader();
        let received = 0;
        try {
          while (true) {
            const chunk = await reader.read();
            if (chunk.done) break;
            received += chunk.value.length;
            if (expectedSize !== null && received > expectedSize) throw new Error(`Original artifact exceeded its declared size: ${artifact.artifactId}`);
            file.push(chunk.value);
            await writes;
          }
        } finally {
          reader.releaseLock();
        }
        if (expectedSize !== null && received !== expectedSize) throw new Error(`Original artifact was truncated: ${artifact.artifactId}`);
        file.push(new Uint8Array(), true);
        await writes;
      }
      zip.end();
      await writes;
    } catch (error) {
      if (!failed) {
        failed = true;
        zip.terminate();
        await writes.catch(() => undefined);
        await writer.abort(error).catch(() => undefined);
      }
    }
  })();

  return transport.readable;
}
