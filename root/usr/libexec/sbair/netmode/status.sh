# SPDX-License-Identifier: MIT
# Copyright (c) 2026 syado
# Read-only status and diagnostics.

sim_pool_context() {
	local proto ipaddr netmask
	proto=$(get sbair.bridge.sim_proto)
	ipaddr=$(get sbair.bridge.sim_ipaddr)
	netmask=$(get sbair.bridge.sim_netmask)
	if [ "$(get sbair.bridge.backup_ready)" = 1 ] && [ "$proto" = static ] &&
		is_ipv4 "$ipaddr" && mask_to_prefix "$netmask" >/dev/null; then
		:
	else
		proto=$(get sbair.bridge.mode)
		if [ "$(get sbair.bridge.managed)" = 1 ] && [ "$proto" = sim ] &&
			[ "$(get network.lan.proto)" = static ] && is_ipv4 "$(get network.lan.ipaddr)" &&
			mask_to_prefix "$(get network.lan.netmask)" >/dev/null; then
			ipaddr=$(get network.lan.ipaddr)
			netmask=$(get network.lan.netmask)
		else
			ipaddr=192.168.3.1
			netmask=255.255.255.0
		fi
	fi
	printf 'network=%s\nnetmask=%s\nrouter=%s\n' "$ipaddr" "$netmask" "$ipaddr"
}

pool_context() {
	case "${1:-}" in
		sim) sim_pool_context;;
		*) printf '%s\n' 'error=unknown pool context'; return 1;;
	esac
}
cellular_default_route() {
	local proto device
	proto=$(get network.wan.proto)
	[ "$proto" = ql_datacall ] || return 1
	device=$(get network.wan.device)
	ip route show 2>/dev/null | awk -v expected="$device" '$1 == "default" {for (i=1; i<NF; i++) if ($i == "dev" && ($(i+1) == expected || $(i+1) ~ /^(ccmni|rmnet|wwan|ppp)/)) found=1} END {exit found ? 0 : 1}'
}

bridge_members() {
	local p n out
	out=
	for p in /sys/class/net/"$BRIDGE"/brif/*; do
		[ -e "$p" ] || continue
		n=${p##*/}
		[ -n "$out" ] && out="$out "
		out="$out$n"
	done
	printf '%s\n' "$out"
}

bridge_up() {
	ip link show dev "$BRIDGE" >/dev/null 2>&1
}

default_gateway() {
	ip route show default dev "$BRIDGE" 2>/dev/null | awk '$1 == "default" {for (i=1; i<NF; i++) if ($i == "via") {print $(i+1); exit}}'
}

dns_server() {
	awk '/^[[:space:]]*nameserver[[:space:]]/ {print $2; exit}' /tmp/resolv.conf.d/resolv.conf.auto /etc/resolv.conf 2>/dev/null
}

wifi_band() {
	local iface device band
	iface=$1
	band=$2
	device=$(get "wireless.$iface.device")
	[ "$(get "wireless.$iface.mode")" = ap ] || { printf '%s\n' unknown; return; }
	[ "$(get "wireless.$iface.disabled")" != 1 ] || { printf '%s\n' 0; return; }
	[ -n "$device" ] || { printf '%s\n' unknown; return; }
	[ "$(get "wireless.$device.band")" = "$band" ] && printf '%s\n' 1 || printf '%s\n' 0
}

wifi_mlo() {
	if ! uci -q get wireless.apmld1 >/dev/null 2>&1; then printf '%s\n' unknown; return; fi
	[ "$(get wireless.apmld1.mode)" = ap ] || { printf '%s\n' 0; return; }
	[ "$(get wireless.apmld1.disabled)" = 1 ] && printf '%s\n' 0 || printf '%s\n' 1
}

