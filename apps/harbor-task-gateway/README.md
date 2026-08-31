# Harbor task gateway

Authenticated, read-only HTTP access to the exact individual files in the Railway `harbor-tasks` bucket.

Directory paths end in `/` and return a paginated JSON listing. File paths return a short-lived redirect to the corresponding object. `HEAD` returns object metadata, including the recorded SHA-256 when available.

```text
GET  /healthz
GET  /?limit=200&cursor=...
GET  /vendor/submission/task/
GET  /vendor/submission/task/instruction.md
HEAD /vendor/submission/task/task.toml
```

All routes except `/healthz` require `Authorization: Bearer <token>`.

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
