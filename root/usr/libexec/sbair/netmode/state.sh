# SPDX-License-Identifier: MIT
# Copyright (c) 2026 syado
# Persistent configuration, snapshots, and draft state.

oem_baseline_recorded() {
	[ "$(get sbair.bridge.oem_baseline_ready)" = 1 ]
}

oem_baseline_available() {
	oem_baseline_recorded || return 1
	is_ipv4 "$(get sbair.bridge.oem_ipaddr)" || return 1
	mask_to_prefix "$(get sbair.bridge.oem_netmask)" >/dev/null 2>&1 || return 1
}

capture_oem_baseline() {
	local ipaddr netmask gateway dns ready
	# Once recorded, never replace the baseline with a package-managed AP value.
	oem_baseline_recorded && return 0
	ipaddr=$(get network.lan.ipaddr)
	netmask=$(get network.lan.netmask)
	gateway=$(get network.lan.gateway)
	dns=$(get network.lan.dns)
	set_opt sbair.bridge.oem_ipaddr "$ipaddr" || return 1
	set_opt sbair.bridge.oem_netmask "$netmask" || return 1
	set_opt sbair.bridge.oem_gateway "$gateway" || return 1
	set_opt sbair.bridge.oem_dns "$dns" || return 1
	ready=0
	if is_ipv4 "$ipaddr" && mask_to_prefix "$netmask" >/dev/null 2>&1; then
		ready=1
	fi
	set_opt sbair.bridge.oem_baseline_ready "$ready" || return 1
	commit sbair || return 1
}
remember_option() {
	local key path value
	key=$1
	path=$2
	if value=$(uci -q get "$path" 2>/dev/null); then
		set_opt "sbair.bridge.sim_${key}" "$value"
		set_opt "sbair.bridge.sim_${key}_present" 1
	else
		del_opt "sbair.bridge.sim_${key}"
		set_opt "sbair.bridge.sim_${key}_present" 0
	fi
}

save_backup() {
	local key
	ensure_config
	# This profile is only the configuration of a package-managed SIM router.
	# A vendor/AP configuration with managed=0 is not a SIM rollback target.
	[ "$(get sbair.bridge.managed)" = 1 ] || return 0
	[ "$(get sbair.bridge.mode)" = sim ] || return 0
	[ "$(get sbair.bridge.backup_ready)" = 1 ] && return 0
	for key in proto ipaddr netmask gateway dns ip6assign ip6hint ip6class delegate; do
		remember_option "$key" "network.lan.$key"
	done
	for key in disabled auto; do
		remember_option "wan_$key" "network.wan.$key"
	done
	for key in ignore ra dhcpv6 ndp; do
		remember_option "dhcp_$key" "dhcp.lan.$key"
	done
	for key in start limit leasetime; do
		remember_option "dhcp_$key" "dhcp.lan.$key"
	done
	set_opt sbair.bridge.backup_ready 1
	commit sbair || return 1
}

clear_sim_profile() {
	local key
	for key in proto ipaddr netmask gateway dns ip6assign ip6hint ip6class delegate \
		wan_disabled wan_auto dhcp_ignore dhcp_ra dhcp_dhcpv6 dhcp_ndp \
		dhcp_start dhcp_limit dhcp_leasetime; do
		del_opt "sbair.bridge.sim_${key}"
		del_opt "sbair.bridge.sim_${key}_present"
	done
	set_opt sbair.bridge.backup_ready 0
}

find_switch_vlan() {
	local wanted index section
	wanted=$1
	index=0
	while [ "$index" -lt 16 ]; do
		section="@switch_vlan[$index]"
		if [ "$(get "network.$section.device")" = switch0 ] && [ "$(get "network.$section.vlan")" = "$wanted" ]; then
			printf '%s\n' "$section"
			return 0
		fi
		index=$((index + 1))
	done
	return 1
}

find_firewall_zone() {
	local wanted index section
	wanted=$1
	index=0
	while [ "$index" -lt 16 ]; do
		section="@zone[$index]"
		[ "$(get "firewall.$section.name")" = "$wanted" ] && { printf '%s\n' "$section"; return 0; }
		index=$((index + 1))
	done
	return 1
}