add_warning() {
	[ -n "$warnings" ] && warnings="$warnings|"
	warnings="$warnings$1"
}
show_config() {
	local draft oem_ready
	ensure_config
	draft=$(get sbair.bridge.draft_ready)
	load_saved_config
	static_resolution_reset
	if [ "$config_proto" = static ]; then
		resolve_static_config "$config_ipaddr" "$config_netmask" "$config_gateway" "$config_dns" || true
	fi
	oem_ready=$(get sbair.bridge.oem_baseline_ready)
	printf 'mode=%s\nconfigured_mode=%s\nmanaged=%s\nproto=%s\nipaddr=%s\nnetmask=%s\ngateway=%s\ndns=%s\nfallback_enabled=%s\nfallback_ip=%s\nfallback_netmask=%s\nfallback_timeout=%s\n' \
		"$([ "$(get sbair.bridge.managed)" = 1 ] && printf '%s' "$(get sbair.bridge.mode)" || printf unmanaged)" "$(get sbair.bridge.mode)" "$(get sbair.bridge.managed)" "$config_proto" "$config_ipaddr" "$config_netmask" \
		"$config_gateway" "$config_dns" "$config_enabled" "$config_fallback" \
		"$config_fallback_mask" "$config_timeout"
	printf 'oem_baseline_ready=%s\noem.ipaddr=%s\noem.netmask=%s\noem.gateway=%s\noem.dns=%s\n' \
		"$oem_ready" "$(get sbair.bridge.oem_ipaddr)" "$(get sbair.bridge.oem_netmask)" \
		"$(get sbair.bridge.oem_gateway)" "$(get sbair.bridge.oem_dns)"
	printf 'effective.ipaddr=%s\neffective.netmask=%s\neffective.gateway=%s\neffective.dns=%s\neffective.ipaddr_source=%s\neffective.netmask_source=%s\neffective.gateway_source=%s\neffective.dns_source=%s\neffective.error=%s\n' \
		"$static_effective_ipaddr" "$static_effective_netmask" "$static_effective_gateway" "$static_effective_dns" \
		"$static_effective_ipaddr_source" "$static_effective_netmask_source" "$static_effective_gateway_source" "$static_effective_dns_source" "$static_resolve_error"
	printf 'ap_dhcp_enabled=%s\n' "$(if ap_dhcp_allowed; then printf 1; else printf 0; fi)"
	printf 'dhcp.start=%s\ndhcp.limit=%s\ndhcp.leasetime=%s\ndhcp.network=%s\ndhcp.netmask=%s\ndesired_dhcp.start=%s\ndesired_dhcp.limit=%s\ndesired_dhcp.leasetime=%s\n' \
		"$(get dhcp.lan.start)" "$(get dhcp.lan.limit)" "$(get dhcp.lan.leasetime)" \
		"$([ "$(get network.lan.proto)" = static ] && get network.lan.ipaddr || true)" \
		"$([ "$(get network.lan.proto)" = static ] && get network.lan.netmask || true)" \
		"$config_dhcp_start" "$config_dhcp_limit" "$config_dhcp_leasetime"
	printf 'draft=%s\n' "$([ "$draft" = 1 ] && printf 1 || printf 0)"
}

