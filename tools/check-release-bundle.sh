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
test -s extras/luci-bootstrap/packages.lock
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
