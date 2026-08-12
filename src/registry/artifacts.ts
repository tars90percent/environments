import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
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

  async createDownloadUrl(key: string): Promise<{ url: string; expiresInSeconds: number }> {
    const expiresInSeconds = 10 * 60;
    const url = await getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.options.bucket, Key: safeKey(key) }),
      { expiresIn: expiresInSeconds },
    );
    return { url, expiresInSeconds };
  }
}

function safeKey(value: string): string {
  const key = value.trim().replace(/^\/+/, "");
  if (!key || key.includes("..") || key.includes("\\") || key.length > 1_000) {
    throw new Error("Artifact key is invalid");
  }
  return key;
}