remember_vlanwan_value() {
	local key path value
	key=$1; path=$2
	if value=$(uci -q get "$path" 2>/dev/null); then
		set_opt "sbair.bridge.vlanwan_orig_${key}" "$value" || return 1
		set_opt "sbair.bridge.vlanwan_orig_${key}_present" 1 || return 1
	else
		del_opt "sbair.bridge.vlanwan_orig_${key}"
		set_opt "sbair.bridge.vlanwan_orig_${key}_present" 0 || return 1
	fi
}

save_vlanwan_baseline() {
	local section wan_zone key path opt
	if [ "$(get sbair.bridge.vlanwan_orig_ready)" = 1 ] && [ "$(get sbair.bridge.mode)" = vlanwan ]; then return 0; fi
	section=$(find_switch_vlan 1) || { printf '%s\n' 'error=VLAN 1 switch section was not found'; return 1; }
	wan_zone=$(find_firewall_zone wan) || { printf '%s\n' 'error=wan firewall zone was not found'; return 1; }
	set_opt sbair.bridge.vlanwan_orig_vlan1_section "$section" || return 1
	set_opt sbair.bridge.vlanwan_orig_wan_zone "$wan_zone" || return 1
	remember_vlanwan_value vlan1_ports "network.$section.ports" || return 1
	for key in ethwan_vlan_type ethwan_vlan_device ethwan_vlan_vlan ethwan_vlan_ports; do
		case "$key" in
			ethwan_vlan_type) path=network.ethwan_vlan;;
			ethwan_vlan_*) opt=${key#ethwan_vlan_}; path="network.ethwan_vlan.$opt";;
		esac
		remember_vlanwan_value "$key" "$path" || return 1
	done
	for key in ethernetwan_type ethernetwan_proto ethernetwan_device ethernetwan_ifname ethernetwan_auto ethernetwan_disabled; do
		case "$key" in
			ethernetwan_type) path=network.ethernetwan;;
			ethernetwan_*) opt=${key#ethernetwan_}; path="network.ethernetwan.$opt";;
		esac
		remember_vlanwan_value "$key" "$path" || return 1
	done
	remember_vlanwan_value firewall_wan_network "firewall.$wan_zone.network" || return 1
	set_opt sbair.bridge.vlanwan_orig_ready 1 || return 1
	commit sbair
}

restore_vlanwan_baseline() {
	local key path present value section wan_zone token original
	[ "$(get sbair.bridge.vlanwan_orig_ready)" = 1 ] || return 0
	section=$(get sbair.bridge.vlanwan_orig_vlan1_section)
	[ -n "$section" ] || return 1
	present=$(get sbair.bridge.vlanwan_orig_vlan1_ports_present)
	if [ "$present" = 1 ]; then set_opt "network.$section.ports" "$(get sbair.bridge.vlanwan_orig_vlan1_ports)" || return 1; fi
	for key in ethwan_vlan_type ethwan_vlan_device ethwan_vlan_vlan ethwan_vlan_ports; do
		case "$key" in
			ethwan_vlan_type) path=network.ethwan_vlan;;
			ethwan_vlan_*) opt=${key#ethwan_vlan_}; path="network.ethwan_vlan.$opt";;
		esac
		present=$(get "sbair.bridge.vlanwan_orig_${key}_present")
		if [ "$present" = 1 ]; then
			value=$(get "sbair.bridge.vlanwan_orig_${key}")
			if [ "$key" = ethwan_vlan_type ]; then uci -q set "network.ethwan_vlan=$value" || return 1; else set_opt "$path" "$value" || return 1; fi
		elif [ "$key" = ethwan_vlan_type ]; then
			del_opt network.ethwan_vlan
		else
			snapshot_delete "$path" || return 1
		fi
	done
	for key in ethernetwan_type ethernetwan_proto ethernetwan_device ethernetwan_ifname ethernetwan_auto ethernetwan_disabled; do
		case "$key" in
			ethernetwan_type) path=network.ethernetwan;;
			ethernetwan_*) opt=${key#ethernetwan_}; path="network.ethernetwan.$opt";;
		esac
		present=$(get "sbair.bridge.vlanwan_orig_${key}_present")
		if [ "$present" = 1 ]; then
			value=$(get "sbair.bridge.vlanwan_orig_${key}")
			if [ "$key" = ethernetwan_type ]; then uci -q set "network.ethernetwan=$value" || return 1; else set_opt "$path" "$value" || return 1; fi
		elif [ "$key" = ethernetwan_type ]; then
			del_opt network.ethernetwan
		else
			snapshot_delete "$path" || return 1
		fi
	done
	wan_zone=$(get sbair.bridge.vlanwan_orig_wan_zone)
	if [ -n "$wan_zone" ]; then
		uci -q delete "firewall.$wan_zone.network" >/dev/null 2>&1 || true
		if [ "$(get sbair.bridge.vlanwan_orig_firewall_wan_network_present)" = 1 ]; then
			original=$(get sbair.bridge.vlanwan_orig_firewall_wan_network)
			for token in $original; do uci -q add_list "firewall.$wan_zone.network=$token" || return 1; done
		fi
	fi
	commit network || return 1
	commit firewall || return 1
	return 0
}

