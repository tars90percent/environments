import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

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

  async createUploadUrl(input: { key: string; contentType: string; sha256?: string }): Promise<{ url: string; expiresInSeconds: number }> {
    const expiresInSeconds = 15 * 60;
    const url = await getSignedUrl(
      this.client,
      new PutObjectCommand({
        Bucket: this.options.bucket,
        Key: safeKey(input.key),
        ContentType: input.contentType,
        Metadata: input.sha256 ? { sha256: input.sha256 } : undefined,
      }),
      { expiresIn: expiresInSeconds },
    );
    return { url, expiresInSeconds };
  }

  async verifyObject(input: { key: string; sha256: string; sizeBytes?: number }): Promise<void> {
    const result = await this.client.send(new HeadObjectCommand({ Bucket: this.options.bucket, Key: safeKey(input.key) }));
    if (result.Metadata?.sha256 !== input.sha256) throw new Error("Stored artifact SHA-256 metadata does not match");
    if (input.sizeBytes !== undefined && result.ContentLength !== input.sizeBytes) {
      throw new Error("Stored artifact size does not match");
    }
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