show_status() {
	local mode configured_mode managed proto address fallback_active_value fallback_conflict_value configured udp67 guard route members member_count health warnings repair_count repair_last pending_id pending_mode deadline remaining cellular_iface bridge_up_value ethwan_proto ethwan_device ethwan_address ethwan_link ethwan_route vlan3 vlan1
	ensure_config
	static_resolution_reset
	warnings=
	configured_mode=$(get sbair.bridge.mode)
	[ "$configured_mode" = ap ] || [ "$configured_mode" = ethwan ] || [ "$configured_mode" = vlanwan ] || configured_mode=sim
	managed=$(get sbair.bridge.managed)
	[ "$managed" = 1 ] || managed=0
	mode=$configured_mode
	[ "$managed" = 1 ] || mode=unmanaged
	proto=$(get sbair.bridge.management_proto)
	[ "$proto" = dhcp ] || proto=static
	if [ "$configured_mode" = ap ] && [ "$proto" = static ]; then
		resolve_static_config "$(get sbair.bridge.ipaddr)" "$(get sbair.bridge.netmask)" \
			"$(get sbair.bridge.gateway)" "$(get sbair.bridge.dns)" || true
	fi
	if [ "$configured_mode" = ap ] && [ "$proto" = dhcp ]; then address=$(dhcp_address); else address=$(get network.lan.ipaddr); fi
	fallback_active_value=0
	fallback_active && fallback_active_value=1
	[ -n "$address" ] || [ "$fallback_active_value" -eq 0 ] || address=$(get sbair.bridge.fallback_ip)
	fallback_conflict_value=0
	[ -f "$CONFLICT_FILE" ] && fallback_conflict_value=1
	configured=0
	[ "$(get dhcp.lan.ignore)" = 1 ] || configured=1
	udp67=0
	udp67_listening && udp67=1
	guard=0
	dhcp_guard_present && guard=1
	route=0
	cellular_default_route && route=1
	members=$(bridge_members)
	member_count=0
	[ -z "$members" ] || member_count=$(printf '%s\n' "$members" | awk '{print NF}')
	health=ok
	if [ "$managed" -eq 0 ]; then
		health=unmanaged
		add_warning '未管理（既存設定）: AP / BridgeまたはSIMルーターを明示的に適用するまで既存設定を変更しません'
	elif [ "$configured_mode" = ap ]; then
		[ "$proto" != static ] || [ -z "$static_resolve_error" ] || { add_warning "$static_resolve_error"; health=warn; }
		if [ "$proto" = dhcp ] && ! ap_dhcp_allowed; then
			add_warning 'APモードのDHCPクライアントは安全フラグで無効化されています。非常に高リスクなため、固定IPへ移行するか、UART復旧手段を確保したうえで明示的に再有効化してください'
			health=warn
		fi
		[ "$configured" -eq 0 ] || { add_warning 'DHCP設定が停止状態ではありません'; health=danger; }
		if [ "$udp67" -ne 0 ]; then
			if [ "$guard" -eq 1 ]; then
				add_warning 'システム上のUDP/67は待機中ですが、br-lan向け応答はguardで遮断しています'
			else
				add_warning 'UDP/67でDHCPサーバーが待機中で、br-lan向けguardも確認できません'; health=danger
			fi
		fi
		[ "$managed" -eq 0 ] || [ "$guard" -eq 1 ] || { add_warning 'DHCP packet guardが有効ではありません'; health=danger; }
		[ "$(get network.lan.proto)" = "$proto" ] || { add_warning '管理IP方式とnetwork.lanが不一致です'; health=warn; }
		[ "$(get network.wan.disabled)" = 1 ] || { add_warning 'Cellular WANが無効化されていません'; health=danger; }
		[ "$route" -eq 0 ] || { add_warning 'Cellular側にデフォルトルートがあります'; health=danger; }
		bridge_up || { add_warning 'br-lanが停止しています'; health=danger; }
		[ "$member_count" -gt 0 ] || { add_warning 'br-lanのメンバーを確認できません'; health=warn; }
		[ "$fallback_conflict_value" -eq 0 ] || { add_warning 'Fallback IPを安全に付与できません（競合またはARP probe未使用）'; health=warn; }
		if [ -z "$address" ] && [ "$fallback_active_value" -eq 0 ]; then
			local start timeout elapsed
			start=$(cat "$DHCP_START_FILE" 2>/dev/null || now)
			timeout=$(get sbair.bridge.fallback_timeout)
			case "$timeout" in ''|*[!0-9]*) timeout=15;; esac
			elapsed=$(( $(now) - start ))
			if [ "$elapsed" -ge "$timeout" ] || [ "$proto" = static ]; then
				add_warning '管理IPを取得できていません'; health=warn
			fi
		fi
	elif [ "$configured_mode" = ethwan ]; then
		[ "$(get network.wan.proto)" = dhcp ] && [ "$(get network.wan.device)" = eth1 ] || { add_warning '유선 WAN이 eth1/DHCP로 구성되지 않았습니다'; health=danger; }
		[ "$(get dhcp.lan.ignore)" != 1 ] || { add_warning '유선 라우터 모드에서 LAN DHCP 서버가 꺼져 있습니다'; health=danger; }
		[ "$(get network.lan.proto)" = static ] || { add_warning 'LAN 사설 주소가 고정 설정이 아닙니다'; health=danger; }
		[ "$guard" -eq 0 ] || { add_warning '유선 라우터 모드인데 DHCP packet guard가 남아 있습니다'; health=danger; }
		[ "$route" -eq 0 ] || { add_warning '셀룰러 기본 경로가 남아 있습니다'; health=warn; }
		bridge_up || { add_warning 'br-lan이 중지되어 있습니다'; health=danger; }
	elif [ "$configured_mode" = vlanwan ]; then
		[ "$(get network.ethernetwan.proto)" = dhcp ] || { add_warning 'ethernetwan이 DHCP 클라이언트가 아닙니다'; health=danger; }
		[ "$(get network.ethernetwan.device)" = eth0.3 ] || { add_warning 'ethernetwan이 eth0.3에 연결되지 않았습니다'; health=danger; }
		[ "$(get dhcp.lan.ignore)" != 1 ] || { add_warning 'VLAN WAN 라우터 모드에서 LAN DHCP가 꺼져 있습니다'; health=danger; }
		[ "$(get network.lan.proto)" = static ] || { add_warning 'LAN 사설 주소가 고정 설정이 아닙니다'; health=danger; }
		[ "$guard" -eq 0 ] || { add_warning 'VLAN WAN 라우터 모드인데 DHCP packet guard가 남아 있습니다'; health=danger; }
		bridge_up || { add_warning 'br-lan이 중지되어 있습니다'; health=danger; }
	else
		[ "$(get dhcp.lan.ignore)" = 1 ] && { add_warning 'SIMルーターモードなのにDHCPが停止しています'; health=danger; }
		[ "$guard" -eq 0 ] || { add_warning 'SIMルーターモードなのにDHCP packet guardが残っています'; health=danger; }
	fi
	cellular_iface=$(get network.wan.device)
	[ "$(get network.wan.proto)" = ql_datacall ] || cellular_iface=
	ethwan_proto=$(get network.wan.proto)
	ethwan_device=$(get network.wan.device)
	ethwan_address=$(ip -4 -o addr show dev eth1 2>/dev/null | awk 'NR==1 {split($4,p,"/"); print p[1]}')
	ethwan_link=$(cat /sys/class/net/eth1/carrier 2>/dev/null || printf unknown)
	ethwan_route=0
	ip route show default dev eth1 2>/dev/null | grep -q '^default' && ethwan_route=1
	if [ "$managed" = 1 ] && [ "$configured_mode" = vlanwan ]; then
		ethwan_proto=$(get network.ethernetwan.proto)
		ethwan_device=$(get network.ethernetwan.device)
		[ -n "$ethwan_device" ] || ethwan_device=$(get network.ethernetwan.ifname)
		ethwan_address=$(ip -4 -o addr show dev eth0.3 2>/dev/null | awk 'NR==1 {split($4,p,"/"); print p[1]}')
		ethwan_link=$(cat /sys/class/net/eth0.3/carrier 2>/dev/null || cat /sys/class/net/eth0/carrier 2>/dev/null || printf unknown)
		ethwan_route=0
		ip route show default dev eth0.3 2>/dev/null | grep -q '^default' && ethwan_route=1
		vlan3=$(find_switch_vlan 3 2>/dev/null || true)
		[ -n "$vlan3" ] || [ "$(get network.ethwan_vlan.vlan)" = 3 ] || { add_warning 'switch0 VLAN 3 항목이 없습니다'; health=danger; }
		vlan1=$(find_switch_vlan 1 2>/dev/null || true)
		[ -z "$vlan1" ] || case " $(get "network.$vlan1.ports") " in *' 1 '*) add_warning 'VLAN 1에도 스위치 포트 1이 남아 있습니다'; health=danger;; esac
	fi
	if [ "$managed" = 1 ] && [ "$configured_mode" = ethwan ]; then
		if [ "$ethwan_link" != 1 ]; then add_warning 'eth1 링크가 연결되지 않았습니다'; [ "$health" = ok ] && health=warn; fi
		if [ -z "$ethwan_address" ]; then add_warning 'eth1에서 DHCP 주소를 받지 못했습니다'; [ "$health" = ok ] && health=warn; fi
		if [ "$ethwan_route" != 1 ]; then add_warning 'eth1 기본 경로를 확인할 수 없습니다'; [ "$health" = ok ] && health=warn; fi
	fi
	if [ "$managed" = 1 ] && [ "$configured_mode" = vlanwan ]; then
		[ -e /sys/class/net/eth0.3 ] || { add_warning 'eth0.3 인터페이스가 아직 생성되지 않았습니다'; health=danger; }
		[ -n "$ethwan_address" ] || { add_warning 'eth0.3에서 DHCP 주소를 받지 못했습니다'; [ "$health" = ok ] && health=warn; }
		[ "$ethwan_route" = 1 ] || { add_warning 'ethernetwan 기본 경로가 없습니다'; [ "$health" = ok ] && health=warn; }
	fi
	bridge_up_value=0
	bridge_up && bridge_up_value=1
	repair_count=0
	repair_last=-
	[ -f "$REPAIR_FILE" ] && repair_count=$(sed -n 's/^count=//p' "$REPAIR_FILE" 2>/dev/null)
	[ -f "$REPAIR_FILE" ] && repair_last=$(sed -n 's/^last=//p' "$REPAIR_FILE" 2>/dev/null)
	pending_id=$(get sbair.bridge.pending_id)
	pending_mode=$(get sbair.bridge.pending_mode)
	deadline=$(get sbair.bridge.pending_deadline)
	remaining=0
	case "$deadline" in ''|*[!0-9]*) ;; *) remaining=$((deadline - $(now))); [ "$remaining" -gt 0 ] || remaining=0;; esac
	printf 'mode=%s\nconfigured_mode=%s\nmanaged=%s\nhealthy=%s\nhealth=%s\nmanagement.proto=%s\nmanagement.address=%s\nmanagement.gateway=%s\nmanagement.dns=%s\nmanagement.oem_baseline_ready=%s\nmanagement.oem.ipaddr=%s\nmanagement.oem.netmask=%s\nmanagement.oem.gateway=%s\nmanagement.oem.dns=%s\nmanagement.effective.ipaddr=%s\nmanagement.effective.netmask=%s\nmanagement.effective.gateway=%s\nmanagement.effective.dns=%s\nmanagement.effective.ipaddr_source=%s\nmanagement.effective.netmask_source=%s\nmanagement.effective.gateway_source=%s\nmanagement.effective.dns_source=%s\nmanagement.fallback_ip=%s\nmanagement.fallback_netmask=%s\nmanagement.fallback_active=%s\nmanagement.fallback_conflict=%s\ndhcp.configured=%s\ndhcp.udp67_listening=%s\ndhcp.udp67_scope=%s\ndhcp.uci_ignore=%s\ndhcp.guard_active=%s\nbridge.device=%s\nbridge.up=%s\nbridge.members=%s\nbridge.members_count=%s\ncellular.interface=%s\ncellular.routing_enabled=%s\ncellular.default_route=%s\nwifi.mlo=%s\nwifi.bandsteering=%s\nwifi.2g=%s\nwifi.5g=%s\nwifi.6g=%s\nrepair.last=%s\nrepair.count=%s\npending.id=%s\npending.mode=%s\npending.remaining=%s\nwarnings=%s\n' \
		"$mode" "$configured_mode" "$managed" "$([ "$health" = ok ] && printf 1 || printf 0)" "$health" "$proto" "$address" "$(default_gateway)" "$(dns_server)" \
		"$(get sbair.bridge.oem_baseline_ready)" "$(get sbair.bridge.oem_ipaddr)" "$(get sbair.bridge.oem_netmask)" "$(get sbair.bridge.oem_gateway)" "$(get sbair.bridge.oem_dns)" \
		"$static_effective_ipaddr" "$static_effective_netmask" "$static_effective_gateway" "$static_effective_dns" "$static_effective_ipaddr_source" "$static_effective_netmask_source" "$static_effective_gateway_source" "$static_effective_dns_source" \
		"$(get sbair.bridge.fallback_ip)" "$(get sbair.bridge.fallback_netmask)" \
		"$fallback_active_value" "$fallback_conflict_value" "$configured" "$udp67" system "$([ "$(get dhcp.lan.ignore)" = 1 ] && printf 1 || printf 0)" "$guard" \
		"$BRIDGE" "$bridge_up_value" "$members" "$member_count" \
		"$cellular_iface" "$route" "$route" "$(wifi_mlo)" "$(get knos.network.bandsteering)" "$(wifi_band ra0 2.4G)" "$(wifi_band rai0 5G)" "$(wifi_band rax0 6G)" \
		"$repair_last" "$repair_count" "$pending_id" "$pending_mode" "$remaining" "$warnings"
	printf 'ethernet_wan.proto=%s\nethernet_wan.device=%s\nethernet_wan.address=%s\nethernet_wan.link=%s\nethernet_wan.default_route=%s\n' \
		"$ethwan_proto" "$ethwan_device" "$ethwan_address" "$ethwan_link" "$ethwan_route"
}
