# Registering source material

Source registration is the first durable checkpoint in complete sample registration. Its purpose is to make the inbound delivery recoverable and traceable while task discovery, interpretation, and execution continue.

## Order of operations

1. Resolve the inbound event and the exact resources within the reviewed scope.
2. Store every accessible payload or snapshot content-addressably.
3. Build the source event and source-item graph with explicit relations.
4. Import the graph and create or update the visible submission checkpoint.
5. Inspect the preserved material and register exact task versions.
6. Record task artifacts, checks, trajectories, and resolution evidence against those versions.

If storage succeeds but graph registration fails, delete the object only after confirming that no registry record references it. A retry is a new provenance-preserving attempt, not retroactive completion of the failed event.

## Minimum source event

Record:

- stable event identifier and idempotency key;
- vendor and submission association when known;
- source channel and original locator;
- sender or authenticated uploader;
- event and observation timestamps;
- declared purpose (`sample_evaluation` for reviewed capture plans);
- fetch and parse states, including errors;
- revision relation when this delivery corrects earlier material.

## Minimal envelope

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

`batchLinks` and `batchId` are compatibility field names for submission links.

## Source items and relations

Represent meaningful objects separately: message, attachment, document, worksheet, row, URL, webpage, PDF, archive, repository, directory, task package, image, or container-image reference.

Connect them with explicit relations such as:

- message `has_attachment` file;
- document `contains` worksheet;
- worksheet `contains` row;
- archive `contains` task package;
- URL `resolves_to` snapshot;
- new item `revises` prior item;
- derived artifact `extracted_from` source item.

Do not flatten distinct objects into a single note when their identity affects provenance or task interpretation.

## Object metadata

For each stored object, retain its digest, byte size, media type, storage key, original filename when present, and the source item it represents. Snapshots of mutable sources need an observation time even when the locator did not change.

## Partial and failed material

Keep inaccessible, incomplete, malformed, and failed source items in the graph with accurate states. Their existence may define a task boundary or explain why registration is blocked. Absence of bytes is not a failed task check unless such a check ran.

Allowed operational states are:

- `fetchStatus`: `not_requested`, `queued`, `fetching`, `snapshotted`, `external_only`, `blocked`, or `failed`;
- `parseStatus`: `not_requested`, `queued`, `parsing`, `parsed`, `partial`, `blocked`, or `failed`.
