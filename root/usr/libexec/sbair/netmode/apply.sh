# SPDX-License-Identifier: MIT
# Copyright (c) 2026 syado
# Network mutation, recovery, and transaction workers.

prepare_ap_static_config() {
	local address netmask
	# A DHCP lease is not a durable management address. Use the configured
	# fallback as the recovery address, or the documented direct-link address.
	address=$(get sbair.bridge.fallback_ip)
	[ "$address" != "$VENDOR_ALIAS" ] && is_ipv4 "$address" || address=192.168.3.1
	netmask=$(get sbair.bridge.fallback_netmask)
	mask_to_prefix "$netmask" >/dev/null 2>&1 || netmask=255.255.255.0
	set_opt sbair.bridge.management_proto static || return 1
	set_opt sbair.bridge.ipaddr "$address" || return 1
	set_opt sbair.bridge.netmask "$netmask" || return 1
	commit sbair || return 1
}
network_reload() {
	[ -x /usr/bin/sbair-modem ] && /usr/bin/sbair-modem wifi-drift snapshot network_reload_before >/dev/null 2>&1 || true
	/etc/init.d/network reload >/dev/null 2>&1 || true
	ifup lan >/dev/null 2>&1 || true
	[ -x /usr/bin/sbair-modem ] && /usr/bin/sbair-modem wifi-drift snapshot network_reload_after >/dev/null 2>&1 || true
}

apply_ethwan_config() {
	local wan_device section name networks found_zone found_forward found_lan_zone wan_input
	ensure_config
	if [ "$(get sbair.bridge.mode)" = vlanwan ]; then
		restore_vlanwan_baseline || { printf '%s\n' 'error=이전 eth0.3 VLAN WAN 설정을 복원하지 못했습니다'; return 1; }
	fi
	[ -e /sys/class/net/eth1 ] || { printf '%s\n' 'error=유선 WAN 후보 eth1이 존재하지 않습니다'; return 1; }
	[ "$(get network.lan.proto)" = static ] || { printf '%s\n' 'error=LAN이 고정 사설 주소를 가진 라우터 상태가 아닙니다'; return 1; }
	is_ipv4 "$(get network.lan.ipaddr)" || { printf '%s\n' 'error=LAN IPv4 주소가 유효하지 않습니다'; return 1; }
	mask_to_prefix "$(get network.lan.netmask)" >/dev/null 2>&1 || { printf '%s\n' 'error=LAN 넷마스크가 유효하지 않습니다'; return 1; }
	[ "$(get dhcp.lan.ignore)" != 1 ] || { printf '%s\n' 'error=LAN DHCP 서버가 꺼져 있습니다. AP 모드에서 직접 유선 WAN 모드로 전환할 수 없습니다'; return 1; }
	# Reuse the OEM routed firewall only when it still has LAN->WAN forwarding,
	# a WAN zone attached to the logical wan interface, and masquerading enabled.
	found_zone=0
	found_lan_zone=0
	while IFS= read -r section; do
		[ -n "$section" ] || continue
		name=$(get "firewall.$section.name")
		networks=" $(get "firewall.$section.network") "
		if [ "$name" = wan ]; then
			case "$networks" in *' wan '*) :;; *) continue;; esac
			[ "$(get "firewall.$section.masq")" = 1 ] || continue
			wan_input=$(get "firewall.$section.input")
			[ "$wan_input" = DROP ] || [ "$wan_input" = REJECT ] || continue
			found_zone=1
		elif [ "$name" = lan ]; then
			case "$networks" in *' lan '*) :;; *) continue;; esac
			[ "$(get "firewall.$section.input")" = ACCEPT ] || continue
			found_lan_zone=1
		fi
	done <<EOF
$(uci -q show firewall 2>/dev/null | sed -n "s/^firewall\.\(@zone\[[0-9][0-9]*\]\)=zone$/\1/p")
EOF
	[ "$found_zone" -eq 1 ] || { printf '%s\n' 'error=LAN-to-WAN masquerade firewall zone was not found; refusing Ethernet WAN setup'; return 1; }
	[ "$found_lan_zone" -eq 1 ] || { printf '%s\n' 'error=trusted LAN firewall zone was not found; refusing Ethernet WAN setup'; return 1; }
	found_forward=0
	while IFS= read -r section; do
		[ -n "$section" ] || continue
		[ "$(get "firewall.$section.src")" = lan ] && [ "$(get "firewall.$section.dest")" = wan ] && found_forward=1
	done <<EOF
$(uci -q show firewall 2>/dev/null | sed -n "s/^firewall\.\(@forwarding\[[0-9][0-9]*\]\)=forwarding$/\1/p")
EOF
	[ "$found_forward" -eq 1 ] || { printf '%s\n' 'error=LAN-to-WAN firewall forwarding was not found; refusing Ethernet WAN setup'; return 1; }
	wan_device=$(get network.wan.device)
	if [ "$wan_device" = eth1 ] && [ "$(get sbair.bridge.ethwan_orig_ready)" != 1 ]; then
		printf '%s\n' 'error=현재 eth1 WAN의 원래 모뎀 구성을 안전하게 복원할 기준이 없습니다'
		return 1
	fi
	save_ethwan_baseline || { printf '%s\n' 'error=기존 WAN 설정 백업에 실패했습니다'; return 1; }
	fallback_remove
	ifdown wan >/dev/null 2>&1 || true
	if uci -q get network.wan6 >/dev/null 2>&1; then ifdown wan6 >/dev/null 2>&1 || true; fi
	# Use the vendor's dedicated eth1 WAN path. Keep the LAN subnet, DHCP pool,
	# Wi-Fi bridge, and OEM LAN-to-WAN masquerading policy in place.
	uci -q del_list 'network.@device[0].ports=eth1' >/dev/null 2>&1 || true
	set_opt network.wan.proto dhcp || return 1
	set_opt network.wan.device eth1 || return 1
	del_opt network.wan.disabled
	set_opt network.wan.auto 1 || return 1
	if uci -q get network.wan6 >/dev/null 2>&1; then
		set_opt network.wan6.device eth1 || return 1
		del_opt network.wan6.disabled
		set_opt network.wan6.auto 1 || return 1
	fi
	dhcp_guard_disable || true
	set_opt sbair.bridge.mode ethwan || return 1
	set_opt sbair.bridge.managed 1 || return 1
	commit network || return 1
	commit sbair || return 1
	network_reload
	/etc/init.d/firewall reload >/dev/null 2>&1 || true
	ifup wan >/dev/null 2>&1 || true
	if uci -q get network.wan6 >/dev/null 2>&1; then ifup wan6 >/dev/null 2>&1 || true; fi
	restart_dnsmasq_checked || return 1
	/etc/init.d/sbair-netfix stop >/dev/null 2>&1 || true
}

