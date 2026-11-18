# SPDX-License-Identifier: MIT
# Copyright (c) 2026 Floop3
# Explicitly add an attached USB Ethernet netdev to the existing br-lan bridge.

usb_lan_valid_name() {
	local name
	name=$1
	[ -n "$name" ] && [ "${#name}" -le 15 ] || return 1
	case "$name" in
		*[!a-zA-Z0-9_.-]*|.*|*-|*.) return 1;;
	esac
	case "$name" in br-lan|lo|eth0|eth1|lan|wan|wan6) return 1;; esac
	return 0
}

usb_lan_bridge_section() {
	local section
	while IFS= read -r section; do
		[ -n "$section" ] || continue
		[ "$(get "network.$section.name")" = "$BRIDGE" ] || continue
		[ "$(get "network.$section.type")" = bridge ] || continue
		printf '%s\n' "$section"
		return 0
	done <<EOF
$(uci -q show network 2>/dev/null | sed -n 's/^network\.\(.*\)=device$/\1/p')
EOF
	return 1
}

usb_lan_is_managed() {
	local name members member
	name=$1
	members=$(get sbair.bridge.usb_lan_ports)
	for member in $members; do
		[ "$member" = "$name" ] && return 0
	done
	return 1
}

usb_lan_list() {
	local members member index
	members=$(get sbair.bridge.usb_lan_ports)
	index=0
	for member in $members; do
		usb_lan_valid_name "$member" || continue
		printf 'usb_lan_port_%s=%s\n' "$index" "$member"
		index=$((index + 1))
	done
}

usb_lan_check_available() {
	local name wan wan6 wan_ifname wan6_ifname sysdev usb_path driver master
	name=$1
	usb_lan_valid_name "$name" || { printf '%s\n' 'error=invalid network interface name'; return 1; }
	[ -e "/sys/class/net/$name" ] || { printf '%s\n' 'error=USB Ethernet interface is not currently present'; return 1; }
	sysdev=$(readlink -f "/sys/class/net/$name/device" 2>/dev/null)
	[ -n "$sysdev" ] || { printf '%s\n' 'error=interface has no resolved device path'; return 1; }
	usb_path=$sysdev
	while [ "$usb_path" != / ] && [ ! -f "$usb_path/idVendor" ]; do usb_path=$(dirname "$usb_path"); done
	[ -f "$usb_path/idVendor" ] && [ -f "$usb_path/idProduct" ] || { printf '%s\n' 'error=interface is not backed by a USB device'; return 1; }
	driver=$(basename "$(readlink -f "/sys/class/net/$name/device/driver" 2>/dev/null)" 2>/dev/null)
	[ -n "$driver" ] && [ "$driver" != unknown ] || { printf '%s\n' 'error=USB network driver is not bound'; return 1; }
	master=$(basename "$(readlink -f "/sys/class/net/$name/master" 2>/dev/null)" 2>/dev/null)
	[ -z "$master" ] || [ "$master" = "$BRIDGE" ] || { printf '%s\n' 'error=interface already belongs to another bridge'; return 1; }
	wan=$(get network.wan.device)
	wan6=$(get network.wan6.device)
	wan_ifname=$(get network.wan.ifname)
	wan6_ifname=$(get network.wan6.ifname)
	case " $wan $wan_ifname " in *" $name "*) printf '%s\n' 'error=interface is assigned to WAN'; return 1;; esac
	case " $wan6 $wan6_ifname " in *" $name "*) printf '%s\n' 'error=interface is assigned to WAN6'; return 1;; esac
	return 0
}

usb_lan_apply_bridge() {
	local section
	section=$(usb_lan_bridge_section) || { printf '%s\n' 'error=br-lan bridge-device section was not found'; return 1; }
	commit network || return 1
	commit sbair || return 1
	/etc/init.d/network reload >/dev/null 2>&1 || true
	ifup lan >/dev/null 2>&1 || true
	printf 'result=ok\nbridge=%s\n' "$BRIDGE"
}

usb_lan_add() {
	local name section ports
	name=$1
	netmode_lock_acquire || { printf '%s\n' 'error=network configuration is busy'; return 1; }
	ensure_config || return 1
	usb_lan_check_available "$name" || return 1
	section=$(usb_lan_bridge_section) || { printf '%s\n' 'error=br-lan bridge-device section was not found'; return 1; }
	ports=$(get "network.$section.ports")
	case " $ports " in
		*" $name "*) printf 'result=already_member\ninterface=%s\nbridge=%s\n' "$name" "$BRIDGE"; return 0;;
	esac
	uci -q add_list "network.$section.ports=$name" >/dev/null 2>&1 || { printf '%s\n' 'error=failed to add interface to br-lan'; return 1; }
	if ! usb_lan_is_managed "$name"; then
		uci -q add_list "sbair.bridge.usb_lan_ports=$name" >/dev/null 2>&1 || {
			uci -q del_list "network.$section.ports=$name" >/dev/null 2>&1 || true
			printf '%s\n' 'error=failed to record managed USB LAN interface'; return 1;
		}
	fi
	usb_lan_apply_bridge || return 1
	printf 'interface=%s\n' "$name"
}

usb_lan_remove() {
	local name section
	name=$1
	netmode_lock_acquire || { printf '%s\n' 'error=network configuration is busy'; return 1; }
	ensure_config || return 1
	usb_lan_valid_name "$name" || { printf '%s\n' 'error=invalid network interface name'; return 1; }
	usb_lan_is_managed "$name" || { printf '%s\n' 'error=interface is not managed by this USB LAN setting'; return 1; }
	section=$(usb_lan_bridge_section) || { printf '%s\n' 'error=br-lan bridge-device section was not found'; return 1; }
	uci -q del_list "network.$section.ports=$name" >/dev/null 2>&1 || true
	uci -q del_list "sbair.bridge.usb_lan_ports=$name" >/dev/null 2>&1 || return 1
	usb_lan_apply_bridge || return 1
	printf 'interface=%s\n' "$name"
}
