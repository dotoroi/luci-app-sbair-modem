#!/bin/sh
# SPDX-License-Identifier: MIT
# Build a source-plus-prebuilt bundle for a tagged Floop3 release.
set -eu

SELF=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
VERSION=${1:-}
MODE=${2:-}
[ -n "$VERSION" ] || { echo "Usage: $0 VERSION [--use-existing-binary]" >&2; exit 2; }
case "$VERSION" in *[!A-Za-z0-9._+-]*|'') echo "Invalid release version: $VERSION" >&2; exit 2 ;; esac
case "$MODE" in ''|--use-existing-binary) ;; *) echo "Unknown option: $MODE" >&2; exit 2 ;; esac

command -v sha256sum >/dev/null 2>&1 || { echo 'sha256sum is required' >&2; exit 1; }
command -v tar >/dev/null 2>&1 || { echo 'tar is required' >&2; exit 1; }
if [ "$MODE" != --use-existing-binary ]; then
	"$SELF/build.sh"
fi
[ -s "$SELF/out/sbair-modem" ] || { echo 'Missing out/sbair-modem' >&2; exit 1; }
sh "$SELF/tools/check-shell-lf.sh"

COMMIT=$(git -C "$SELF" rev-parse HEAD)
DIRTY=false
# Windows-hosted WSL checkouts may expose CRLF/LF normalization differences.
# Ignore end-of-line-only noise, while still refusing substantive source edits.
if ! git -C "$SELF" -c core.autocrlf=true diff --ignore-space-at-eol --quiet HEAD -- .; then DIRTY=true; fi
if [ "$DIRTY" = true ] && [ "${ALLOW_DIRTY_PREVIEW:-0}" != 1 ]; then
	echo 'Refusing to make a release from modified tracked files. Set ALLOW_DIRTY_PREVIEW=1 only for a local preview.' >&2
	exit 1
fi
GO_VERSION=$(go version | awk '{print $3}')
OUT="$SELF/out/release"
STAGE="$OUT/stage/floop3-$VERSION-air6-linux-arm64"
ARCHIVE="$OUT/floop3-$VERSION-air6-linux-arm64.tar.gz"
mkdir -p "$OUT/stage"
rm -rf "$STAGE"
mkdir -p "$STAGE/out"
cp -R "$SELF/install.sh" "$SELF/root" "$SELF/htdocs" "$STAGE/"
mkdir -p "$STAGE/tools"
cp "$SELF/tools/check-shell-lf.sh" "$STAGE/tools/"
cp "$SELF/tools/uninstall-floop3.sh" "$STAGE/tools/"
cp "$SELF/out/sbair-modem" "$STAGE/out/"
cp "$SELF/LICENSE" "$SELF/NOTICE.md" "$STAGE/"
cp "$SELF/docs/FIRMWARE-COMPATIBILITY-KO.md" "$STAGE/"
cp "$SELF/docs/INSTALL-NON-CODEX-KO.md" "$SELF/docs/UNINSTALL-FLOOP3-KO.md" "$STAGE/"
mkdir -p "$STAGE/out/i18n" "$STAGE/extras"
cp -R "$SELF/extras/luci-bootstrap" "$STAGE/extras/"
for lang in ja ko; do
	name="luci-app-sbair-modem.$lang"
	python3 "$SELF/tools/po2lmo-fallback.py" "$SELF/po/$lang/luci-app-sbair-modem.po" "$STAGE/out/i18n/$name.lmo"
done

BIN_SHA=$(sha256sum "$STAGE/out/sbair-modem" | awk '{print $1}')
cat > "$STAGE/release-manifest.json" <<EOF
{
  "name": "luci-app-sbair-modem",
  "version": "$VERSION",
  "source_commit": "$COMMIT",
  "working_tree_dirty": $DIRTY,
  "built_at_utc": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "binary": "out/sbair-modem",
  "binary_sha256": "$BIN_SHA",
  "go_version": "$GO_VERSION",
  "goos": "linux",
  "goarch": "arm64",
  "cgo_enabled": false,
  "firmware_compatibility": "See FIRMWARE-COMPATIBILITY-KO.md; metadata match is not a functional certification."
}
EOF
(cd "$STAGE" && find . -type f ! -name SHA256SUMS -print | LC_ALL=C sort | xargs sha256sum > SHA256SUMS)
rm -f "$ARCHIVE" "$ARCHIVE.sha256"
tar -czf "$ARCHIVE" -C "$OUT/stage" "floop3-$VERSION-air6-linux-arm64"
(cd "$OUT" && sha256sum "$(basename "$ARCHIVE")" > "$(basename "$ARCHIVE").sha256")
rm -rf "$OUT/stage"
echo "Prepared: $ARCHIVE"
cat "$ARCHIVE.sha256"
echo "Source commit: $COMMIT"
echo 'This archive does not include firmware images and is not an automatic remote installer.'