apply_vlanwan_config() {
	local vlan1 vlan3 wan_zone lan_zone ports filtered token other other_ports present section networks found_forward index other_vid existing_vlan3 existing_ports already_moved
	ensure_config
	[ -e /sys/class/net/eth0 ] || { printf '%s\n' 'error=eth0 스위치 인터페이스가 없습니다'; return 1; }
	[ "$(get network.lan.proto)" = static ] || { printf '%s\n' 'error=LAN이 고정 사설 주소를 가진 라우터 상태가 아닙니다'; return 1; }
	is_ipv4 "$(get network.lan.ipaddr)" || { printf '%s\n' 'error=LAN IPv4 주소가 유효하지 않습니다'; return 1; }
	mask_to_prefix "$(get network.lan.netmask)" >/dev/null 2>&1 || { printf '%s\n' 'error=LAN 넷마스크가 유효하지 않습니다'; return 1; }
	[ "$(get dhcp.lan.ignore)" != 1 ] || { printf '%s\n' 'error=LAN DHCP 서버가 꺼져 있습니다'; return 1; }
	wan_zone=$(find_firewall_zone wan) || { printf '%s\n' 'error=wan 방화벽 zone을 찾을 수 없습니다'; return 1; }
	networks=" $(get "firewall.$wan_zone.network") "
	case "$networks" in *' wan '*) :;; *) printf '%s\n' 'error=wan 방화벽 zone에 기존 wan 인터페이스가 연결되지 않았습니다'; return 1;; esac
	[ "$(get "firewall.$wan_zone.input")" = DROP ] || [ "$(get "firewall.$wan_zone.input")" = REJECT ] || { printf '%s\n' 'error=wan 입력 정책이 DROP/REJECT가 아니므로 적용을 거부했습니다'; return 1; }
	[ "$(get "firewall.$wan_zone.masq")" = 1 ] || { printf '%s\n' 'error=wan NAT masquerade가 없어 적용을 거부했습니다'; return 1; }
	lan_zone=$(find_firewall_zone lan) || { printf '%s\n' 'error=lan 방화벽 zone을 찾을 수 없습니다'; return 1; }
	case " $(get "firewall.$lan_zone.network") " in *' lan '*) :;; *) printf '%s\n' 'error=lan 방화벽 zone에 LAN 인터페이스가 연결되지 않았습니다'; return 1;; esac
	[ "$(get "firewall.$lan_zone.input")" = ACCEPT ] || { printf '%s\n' 'error=trusted LAN 입력 정책이 ACCEPT가 아니므로 적용을 거부했습니다'; return 1; }
	found_forward=0
	while IFS= read -r section; do
		[ -n "$section" ] || continue
		[ "$(get "firewall.$section.src")" = lan ] && [ "$(get "firewall.$section.dest")" = wan ] && found_forward=1
	done <<EOF
$(uci -q show firewall 2>/dev/null | sed -n "s/^firewall\\.\\(@forwarding\\[[0-9][0-9]*\\]\\)=forwarding$/\\1/p")
EOF
	[ "$found_forward" -eq 1 ] || { printf '%s\n' 'error=LAN-to-WAN forwarding이 없어 적용을 거부했습니다'; return 1; }
	# The history maps switch port 1 to the external jack and CPU port 5 to eth0.
	# Move port 1 out of VLAN 1; eth0.1 remains a br-lan member and is never WAN.
	vlan1=$(find_switch_vlan 1) || { printf '%s\n' 'error=switch0 VLAN 1을 찾을 수 없습니다'; return 1; }
	ports=$(get "network.$vlan1.ports")
	filtered=
	for token in $ports; do
		[ "$token" = 1 ] && continue
		[ -n "$filtered" ] && filtered="$filtered "
		filtered="$filtered$token"
	done
	already_moved=0
	case " $ports " in
		*' 1 '*) :;;
		*)
			if [ "$(get network.ethwan_vlan.device)" = switch0 ] && [ "$(get network.ethwan_vlan.vlan)" = 3 ]; then
				existing_vlan3=ethwan_vlan
			else
				existing_vlan3=$(find_switch_vlan 3 2>/dev/null || true)
			fi
			[ -n "$existing_vlan3" ] || { printf '%s\n' 'error=포트 1이 VLAN 1에 없고 VLAN 3도 없어 적용을 거부했습니다'; return 1; }
			existing_ports=$(get "network.$existing_vlan3.ports")
			case " $existing_ports " in *' 1 '*) :;; *) printf '%s\n' 'error=포트 1이 VLAN 1에도 VLAN 3에도 없어 적용을 거부했습니다'; return 1;; esac
			case " $existing_ports " in *' 5t '*) :;; *) printf '%s\n' 'error=기존 VLAN 3의 CPU 포트 5 tagged 연결이 없어 적용을 거부했습니다'; return 1;; esac
			already_moved=1
			;;
	esac
	# Refuse ambiguous overlap with any VLAN other than the expected VID 1/3.
	index=0
	while [ "$index" -lt 16 ]; do
		other="@switch_vlan[$index]"
		other_vid=$(get "network.$other.vlan")
		other_ports=$(get "network.$other.ports")
		if [ -n "$other_vid" ] && [ "$other_vid" != 1 ] && [ "$other_vid" != 3 ]; then
			case " $other_ports " in *' 1 '*) printf '%s\n' 'error=스위치 포트 1이 다른 VLAN에도 있어 적용을 거부했습니다'; return 1;; esac
		fi
		index=$((index + 1))
	done
	if [ "$(get network.ethwan_vlan)" ]; then
		[ "$(get network.ethwan_vlan.device)" = switch0 ] && [ "$(get network.ethwan_vlan.vlan)" = 3 ] || { printf '%s\n' 'error=network.ethwan_vlan 이름이 다른 VLAN에 사용 중입니다'; return 1; }
		case " $(get network.ethwan_vlan.ports) " in *' 1 '*) :;; *) printf '%s\n' 'error=ethwan_vlan에 기록된 외부 포트 1이 없습니다'; return 1;; esac
		case " $(get network.ethwan_vlan.ports) " in *' 5t '*) :;; *) printf '%s\n' 'error=ethwan_vlan에 CPU 포트 5 tagged가 없습니다'; return 1;; esac
		vlan3=network.ethwan_vlan
	else
		vlan3=$(find_switch_vlan 3 2>/dev/null || true)
		if [ -z "$vlan3" ]; then vlan3=ethwan_vlan; fi
		if [ "$vlan3" != ethwan_vlan ]; then
			case " $(get "network.$vlan3.ports") " in *' 1 '* ) :;; *) printf '%s\n' 'error=기존 VLAN 3에 외부 스위치 포트 1이 할당되지 않았습니다'; return 1;; esac
			case " $(get "network.$vlan3.ports") " in *' 5t '*) :;; *) printf '%s\n' 'error=기존 VLAN 3에 CPU 포트 5 tagged가 없습니다'; return 1;; esac
		fi
	fi
	if [ "$(get sbair.bridge.mode)" != vlanwan ] || [ "$(get sbair.bridge.vlanwan_orig_ready)" != 1 ]; then
		save_vlanwan_baseline || { printf '%s\n' 'error=eth0.3 원복 기준을 저장하지 못했습니다'; return 1; }
	fi
	if [ "$(get network.wan.device)" = eth1 ] && [ "$(get sbair.bridge.ethwan_orig_ready)" = 1 ]; then
		restore_ethwan_baseline || return 1
	fi
	ifdown ethernetwan >/dev/null 2>&1 || true
	set_opt "network.$vlan1.ports" "$filtered" || return 1
	if [ "$vlan3" = ethwan_vlan ]; then
		uci -q set network.ethwan_vlan=switch_vlan || return 1
		set_opt network.ethwan_vlan.device switch0 || return 1
		set_opt network.ethwan_vlan.vlan 3 || return 1
		set_opt network.ethwan_vlan.ports '1 5t' || return 1
	fi
	if [ "$(get network.ethernetwan)" ] && [ "$(get network.ethernetwan.proto)" != dhcp ]; then
		printf '%s\n' 'error=기존 ethernetwan이 DHCP가 아니므로 덮어쓰지 않았습니다'; return 1
	fi
	uci -q set network.ethernetwan=interface || return 1
	set_opt network.ethernetwan.proto dhcp || return 1
	set_opt network.ethernetwan.device eth0.3 || return 1
	set_opt network.ethernetwan.auto 1 || return 1
	del_opt network.ethernetwan.disabled
	case " $(get "firewall.$wan_zone.network") " in *' ethernetwan '*) :;; *) uci -q add_list "firewall.$wan_zone.network=ethernetwan" || return 1;; esac
	dhcp_guard_disable || true
	set_opt sbair.bridge.mode vlanwan || return 1
	set_opt sbair.bridge.managed 1 || return 1
	commit network || return 1
	commit firewall || return 1
	commit sbair || return 1
	network_reload
	/etc/init.d/firewall reload >/dev/null 2>&1 || true
	ifup ethernetwan >/dev/null 2>&1 || true
	restart_dnsmasq_checked || return 1
	/etc/init.d/sbair-netfix stop >/dev/null 2>&1 || true
}

