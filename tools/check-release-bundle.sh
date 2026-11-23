#!/bin/sh
# SPDX-License-Identifier: MIT
set -eu
[ "$#" -eq 1 ] || { echo "Usage: $0 BUNDLE.tar.gz" >&2; exit 2; }
archive=$1
case "$archive" in /*) ;; *) archive="$PWD/$archive" ;; esac
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
(cd "$(dirname "$archive")" && sha256sum -c "$(basename "$archive").sha256")
tar -xzf "$archive" -C "$tmp"
cd "$tmp/$(basename "$archive" .tar.gz)"
sha256sum -c SHA256SUMS >/dev/null
bundle=$(basename "$PWD")
version=${bundle#floop3-}
version=${version%-air6-linux-arm64}
version=${version#v}
notes="docs/RELEASE-NOTES-$version.md"
test -s "$notes"
grep -Fq '[English](#english)' "$notes"
grep -Fq '[日本語](#日本語)' "$notes"
grep -Fq '[한국어](#한국어)' "$notes"
grep -Fq '## English' "$notes"
grep -Fq '## 日本語' "$notes"
grep -Fq '## 한국어' "$notes"
test -s extras/luci-bootstrap/packages.lock
test -s README.md
test -s README.en.md
test -s README.ja.md
test -s README.ko.md
test -s docs/INSTALL-NON-CODEX-EN.md
test -s docs/INSTALL-NON-CODEX-JA.md
test -s docs/INSTALL-NON-CODEX-KO.md
test -s docs/FIRMWARE-COMPATIBILITY-EN.md
test -s docs/FIRMWARE-COMPATIBILITY-JA.md
test -s docs/FIRMWARE-COMPATIBILITY-KO.md
test -s docs/OVERLAY-WHITEOUT-AUDIT-KO.md
test -s docs/OVERLAY-WHITEOUT-AUDIT-TEMPLATE-KO.md
test -s tools/overlay-whiteout-audit.sh
test -s extras/luci-bootstrap/README.en.md
test -s extras/iperf3/README.en.md
test -s extras/usb-nic/README.en.md
grep -Fq '"overlay_diagnostics_guide": "docs/OVERLAY-WHITEOUT-AUDIT-KO.md"' release-manifest.json
grep -Fq '"firmware_compatibility": "docs/FIRMWARE-COMPATIBILITY-EN.md; metadata match is not a functional certification."' release-manifest.json
grep -Fq '"overlay_audit_script": "tools/overlay-whiteout-audit.sh"' release-manifest.json
mkdir "$tmp/rootfs"
sh install.sh "$tmp/rootfs"
cmp release-manifest.json "$tmp/rootfs/www/luci-static/resources/sbair-release.json"
for lang in ja ko; do
	name="luci-app-sbair-modem.$lang.lmo"
	test -s "out/i18n/$name"
	cmp "out/i18n/$name" "$tmp/rootfs/usr/lib/lua/luci/i18n/$name"
done
sh install.sh "$tmp/rootfs"
printf 'fixture user data\n' > "$tmp/rootfs/etc/sbair/user-data"
sh tools/uninstall-floop3.sh --check "$tmp/rootfs"
sh tools/uninstall-floop3.sh "$tmp/rootfs"
test ! -e "$tmp/rootfs/usr/bin/sbair-modem"
test ! -e "$tmp/rootfs/www/luci-static/resources/sbair-release.json"
test ! -L "$tmp/rootfs/etc/rc.d/S95sbair-apn"
test -s "$tmp/rootfs/etc/sbair/user-data"
echo 'Release bundle install, upgrade and removal checks passed.'
