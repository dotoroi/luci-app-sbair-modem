#!/bin/sh
# SPDX-License-Identifier: MIT
set -eu

check_only=0
if [ "${1:-}" = --check ]; then
	check_only=1
	shift
fi
[ "$#" -le 1 ] || { echo "Usage: $0 [--check] [rootfs tree]" >&2; exit 2; }
root=$(CDPATH= cd -- "${1:-/}" && pwd -P)
prefix=${root%/}
receipt="$prefix/usr/share/sbair/install-paths"
[ -f "$receipt" ] && [ ! -L "$receipt" ] || {
	echo 'Missing Floop3 installation record. Restore from the pre-install backup instead.' >&2
	exit 1
}

# Restrict the installation record to product-owned paths.
while IFS= read -r path; do
	case "$path" in
		*..*|*//*|*[!A-Za-z0-9_./-]*) echo "Invalid path: $path" >&2; exit 1 ;;
	esac
	case "$path" in
		etc/init.d/sbair-*|etc/init.d/zzzzz_air6_ssh_watchdog|etc/rc.d/[SK][0-9][0-9]sbair-*|\
		etc/rc.d/[SK][0-9][0-9]zzzzz_air6_ssh_watchdog|etc/udhcpc.user.d/sbair-fallback|\
		etc/uci-defaults/luci-app-sbair-modem|lib/upgrade/keep.d/luci-app-sbair-modem|\
		usr/bin/sbair-modem|usr/bin/air6-ssh-watchdog|usr/sbin/sbair-*|usr/sbin/air6-band-restore|\
		usr/libexec/rpcd/sbair|usr/libexec/sbair/netmode/*.sh|usr/share/sbair/firewall.include|\
		usr/share/rpcd/acl.d/luci-app-sbair-modem.json|usr/share/luci/menu.d/luci-app-sbair-modem.json|\
		usr/lib/lua/luci/i18n/luci-app-sbair-modem.ko.lmo|usr/lib/lua/luci/i18n/luci-app-sbair-modem.ja.lmo|\
		www/luci-static/resources/sbair-release.json|www/luci-static/resources/view/sbair/*.js|\
		www/luci-static/resources/tools/sbair.js|www/luci-static/resources/protocol/ql_datacall.js) ;;
		*) echo "Unrecognized path: $path" >&2; exit 1 ;;
	esac
done < "$receipt"

if [ "$root" = / ]; then
	[ "$(id -u)" = 0 ] &&
		[ "$(cat /etc/knos-config/INPUT_PROJECT)" = RUDOLF ] &&
		[ "$(cat /etc/knos-config/INPUT_BASE_MODULE)" = RG620TSBK ] || exit 1
	managed=$(uci -q get sbair.bridge.managed || true)
	pending=$(uci -q get sbair.bridge.pending_id || true)
	firewall_changes=$(uci changes firewall)
	if [ "$managed" = 1 ] || [ -n "$pending" ] || [ -n "$firewall_changes" ]; then
		echo 'Resolve the pending transaction/firewall changes and return the network to unmanaged stock mode first.' >&2
		exit 1
	fi
fi

if [ "$check_only" = 1 ]; then
	echo 'Removal preflight passed.'
	exit 0
fi

umask 077
backup_base="$prefix/root/sbair-backups"
mkdir -p "$backup_base"
backup=$(mktemp -d "$backup_base/floop3-removal.XXXXXX")
cp "$receipt" "$backup/install-paths"
for path in usr/share/sbair/install-paths etc/config/firewall $(cat "$receipt"); do
	if [ -f "$prefix/$path" ] || [ -L "$prefix/$path" ]; then
		printf '%s\n' "$path"
	fi
done > "$backup/present"
tar -czf "$backup/before-remove.tar.gz" -C "$root" -T "$backup/present"
tar -tzf "$backup/before-remove.tar.gz" >/dev/null
echo "Removal backup: $backup/before-remove.tar.gz"

if [ "$root" = / ]; then
	for service in zzzzz_air6_ssh_watchdog sbair-portal sbair-adblock sbair-wifidrift sbair-netfix sbair-apn; do
		if [ -x "/etc/init.d/$service" ]; then
			"/etc/init.d/$service" stop || true
		fi
	done
	if [ "$(uci -q get firewall.sbair_dhcp_guard.path || true)" = /usr/share/sbair/firewall.include ]; then
		uci delete firewall.sbair_dhcp_guard
		uci commit firewall
	fi
fi

while IFS= read -r path; do
	rm -f "$prefix/$path"
done < "$receipt"
rm -f "$receipt"

if [ "$root" = / ]; then
	rm -f /tmp/luci-indexcache
	rm -rf /tmp/luci-modulecache
	/etc/init.d/rpcd restart
fi
echo 'Removed Floop3 release files. Preserved user settings and data.'