snapshot_path() {
	case "$1" in
		mode) printf '%s\n' sbair.bridge.mode;;
		managed) printf '%s\n' sbair.bridge.managed;;
		management_proto) printf '%s\n' sbair.bridge.management_proto;;
		ipaddr) printf '%s\n' sbair.bridge.ipaddr;;
		netmask) printf '%s\n' sbair.bridge.netmask;;
		gateway) printf '%s\n' sbair.bridge.gateway;;
		dns) printf '%s\n' sbair.bridge.dns;;
		fallback_enabled) printf '%s\n' sbair.bridge.fallback_enabled;;
		fallback_ip) printf '%s\n' sbair.bridge.fallback_ip;;
		fallback_netmask) printf '%s\n' sbair.bridge.fallback_netmask;;
		fallback_timeout) printf '%s\n' sbair.bridge.fallback_timeout;;
		dhcp_server) printf '%s\n' sbair.bridge.dhcp_server;;
		cellular_wan) printf '%s\n' sbair.bridge.cellular_wan;;
		dhcp_pool_start) printf '%s\n' sbair.bridge.dhcp_start;;
		dhcp_pool_limit) printf '%s\n' sbair.bridge.dhcp_limit;;
		dhcp_pool_leasetime) printf '%s\n' sbair.bridge.dhcp_leasetime;;
		backup_ready) printf '%s\n' sbair.bridge.backup_ready;;
		sim_proto) printf '%s\n' sbair.bridge.sim_proto;;
		sim_ipaddr) printf '%s\n' sbair.bridge.sim_ipaddr;;
		sim_netmask) printf '%s\n' sbair.bridge.sim_netmask;;
		sim_gateway) printf '%s\n' sbair.bridge.sim_gateway;;
		sim_dns) printf '%s\n' sbair.bridge.sim_dns;;
		sim_ip6assign) printf '%s\n' sbair.bridge.sim_ip6assign;;
		sim_ip6hint) printf '%s\n' sbair.bridge.sim_ip6hint;;
		sim_ip6class) printf '%s\n' sbair.bridge.sim_ip6class;;
		sim_delegate) printf '%s\n' sbair.bridge.sim_delegate;;
		sim_dhcp_start) printf '%s\n' sbair.bridge.sim_dhcp_start;;
		sim_dhcp_limit) printf '%s\n' sbair.bridge.sim_dhcp_limit;;
		sim_dhcp_leasetime) printf '%s\n' sbair.bridge.sim_dhcp_leasetime;;
		sim_wan_disabled) printf '%s\n' sbair.bridge.sim_wan_disabled;;
		sim_wan_auto) printf '%s\n' sbair.bridge.sim_wan_auto;;
		sim_dhcp_ignore) printf '%s\n' sbair.bridge.sim_dhcp_ignore;;
		sim_dhcp_ra) printf '%s\n' sbair.bridge.sim_dhcp_ra;;
		sim_dhcp_dhcpv6) printf '%s\n' sbair.bridge.sim_dhcp_dhcpv6;;
		sim_dhcp_ndp) printf '%s\n' sbair.bridge.sim_dhcp_ndp;;
		network_lan_proto) printf '%s\n' network.lan.proto;;
		network_lan_ipaddr) printf '%s\n' network.lan.ipaddr;;
		network_lan_netmask) printf '%s\n' network.lan.netmask;;
		network_lan_gateway) printf '%s\n' network.lan.gateway;;
		network_lan_dns) printf '%s\n' network.lan.dns;;
		network_lan_ip6assign) printf '%s\n' network.lan.ip6assign;;
		network_lan_ip6hint) printf '%s\n' network.lan.ip6hint;;
		network_lan_ip6class) printf '%s\n' network.lan.ip6class;;
		network_lan_delegate) printf '%s\n' network.lan.delegate;;
		dhcp_lan_ignore) printf '%s\n' dhcp.lan.ignore;;
		dhcp_lan_ra) printf '%s\n' dhcp.lan.ra;;
		dhcp_lan_dhcpv6) printf '%s\n' dhcp.lan.dhcpv6;;
		dhcp_lan_ndp) printf '%s\n' dhcp.lan.ndp;;
		dhcp_lan_start) printf '%s\n' dhcp.lan.start;;
		dhcp_lan_limit) printf '%s\n' dhcp.lan.limit;;
		dhcp_lan_leasetime) printf '%s\n' dhcp.lan.leasetime;;
		network_wan_disabled) printf '%s\n' network.wan.disabled;;
		network_wan_auto) printf '%s\n' network.wan.auto;;
		network_wan_proto) printf '%s\n' network.wan.proto;;
		network_wan_device) printf '%s\n' network.wan.device;;
		network_wan6_proto) printf '%s\n' network.wan6.proto;;
		network_wan6_device) printf '%s\n' network.wan6.device;;
		network_wan6_disabled) printf '%s\n' network.wan6.disabled;;
		network_wan6_auto) printf '%s\n' network.wan6.auto;;
		eth1_lan_member) printf '%s\n' '@eth1_lan_member';;
		*) return 1;;
	esac
}

