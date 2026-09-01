const productionBaseUrl = "https://harbor-task-gateway-production.up.railway.app";

export function documentationHtml() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Harbor Task Gateway</title>
</head>
<body>
  <main>
    <h1>Harbor Task Gateway</h1>
    <p>Read-only access to the exact individual files in the Harbor task bucket, plus cached vendor ZIP downloads stored in a separate disposable cache.</p>

    <h2>Authentication</h2>
    <p>Documentation and health checks are public. Task listings, metadata, and downloads require this header:</p>
    <pre><code>Authorization: Bearer &lt;token&gt;</code></pre>

    <h2>Canonical task layout</h2>
    <pre><code>vendor/
  submission/
    task/
      task.toml
      instruction.md
      environment/
      tests/
      solution/</code></pre>
    <p>The bucket is preserved exactly. Discover task roots by finding file paths that end in <code>/task.toml</code>; the parent directory is the task root.</p>

    <h2>List files</h2>
    <p>Directory URLs end in <code>/</code>. A non-recursive request lists the immediate directory. Use <code>recursive=1</code> to list all objects under a prefix.</p>
    <pre><code>curl -H "Authorization: Bearer $HARBOR_TASKS_TOKEN" \
  "${productionBaseUrl}/?recursive=1&amp;limit=1000"</code></pre>
    <p><code>limit</code> defaults to 200 and may be 1–1000. When <code>nextCursor</code> is not null, pass it back as the <code>cursor</code> query parameter.</p>

    <h2>Download selected task roots as one TAR</h2>
    <p>Submit the exact active task roots selected from CASE. The response streams their individual bucket files without creating a stored wrapper object.</p>
    <pre><code>curl -X POST -H "Authorization: Bearer $HARBOR_TASKS_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"roots":["vendor/submission/task"]}' \
  "${productionBaseUrl}/archives" &gt; harbor-tasks.tar</code></pre>

    <h2>Prepare a cached vendor ZIP</h2>
    <p>Submit exact active task roots, a portal manifest, and a safe ZIP filename. The response is JSON containing a short-lived signed download URL. The first request builds a content-addressed ZIP in the separate archive cache; identical later requests reuse it. The ZIP contains <code>manifest.json</code> and the exact task paths, with no generated README.</p>
    <pre><code>curl -X POST -H "Authorization: Bearer $HARBOR_TASKS_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"roots":["vendor/submission/task"],"manifest":{"schemaVersion":"example.v1"},"filename":"vendor-harbor-tasks.zip"}' \
  "${productionBaseUrl}/zip-archives"</code></pre>

    <h2>Download a file</h2>
    <p>File requests return a temporary <code>302</code> redirect. Clients must follow redirects.</p>
    <pre><code>curl -L -H "Authorization: Bearer $HARBOR_TASKS_TOKEN" \
  "${productionBaseUrl}/vendor/submission/task/task.toml"</code></pre>
    <p>Use <code>HEAD</code> on a file URL for size, content type, ETag, last-modified time, and SHA-256 metadata when available.</p>

    <h2>Machine-readable specification</h2>
    <p><a href="/openapi.json">OpenAPI 3.1 specification</a></p>
  </main>
