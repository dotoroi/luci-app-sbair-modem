#!/bin/sh
# SPDX-License-Identifier: MIT
# Remove the manually deployed Floop3 app from an Air Terminal 6 OpenWrt system.
# Does not remove OpenWrt, LuCI, luci-app-air6-modem, or user network settings.
set -eu

[ "$(id -u)" = 0 ] || { echo 'Run as root.' >&2; exit 1; }
board=$(ubus call system board 2>/dev/null)
echo "$board" | grep -Fq 'SoftBank Air 6' || { echo 'Not a recognized Air Terminal 6; stopping.' >&2; exit 1; }

stamp=$(date -u +%Y%m%dT%H%M%SZ)
backup="/root/sbair-backups/floop3-removal-$stamp"
mkdir -p "$backup"
chmod 0700 "$backup"

# Capture current app files and affected configs before touching anything.
list="$backup/paths.txt"
: >"$list"
for p in \
	etc/config/luci etc/config/firewall etc/config/sbair etc/config/ql_ril_service \
	etc/sbair/adblock-dnsmasq.conf etc/init.d/sbair-apn etc/init.d/sbair-netfix \
	etc/init.d/sbair-wifidrift etc/init.d/sbair-adblock etc/init.d/sbair-portal \
	etc/udhcpc.user.d/sbair-fallback etc/uci-defaults/luci-app-sbair-modem \
	lib/upgrade/keep.d/luci-app-sbair-modem usr/bin/sbair-modem \
	usr/sbin/sbair-netmode usr/sbin/sbair-maintenance usr/sbin/sbair-usb-nic \
	usr/sbin/sbair-netfix usr/sbin/sbair-wifidrift usr/sbin/sbair-adblock-dnsmasq \
	usr/libexec/rpcd/sbair usr/libexec/sbair/netmode usr/share/sbair \
	usr/share/rpcd/acl.d/luci-app-sbair-modem.json \
	usr/share/luci/menu.d/luci-app-sbair-modem.json \
	usr/lib/lua/luci/i18n/luci-app-sbair-modem.ko.lmo \
	usr/lib/lua/luci/i18n/luci-app-sbair-modem.ja.lmo \
	www/luci-static/resources/tools/sbair.js \
	www/luci-static/resources/view/sbair \
	www/luci-static/resources/protocol/ql_datacall.js; do
	[ ! -e "/$p" ] || printf '%s\n' "$p" >>"$list"
done
for p in etc/rc.d/S95sbair-apn etc/rc.d/K01sbair-apn etc/rc.d/S94sbair-netfix \
	etc/rc.d/K06sbair-netfix etc/rc.d/S93sbair-wifidrift etc/rc.d/K07sbair-wifidrift \
	etc/rc.d/S90sbair-adblock etc/rc.d/K10sbair-adblock etc/rc.d/S91sbair-portal \
	etc/rc.d/K09sbair-portal; do
	[ ! -e "/$p" ] && [ ! -L "/$p" ] || printf '%s\n' "$p" >>"$list"
done
tar -czpf "$backup/before-remove.tar.gz" -C / -T "$list"
ubus call system board >"$backup/board.json"
date -u >"$backup/removal-started-utc.txt"

# Stop and disable only Floop3 services. Preserve all unrelated rc.d entries.
for s in sbair-portal sbair-adblock sbair-wifidrift sbair-netfix sbair-apn; do
	if [ -x "/etc/init.d/$s" ]; then
		"/etc/init.d/$s" stop >/dev/null 2>&1 || true
		"/etc/init.d/$s" disable >/dev/null 2>&1 || true
	fi
done

# Remove only the exact Floop3 firewall include and locale registrations.
if [ "$(uci -q get firewall.sbair_dhcp_guard 2>/dev/null || true)" = include ] &&
	[ "$(uci -q get firewall.sbair_dhcp_guard.path 2>/dev/null || true)" = /usr/share/sbair/firewall.include ] &&
	[ "$(uci -q get firewall.sbair_dhcp_guard.type 2>/dev/null || true)" = script ]; then
	uci -q delete firewall.sbair_dhcp_guard
	uci -q commit firewall
fi
if [ "$(uci -q get luci.languages.en 2>/dev/null || true)" = English ]; then
	uci -q delete luci.languages.en
fi
if [ "$(uci -q get luci.languages.ja 2>/dev/null || true)" = '日本語 (Japanese)' ]; then
	uci -q delete luci.languages.ja
fi
uci -q commit luci

# This config was absent in the verified pre-install archive. Remove it only
# while its full contents still match the app-generated defaults.
if [ -f /etc/config/ql_ril_service ]; then
	cat >"$backup/ql_ril_service.expected" <<'EOF'
config ql_ril_service 'common'
	option log_level '3'
