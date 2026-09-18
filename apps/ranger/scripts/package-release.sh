#!/bin/sh
# Package a committed, explicitly selected source snapshot; no local payloads or secrets.
set -eu
revision=${1:-HEAD}
output=${2:?Usage: package-release.sh REVISION OUTPUT.tar.gz}
root=$(git rev-parse --show-toplevel)
commit=$(git -C "$root" rev-parse --verify "$revision^{commit}")
git -C "$root" archive --format=tar.gz --output="$output" "$commit" \
  AGENTS.md apps/ranger docs/beagle.md docs/srm-data-boundary.md \
  ops/harbor-mirror/README.md ops/harbor-archives/README.md \
  apps/case/README.md apps/portal/README.md
printf '%s\n' "$commit"