snapshot_option() {
	local prefix key path value
	prefix=$1
	key=$2
	path=$3
	if [ "$key" = eth1_lan_member ]; then
		value=$(uci -q get 'network.@device[0].ports' 2>/dev/null || true)
		case " $value " in *' eth1 '*) value=1;; *) value=0;; esac
		set_opt "sbair.bridge.${prefix}${key}" "$value" || return 1
		set_opt "sbair.bridge.${prefix}${key}_present" 1 || return 1
		return 0
	fi
	if value=$(uci -q get "$path" 2>/dev/null); then
		set_opt "sbair.bridge.${prefix}${key}" "$value" || return 1
		set_opt "sbair.bridge.${prefix}${key}_present" 1 || return 1
	else
		snapshot_delete "sbair.bridge.${prefix}${key}" || return 1
		set_opt "sbair.bridge.${prefix}${key}_present" 0 || return 1
	fi
}

save_ethwan_baseline() {
	local key path
	if [ "$(get sbair.bridge.ethwan_orig_ready)" = 1 ]; then
		[ "$(get network.wan.device)" = eth1 ] && return 0
		for key in network_wan_proto network_wan_device network_wan_disabled network_wan_auto \
			network_wan6_proto network_wan6_device network_wan6_disabled network_wan6_auto eth1_lan_member; do
			snapshot_delete "sbair.bridge.ethwan_orig_${key}" || return 1
			snapshot_delete "sbair.bridge.ethwan_orig_${key}_present" || return 1
		done
		del_opt sbair.bridge.ethwan_orig_ready
	fi
	for key in network_wan_proto network_wan_device network_wan_disabled network_wan_auto \
		network_wan6_proto network_wan6_device network_wan6_disabled network_wan6_auto eth1_lan_member; do
		path=$(snapshot_path "$key") || return 1
		snapshot_option ethwan_orig_ "$key" "$path" || return 1
	done
	set_opt sbair.bridge.ethwan_orig_ready 1 || return 1
	commit sbair
}