apply_ap_config() {
	local proto
	ensure_config
	if [ "$(get sbair.bridge.mode)" = vlanwan ]; then restore_vlanwan_baseline || return 1; fi
	if [ "$(get network.wan.device)" = eth1 ] && [ "$(get sbair.bridge.ethwan_orig_ready)" = 1 ]; then
		# Return the Ethernet jack to the LAN bridge before entering AP mode.
		restore_ethwan_baseline || return 1
	fi
	save_backup || return 1
	fallback_remove
	proto=$(get sbair.bridge.management_proto)
	if [ "$proto" = dhcp ] && ! ap_dhcp_allowed; then
		prepare_ap_static_config || return 1
		proto=static
	fi
	[ "$proto" = dhcp ] || proto=static
	set_opt network.lan.proto "$proto"
	if [ "$proto" = dhcp ]; then
		for key in ipaddr netmask gateway dns ip6assign ip6hint ip6class; do
			del_opt "network.lan.$key"
		done
	else
		# Blank raw fields inherit the captured OEM logical LAN values. Resolve and
		# validate before changing network.lan so an incomplete configuration cannot
		# leave the device without a management address.
		resolve_static_config "$(get sbair.bridge.ipaddr)" "$(get sbair.bridge.netmask)" \
			"$(get sbair.bridge.gateway)" "$(get sbair.bridge.dns)" || return 1
		set_opt network.lan.ipaddr "$static_effective_ipaddr" || return 1
		set_opt network.lan.netmask "$static_effective_netmask" || return 1
		if [ -n "$static_effective_gateway" ]; then set_opt network.lan.gateway "$static_effective_gateway"; else del_opt network.lan.gateway; fi
		if [ -n "$static_effective_dns" ]; then set_opt network.lan.dns "$static_effective_dns"; else del_opt network.lan.dns; fi
		for key in ip6assign ip6hint ip6class; do del_opt "network.lan.$key"; done
	fi
	set_opt network.lan.delegate 0
	set_opt dhcp.lan.ignore 1
	set_opt dhcp.lan.ra disabled
	set_opt dhcp.lan.dhcpv6 disabled
	set_opt dhcp.lan.ndp disabled
	if uci -q get network.wan >/dev/null 2>&1; then
		set_opt network.wan.disabled 1
		set_opt network.wan.auto 0
	fi
	set_opt sbair.bridge.mode ap
	set_opt sbair.bridge.managed 1
	# Install the packet guard before any reload can revive vendor DHCP.
	dhcp_guard_enable || return 1
	commit network || return 1
	commit dhcp || return 1
	commit sbair || return 1
	ifdown wan >/dev/null 2>&1 || true
	ifdown lan >/dev/null 2>&1 || true
	network_reload
	/etc/init.d/firewall reload >/dev/null 2>&1 || true
	ifdown wan >/dev/null 2>&1 || true
	dhcp_guard_enable || return 1
	restart_dnsmasq_checked || return 1
	safe_runtime_write "$DHCP_START_FILE" "$(date +%s)" || return 1
	rm -f "$CONFLICT_FILE" "$FALLBACK_FILE"
}

apply_sim_config() {
	local force ipaddr netmask profile_ready
	force=${1:-0}
	ensure_config
	load_saved_config
	if [ "$(get sbair.bridge.mode)" = vlanwan ]; then restore_vlanwan_baseline || return 1; fi
	if [ "$(get network.wan.device)" = eth1 ] && [ "$(get sbair.bridge.ethwan_orig_ready)" = 1 ]; then
		restore_ethwan_baseline || return 1
	fi
	dhcp_guard_disable || true
	fallback_remove
	ifdown wan >/dev/null 2>&1 || true
	ifdown lan >/dev/null 2>&1 || true
	profile_ready=0
	[ "$force" = 0 ] && [ "$(get sbair.bridge.backup_ready)" = 1 ] && profile_ready=1
	if [ "$force" = 1 ] || [ "$profile_ready" -ne 1 ] || [ "$(get sbair.bridge.sim_proto)" != static ]; then
		# An unmanaged baseline is not a SIM profile. Start from the explicit,
		# documented SIM LAN instead of combining a DHCP client with a DHCP server.
		set_opt network.lan.proto static
		set_opt network.lan.ipaddr 192.168.3.1
		set_opt network.lan.netmask 255.255.255.0
		del_opt network.lan.gateway
		del_opt network.lan.dns
		set_opt network.lan.delegate 0
		for key in ip6assign ip6hint ip6class; do del_opt "network.lan.$key"; done
	else
		# Only a profile captured from managed SIM mode may be restored.
		set_opt network.lan.proto static
		restore_option ipaddr network.lan.ipaddr
		restore_option netmask network.lan.netmask
		ipaddr=$(get network.lan.ipaddr)
		netmask=$(get network.lan.netmask)
		[ -n "$ipaddr" ] || set_opt network.lan.ipaddr 192.168.3.1
		[ -n "$netmask" ] || set_opt network.lan.netmask 255.255.255.0
		restore_option gateway network.lan.gateway
		restore_option dns network.lan.dns
		restore_option ip6assign network.lan.ip6assign
		restore_option ip6hint network.lan.ip6hint
		restore_option ip6class network.lan.ip6class
		restore_option delegate network.lan.delegate
	fi
	# Recovery and an explicit SIM transition always own a local DHCP server.
	# Never restore an old ignore=1 value from an AP baseline.
	set_opt dhcp.lan.ignore 0
	if [ "$profile_ready" -eq 1 ]; then
		restore_option dhcp_ra dhcp.lan.ra
		restore_option dhcp_dhcpv6 dhcp.lan.dhcpv6
		restore_option dhcp_ndp dhcp.lan.ndp
		restore_option dhcp_start dhcp.lan.start
		restore_option dhcp_limit dhcp.lan.limit
		restore_option dhcp_leasetime dhcp.lan.leasetime
		restore_option wan_disabled network.wan.disabled
		restore_option wan_auto network.wan.auto
	fi
	[ -n "$config_dhcp_start" ] && set_opt dhcp.lan.start "$config_dhcp_start"
	[ -n "$config_dhcp_limit" ] && set_opt dhcp.lan.limit "$config_dhcp_limit"
	[ -n "$config_dhcp_leasetime" ] && set_opt dhcp.lan.leasetime "$config_dhcp_leasetime"
	set_opt sbair.bridge.mode sim
	set_opt sbair.bridge.managed 1
	# The next AP transition must snapshot the current SIM settings again.
	set_opt sbair.bridge.backup_ready 0
	commit network || return 1
	commit dhcp || return 1
	commit sbair || return 1
	network_reload
	/etc/init.d/firewall reload >/dev/null 2>&1 || true
	dhcp_guard_disable || true
	restart_dnsmasq_checked || return 1
	if [ "$(get network.wan.disabled)" != 1 ] && uci -q get network.wan >/dev/null 2>&1; then
		ifup wan >/dev/null 2>&1 || true
	fi
	rm -f "$DHCP_START_FILE" "$CONFLICT_FILE" "$FALLBACK_FILE"
}

