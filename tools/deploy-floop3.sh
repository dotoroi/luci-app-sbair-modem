#!/usr/bin/env bash
# SPDX-License-Identifier: MIT
# Host-side deployer for an already-built Floop3 checkout.
set -Eeuo pipefail

SELF=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
TARGET=${1:-}
[[ -n "$TARGET" ]] || { echo "Usage: $0 root@AIR6_LAN_IP" >&2; exit 2; }
[[ "$TARGET" != -* && "$TARGET" != *[!A-Za-z0-9_.@:-]* ]] || { echo "Invalid SSH target: $TARGET" >&2; exit 2; }

SSH_OPTS=()
if [[ -n "${AIR6_SSH_OPTS:-}" ]]; then read -r -a SSH_OPTS <<<"$AIR6_SSH_OPTS"; fi
for command in ssh tar sha256sum; do
	command -v "$command" >/dev/null 2>&1 || { echo "Required host command not found: $command" >&2; exit 1; }
done
[[ -s "$SELF/out/sbair-modem" ]] || { echo 'Build first: ./build.sh' >&2; exit 1; }
for lang in ja ko; do
	[[ -s "$SELF/out/i18n/luci-app-sbair-modem.$lang.lmo" ]] || { echo "Missing $lang catalog; build translations first." >&2; exit 1; }
done
BIN_SHA=$(sha256sum "$SELF/out/sbair-modem" | awk '{print $1}')
JA_SHA=$(sha256sum "$SELF/out/i18n/luci-app-sbair-modem.ja.lmo" | awk '{print $1}')
KO_SHA=$(sha256sum "$SELF/out/i18n/luci-app-sbair-modem.ko.lmo" | awk '{print $1}')

STAMP=$(date -u +%Y%m%dT%H%M%SZ)
STAGE="/tmp/floop3-deploy-${STAMP}-$$"
BACKUP="/root/sbair-backups/floop3-preinstall-${STAMP}"
WORK=$(mktemp -d "${TMPDIR:-/tmp}/floop3-deploy.XXXXXX")
trap 'rm -rf "$WORK"' EXIT
mkdir -p "$WORK/bundle/out/i18n" "$WORK/bundle/tools"
cp -R "$SELF/install.sh" "$SELF/build.sh" "$SELF/root" "$SELF/htdocs" "$WORK/bundle/"
cp "$SELF/tools/check-shell-lf.sh" "$WORK/bundle/tools/"
cp "$SELF/out/sbair-modem" "$WORK/bundle/out/"
cp "$SELF/out/i18n/luci-app-sbair-modem.ja.lmo" "$SELF/out/i18n/luci-app-sbair-modem.ko.lmo" "$WORK/bundle/out/i18n/"
tar -czf "$WORK/bundle.tar.gz" -C "$WORK/bundle" .

remote() { ssh "${SSH_OPTS[@]}" "$TARGET" "$@"; }

echo "[1/5] Preflight: $TARGET"
remote sh -s <<'REMOTE_PREFLIGHT'
set -eu
[ "$(id -u)" = 0 ] || { echo 'ERROR: SSH user must be root' >&2; exit 1; }
command -v ubus >/dev/null 2>&1 && command -v uci >/dev/null 2>&1 || { echo 'ERROR: ubus/uci missing' >&2; exit 1; }
[ -x /sbin/rpcd ] || [ -x /usr/sbin/rpcd ] || { echo 'ERROR: rpcd missing' >&2; exit 1; }
[ -x /www/cgi-bin/luci ] || { echo 'ERROR: LuCI is not installed; bootstrap only a documented matching stock image first' >&2; exit 1; }
board=$(ubus call system board 2>/dev/null) || { echo 'ERROR: cannot identify the board' >&2; exit 1; }
echo "$board" | grep -Fq '"hostname": "SBA6D"' || { echo 'ERROR: hostname is not SBA6D' >&2; exit 1; }
release=$(awk -F"'" '$1 == "DISTRIB_RELEASE=" { print $2; exit }' /etc/openwrt_release)
target=$(awk -F"'" '$1 == "DISTRIB_TARGET=" { print $2; exit }' /etc/openwrt_release)
arch=$(awk -F"'" '$1 == "DISTRIB_ARCH=" { print $2; exit }' /etc/openwrt_release)
[ "$release" = '21.02.7' ] && [ "$target" = 'gem6xxx/evb6990_cpe_mt7990_emmc' ] && \
	[ "$arch" = 'aarch64_cortex-a55_neon-vfpv4' ] || {
	echo 'ERROR: unsupported SBA6D release/target/architecture' >&2
	exit 1
}
available=$(df -Pk /overlay 2>/dev/null | awk 'NR==2 {print $4}')
[ -n "$available" ] && [ "$available" -ge 24000 ] || { echo "ERROR: /overlay needs at least 24 MiB free (reported ${available:-unknown} KiB)" >&2; exit 1; }
echo 'Board:'
echo "$board"
echo 'LAN:'
ip -4 -o addr show dev br-lan 2>/dev/null || true
echo "Overlay free: ${available} KiB"
echo 'Preflight passed. No router files changed.'
REMOTE_PREFLIGHT