restore_ethwan_baseline() {
	local key path present value
	[ "$(get sbair.bridge.ethwan_orig_ready)" = 1 ] || return 1
	for key in network_wan_proto network_wan_device network_wan_disabled network_wan_auto \
		network_wan6_proto network_wan6_device network_wan6_disabled network_wan6_auto; do
		path=$(snapshot_path "$key") || return 1
		present=$(get "sbair.bridge.ethwan_orig_${key}_present")
		if [ "$present" = 1 ]; then
			value=$(get "sbair.bridge.ethwan_orig_${key}")
			set_opt "$path" "$value" || return 1
		else
			snapshot_delete "$path" || return 1
		fi
	done
	value=$(get sbair.bridge.ethwan_orig_eth1_lan_member)
	uci -q del_list 'network.@device[0].ports=eth1' >/dev/null 2>&1 || true
	if [ "$value" = 1 ]; then
		uci -q add_list 'network.@device[0].ports=eth1' >/dev/null 2>&1 || return 1
	fi
	commit network || return 1
	# Keep the baseline until the mode transaction is confirmed. A failed
	# SIM/AP transition may roll back to ethwan and still need these values.
	return 0
}

snapshot_abort() {
	local prefix
	prefix=$1
	# Do not leave a partially staged snapshot that a later recovery could
	# mistake for a complete rollback point. Best-effort cleanup is used here
	# because the original UCI failure may also prevent cleanup writes.
	clear_snapshot "$prefix" || true
	set_opt "sbair.bridge.${prefix}snapshot_ready" 0 || true
	commit sbair || true
}

snapshot_delete() {
	local path
	path=$1
	# UCI returns non-zero for deleting an option which is not present on some
	# releases. That is not a snapshot failure; an actual existing option must
	# be deleted successfully.
	if uci -q get "$path" >/dev/null 2>&1; then
		uci -q delete "$path" >/dev/null 2>&1 || return 1
	fi
}

capture_snapshot() {
	local prefix key path
	prefix=$1
	# Remove any stale copy first, then persist ready=0. A previously committed
	# ready=1 must not survive a later partial rewrite.
	clear_snapshot "$prefix" || return 1
	set_opt "sbair.bridge.${prefix}snapshot_ready" 0 || return 1
	commit sbair || return 1
	for key in $SNAPSHOT_KEYS; do
		path=$(snapshot_path "$key") || return 1
		snapshot_option "$prefix" "$key" "$path" || { snapshot_abort "$prefix"; return 1; }
	done
	set_opt "sbair.bridge.${prefix}snapshot_ready" 1 || { snapshot_abort "$prefix"; return 1; }
	commit sbair || {
		snapshot_abort "$prefix"
		return 1
	}
	if [ "$(get "sbair.bridge.${prefix}snapshot_ready")" != 1 ]; then
		snapshot_abort "$prefix"
		return 1
	fi
}

clear_snapshot() {
	local prefix key
	prefix=$1
	for key in $SNAPSHOT_KEYS; do
		snapshot_delete "sbair.bridge.${prefix}${key}" || return 1
		snapshot_delete "sbair.bridge.${prefix}${key}_present" || return 1
	done
	snapshot_delete "sbair.bridge.${prefix}snapshot_ready" || return 1
}

clear_draft() {
	local key
	for key in $DRAFT_KEYS; do snapshot_delete "sbair.bridge.draft_${key}" || return 1; done
	snapshot_delete sbair.bridge.draft_ready
}

