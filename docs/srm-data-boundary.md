# SRM and Harbor data ownership

The [SRM Feishu Base](https://vrfi1sk8a0.feishu.cn/base/WqS9bTgadatBNusLu7aciS7wn8f)
owns supplier relationships, timeline events, original deliveries, receipt and
source metadata, researcher feedback, and procurement history. All new timeline
entries and original delivery capture belong there.

Railway's vendor-facing purpose is a Harbor task view. It retains the task files
and technical identities, versions, classifications, integrity information and
Base references required to browse tasks, download them and publish them to JFS.
The separate public benchmark reference is unaffected by this ownership change.

## Record placement

| Information | Destination |
| --- | --- |
| Supplier descriptions, contacts, discussions, offers and purchasing history | Base supplier and event records |
| Original vendor archives, documents, attachments and vendor traces | Base delivery materials |
| Receipt dates, source channels, confirmed source groups, and original source relationships | Corresponding Base delivery/event, with retained supporting metadata when needed |
| Researcher feedback, evaluation summaries and links to Beagle evidence | Base delivery/event |
| Valid Harbor task files, exact task identities, version and classification metadata | Railway Harbor catalog and task storage |
| File hashes and selection manifests needed by the gateway and JFS publisher | Technical task metadata |
| JFS distribution and generated ZIPs | Existing raw mirror and archive publisher |

Supplier and delivery references retained in Railway identify and group Harbor
tasks; they are not a second supplier history. Feishu record IDs and exact CASE
task/version IDs must remain explicitly mapped. Display names do not establish
identity. A Base attachment is preserved only when its downloaded bytes and
record association have been verified, not merely because its filename matches.

## Existing data and deletion gate

The installed legacy registry combines original payloads, source snapshots,
task packages, trajectories and check evidence in `case-registry-artifacts`.
It is not an originals-only bucket. The current Harbor exporter and internal legacy artifact reads still use task
packages from it. Do not delete this bucket while any
Harbor-serving operation depends on those objects.

Retiring originals and their database metadata requires all of the following:

1. Inventory retained and archived submissions, their original files, source
   relationships and historical corrections, including material omitted from
   the current catalog.
2. Map each delivery to its Base record. Verify each original's SHA-256 against
   a downloaded Base attachment or a verified member of a preserved archive.
   Retain all submission associations for files shared by multiple deliveries.
3. Reconcile supplier timelines and relevant change history into Base, retaining
   the meaning, dates, provenance and visibility of the original evidence.
4. Remove runtime dependencies on the legacy originals store. Verify Harbor
   browsing, individual and aggregate downloads, registration/republication,
   gateway manifests, and both JFS jobs against the retained task storage.
5. Re-read inventories before deletion, account for intervening writes, and
   remove only the verified retired objects and metadata. Preserve technical
   task identities and any foreign-key relationships still needed by consumers.

The user has authorized deletion once these conditions are established. Missing
verification leaves the existing data in place; it is not authorization to
discard it. Do not describe the retained legacy store as the destination for new
deliveries or invoke legacy capture commands for new originals.

## Runtime transition

Root `AGENTS.md` establishes the new operating boundary immediately for agents
reading this checkout. Running deployments receive it only through the normal
GitHub deployment flow. Source policy changes alone do not migrate stored files,
remove database rows, or prove that installed consumers have been changed.

The raw JFS mirror and archive publisher remain documented in
[raw mirror operations](../ops/harbor-mirror/README.md) and
[archive operations](../ops/harbor-archives/README.md). Preserve their exact task
selection and integrity checks when changing the backing registry.

The installed CLI stops new timeline writes and original-delivery intake. Harbor
registration starts with a Base record reference; see the
[registration guide](../apps/case/README.md#registering-harbor-tasks-from-base).
The portal shows Harbor tasks only and links supplier history and originals to
Base. Legacy portal artifact/original/dataset routes are retired; individual task
files and vendor/benchmark Harbor ZIP downloads use the existing gateway.

The internal CASE catalog and legacy read/recovery library remain intact for
preservation work and the JFS publisher. This is a staged storage retirement:
existing source graphs, originals and technical packages are retained until the
verification gates above pass. No deployment of these changes deletes them.