echo "[2/5] Backing up configuration to $BACKUP"
remote sh -s -- "$BACKUP" <<'REMOTE_BACKUP'
set -eu
backup=$1
umask 077
mkdir -p "$backup"
chmod 0700 "$backup"
list="$backup/paths.txt"
: >"$list"
for path in etc/config etc/apk etc/opkg; do
	[ ! -e "/$path" ] || echo "$path" >>"$list"
done
for path in usr/bin/sbair-modem usr/sbin/sbair-netmode usr/sbin/sbair-maintenance \
	usr/sbin/sbair-usb-nic usr/sbin/sbair-netfix usr/sbin/sbair-wifidrift \
	usr/sbin/sbair-adblock-dnsmasq usr/libexec/rpcd/sbair usr/libexec/sbair usr/share/sbair \
	usr/share/luci/menu.d/luci-app-sbair-modem.json usr/share/rpcd/acl.d/luci-app-sbair-modem.json \
	usr/lib/lua/luci/i18n/luci-app-sbair-modem.ja.lmo usr/lib/lua/luci/i18n/luci-app-sbair-modem.ko.lmo \
	www/luci-static/resources/view/sbair www/luci-static/resources/tools/sbair.js \
	www/luci-static/resources/protocol/ql_datacall.js etc/init.d/sbair-apn etc/init.d/sbair-netfix \
	etc/init.d/sbair-wifidrift etc/init.d/sbair-adblock etc/init.d/sbair-portal \
	etc/udhcpc.user.d/sbair-fallback etc/uci-defaults/luci-app-sbair-modem \
	lib/upgrade/keep.d/luci-app-sbair-modem etc/rc.d; do
	[ ! -e "/$path" ] || echo "$path" >>"$list"
done
if [ -s "$list" ]; then tar -czpf "$backup/before-install.tar.gz" -C / -T "$list"; fi
ubus call system board >"$backup/board.json"
if [ -r /lib/apk/db/installed ]; then cp /lib/apk/db/installed "$backup/apk-installed.db"; fi
if command -v opkg >/dev/null 2>&1; then opkg list-installed >"$backup/packages.txt"; fi
chmod 0600 "$backup"/*
echo "Backup complete: $backup"
REMOTE_BACKUP

echo "[3/5] Uploading build bundle to $STAGE"
remote "mkdir -p '$STAGE' && tar -xzf - -C '$STAGE'" <"$WORK/bundle.tar.gz"
REMOTE_SHA=$(remote "cd '$STAGE' && sha256sum out/sbair-modem out/i18n/luci-app-sbair-modem.ja.lmo out/i18n/luci-app-sbair-modem.ko.lmo")
[[ "$(echo "$REMOTE_SHA" | awk 'NR==1 {print $1}')" = "$BIN_SHA" ]] || { echo 'ERROR: backend SHA256 mismatch after transfer' >&2; exit 1; }
[[ "$(echo "$REMOTE_SHA" | awk 'NR==2 {print $1}')" = "$JA_SHA" ]] || { echo 'ERROR: Japanese catalog SHA256 mismatch after transfer' >&2; exit 1; }
[[ "$(echo "$REMOTE_SHA" | awk 'NR==3 {print $1}')" = "$KO_SHA" ]] || { echo 'ERROR: Korean catalog SHA256 mismatch after transfer' >&2; exit 1; }
echo 'Transfer SHA256 checks passed.'

echo '[4/5] Installing Floop3 (no reboot)'
remote "sh '$STAGE/install.sh' /"

echo '[5/5] Checking RPC registration, language entries, and backend files'
remote sh -s <<'REMOTE_CHECK'
set -eu
ubus list | grep -qx sbair || { echo 'ERROR: rpcd did not register sbair' >&2; exit 1; }
for lang in en ja ko; do uci -q get "luci.languages.$lang" >/dev/null || { echo "ERROR: LuCI language $lang is missing" >&2; exit 1; }; done
[ -x /usr/bin/sbair-modem ] || { echo 'ERROR: Floop3 backend missing' >&2; exit 1; }
[ -s /usr/lib/lua/luci/i18n/luci-app-sbair-modem.ja.lmo ] || { echo 'ERROR: Japanese catalog missing' >&2; exit 1; }
[ -s /usr/lib/lua/luci/i18n/luci-app-sbair-modem.ko.lmo ] || { echo 'ERROR: Korean catalog missing' >&2; exit 1; }
ip -4 -o addr show dev br-lan 2>/dev/null | awk '{split($4, a, "/"); print "LuCI URL: http://" a[1] "/cgi-bin/luci/"}'
echo 'Floop3 backend, RPC object, and English/Japanese/Korean language entries are present.'
REMOTE_CHECK

remote "rm -rf '$STAGE'"
echo "Installation complete. Configuration backup: $BACKUP"