load_saved_config() {
	if [ "$(get sbair.bridge.draft_ready)" = 1 ]; then
		config_proto=$(get sbair.bridge.draft_proto)
		config_ipaddr=$(get sbair.bridge.draft_ipaddr)
		config_netmask=$(get sbair.bridge.draft_netmask)
		config_gateway=$(get sbair.bridge.draft_gateway)
		config_dns=$(get sbair.bridge.draft_dns)
		config_enabled=$(get sbair.bridge.draft_fallback_enabled)
		config_fallback=$(get sbair.bridge.draft_fallback_ip)
		config_fallback_mask=$(get sbair.bridge.draft_fallback_netmask)
		config_timeout=$(get sbair.bridge.draft_fallback_timeout)
		config_dhcp_start=$(get sbair.bridge.draft_dhcp_start)
		config_dhcp_limit=$(get sbair.bridge.draft_dhcp_limit)
		config_dhcp_leasetime=$(get sbair.bridge.draft_dhcp_leasetime)
	else
		config_proto=$(get sbair.bridge.management_proto)
		config_ipaddr=$(get sbair.bridge.ipaddr)
		config_netmask=$(get sbair.bridge.netmask)
		config_gateway=$(get sbair.bridge.gateway)
		config_dns=$(get sbair.bridge.dns)
		config_enabled=$(get sbair.bridge.fallback_enabled)
		config_fallback=$(get sbair.bridge.fallback_ip)
		config_fallback_mask=$(get sbair.bridge.fallback_netmask)
		config_timeout=$(get sbair.bridge.fallback_timeout)
		config_dhcp_start=$(get sbair.bridge.dhcp_start)
		config_dhcp_limit=$(get sbair.bridge.dhcp_limit)
		config_dhcp_leasetime=$(get sbair.bridge.dhcp_leasetime)
	fi
}

restore_option() {
	local key path present value
	key=$1
	path=$2
	present=$(get "sbair.bridge.sim_${key}_present")
	if [ "$present" = 1 ]; then
		value=$(get "sbair.bridge.sim_${key}")
		set_opt "$path" "$value"
	else
		del_opt "$path"
	fi
}

restore_snapshot_option() {
	local prefix key path present value
	prefix=$1
	key=$2
	path=$(snapshot_path "$key") || return 1
	present=$(get "sbair.bridge.${prefix}${key}_present")
	if [ "$key" = eth1_lan_member ]; then
		value=$(get "sbair.bridge.${prefix}${key}")
		uci -q del_list 'network.@device[0].ports=eth1' >/dev/null 2>&1 || true
		[ "$value" != 1 ] || uci -q add_list 'network.@device[0].ports=eth1' >/dev/null 2>&1
		return $?
	fi
	if [ "$present" = 1 ]; then
		value=$(get "sbair.bridge.${prefix}${key}")
		set_opt "$path" "$value"
	else
		snapshot_delete "$path"
	fi
}

restore_transaction_snapshot() {
	local prefix previous_mode previous_managed
	prefix=pending_prev_
	[ "$(get sbair.bridge.${prefix}snapshot_ready)" = 1 ] || return 1
	previous_mode=$(get "sbair.bridge.${prefix}mode")
	previous_managed=$(get "sbair.bridge.${prefix}managed")
	fallback_remove
	for key in $SNAPSHOT_KEYS; do
		restore_snapshot_option "$prefix" "$key" || return 1
	done
	commit network || return 1
	commit dhcp || return 1
	commit sbair || return 1
	network_reload
	if [ "$(get network.wan.disabled)" = 1 ]; then
		ifdown wan >/dev/null 2>&1 || true
	elif uci -q get network.wan >/dev/null 2>&1; then
		ifup wan >/dev/null 2>&1 || true
	fi
	if uci -q get network.wan6 >/dev/null 2>&1; then
		if [ "$(get network.wan6.disabled)" = 1 ]; then ifdown wan6 >/dev/null 2>&1 || true; else ifup wan6 >/dev/null 2>&1 || true; fi
	fi
	if [ "$previous_mode" = ap ] && [ "$previous_managed" = 1 ]; then
		dhcp_guard_enable || return 1
		[ -f "$DHCP_START_FILE" ] || safe_runtime_write "$DHCP_START_FILE" "$(date +%s)" || return 1
	else
		dhcp_guard_disable || true
		rm -f "$DHCP_START_FILE" "$CONFLICT_FILE" "$FALLBACK_FILE"
	fi
	# Recreate the service state only for a transaction previously owned by this
	# package. An unmanaged rollback must not restart or reinterpret vendor state.
	if [ "$previous_managed" = 1 ]; then
		# AP guard is installed before this check because UDP/67 is system-wide.
		restart_dnsmasq_checked || return 1
	fi
	if [ "$previous_mode" = ap ] && [ "$previous_managed" = 1 ]; then
		ensure_fallback
	fi
	if [ "$previous_mode" = vlanwan ] && [ "$previous_managed" = 1 ]; then
		apply_vlanwan_config || return 1
	fi
}

