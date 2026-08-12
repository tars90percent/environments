# Source envelope contract

Capture in this order:

1. Save the exact inbound message, email, document, spreadsheet export, PDF, archive, or fetched file with `case-registry store-file`.
2. Create a source envelope that names the vendor and transport event, lists every known source item, and records relations between them.
3. Import it with `case-registry import-source`.
4. Fetch and parse queued source items. Record each newly discovered item in a new immutable envelope/event or through the normalization worker; never mutate an older snapshot.
5. Import the normalized submission batch and link task versions to their source item IDs.

Minimal example:

```json
{
  "vendor": {
    "id": "vendor-one",
    "name": "Vendor One",
    "short": "V1",
    "description": "Coding environment vendor",
    "aliases": []
  },
  "sourceEvent": {
    "id": "feishu-message-om-example",
    "channel": "feishu",
    "externalRef": "https://applink.feishu.cn/client/thread/example",
    "sender": "Vendor contact",
    "receivedAt": "2026-08-13T00:00:00.000Z",
    "rawArtifactId": "artifact:sha256:...",
    "metadata": { "messageId": "om_example", "chatId": "oc_example" }
  },
  "items": [
    {
      "id": "source-message-om-example",
      "kind": "message",
      "displayName": "Inbound Feishu message",
      "locator": "https://applink.feishu.cn/client/thread/example",
      "artifactId": "artifact:sha256:...",
      "fetchStatus": "snapshotted",
      "parseStatus": "parsed",
      "mutable": false
    },
    {
      "id": "source-sheet-example",
      "kind": "spreadsheet",
      "displayName": "Vendor task index",
      "locator": "https://docs.google.com/spreadsheets/d/example/edit",
      "fetchStatus": "queued",
      "parseStatus": "not_requested",
      "mutable": true
    }
  ],
  "relations": [
    {
      "fromItemId": "source-message-om-example",
      "toItemId": "source-sheet-example",
      "relation": "links_to",
      "position": 0
    }
  ],
  "batchLinks": [
    {
      "batchId": "vendor-one-2026-08-13",
      "role": "primary",
      "sourceItemIds": ["source-message-om-example", "source-sheet-example"]
    }
  ]
}
```

Statuses are operational facts:

- `fetchStatus`: `not_requested`, `queued`, `fetching`, `snapshotted`, `external_only`, `blocked`, or `failed`.
- `parseStatus`: `not_requested`, `queued`, `parsing`, `parsed`, `partial`, `blocked`, or `failed`.

Use a new source event or source item whenever remote bytes or observable contents change. A stable Google URL is only a locator; it is never a version identifier.
