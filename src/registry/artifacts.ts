import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";

export type ArtifactStoreOptions = {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle?: boolean;
};

export class ArtifactStore {
  private readonly client: S3Client;

  constructor(private readonly options: ArtifactStoreOptions) {
    this.client = new S3Client({
      endpoint: options.endpoint,
      region: options.region,
      forcePathStyle: options.forcePathStyle ?? true,
      credentials: {
        accessKeyId: options.accessKeyId,
        secretAccessKey: options.secretAccessKey,
      },
    });
  }

  async createUploadUrl(input: { key: string; contentType: string; sha256?: string; sizeBytes?: number }): Promise<{ url: string; expiresInSeconds: number }> {
    const expiresInSeconds = 15 * 60;
    const url = await getSignedUrl(
      this.client,
      new PutObjectCommand({
        Bucket: this.options.bucket,
        Key: safeKey(input.key),
        ContentType: input.contentType,
        ContentLength: input.sizeBytes,
        Metadata: input.sha256 ? { sha256: input.sha256 } : undefined,
      }),
      { expiresIn: expiresInSeconds },
    );
    return { url, expiresInSeconds };
  }

  async putFile(input: { key: string; path: string; contentType: string; sha256: string; sizeBytes: number }): Promise<void> {
    const file = await stat(input.path);
    if (!file.isFile() || file.size !== input.sizeBytes) throw new Error("Artifact file size does not match");
    await this.client.send(new PutObjectCommand({
      Bucket: this.options.bucket,
      Key: safeKey(input.key),
      Body: createReadStream(input.path),
      ContentType: input.contentType,
      ContentLength: input.sizeBytes,
      Metadata: { sha256: input.sha256 },
    }));
    await this.verifyObject({ key: input.key, sha256: input.sha256, sizeBytes: input.sizeBytes });
  }

  async verifyObject(input: { key: string; sha256: string; sizeBytes?: number }): Promise<void> {
    const key = safeKey(input.key);
    const head = await this.client.send(new HeadObjectCommand({ Bucket: this.options.bucket, Key: key }));
    if (head.Metadata?.sha256 !== input.sha256) throw new Error("Stored artifact SHA-256 metadata does not match");
    if (input.sizeBytes !== undefined && head.ContentLength !== input.sizeBytes) {
      throw new Error("Stored artifact size does not match");
    }
    const object = await this.client.send(new GetObjectCommand({ Bucket: this.options.bucket, Key: key }));
    if (!object.Body) throw new Error("Stored artifact has no body");
    const hash = createHash("sha256");
    let sizeBytes = 0;
    for await (const chunk of object.Body as AsyncIterable<Uint8Array>) {
      hash.update(chunk);
      sizeBytes += chunk.byteLength;
    }
    if (input.sizeBytes !== undefined && sizeBytes !== input.sizeBytes) throw new Error("Stored artifact streamed size does not match");
    if (hash.digest("hex") !== input.sha256) throw new Error("Stored artifact bytes do not match the declared SHA-256");
  }

  async createDownloadUrl(key: string, downloadName?: string): Promise<{ url: string; expiresInSeconds: number }> {
    const expiresInSeconds = 10 * 60;
    const url = await getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.options.bucket,
        Key: safeKey(key),
        ResponseContentDisposition: downloadName ? `attachment; filename="${safeDownloadName(downloadName)}"` : undefined,
      }),
      { expiresIn: expiresInSeconds },
    );
    return { url, expiresInSeconds };
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.options.bucket, Key: safeKey(key) }));
  }
}

export function contentAddressedStorageKey(sha256: string): string {
  if (!/^[a-f0-9]{64}$/.test(sha256)) throw new Error("SHA-256 is invalid");
  return `objects/sha256/${sha256.slice(0, 2)}/${sha256}`;
}

function safeKey(value: string): string {
  const key = value.trim().replace(/^\/+/, "");
  if (!key || key.includes("..") || key.includes("\\") || key.length > 1_000) {
    throw new Error("Artifact key is invalid");
  }
  return key;
}

function safeDownloadName(value: string): string {
  const name = value.replace(/[\r\n"\\/]/g, "_").trim().slice(0, 180);
  return name || "artifact";
}