dhcp_address() {
	local fallback
	fallback=$(get sbair.bridge.fallback_ip)
	ip -4 -o addr show dev "$BRIDGE" 2>/dev/null | awk -v f="$fallback" -v a="$VENDOR_ALIAS" -v l="$BRIDGE:fallback" '$3 == "inet" {split($4,p,"/"); temporary=0; for (i=1; i<=NF; i++) if ($i == l) temporary=1; if (!temporary && p[1] != f && p[1] != a) {print p[1]; exit}}'
}

fallback_active() {
	local fallback
	fallback=$(get sbair.bridge.fallback_ip)
	ip -4 -o addr show dev "$BRIDGE" 2>/dev/null | awk -v f="$fallback" -v l="$BRIDGE:fallback" '$3 == "inet" {split($4,p,"/"); if (p[1] == f) for (i=1; i<=NF; i++) if ($i == l) found=1} END {exit found ? 0 : 1}'
}

fallback_remove() {
	local cidr saved
	if [ -f "$FALLBACK_FILE" ]; then
		saved=$(cat "$FALLBACK_FILE" 2>/dev/null || true)
		[ -z "$saved" ] || ip addr del "$saved" dev "$BRIDGE" >/dev/null 2>&1 || true
	fi
	for cidr in $(ip -4 -o addr show dev "$BRIDGE" 2>/dev/null | awk -v l="$BRIDGE:fallback" '$3 == "inet" {label=0; for (i=1; i<=NF; i++) if ($i == l) label=1; if (label) print $4}'); do
		ip addr del "$cidr" dev "$BRIDGE" >/dev/null 2>&1 || true
	done
	rm -f "$FALLBACK_FILE"
}

fallback_add() {
	local fallback mask prefix probe
	fallback=$(get sbair.bridge.fallback_ip)
	mask=$(get sbair.bridge.fallback_netmask)
	prefix=$(mask_to_prefix "$mask") || return 1
	# -D sends an ARP duplicate-address probe. Air 6's BusyBox omits arping, so
	# use the static Go raw-socket probe included in this package there.
	if command -v arping >/dev/null 2>&1; then
		if ! arping -D -I "$BRIDGE" -c 2 -w 2 "$fallback" >/dev/null 2>&1; then
			safe_runtime_write "$CONFLICT_FILE" conflict || return 1
			return 1
		fi
	elif [ -x /usr/bin/sbair-modem ]; then
		probe=0
		/usr/bin/sbair-modem netmode arp-probe "$BRIDGE" "$fallback" >/dev/null 2>&1 || probe=$?
		if [ "$probe" -eq 1 ]; then
			safe_runtime_write "$CONFLICT_FILE" conflict || return 1
			return 1
		elif [ "$probe" -ne 0 ]; then
			safe_runtime_write "$CONFLICT_FILE" probe-unavailable || return 1
			return 1
		fi
	else
		safe_runtime_write "$CONFLICT_FILE" probe-unavailable || return 1
		return 1
	fi
	ip addr add "$fallback/$prefix" dev "$BRIDGE" label "$BRIDGE:fallback" >/dev/null 2>&1 || return 1
	safe_runtime_write "$FALLBACK_FILE" "$fallback/$prefix" || return 1
	rm -f "$CONFLICT_FILE"
}

ensure_fallback() {
	local proto enabled fallback start timeout elapsed current
	fallback_changed=0
	[ "$(get sbair.bridge.mode)" = ap ] || return 0
	proto=$(get sbair.bridge.management_proto)
	enabled=$(get sbair.bridge.fallback_enabled)
	if [ "$proto" != dhcp ] || [ "$enabled" != 1 ]; then
		if fallback_active || [ -f "$FALLBACK_FILE" ]; then fallback_remove; fallback_changed=1; fi
		return 0
	fi
	current=$(dhcp_address)
	if [ -n "$current" ]; then
		if fallback_active; then fallback_remove; fallback_changed=1; fi
		rm -f "$DHCP_START_FILE" "$CONFLICT_FILE"
		return 0
	fi
	[ -f "$DHCP_START_FILE" ] || safe_runtime_write "$DHCP_START_FILE" "$(date +%s)" || return 1
	start=$(cat "$DHCP_START_FILE" 2>/dev/null || now)
	timeout=$(get sbair.bridge.fallback_timeout)
	case "$timeout" in ''|*[!0-9]*) timeout=15;; esac
	elapsed=$(( $(now) - start ))
	[ "$elapsed" -ge "$timeout" ] || return 0
	if ! fallback_active; then
		if fallback_add; then fallback_changed=1; fi
	fi
}

udp67_listening() {
	if command -v ss >/dev/null 2>&1; then
		ss -lun 2>/dev/null | awk 'NR > 1 && $0 ~ /(^|[.:])67([[:space:]]|$)/ {found=1} END {exit found ? 0 : 1}' && return 0
	fi
	if command -v netstat >/dev/null 2>&1; then
		netstat -lun 2>/dev/null | awk 'NR > 1 && $4 ~ /(^|[.:])67$/ {found=1} END {exit found ? 0 : 1}' && return 0
	fi
	awk '$2 ~ /:0043$/ {found=1} END {exit found ? 0 : 1}' /proc/net/udp /proc/net/udp6 2>/dev/null
}

dhcp_guard_present() {
	command -v iptables >/dev/null 2>&1 || return 1
	iptables -C OUTPUT -o "$BRIDGE" -p udp --sport 67 --dport 68 -j DROP >/dev/null 2>&1
}

dhcp_guard_enable() {
	command -v iptables >/dev/null 2>&1 || return 1
	if ! dhcp_guard_present; then
		iptables -I OUTPUT 1 -o "$BRIDGE" -p udp --sport 67 --dport 68 -j DROP >/dev/null 2>&1 || return 1
	fi
	dhcp_guard_present
}