</body>
</html>`;
}

export function openApiDocument() {
  return {
    openapi: "3.1.0",
    info: {
      title: "Harbor Task Gateway",
      version: "1.0.0",
      description: "Read-only access to exact individual Harbor task files plus content-addressed vendor ZIPs in a separate disposable cache. Documentation and health endpoints are public; task data requires bearer authentication.",
    },
    servers: [{ url: productionBaseUrl }],
    security: [{ bearerAuth: [] }],
    paths: {
      "/healthz": {
        get: {
          summary: "Service health",
          security: [],
          responses: {
            "200": {
              description: "Gateway is running",
              content: { "application/json": { schema: { $ref: "#/components/schemas/Health" } } },
            },
          },
        },
        head: {
          summary: "Service health headers",
          security: [],
          responses: { "200": { description: "Gateway is running" } },
        },
      },
      "/docs": {
        get: {
          summary: "Human-readable usage documentation",
          security: [],
          responses: { "200": { description: "HTML documentation" } },
        },
        head: {
          summary: "Documentation headers",
          security: [],
          responses: { "200": { description: "Documentation is available" } },
        },
      },
      "/openapi.json": {
        get: {
          summary: "OpenAPI specification",
          security: [],
          responses: {
            "200": {
              description: "OpenAPI 3.1 document",
              content: { "application/json": { schema: { type: "object" } } },
            },
          },
        },
        head: {
          summary: "OpenAPI specification headers",
          security: [],
          responses: { "200": { description: "OpenAPI specification is available" } },
        },
      },
      "/": {
        get: {
          summary: "List the bucket root",
          description: "Returns immediate entries by default. Set recursive=1 to enumerate all objects. Follow nextCursor until it is null.",
          parameters: listingParameters(),
          responses: listingResponses(),
        },
        head: {
          summary: "Check access to the bucket root",
          responses: standardHeadResponses(),
        },
      },
      "/archives": {
        post: {
          summary: "Stream selected task roots as a TAR archive",
          description: "Validates each task.toml completion marker, then streams the exact individual bucket files for 1–1000 task roots from one vendor. No archive object is stored.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["roots"],
                  properties: {
                    roots: {
                      type: "array",
                      minItems: 1,
                      maxItems: 1000,
                      uniqueItems: true,
                      items: { type: "string", pattern: "^[^/]+/[^/]+/[^/]+$" },
                    },
                  },
                },
              },
            },
          },
          responses: {
            "200": { description: "Streaming TAR archive", content: { "application/x-tar": { schema: { type: "string", format: "binary" } } } },
            "400": errorResponse("Invalid archive request"),
            "409": errorResponse("One or more task roots are incomplete"),
          },
        },
      },
      "/zip-archives": {
        post: {
          summary: "Prepare a cached ZIP for selected task roots",
          description: "Validates each task.toml completion marker and returns a short-lived signed URL. A cache miss builds a content-addressed ZIP from exact harbor-tasks objects and the supplied manifest; a hit reads no task bytes.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["roots", "manifest", "filename"],
                  properties: {
                    roots: {
                      type: "array",
                      minItems: 1,
                      maxItems: 1000,
                      uniqueItems: true,
                      items: { type: "string", pattern: "^[^/]+/[^/]+/[^/]+$" },
                    },
                    manifest: { type: "object" },
                    filename: { type: "string", maxLength: 200, pattern: "\\.zip$" },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Archive is ready",
              content: { "application/json": { schema: { $ref: "#/components/schemas/PreparedArchive" } } },
            },
            "400": errorResponse("Invalid ZIP archive request"),
            "409": errorResponse("One or more task roots are incomplete"),
            "502": errorResponse("Archive preparation failed"),
          },
        },
      },
      "/{objectPath}": {
        parameters: [{
          name: "objectPath",
          in: "path",
          required: true,
          description: "Exact percent-encoded object or directory path. Directory paths must end in a slash.",
          allowReserved: true,
          schema: { type: "string" },
        }],
        get: {
          summary: "List a directory or download a file",
          description: "A trailing slash lists the directory. A file path returns a 302 redirect to a short-lived signed object URL.",
          parameters: [
            ...listingParameters(),
            {
              name: "download",
              in: "query",
              description: "For file paths, request attachment content disposition.",
              schema: { type: "boolean", default: false },
            },
          ],
          responses: {
            ...listingResponses(),
            "302": {
              description: "Short-lived signed file URL",
              headers: {
                Location: { schema: { type: "string", format: "uri" } },
                "X-Presigned-Url-Expires-In": { schema: { type: "integer" } },
              },
            },
            "404": errorResponse("Object not found"),
          },
        },
        head: {
          summary: "Read file metadata or check a directory",
          responses: {
            ...standardHeadResponses(),
            "404": errorResponse("Object not found"),
          },
        },
      },
    },
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer" },
      },
      schemas: {
        Health: {
          type: "object",
          required: ["status"],
          properties: { status: { type: "string", const: "ok" } },
        },
        PreparedArchive: {
          type: "object",
          required: ["status", "cacheHit", "downloadUrl", "filename", "sizeBytes", "sourceBytes", "fileCount", "taskCount", "expiresInSeconds"],
          properties: {
            status: { const: "ready" },
            cacheHit: { type: "boolean" },
            downloadUrl: { type: "string", format: "uri" },
            filename: { type: "string" },
            sizeBytes: { type: "integer", minimum: 1 },
            sourceBytes: { type: "integer", minimum: 0 },
            fileCount: { type: "integer", minimum: 1 },
            taskCount: { type: "integer", minimum: 1 },
            expiresInSeconds: { type: "integer", minimum: 60 },
          },
        },
        DirectoryListing: {
          type: "object",
          required: ["path", "recursive", "entries", "nextCursor"],
          properties: {
            path: { type: "string", description: "Exact listed bucket prefix." },
            recursive: { type: "boolean" },
            entries: { type: "array", items: { $ref: "#/components/schemas/Entry" } },
            nextCursor: { type: ["string", "null"], description: "Opaque continuation cursor; null means the listing is complete." },
          },
        },
        Entry: {
          oneOf: [
            { $ref: "#/components/schemas/DirectoryEntry" },
            { $ref: "#/components/schemas/FileEntry" },
          ],
        },
        DirectoryEntry: {
          type: "object",
          required: ["type", "name", "path", "url"],
          properties: {
            type: { const: "directory" },
            name: { type: "string" },
            path: { type: "string" },
            url: { type: "string" },
          },
        },
        FileEntry: {
          type: "object",
          required: ["type", "name", "path", "url", "sizeBytes", "lastModified", "etag"],
          properties: {
            type: { const: "file" },
            name: { type: "string" },
            path: { type: "string" },
            url: { type: "string" },
            sizeBytes: { type: ["integer", "null"] },
            lastModified: { type: ["string", "null"], format: "date-time" },
            etag: { type: ["string", "null"] },
          },
        },
        Error: {
          type: "object",
          required: ["error"],
          properties: {
            error: { type: "string" },
            documentation: { type: "string" },
            openapi: { type: "string" },
          },
        },
      },
    },
  };
}

function listingParameters() {
  return [
    {
      name: "recursive",
      in: "query",
      description: "List all objects below the prefix instead of immediate children only.",
      schema: { type: "boolean", default: false },
    },
    {
      name: "limit",
      in: "query",
      description: "Maximum entries requested from storage for this page.",
      schema: { type: "integer", minimum: 1, maximum: 1000, default: 200 },
    },
    {
      name: "cursor",
      in: "query",
      description: "Opaque nextCursor returned by the previous page.",
      schema: { type: "string" },
    },
  ];
}

function listingResponses() {
  return {
    "200": {
      description: "Paginated directory listing",
      content: { "application/json": { schema: { $ref: "#/components/schemas/DirectoryListing" } } },
    },
    "400": errorResponse("Invalid path or query parameter"),
    "401": errorResponse("Missing or invalid bearer token"),
    "502": errorResponse("Bucket request failed"),
  };
}

function standardHeadResponses() {
  return {
    "200": { description: "Metadata is available" },
    "401": errorResponse("Missing or invalid bearer token"),
    "502": errorResponse("Bucket request failed"),
  };
}

function errorResponse(description) {
  return {
    description,
    content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } },
  };
}