EOF
	if cmp -s /etc/config/ql_ril_service "$backup/ql_ril_service.expected"; then
		cp -p /etc/config/ql_ril_service "$backup/ql_ril_service.removed"
		rm -f /etc/config/ql_ril_service
	else
		echo 'Preserved modified /etc/config/ql_ril_service' >>"$backup/preserved.txt"
	fi
fi

if [ -f /etc/config/sbair ]; then
	uci -q show sbair | sort >"$backup/sbair.actual"
	cat >"$backup/sbair.expected" <<'EOF'
sbair.bridge.ap_dhcp_enabled='1'
sbair.bridge.cellular_wan='0'
sbair.bridge.dhcp_server='0'
sbair.bridge.fallback_enabled='1'
sbair.bridge.fallback_ip='192.168.3.1'
sbair.bridge.fallback_netmask='255.255.255.0'
sbair.bridge.fallback_timeout='15'
sbair.bridge.managed='0'
sbair.bridge.management_proto='dhcp'
sbair.bridge.mode='sim'
sbair.bridge.oem_baseline_ready='0'
sbair.bridge=bridge
EOF
	if cmp -s "$backup/sbair.actual" "$backup/sbair.expected"; then
		cp -p /etc/config/sbair "$backup/sbair.removed"
		rm -f /etc/config/sbair
	else
		echo 'Preserved modified /etc/config/sbair' >>"$backup/preserved.txt"
	fi
fi

# Remove known app-owned files; rmdir only removes directories when empty.
rm -f \
	/usr/bin/sbair-modem \
	/usr/sbin/sbair-netmode /usr/sbin/sbair-maintenance /usr/sbin/sbair-usb-nic \
	/usr/sbin/sbair-netfix /usr/sbin/sbair-wifidrift /usr/sbin/sbair-adblock-dnsmasq \
	/usr/libexec/rpcd/sbair \
	/usr/libexec/sbair/netmode/common.sh /usr/libexec/sbair/netmode/state.sh \
	/usr/libexec/sbair/netmode/apply.sh /usr/libexec/sbair/netmode/status.sh \
	/usr/libexec/sbair/netmode/usb-lan.sh \
	/usr/share/sbair/firewall.include \
	/usr/share/rpcd/acl.d/luci-app-sbair-modem.json \
	/usr/share/luci/menu.d/luci-app-sbair-modem.json \
	/usr/lib/lua/luci/i18n/luci-app-sbair-modem.ko.lmo \
	/usr/lib/lua/luci/i18n/luci-app-sbair-modem.ja.lmo \
	/www/luci-static/resources/tools/sbair.js \
	/www/luci-static/resources/protocol/ql_datacall.js \
	/etc/init.d/sbair-apn /etc/init.d/sbair-netfix /etc/init.d/sbair-wifidrift \
	/etc/init.d/sbair-adblock /etc/init.d/sbair-portal \
	/etc/udhcpc.user.d/sbair-fallback /etc/uci-defaults/luci-app-sbair-modem \
	/lib/upgrade/keep.d/luci-app-sbair-modem \
	/etc/sbair/adblock-dnsmasq.conf
if [ -d /www/luci-static/resources/view/sbair ]; then
	for f in /www/luci-static/resources/view/sbair/*.js; do [ ! -f "$f" ] || rm -f "$f"; done
	rmdir /www/luci-static/resources/view/sbair 2>/dev/null || true
fi
rmdir /usr/libexec/sbair/netmode /usr/libexec/sbair /usr/share/sbair /etc/sbair 2>/dev/null || true

rm -f /etc/rc.d/S95sbair-apn /etc/rc.d/K01sbair-apn \
	/etc/rc.d/S94sbair-netfix /etc/rc.d/K06sbair-netfix \
	/etc/rc.d/S93sbair-wifidrift /etc/rc.d/K07sbair-wifidrift \
	/etc/rc.d/S90sbair-adblock /etc/rc.d/K10sbair-adblock \
	/etc/rc.d/S91sbair-portal /etc/rc.d/K09sbair-portal

rm -f /tmp/luci-indexcache
rm -rf /tmp/luci-modulecache
/etc/init.d/rpcd restart
sleep 2

echo "Removal backup: $backup"
echo 'Remaining Floop3 checks:'
for p in /usr/bin/sbair-modem /usr/libexec/rpcd/sbair /usr/share/sbair/firewall.include \
	/usr/share/luci/menu.d/luci-app-sbair-modem.json \
	/usr/share/rpcd/acl.d/luci-app-sbair-modem.json; do
	[ ! -e "$p" ] || echo "REMAINS: $p"
done
if ubus list 2>/dev/null | grep -qx sbair; then echo 'REMAINS: ubus object sbair'; fi
echo 'Air6 base package:'
apk info -e luci-app-air6-modem 2>/dev/null || true
echo 'Preserved network addresses:'
ip -4 -o addr show dev br-lan 2>/dev/null || true