dhcp_guard_disable() {
	command -v iptables >/dev/null 2>&1 || return 0
	while dhcp_guard_present; do
		iptables -D OUTPUT -o "$BRIDGE" -p udp --sport 67 --dport 68 -j DROP >/dev/null 2>&1 || break
	done
	! dhcp_guard_present
}

restart_dnsmasq_checked() {
	local tries ignore
	[ -x "$DNSMASQ_INIT" ] || return 1
	"$DNSMASQ_INIT" restart >/dev/null 2>&1 || return 1
	tries=0
	while [ "$tries" -lt 5 ]; do
		ignore=$(get dhcp.lan.ignore)
		if [ "$ignore" = 1 ]; then
			# UDP/67 is a system-wide observation on OpenWrt. A listener on
			# another interface is not enough to call AP unsafe; the exact
			# br-lan response path is fail-closed by the packet guard.
			if ! udp67_listening || dhcp_guard_present; then
				return 0
			fi
		else
			udp67_listening && return 0
		fi
		tries=$((tries + 1))
		sleep 1
	done
	return 1
}
repair_record() {
	local count value
	count=0
	[ -f "$REPAIR_FILE" ] && count=$(sed -n 's/^count=//p' "$REPAIR_FILE" 2>/dev/null)
	case "$count" in ''|*[!0-9]*) count=0;; esac
	count=$((count + 1))
	value=$(printf 'count=%s\nlast=%s' "$count" "$(date '+%Y-%m-%dT%H:%M:%S%z' 2>/dev/null || now)")
	safe_runtime_write "$REPAIR_FILE" "$value"
}
repair_config() {
	local mode proto changed wan_changed lan_changed members guard dnsmasq_ok result lock_rc
	netmode_lock_acquire
	lock_rc=$?
	if [ "$lock_rc" -ne 0 ]; then
		printf '%s\n' 'result=error' 'error=network-mode transaction lock unavailable'
		return 1
	fi
	ensure_config || return 1
	mode=$(get sbair.bridge.mode)
	if [ "$mode" != ap ] || [ "$(get sbair.bridge.managed)" != 1 ]; then
		printf '%s\n' 'result=skipped'
		return 0
	fi
	if [ "$(get sbair.bridge.management_proto)" = dhcp ] && ! ap_dhcp_allowed; then
		prepare_ap_static_config || {
			printf '%s\n' 'result=error' 'error=AP DHCP設定を固定IPへ移行できません'
			return 1
		}
	fi
	proto=$(get sbair.bridge.management_proto)
	[ "$proto" = dhcp ] || proto=static
	if [ "$proto" = static ]; then
		resolve_static_config "$(get sbair.bridge.ipaddr)" "$(get sbair.bridge.netmask)" \
			"$(get sbair.bridge.gateway)" "$(get sbair.bridge.dns)" || {
			printf '%s\n' 'result=error' "error=$static_resolve_error"
			return 1
		}
	fi
	changed=0
	wan_changed=0
	lan_changed=0
	guard=0
	dnsmasq_ok=1
	dhcp_guard_enable && guard=1
	[ "$guard" -eq 1 ] || changed=1
	if [ "$(get network.lan.proto)" != "$proto" ]; then set_opt network.lan.proto "$proto"; changed=1; lan_changed=1; fi
	if [ "$proto" = dhcp ]; then
		for key in ipaddr netmask gateway dns ip6assign ip6hint ip6class; do
			[ -z "$(get "network.lan.$key")" ] || { del_opt "network.lan.$key"; changed=1; lan_changed=1; }
		done
	else
		if [ "$(get network.lan.ipaddr)" != "$static_effective_ipaddr" ]; then set_opt network.lan.ipaddr "$static_effective_ipaddr"; changed=1; lan_changed=1; fi
		if [ "$(get network.lan.netmask)" != "$static_effective_netmask" ]; then set_opt network.lan.netmask "$static_effective_netmask"; changed=1; lan_changed=1; fi
		if [ -n "$static_effective_gateway" ]; then
			if [ "$(get network.lan.gateway)" != "$static_effective_gateway" ]; then set_opt network.lan.gateway "$static_effective_gateway"; changed=1; lan_changed=1; fi
		elif [ -n "$(get network.lan.gateway)" ]; then
			del_opt network.lan.gateway; changed=1; lan_changed=1
		fi
		if [ -n "$static_effective_dns" ]; then
			if [ "$(get network.lan.dns)" != "$static_effective_dns" ]; then set_opt network.lan.dns "$static_effective_dns"; changed=1; lan_changed=1; fi
		elif [ -n "$(get network.lan.dns)" ]; then
			del_opt network.lan.dns; changed=1; lan_changed=1
		fi
	fi
	[ "$(get network.lan.delegate)" = 0 ] || { set_opt network.lan.delegate 0; changed=1; lan_changed=1; }
	[ "$(get dhcp.lan.ignore)" = 1 ] || { set_opt dhcp.lan.ignore 1; changed=1; }
	for key in ra dhcpv6 ndp; do
		[ "$(get "dhcp.lan.$key")" = disabled ] || { set_opt "dhcp.lan.$key" disabled; changed=1; }
	done
	if uci -q get network.wan >/dev/null 2>&1; then
		[ "$(get network.wan.disabled)" = 1 ] || { set_opt network.wan.disabled 1; changed=1; wan_changed=1; }
		[ "$(get network.wan.auto)" = 0 ] || { set_opt network.wan.auto 0; changed=1; wan_changed=1; }
	fi
	if [ "$changed" -ne 0 ]; then
		commit network
		commit dhcp
		commit sbair
		[ "$wan_changed" -eq 0 ] || ifdown wan >/dev/null 2>&1 || true
		if [ "$lan_changed" -ne 0 ]; then
			network_reload
			dhcp_guard_enable && guard=1
		fi
	fi
	if udp67_listening; then
		restart_dnsmasq_checked || dnsmasq_ok=0
		changed=1
	fi
	if cellular_default_route; then
		ifdown wan >/dev/null 2>&1 || true
		changed=1
	fi
	ensure_fallback
	[ "${fallback_changed:-0}" -eq 0 ] || changed=1
	dhcp_guard_enable && guard=1
	[ "$guard" -eq 1 ] || dnsmasq_ok=0
	[ "$changed" -eq 0 ] || repair_record
	members=$(bridge_members)
	result=ok
	[ "$guard" -eq 1 ] && [ "$dnsmasq_ok" -eq 1 ] || result=unsafe
	printf 'result=%s\nchanged=%s\ndhcp_guard=%s\ndnsmasq_ok=%s\nbridge_members=%s\n' "$result" "$changed" "$guard" "$dnsmasq_ok" "$members"
	[ "$result" = ok ]
}

clear_pending() {
	local key
	for key in pending_id pending_mode pending_previous pending_previous_managed pending_deadline; do snapshot_delete "sbair.bridge.$key" || return 1; done
	clear_snapshot pending_prev_ || return 1
	commit sbair
}

state_file_for() {
	printf '%s/sbair-netmode-%s.state\n' "$STATE_DIR" "$1"
}

pid_file_for() {
	printf '%s/sbair-netmode-%s.pid\n' "$STATE_DIR" "$1"
}