parse_config_args() {
	load_saved_config
	for config_arg in "$@"; do
		case "$config_arg" in
			proto=*) config_proto=${config_arg#*=};;
			ipaddr=*) config_ipaddr=${config_arg#*=};;
			netmask=*) config_netmask=${config_arg#*=};;
			gateway=*) config_gateway=${config_arg#*=};;
			dns=*) config_dns=${config_arg#*=};;
			fallback_enabled=*) config_enabled=${config_arg#*=};;
			fallback_ip=*) config_fallback=${config_arg#*=};;
			fallback_netmask=*) config_fallback_mask=${config_arg#*=};;
			fallback_timeout=*) config_timeout=${config_arg#*=};;
			dhcp_start=*) config_dhcp_start=${config_arg#*=};;
			dhcp_limit=*) config_dhcp_limit=${config_arg#*=};;
			dhcp_leasetime=*) config_dhcp_leasetime=${config_arg#*=};;
		esac
	done
}

validate_config_args() {
	local lease_number
	[ "$config_proto" = dhcp ] || [ "$config_proto" = static ] || { printf '%s\n' 'error=invalid management protocol'; return 1; }
	if [ "$config_proto" = static ]; then
		[ -z "$config_ipaddr" ] || is_ipv4 "$config_ipaddr" || { printf '%s\n' 'error=invalid static address'; return 1; }
		[ -z "$config_netmask" ] || mask_to_prefix "$config_netmask" >/dev/null || { printf '%s\n' 'error=invalid static netmask'; return 1; }
	fi
	[ -z "$config_gateway" ] || is_ipv4 "$config_gateway" || { printf '%s\n' 'error=invalid gateway'; return 1; }
	is_ipv4 "$config_fallback" || { printf '%s\n' 'error=invalid fallback address'; return 1; }
	[ "$config_fallback" != "$VENDOR_ALIAS" ] || { printf '%s\n' 'error=fallback conflicts with vendor alias'; return 1; }
	mask_to_prefix "$config_fallback_mask" >/dev/null || { printf '%s\n' 'error=invalid fallback netmask'; return 1; }
	case "$config_enabled" in 0|1) ;; *) printf '%s\n' 'error=fallback_enabled must be 0 or 1'; return 1;; esac
	case "$config_timeout" in ''|*[!0-9]*) printf '%s\n' 'error=invalid fallback timeout'; return 1;; esac
	[ "$config_timeout" -ge 5 ] && [ "$config_timeout" -le 3600 ] || { printf '%s\n' 'error=fallback timeout must be 5..3600'; return 1; }
	if [ -n "$config_dhcp_start" ] || [ -n "$config_dhcp_limit" ]; then
		case "$config_dhcp_start" in ''|*[!0-9]*) printf '%s\n' 'error=invalid DHCP pool start'; return 1;; esac
		case "$config_dhcp_limit" in ''|*[!0-9]*) printf '%s\n' 'error=invalid DHCP pool limit'; return 1;; esac
		[ "$config_dhcp_start" -gt 0 ] || { printf '%s\n' 'error=DHCP pool start must be positive'; return 1; }
		[ "$config_dhcp_limit" -gt 0 ] || { printf '%s\n' 'error=DHCP pool limit must be positive'; return 1; }
	fi
	case "$config_dhcp_leasetime" in
		'') ;;
		infinite) ;;
		*[!0-9smhdw]*) printf '%s\n' 'error=invalid DHCP lease time'; return 1;;
		*) :;;
	esac
	case "$config_dhcp_leasetime" in
		*[smhdw]) lease_number=${config_dhcp_leasetime%?};;
		[0-9]*) lease_number=$config_dhcp_leasetime;;
		*) lease_number=0;;
	esac
	[ -z "$config_dhcp_leasetime" ] || [ "$config_dhcp_leasetime" = infinite ] || [ "${lease_number:-0}" -gt 0 ] || {
		printf '%s\n' 'error=DHCP lease time must be positive'; return 1;
	}
}

