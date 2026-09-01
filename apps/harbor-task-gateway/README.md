# Harbor task gateway

Authenticated, read-only HTTP access to the exact individual files in the Railway `harbor-tasks` bucket, with public human- and machine-readable API documentation.

Directory paths end in `/` and return a paginated JSON listing. File paths return a short-lived redirect to the corresponding object. `HEAD` returns object metadata, including the recorded SHA-256 when available.

`POST /archives` accepts 1–1000 exact task roots from one vendor, validates each `task.toml` completion marker, and streams their individual files as one TAR. The archive is generated on demand and is never stored in the bucket.

```text
GET  /healthz
GET  /docs
GET  /openapi.json
GET  /?limit=200&cursor=...
GET  /vendor/submission/task/
GET  /vendor/submission/task/instruction.md
HEAD /vendor/submission/task/task.toml
POST /archives
```

`/healthz`, `/docs`, and `/openapi.json` are public. Bucket listings, file metadata, and downloads require `Authorization: Bearer <token>`. Unauthorized responses link to both documentation endpoints so a new consumer can discover the protocol from the base URL.

The canonical object layout is `vendor/submission/task/`. Consumers can discover task roots by recursively listing objects and selecting paths that end in `/task.toml`. Pagination, response schemas, redirects, and metadata headers are defined in `/openapi.json` and illustrated in `/docs`.

Required variables:

- `GATEWAY_AUTH_TOKEN`
- `BUCKET_ENDPOINT`
- `BUCKET_ACCESS_KEY_ID`
- `BUCKET_SECRET_ACCESS_KEY`
- `BUCKET_NAME`
- `BUCKET_REGION`
- `BUCKET_URL_STYLE`

Optional variables:

- `SIGNED_URL_TTL_SECONDS` (default `900`, range `60`–`86400`)