log_file_for() {
	printf '%s/sbair-netmode-%s.log\n' "$STATE_DIR" "$1"
}

write_state() {
	local id state message file tmp
	private_runtime_dir "$STATE_DIR" || return 1
	id=$1
	state=$2
	message=${3:-}
	file=$(state_file_for "$id")
	tmp=$(mktemp "$file.tmp.XXXXXX" 2>/dev/null) || return 1
	chmod 600 "$tmp" 2>/dev/null || { rm -f "$tmp"; return 1; }
	{
		printf 'state=%s\n' "$state"
		printf 'mode=%s\n' "$(get sbair.bridge.mode)"
		[ -z "$message" ] || printf 'message=%s\n' "$message"
	} > "$tmp" && [ ! -L "$tmp" ] && mv "$tmp" "$file" && [ ! -L "$file" ]
}

rollback_pending() {
	local id previous previous_managed result
	id=$1
	previous=$2
	previous_managed=${3:-$(get sbair.bridge.pending_previous_managed)}
	[ "$previous_managed" = 1 ] || previous_managed=0
	[ "$(get sbair.bridge.pending_id)" = "$id" ] || return 1
	write_state "$id" rolling_back
	result=0
	if [ "$(get sbair.bridge.pending_prev_snapshot_ready)" = 1 ]; then
		restore_transaction_snapshot || result=1
	elif [ "$previous_managed" = 0 ]; then
		# A pre-snapshot pending transaction has no complete live snapshot. Do not
		# reinterpret the old vendor configuration as AP or SIM; at least return
		# ownership to unmanaged without changing its network settings.
		set_opt sbair.bridge.managed 0
		clear_draft
		clear_sim_profile
		commit sbair || result=1
		dhcp_guard_disable || true
		rm -f "$DHCP_START_FILE" "$CONFLICT_FILE" "$FALLBACK_FILE"
		/etc/init.d/sbair-netfix stop >/dev/null 2>&1 || true
	elif [ "$previous" = ap ]; then
		apply_ap_config || result=1
	elif [ "$previous" = ethwan ]; then
		apply_ethwan_config || result=1
	else
		apply_sim_config 0 || result=1
	fi
	if [ "$(get sbair.bridge.pending_mode)" = vlanwan ] && [ "$previous" != vlanwan ]; then
		restore_vlanwan_baseline || result=1
		commit network >/dev/null 2>&1 || result=1
		commit firewall >/dev/null 2>&1 || result=1
		network_reload
		/etc/init.d/firewall reload >/dev/null 2>&1 || true
		if [ "$(get sbair.bridge.vlanwan_orig_ethernetwan_type_present)" = 1 ]; then
			ifup ethernetwan >/dev/null 2>&1 || true
		fi
	fi
	[ "$result" -eq 0 ] || return 1
	clear_pending || { printf '%s\n' 'error=unable to clear confirmed transaction'; return 1; }
	if [ "$(get sbair.bridge.mode)" = ap ] && [ "$(get sbair.bridge.managed)" = 1 ]; then
		/etc/init.d/sbair-netfix start >/dev/null 2>&1 || true
	else
		/etc/init.d/sbair-netfix stop >/dev/null 2>&1 || true
	fi
	write_state "$id" rolled_back 'rollback timer expired or requested'
	rm -f "$(pid_file_for "$id")"
}

start_rollback_watch() {
	local id deadline previous previous_managed log
	id=$1
	deadline=$2
	previous=$3
	previous_managed=${4:-$(get sbair.bridge.pending_previous_managed)}
	private_runtime_dir "$STATE_DIR" || return 1
	log=$(log_file_for "$id")
	private_runtime_file "$log" || return 1
	(umask 077; setsid "$SELF" --rollback-watch "$id" "$deadline" "$previous" "$previous_managed" >"$log" 2>&1 </dev/null) &
}

save_pending() {
	local id mode previous previous_managed deadline
	id=$1
	mode=$2
	previous=$3
	previous_managed=$4
	deadline=$5
	set_opt sbair.bridge.pending_id "$id" || return 1
	set_opt sbair.bridge.pending_mode "$mode" || return 1
	set_opt sbair.bridge.pending_previous "$previous" || return 1
	set_opt sbair.bridge.pending_previous_managed "$previous_managed" || return 1
	set_opt sbair.bridge.pending_deadline "$deadline" || return 1
	commit sbair
}

start_apply() {
	local mode previous previous_managed id deadline pending pending_deadline pid config_supplied lock_rc log
	mode=$1
	shift
	[ "$mode" = sim ] || [ "$mode" = ap ] || [ "$mode" = ethwan ] || [ "$mode" = vlanwan ] || { printf 'error=unknown mode %s\n' "$mode"; return 1; }
	netmode_lock_acquire
	lock_rc=$?
	if [ "$lock_rc" -ne 0 ]; then
		[ "$lock_rc" -eq 2 ] && printf '%s\n' 'error=another network-mode transaction is running' || printf '%s\n' 'error=network-mode transaction lock unavailable'
		return 1
	fi
	private_runtime_dir "$STATE_DIR" || { printf '%s\n' 'error=network-mode runtime directory unavailable'; return 1; }
	ensure_config || return 1
	pending=$(get sbair.bridge.pending_id)
	if [ -n "$pending" ]; then
		pending_deadline=$(get sbair.bridge.pending_deadline)
		case "$pending_deadline" in ''|*[!0-9]*) pending_deadline=0;; esac
		if [ "$(now)" -lt "$pending_deadline" ]; then
			printf '%s\n' 'error=another mode change is awaiting confirmation'
			return 1
		fi
		rollback_pending "$pending" "$(get sbair.bridge.pending_previous)" || {
			printf '%s\n' 'error=unable to rollback previous transaction'
			return 1
		}
	fi
	config_supplied=0
	[ "$#" -eq 0 ] || config_supplied=1
	if [ "$config_supplied" -eq 1 ]; then
		parse_config_args "$@"
		validate_config_args || return 1
	elif [ "$(get sbair.bridge.draft_ready)" = 1 ]; then
		load_saved_config
		validate_config_args || return 1
		config_supplied=1
	fi
	validate_ap_proto "$mode" "$config_proto" || return 1
	[ -x "$SELF" ] || { printf '%s\n' 'error=network-mode worker is not executable'; return 1; }
	command -v setsid >/dev/null 2>&1 || { printf '%s\n' 'error=setsid is unavailable'; return 1; }
	previous=$(get sbair.bridge.mode)
	[ "$previous" = ap ] || [ "$previous" = ethwan ] || [ "$previous" = vlanwan ] || previous=sim
	if { [ "$mode" = ethwan ] || [ "$mode" = vlanwan ]; } && [ "$previous" = ap ]; then
		printf '%s\n' 'error=AP 모드에서 유선 WAN 라우터 모드로 바로 전환할 수 없습니다. 먼저 모뎀 라우터 모드로 복귀하십시오'
		return 1
	fi
	previous_managed=$(get sbair.bridge.managed)
	[ "$previous_managed" = 1 ] || previous_managed=0
	if [ "$mode" = ap ] && [ "$previous_managed" = 0 ]; then
		# Capture the vendor logical LAN before the worker can change it. This is
		# independent from the transaction snapshot and is never replaced later.
		capture_oem_baseline || { printf '%s\n' 'error=unable to save OEM network baseline'; return 1; }
	fi
	if [ "$mode" = ap ] && [ "$config_proto" = static ]; then
		# Resolve only after the first unmanaged transition has had a chance to
		# capture the vendor logical LAN. Explicit fields remain validated above.
		resolve_static_config "$config_ipaddr" "$config_netmask" "$config_gateway" "$config_dns" || {
			printf '%s\n' "error=$static_resolve_error"
			return 1
		}
	fi
	# Only managed SIM is allowed to create the reusable SIM profile. The live
	# transaction snapshot is captured after that profile is durable, so rollback
	# also restores its ownership metadata.
	if [ "$previous_managed" = 1 ] && [ "$previous" = sim ]; then
		save_backup || { printf '%s\n' 'error=unable to save SIM profile'; return 1; }
	fi
	# Always capture the live state immediately before promoting the draft.
	# A stale draft_prev_ from an older release must never roll AP->AP back to
	# an unrelated historical management IP or Fallback configuration.
	capture_snapshot pending_prev_ || { printf '%s\n' 'error=unable to save configuration snapshot'; return 1; }
	# Promote a draft only after the complete transaction snapshot is durable.
	clear_draft || return 1
	clear_snapshot draft_prev_ || return 1
	if [ "$config_supplied" -ne 0 ]; then
		write_config_args || { printf '%s\n' 'error=unable to save mode configuration'; return 1; }
	fi
	id="$(now)-$$"
	deadline=$(( $(now) + ROLLBACK_SECONDS ))
	log=$(log_file_for "$id")
	private_runtime_file "$log" || { printf '%s\n' 'error=network-mode log file is unsafe'; return 1; }
	private_runtime_file "$(pid_file_for "$id")" || { printf '%s\n' 'error=network-mode pid file is unsafe'; return 1; }
	if ! save_pending "$id" "$mode" "$previous" "$previous_managed" "$deadline"; then
		clear_pending || true
		printf '%s\n' 'error=unable to save rollback transaction'
		return 1
	fi
	(umask 077; setsid "$SELF" --apply-worker "$mode" "$id" "$previous" "$previous_managed" >"$log" 2>&1 </dev/null) &
	pid=$!
	if ! (umask 077; printf '%s\n' "$pid" > "$(pid_file_for "$id")"); then
		kill "$pid" 2>/dev/null || true
		clear_pending || true
		printf '%s\n' 'error=unable to save worker pid'
		return 1
	fi
	printf 'result=started\nmode=%s\ntransaction=%s\nrollback_seconds=%s\n' "$mode" "$id" "$ROLLBACK_SECONDS"
}

