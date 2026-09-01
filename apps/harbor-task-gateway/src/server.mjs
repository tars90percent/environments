import { createServer } from "node:http";
import {
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createGatewayHandler } from "./app.mjs";
import { taskArchiveChunks } from "./task-archive.mjs";

const configuration = loadConfiguration(process.env);
const client = new S3Client({
  endpoint: configuration.endpoint,
  region: configuration.region,
  forcePathStyle: configuration.urlStyle === "path",
  credentials: {
    accessKeyId: configuration.accessKeyId,
    secretAccessKey: configuration.secretAccessKey,
  },
});

const listObjects = async ({ prefix, cursor, limit, recursive }) => {
  const page = await client.send(new ListObjectsV2Command({
    Bucket: configuration.bucket,
    Prefix: prefix,
    Delimiter: recursive ? undefined : "/",
    ContinuationToken: cursor,
    MaxKeys: limit,
  }));
  return {
    directories: (page.CommonPrefixes ?? []).flatMap((entry) => entry.Prefix ? [entry.Prefix] : []),
    objects: (page.Contents ?? []).flatMap((object) => object.Key && object.Key !== prefix ? [{
      key: object.Key,
      sizeBytes: object.Size ?? null,
      lastModified: object.LastModified,
      etag: object.ETag,
    }] : []),
    nextCursor: page.IsTruncated ? page.NextContinuationToken : undefined,
  };
};

const headObject = async (key) => {
  try {
    const head = await client.send(new HeadObjectCommand({ Bucket: configuration.bucket, Key: key }));
    return {
      contentLength: head.ContentLength,
      contentType: head.ContentType,
      etag: head.ETag,
      lastModified: head.LastModified,
      sha256: head.Metadata?.sha256,
    };
  } catch (error) {
    if (error?.name === "NoSuchKey" || error?.name === "NotFound" || error?.$metadata?.httpStatusCode === 404) return null;
    throw error;
  }
};

const handler = createGatewayHandler({
  authToken: configuration.authToken,
  signedUrlTtlSeconds: configuration.signedUrlTtlSeconds,
  listObjects,
  headObject,
  archiveRoots: (roots) => taskArchiveChunks({
    roots,
    listObjects,
    readObject: async (key) => {
      const object = await client.send(new GetObjectCommand({ Bucket: configuration.bucket, Key: key }));
      return { body: object.Body, contentLength: object.ContentLength };
    },
  }),
  signGetObject: async ({ key, expiresInSeconds, downloadName }) => getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: configuration.bucket,
      Key: key,
      ResponseContentDisposition: downloadName ? contentDisposition(downloadName) : undefined,
    }),
    { expiresIn: expiresInSeconds },
  ),
});

const server = createServer((request, response) => {
  Promise.resolve(handler(request, response)).catch((error) => {
    console.error(JSON.stringify({
      level: "error",
      message: "unhandled gateway error",
      error: error instanceof Error ? error.message : String(error),
    }));
    if (!response.headersSent) {
      response.statusCode = 500;
      response.setHeader("Content-Type", "application/json; charset=utf-8");
    }
    response.end(JSON.stringify({ error: "internal server error" }));
  });
});

server.listen(configuration.port, "0.0.0.0", () => {
  console.log(JSON.stringify({
    level: "info",
    message: "harbor task gateway listening",
    port: configuration.port,
    signedUrlTtlSeconds: configuration.signedUrlTtlSeconds,
  }));
});

function loadConfiguration(environment) {
  const required = (name, alternatives = []) => {
    for (const candidate of [name, ...alternatives]) {
      const value = environment[candidate];
      if (value) return value;
    }
    throw new Error(`Missing required environment variable: ${name}`);
  };
  const port = Number(environment.PORT ?? "3000");
  const signedUrlTtlSeconds = Number(environment.SIGNED_URL_TTL_SECONDS ?? "900");
  if (!Number.isInteger(port) || port < 1 || port > 65_535) throw new Error("PORT must be a valid TCP port");
  return {
    port,
    signedUrlTtlSeconds,
    authToken: required("GATEWAY_AUTH_TOKEN"),
    endpoint: required("BUCKET_ENDPOINT", ["AWS_ENDPOINT_URL"]),
    accessKeyId: required("BUCKET_ACCESS_KEY_ID", ["AWS_ACCESS_KEY_ID"]),
    secretAccessKey: required("BUCKET_SECRET_ACCESS_KEY", ["AWS_SECRET_ACCESS_KEY"]),
    bucket: required("BUCKET_NAME", ["AWS_S3_BUCKET_NAME"]),
    region: environment.BUCKET_REGION ?? environment.AWS_DEFAULT_REGION ?? "auto",
    urlStyle: environment.BUCKET_URL_STYLE ?? environment.AWS_S3_URL_STYLE ?? "virtual",
  };
}

function contentDisposition(filename) {
  const safeAscii = filename.replace(/["\\\r\n]/g, "_").replace(/[^\x20-\x7e]/g, "_");
  return `attachment; filename="${safeAscii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}