write_config_args() {
	set_opt sbair.bridge.management_proto "$config_proto" || return 1
	set_opt sbair.bridge.ipaddr "$config_ipaddr" || return 1
	set_opt sbair.bridge.netmask "$config_netmask" || return 1
	set_opt sbair.bridge.gateway "$config_gateway" || return 1
	set_opt sbair.bridge.dns "$config_dns" || return 1
	set_opt sbair.bridge.fallback_enabled "$config_enabled" || return 1
	set_opt sbair.bridge.fallback_ip "$config_fallback" || return 1
	set_opt sbair.bridge.fallback_netmask "$config_fallback_mask" || return 1
	set_opt sbair.bridge.fallback_timeout "$config_timeout" || return 1
	if [ -n "$config_dhcp_start" ]; then set_opt sbair.bridge.dhcp_start "$config_dhcp_start" || return 1; else snapshot_delete sbair.bridge.dhcp_start || return 1; fi
	if [ -n "$config_dhcp_limit" ]; then set_opt sbair.bridge.dhcp_limit "$config_dhcp_limit" || return 1; else snapshot_delete sbair.bridge.dhcp_limit || return 1; fi
	if [ -n "$config_dhcp_leasetime" ]; then set_opt sbair.bridge.dhcp_leasetime "$config_dhcp_leasetime" || return 1; else snapshot_delete sbair.bridge.dhcp_leasetime || return 1; fi
}

write_draft_args() {
	set_opt sbair.bridge.draft_proto "$config_proto"
	set_opt sbair.bridge.draft_ipaddr "$config_ipaddr"
	set_opt sbair.bridge.draft_netmask "$config_netmask"
	set_opt sbair.bridge.draft_gateway "$config_gateway"
	set_opt sbair.bridge.draft_dns "$config_dns"
	set_opt sbair.bridge.draft_fallback_enabled "$config_enabled"
	set_opt sbair.bridge.draft_fallback_ip "$config_fallback"
	set_opt sbair.bridge.draft_fallback_netmask "$config_fallback_mask"
	set_opt sbair.bridge.draft_fallback_timeout "$config_timeout"
	set_opt sbair.bridge.draft_dhcp_start "$config_dhcp_start"
	set_opt sbair.bridge.draft_dhcp_limit "$config_dhcp_limit"
	set_opt sbair.bridge.draft_dhcp_leasetime "$config_dhcp_leasetime"
	set_opt sbair.bridge.draft_ready 1
}

set_config() {
	local pending lock_rc
	netmode_lock_acquire
	lock_rc=$?
	[ "$lock_rc" -eq 0 ] || { printf '%s\n' 'error=network-mode transaction lock unavailable'; return 1; }
	ensure_config || return 1
	pending=$(get sbair.bridge.pending_id)
	[ -z "$pending" ] || { printf '%s\n' 'error=another mode change is awaiting confirmation'; return 1; }
	parse_config_args "$@"
	validate_config_args || return 1
	if [ "$config_proto" = static ]; then
		resolve_static_config "$config_ipaddr" "$config_netmask" "$config_gateway" "$config_dns" || {
			printf '%s\n' "error=$static_resolve_error"
			return 1
		}
	fi
	if [ "$(get sbair.bridge.mode)" = ap ] && [ "$(get sbair.bridge.managed)" = 1 ]; then
		validate_ap_proto ap "$config_proto" || return 1
	fi
	# Deprecated compatibility API: keep edits in a draft so it cannot bypass
	# Safe Apply. Active sbair.bridge.* changes only inside start_apply.
	write_draft_args
	commit sbair || { printf '%s\n' 'error=unable to save configuration draft'; return 1; }
	printf '%s\n' 'result=ok' 'draft=1' 'deprecated=1'
}