ap_management_ready() {
	local proto
	[ "$(get sbair.bridge.mode)" = ap ] || return 1
	[ "$(get sbair.bridge.managed)" = 1 ] || return 1
	proto=$(get sbair.bridge.management_proto)
	[ "$proto" = dhcp ] || [ "$proto" = static ] || return 1
	[ "$(get network.lan.proto)" = "$proto" ] || return 1
	[ "$(get dhcp.lan.ignore)" = 1 ] || return 1
	[ "$(get network.wan.disabled)" = 1 ] || return 1
	bridge_up || return 1
	dhcp_guard_present || return 1
	if [ "$proto" = dhcp ]; then
		# Do not treat the emergency Fallback or vendor alias as a successful
		# upstream lease. A real DHCP address proves the new management path is
		# present before the transaction is confirmed.
		[ -n "$(dhcp_address)" ] || return 1
		return 0
	fi
	resolve_static_config "$(get sbair.bridge.ipaddr)" "$(get sbair.bridge.netmask)" \
		"$(get sbair.bridge.gateway)" "$(get sbair.bridge.dns)" || return 1
	ip -4 -o addr show dev "$BRIDGE" 2>/dev/null |
		awk -v expected="$static_effective_ipaddr" \
			'$3 == "inet" {split($4,p,"/"); if (p[1] == expected) found=1} END {exit found ? 0 : 1}'
}

wait_ap_management_ready() {
	local tries
	tries=0
	# Give netifd time to complete DHCP while leaving the existing 120-second
	# rollback window intact when the lease never arrives.
	while [ "$tries" -lt 15 ]; do
		ap_management_ready && return 0
		sleep 1
		tries=$((tries + 1))
	done
	return 1
}

auto_confirm_applied() {
	local id
	id=$1
	[ "$(get sbair.bridge.pending_id)" = "$id" ] || return 1
	clear_pending || return 1
	write_state "$id" confirmed 'configuration verified automatically' || return 1
	rm -f "$(pid_file_for "$id")"
}

apply_worker() {
	local mode id previous previous_managed lock_rc
	mode=$1
	id=$2
	previous=$3
	previous_managed=${4:-0}
	netmode_lock_wait
	lock_rc=$?
	if [ "$lock_rc" -ne 0 ]; then
		write_state "$id" error 'network-mode transaction lock unavailable'
		return 1
	fi
	write_state "$id" applying
	if [ "$mode" = ap ]; then
		apply_ap_config
	elif [ "$mode" = ethwan ]; then
		apply_ethwan_config
	elif [ "$mode" = vlanwan ]; then
		apply_vlanwan_config
	else
		# First ownership claim from an unmanaged device must use the defined SIM
		# LAN. A managed AP may restore only a profile captured from managed SIM.
		apply_sim_config "$([ "$previous_managed" = 1 ] && printf 0 || printf 1)"
	fi
	if [ "$?" -ne 0 ]; then
		rollback_pending "$id" "$previous" || true
		write_state "$id" error 'configuration apply failed; previous mode restored'
		return 1
	fi
	if [ "$mode" = ap ]; then
		repair_config >/dev/null 2>&1 || true
		/etc/init.d/sbair-netfix start >/dev/null 2>&1 || true
		# DHCP can move the management address before the browser can follow it.
		# Confirm automatically only after the target itself proves that the AP
		# management path is healthy; otherwise retain the manual rollback window.
		if wait_ap_management_ready && auto_confirm_applied "$id"; then
			return 0
		fi
	else
		/etc/init.d/sbair-netfix stop >/dev/null 2>&1 || true
	fi
	write_state "$id" applied 'confirm within the rollback window'
	start_rollback_watch "$id" "$(get sbair.bridge.pending_deadline)" "$previous" "$previous_managed"
}

rollback_watch() {
	local id deadline previous previous_managed remaining
	id=$1
	deadline=$2
	previous=$3
	previous_managed=${4:-$(get sbair.bridge.pending_previous_managed)}
	while [ "$(get sbair.bridge.pending_id)" = "$id" ]; do
		remaining=$((deadline - $(now)))
		[ "$remaining" -gt 0 ] || break
		sleep $(( remaining < 5 ? remaining : 5 ))
	done
	if [ "$(get sbair.bridge.pending_id)" = "$id" ]; then
		netmode_lock_wait || return 1
		rollback_pending "$id" "$previous" "$previous_managed"
	fi
}

confirm() {
	local id deadline lock_rc
	netmode_lock_acquire
	lock_rc=$?
	if [ "$lock_rc" -ne 0 ]; then
		[ "$lock_rc" -eq 2 ] && printf '%s\n' 'error=another network-mode transaction is running' || printf '%s\n' 'error=network-mode transaction lock unavailable'
		return 1
	fi
	ensure_config || return 1
	id=$(get sbair.bridge.pending_id)
	if [ -z "$id" ]; then printf '%s\n' 'result=no_pending'; return 0; fi
	deadline=$(get sbair.bridge.pending_deadline)
	case "$deadline" in ''|*[!0-9]*) deadline=0;; esac
	if [ "$(now)" -ge "$deadline" ]; then
		if rollback_pending "$id" "$(get sbair.bridge.pending_previous)"; then
			printf 'result=rolled_back\ntransaction=%s\n' "$id"
			return 0
		fi
		printf '%s\n' 'error=rollback failed'
		return 1
	fi
	clear_pending || { printf '%s\n' 'error=unable to clear confirmed transaction'; return 1; }
	write_state "$id" confirmed 'configuration confirmed'
	rm -f "$(pid_file_for "$id")"
	printf 'result=confirmed\ntransaction=%s\n' "$id"
}

rollback() {
	local id previous lock_rc
	netmode_lock_acquire
	lock_rc=$?
	if [ "$lock_rc" -ne 0 ]; then
		[ "$lock_rc" -eq 2 ] && printf '%s\n' 'error=another network-mode transaction is running' || printf '%s\n' 'error=network-mode transaction lock unavailable'
		return 1
	fi
	ensure_config || return 1
	id=$(get sbair.bridge.pending_id)
	if [ -n "$id" ]; then
		previous=$(get sbair.bridge.pending_previous)
		rollback_pending "$id" "$previous" || { printf '%s\n' 'error=rollback failed'; return 1; }
		printf 'result=rolled_back\ntransaction=%s\n' "$id"
		return 0
	fi
	printf '%s\n' 'result=no_pending'
}

unmanage() {
	local pending lock_rc
	netmode_lock_acquire
	lock_rc=$?
	if [ "$lock_rc" -ne 0 ]; then
		[ "$lock_rc" -eq 2 ] && printf '%s\n' 'error=another network-mode transaction is running' || printf '%s\n' 'error=network-mode transaction lock unavailable'
		return 1
	fi
	ensure_config || return 1
	pending=$(get sbair.bridge.pending_id)
	[ -z "$pending" ] || { printf '%s\n' 'error=another mode change is awaiting confirmation'; return 1; }
	if [ "$(get sbair.bridge.managed)" != 1 ]; then
		clear_draft
		clear_sim_profile
		for key in dhcp_start dhcp_limit dhcp_leasetime; do del_opt "sbair.bridge.$key"; done
		commit sbair
		printf '%s\n' 'result=already_unmanaged' 'mode=unmanaged'
		return 0
	fi
	if fallback_active; then
		printf '%s\n' 'error=管理解除の前にFallbackではない管理IPを確立してください'
		return 1
	fi
	# Management release changes ownership metadata and package runtime guards
	# only. The current network, DHCP, WAN, and Wi-Fi configuration is retained.
	set_opt sbair.bridge.managed 0
	clear_draft
	clear_sim_profile
	for key in dhcp_start dhcp_limit dhcp_leasetime; do del_opt "sbair.bridge.$key"; done
	commit sbair || { printf '%s\n' 'error=unable to release sbair management'; return 1; }
	dhcp_guard_disable || true
	rm -f "$DHCP_START_FILE" "$CONFLICT_FILE" "$FALLBACK_FILE"
	/etc/init.d/sbair-netfix stop >/dev/null 2>&1 || true
	printf '%s\n' 'result=unmanaged' 'mode=unmanaged' 'network=unchanged'
}

recover() {
	local id lock_rc address
	netmode_lock_acquire
	lock_rc=$?
	if [ "$lock_rc" -ne 0 ]; then
		[ "$lock_rc" -eq 2 ] && printf '%s\n' 'error=another network-mode transaction is running' || printf '%s\n' 'error=network-mode transaction lock unavailable'
		return 1
	fi
	ensure_config || return 1
	id=$(get sbair.bridge.pending_id)
	[ -z "$id" ] || clear_pending
	apply_sim_config 1 || { printf '%s\n' 'error=recovery failed'; return 1; }
	/etc/init.d/sbair-netfix stop >/dev/null 2>&1 || true
	# Report the address selected by the recovery transaction, not a hard-coded
	# value. Force-recovery normally selects the documented factory address, while
	# an existing valid SIM profile may restore a different local address.
	address=$(get network.lan.ipaddr)
	if [ -z "$address" ]; then
		address=$(ip -4 -o addr show dev "$BRIDGE" 2>/dev/null | awk -v a="$VENDOR_ALIAS" '$3 == "inet" {split($4,p,"/"); if (p[1] != a) {print p[1]; exit}}')
	fi
	[ -n "$address" ] || address=unknown
	printf 'result=recovered\nmode=sim\naddress=%s\ndhcp=on\n' "$address"
}

startup() {
	local id deadline remaining previous_managed lock_rc
	netmode_lock_acquire
	lock_rc=$?
	[ "$lock_rc" -eq 0 ] || return 1
	ensure_config || return 1
	id=$(get sbair.bridge.pending_id)
	if [ -n "$id" ]; then
		deadline=$(get sbair.bridge.pending_deadline)
		case "$deadline" in ''|*[!0-9]*) deadline=0;; esac
		if [ "$(now)" -ge "$deadline" ]; then
			rollback_pending "$id" "$(get sbair.bridge.pending_previous)" "$(get sbair.bridge.pending_previous_managed)" || true
		else
			remaining=$((deadline - $(now)))
			previous_managed=$(get sbair.bridge.pending_previous_managed)
			start_rollback_watch "$id" "$deadline" "$(get sbair.bridge.pending_previous)" "$previous_managed"
		fi
	fi
	if [ -z "$(get sbair.bridge.pending_id)" ] &&
		[ "$(get sbair.bridge.mode)" = ap ] &&
		[ "$(get sbair.bridge.managed)" = 1 ] &&
		[ "$(get sbair.bridge.management_proto)" = dhcp ] &&
		! ap_dhcp_allowed; then
		# Migrate legacy AP-DHCP state once the transaction path is settled. The
		# repair path applies the static LAN, keeps Wi-Fi untouched, and verifies
		# the DHCP guard just like an explicit AP apply.
		if prepare_ap_static_config; then
			repair_config >/dev/null 2>&1 || true
		fi
	fi
	[ "$(get sbair.bridge.mode)" = ap ] && [ "$(get sbair.bridge.managed)" = 1 ] || return 0
	# Re-apply the same resolved static values used by Safe Apply. This keeps
	# startup repair from treating a blank raw field as an empty network value.
	repair_config >/dev/null 2>&1 || true
	# The UCI include covers later firewall reloads; run it now to close the
	# boot window before the 15-second repair service's first iteration.
	[ -x /usr/share/sbair/firewall.include ] && /usr/share/sbair/firewall.include >/dev/null 2>&1 || true
	dhcp_guard_enable || true
	[ -f "$DHCP_START_FILE" ] || safe_runtime_write "$DHCP_START_FILE" "$(date +%s)" || return 1
}
