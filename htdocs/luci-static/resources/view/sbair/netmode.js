// SPDX-License-Identifier: MIT
// Copyright (c) 2026 syado
//
// Safe AP/Bridge mode for SoftBank Air 6. Wi-Fi settings are deliberately not
// edited here; this page owns only L3, DHCP/RA, fallback, and cellular routing.

'use strict';
'require view';
'require rpc';
'require ui';
'require dom';
'require tools.sbair as sbair';

var callStatus = rpc.declare({ object: 'sbair', method: 'netmode_status' });
var callGetConfig = rpc.declare({ object: 'sbair', method: 'netmode_get_config' });
var callApply = rpc.declare({
	object: 'sbair', method: 'netmode_apply',
	params: [ 'mode', 'proto', 'ipaddr', 'netmask', 'gateway', 'dns',
		'fallback_enabled', 'fallback_ip', 'fallback_netmask', 'fallback_timeout',
		'dhcp_start_ip', 'dhcp_end_ip', 'dhcp_leasetime' ]
});
var callConfirm = rpc.declare({ object: 'sbair', method: 'netmode_confirm' });
var callRollback = rpc.declare({ object: 'sbair', method: 'netmode_rollback' });
var callUnmanage = rpc.declare({ object: 'sbair', method: 'netmode_unmanage' });
var callRepair = rpc.declare({ object: 'sbair', method: 'netmode_repair' });

var modeLabel = { unmanaged: _("Primary (uncontrolled) / unmanaged"), sim: _("Stock cellular router (SIM / ccmni)"), ap: _("AP / Bridge"), ethwan: _("Floop3 wired WAN router (eth1)"), vlanwan: _("Air 6 Ethernet WAN (VLAN 3)") };
var pollTimer;

function flagEnabled(value) {
	return value === true || value === 1 || value === '1';
}

function effectiveMode(status) {
	var managed = status && (status.managed === true || status.managed === 1 || status.managed === '1');
	if (managed && status && (status.mode === 'ap' || status.configured_mode === 'ap')) return 'ap';
	if (managed && status && (status.mode === 'sim' || status.configured_mode === 'sim')) return 'sim';
	if (managed && status && (status.mode === 'ethwan' || status.configured_mode === 'ethwan')) return 'ethwan';
	if (managed && status && (status.mode === 'vlanwan' || status.configured_mode === 'vlanwan')) return 'vlanwan';
	return 'unmanaged';
}

function displayModeLabel(mode) {
	return modeLabel[mode] || mode;
}

function badge(text, color) {
	var colors = {
		green: '#5cb85c', yellow: '#e6a23c', red: '#d9534f', gray: '#777'
	};
	return E('span', {
		'class': 'ifacebadge',
		'style': 'margin-left:.5em;background:' + (colors[color] || colors.gray) + ';color:#fff'
	}, text);
}

function healthBadge(data) {
	var health = data.health || (data.healthy ? 'ok' : 'warn');
	if (health === 'unmanaged') return badge(_("not managed"), 'gray');
	return badge(health === 'ok' ? _("normal") : (health === 'danger' ? _("danger") : _("Get the gist")),
		health === 'ok' ? 'green' : (health === 'danger' ? 'red' : 'yellow'));
}

function onOff(value, onText, offText) {
	if (value === true || value === 1 || value === '1') return badge(onText || 'ON', 'green');
	if (value === false || value === 0 || value === '0') return badge(offText || 'OFF', 'gray');
	return badge(_("Non-target / unknown"), 'gray');
}

function observed(value) {
	if (value === true || value === 1 || value === '1') return badge('ON', 'gray');
	if (value === false || value === 0 || value === '0') return badge('OFF', 'gray');
	return badge(_("unknown"), 'gray');
}

function expectedOff(value) {
	return (value === false || value === 0 || value === '0')
		? badge(_("normal"), 'green') : badge(_("Get the gist"), 'red');
}

function valueOrDash(value) {
	return value === undefined || value === null || value === '' ? '-' : String(value);
}

function rawConfigValue(config, draft, key) {
	return draft[key] !== undefined ? draft[key] : (config[key] || '');
}

function staticResolution(config, draft) {
	var oem = config.oem || {};
	var ready = flagEnabled(config.oem_baseline_ready) || flagEnabled(oem.ready);
	var result = { oem: oem, fields: {} };
	[ 'ipaddr', 'netmask', 'gateway', 'dns' ].forEach(function(key) {
		var raw = rawConfigValue(config, draft, key);
		var inherited = ready ? (oem[key] || '') : '';
		var effective = raw || inherited;
		result.fields[key] = {
			raw: raw,
			oem: oem[key] || '',
			effective: effective,
			source: raw ? _("express designation") : (effective ? _("Inheritance of stock settings") : _("Unresolved (no original settings)"))
		};
	});
	return result;
}

function staticPreviewText(config, draft) {
	var resolution = staticResolution(config, draft);
	return [ _("Static IP settings to be applied"),
		_("Static IP:") + valueOrDash(resolution.fields.ipaddr.effective) + '（' + resolution.fields.ipaddr.source + '）',
		_("Netmask:") + valueOrDash(resolution.fields.netmask.effective) + '（' + resolution.fields.netmask.source + '）',
		_("Gateway: ") + valueOrDash(resolution.fields.gateway.effective) + '（' + resolution.fields.gateway.source + '）',
		'DNS: ' + valueOrDash(resolution.fields.dns.effective) + '（' + resolution.fields.dns.source + '）'
	].join('\n');
}

function staticPreviewSection(config, draft, proto) {
	if (proto !== 'static') return '';
	var resolution = staticResolution(config, draft);
	var rows = [
		sbair.row(_("static IP"), valueOrDash(resolution.fields.ipaddr.effective), resolution.fields.ipaddr.source),
		sbair.row(_("netmask"), valueOrDash(resolution.fields.netmask.effective), resolution.fields.netmask.source),
		sbair.row(_("Gateway"), valueOrDash(resolution.fields.gateway.effective), resolution.fields.gateway.source),
		sbair.row(_('DNS'), valueOrDash(resolution.fields.dns.effective), resolution.fields.dns.source)
	];
	return E('div', { 'class': 'sbair-netmode-static-preview', 'style': 'margin-top:1em;font-size:.9em;opacity:.9' }, [
		E('h4', {}, _("Preview of applying static IP")),
		E('p', {}, _("Blank inherits the stock settings. Required items for which a stock setting cannot be obtained will be rejected upon application.")),
		E('p', { 'style': 'margin:.4em 0' }, _("Genuine Settings: Static IP") + valueOrDash(resolution.fields.ipaddr.oem) + _("/ netmask") + valueOrDash(resolution.fields.netmask.oem) + _(" / Gateway ") + valueOrDash(resolution.fields.gateway.oem) + ' / DNS ' + valueOrDash(resolution.fields.dns.oem)),
		sbair.table(rows)
	]);
}

function statusSection(status) {
	var management = status.management || {};
	var dhcp = status.dhcp_server || {};
	var cellular = status.cellular || {};
	var ethernet = status.ethernet_wan || {};
	var managed = status.managed === true || status.managed === 1 || status.managed === '1';
	var ap = managed && status.mode === 'ap';
	var ethwan = managed && status.mode === 'ethwan';
	var vlanwan = managed && status.mode === 'vlanwan';
	var modeText = managed
		? (modeLabel[status.mode] || modeLabel.unmanaged)
		: _("Unmanaged (existing setting)");
	var rows = [
		sbair.row(_("operating mode"), modeText, healthBadge(status)),
		sbair.row(_("Management IP"), valueOrDash(management.address), onOff(management.fallback_active, _("Fallback"), _("DHCP / Fixed"))),
		sbair.row(_("Management IP method"), valueOrDash(management.proto)),
		sbair.row(_("Gateway"), valueOrDash(management.gateway)),
		sbair.row(_('DNS'), valueOrDash(management.dns)),
		sbair.row(_('LAN DHCP server'), dhcp.uci_ignore ? _('deactivate') : _('effectiveness'), managed ? (ap ? expectedOff(dhcp.configured) : onOff(dhcp.configured, _('normal'), _('Get the gist'))) : observed(dhcp.configured)),
		sbair.row(_("default path"), ethwan ? (ethernet.default_route ? _("Wired WAN (eth1)") : _("doesn't exist")) : (vlanwan ? (ethernet.default_route ? _("Ethernet WAN (eth0.3)") : _("doesn't exist")) : (cellular.default_route ? _("Cellular") : valueOrDash(management.gateway))), managed ? (ap ? expectedOff(cellular.default_route) : (ethwan || vlanwan ? onOff(ethernet.default_route, vlanwan ? _("Ethernet WAN") : _("Wired WAN"), _("doesn't exist")) : onOff(cellular.default_route, _("Cellular"), _("doesn't exist")))) : observed(cellular.default_route)),
	];
	if (ethwan) {
		rows.push(sbair.row(_("Wired WAN"), valueOrDash(ethernet.device) + ' / ' + valueOrDash(ethernet.proto), onOff(ethernet.link, _("link connection"), _("Link broken"))));
		rows.push(sbair.row(_("Parent address/default path"), valueOrDash(ethernet.address), onOff(ethernet.default_route, _("active"), _("Not received"))));
		rows.push(sbair.row(_('LAN DHCP'), dhcp.uci_ignore ? _("Off") : _("On"), onOff(dhcp.configured, _("normal"), _("Confirmation required"))));
	}
	if (vlanwan) {
		rows.push(sbair.row(_("Ethernet WAN"), valueOrDash(ethernet.device) + ' / ' + valueOrDash(ethernet.proto), onOff(ethernet.link, _("link connection"), _("Link broken"))));
		rows.push(sbair.row(_("Ethernet WAN address/default path"), valueOrDash(ethernet.address), onOff(ethernet.default_route, _("active"), _("Not received"))));
		rows.push(sbair.row(_("Cellular WAN"), valueOrDash(cellular.interface), onOff(cellular.default_route, _("default route active"), _("not the default route"))));
	}

	if (management.fallback_conflict)
		rows.push(sbair.row(_("Fallback"), valueOrDash(status.management.fallback_ip), badge(_("Competitive / non-granted"), 'yellow')));
	if (status.repair)
		rows.push(sbair.row(_("Last correction/count"), valueOrDash(status.repair.last) + ' / ' + valueOrDash(status.repair.count)));
	return sbair.section(_("current status"), [ sbair.table(rows) ]);
}

function warningSection(warnings) {
	if (!warnings || !warnings.length) return '';
	return E('div', { 'class': 'cbi-section sbair-section' }, [
		E('h3', {}, _("warning")),
		E('ul', {}, warnings.map(function(w) { return E('li', {}, w); }))
	]);
}

function inputRow(label, input, help) {
	return E('tr', { 'class': 'tr' }, [
		E('td', { 'class': 'td left', 'width': '35%' }, label),
		E('td', { 'class': 'td left' }, [ input, help ? E('p', { 'style': 'opacity:.7;margin:.3em 0 0' }, help) : '' ])
	]);
}

function textInput(value, disabled, onChange) {
	return E('input', {
		'class': 'cbi-input-text', 'type': 'text', 'value': valueOrDash(value) === '-' ? '' : valueOrDash(value),
		'disabled': disabled ? '' : null,
		'change': function(ev) { onChange(ev.target.value); }
	});
}

function unmanagedConfigSection(config) {
	var range = config.dhcp_start_ip && config.dhcp_end_ip
		? config.dhcp_start_ip + ' ～ ' + config.dhcp_end_ip
		: _("Cannot be calculated in existing settings.");
	return sbair.section(_("Existing settings (unmanaged)"), [ sbair.table([
		sbair.row(_("management status"), _("Unmanaged (keep existing settings)")),
		sbair.row(_("Current DHCP scope (observation)"), range),
		sbair.row(_("DHCP lease time (observed)"), valueOrDash(config.dhcp_leasetime)),
		sbair.row(_("SIM applicable LAN"), valueOrDash(config.sim_network) + ' / ' + valueOrDash(config.sim_netmask))
	]) , E('p', { 'class': 'alert-message notice' },
		_("sbair does not auto-calibrate network, DHCP, or Wi-Fi. To change it, select AP/Bridge and apply it explicitly.")) ]);
}

function configSection(config, draft, selectedMode, onChange) {
	if (selectedMode === 'unmanaged') return unmanagedConfigSection(config);
	if (selectedMode === 'sim') return sbair.section(modeLabel.sim, [
		E('p', {}, _("Restore the sbair-managed stock cellular router profile: keep the SIM/ccmni WAN and private LAN with DHCP. This applies the saved SIM profile, or the documented factory LAN defaults if no managed profile exists.")),
		E('p', { 'class': 'alert-message notice' }, _("This restores the stock cellular-uplink configuration; it does not enable Ethernet WAN or modify modem firmware."))
	]);
	if (selectedMode === 'ethwan') return sbair.section(_("Wired WAN router mode"), [
		E('p', {}, _("The upper address is received via DHCP from the dedicated Ethernet interface eth1. LAN/Wi-Fi maintains current private addresses and DHCP ranges, and uses existing LAN→WAN NAT/firewall policies.")),
		E('div', { 'class': 'alert-message warning' }, _("First check which physical jack is connected to eth1 on your device. If you connect a higher-level network to the LAN jack, DHCP servers may compete with each other. This mode replaces modem WAN and does not tie you into a dual WAN with cellular.")),
		sbair.table([
			sbair.row(_("WAN interface"), 'eth1'),
			sbair.row(_("WAN address"), _("Obtain DHCP automatically")),
			sbair.row(_('LAN/Wi-Fi'), _("Keep current br-lan, private address, DHCP")),
			sbair.row(_("return"), _("Restore saved WAN interface settings when switching to modem router mode"))
		])
	]);
	if (selectedMode === 'vlanwan') return sbair.section(_("Air 6 VLAN 3 WAN mode"), [
		E('p', {}, _("This project mode creates switch0 VLAN 3 instead of trying to reuse eth0.1. The recorded topology moves external switch port 1 out of VLAN 1 and adds it untagged to VLAN 3, with CPU port 5 tagged; this creates eth0.3.")),
		E('p', {}, _("A separate network.ethernetwan DHCP client uses eth0.3. The existing cellular network.wan on ccmni remains configured, unlike Floop3 ethwan, which repoints network.wan to eth1 and replaces cellular as the upstream.")),
		E('p', {}, _("LAN br-lan, private addressing, and its DHCP server remain in place. Ethernet WAN is added to the existing WAN firewall/NAT zone; incoming WAN traffic remains subject to that zone's input policy.")),
		E('p', {}, _("Both Ethernet and cellular interfaces may advertise a default route. This mode preserves the cellular interface but does not configure route preference or automatic failover; verify the active default route before confirming.")),
		E('div', { 'class': 'alert-message warning' }, _("This follows the saved device record for switch port 1 and VID 3. It does not infer another physical jack mapping. Safe Apply rolls the UCI state back after 120 seconds unless confirmed; it cannot guarantee recovery from a switch configuration failure, so keep UART available."))
	]);
	var apDhcpEnabled = flagEnabled(config.ap_dhcp_enabled);
	var proto = draft.proto !== undefined ? draft.proto : (config.proto || (apDhcpEnabled ? 'dhcp' : 'static'));
	if (!apDhcpEnabled) proto = 'static';
	var fallbackEnabled = draft.fallback_enabled !== undefined ? draft.fallback_enabled : !!config.fallback_enabled;
	var staticDisabled = proto !== 'static';
	var fallbackDisabled = proto !== 'dhcp';
	var staticIp = rawConfigValue(config, draft, 'ipaddr');
	var staticNetmask = rawConfigValue(config, draft, 'netmask');
	var radio = function(value, label) {
		return E('label', { 'style': 'display:block;margin:.35em 0' }, [
			E('input', {
				'type': 'radio', 'name': 'sbair-management-proto', 'value': value,
				'checked': proto === value ? '' : null,
				'change': function() { onChange('proto', value); }
			}), ' ' + label
		]);
	};
	var fallback = E('label', {}, [
		E('input', {
			'type': 'checkbox', 'checked': fallbackEnabled ? '' : null,
			'disabled': fallbackDisabled ? '' : null,
			'change': function(ev) { onChange('fallback_enabled', ev.target.checked); }
		}), _("Use fallback when DHCP acquisition is not possible")
	]);
	var rows = [
		inputRow(_("Management IP method"), E('div', {}, apDhcpEnabled
			? [ radio('dhcp', _("Automatic acquisition from upstream router (DHCP)")), radio('static', _("static IP")) ]
			: [ radio('static', _("Static IP (DHCP client disabled with safe flag)")) ])),
		inputRow(_("static IP"), textInput(staticIp, staticDisabled,
			function(v) { onChange('ipaddr', v); }), _("If left blank, the static IP of the factory settings will be inherited.")),
		inputRow(_("netmask"), textInput(staticNetmask, staticDisabled,
			function(v) { onChange('netmask', v); }), _("If left blank, the netmask of the factory settings will be inherited.")),
		inputRow(_("Gateway"), textInput(draft.gateway !== undefined ? draft.gateway : config.gateway, staticDisabled,
			function(v) { onChange('gateway', v); }), _("If left blank, the factory settings will be inherited. If there is no setting on the factory side, it will not be set.")),
		inputRow('DNS', textInput(draft.dns !== undefined ? draft.dns : config.dns, staticDisabled,
			function(v) { onChange('dns', v); }), _("If left blank, the factory settings will be inherited. If there is no setting on the factory side, it will not be set."))
	];
	if (apDhcpEnabled) rows.push(
		inputRow(_("Fallback"), fallback, _("Granted only in case of DHCP failure. Conflict check in ARP probe")),
		inputRow(_("Fallback IP"), textInput(draft.fallback_ip !== undefined ? draft.fallback_ip : config.fallback_ip, fallbackDisabled,
			function(v) { onChange('fallback_ip', v); })),
		inputRow(_("Fallback Netmask"), textInput(draft.fallback_netmask !== undefined ? draft.fallback_netmask : config.fallback_netmask, fallbackDisabled,
			function(v) { onChange('fallback_netmask', v); })),
		inputRow(_("waiting"), E('input', {
			'class': 'cbi-input-text', 'type': 'number', 'min': '5', 'max': '3600',
			'value': valueOrDash(draft.fallback_timeout !== undefined ? draft.fallback_timeout : config.fallback_timeout),
			'disabled': fallbackDisabled ? '' : null,
			'change': function(ev) { onChange('fallback_timeout', parseInt(ev.target.value, 10) || 0); }
		}), _("candle"))
	);
	rows.push(
		inputRow('DHCP / IPv6', _("In AP mode, DHCP, RA, DHCPv6, and NDP on Air 6 are stopped. It does not block IPv6 coming from upstream.")),
		inputRow(_("Cellular WAN"), _("In AP mode, it is not used for routing. The modem itself does not stop."))
	);
	return sbair.section(_("AP/Bridge settings"), [
		E('div', { 'class': 'alert-message warning' }, [
			E('strong', {}, _("⚠ Setting up a DHCP client is very high risk")),
			E('p', {}, _("What we cover here is setting up a DHCP client where the Air 6 itself obtains a management IP from the upstream router. Failure to switch or apply will result in loss of all network connectivity and may require UART recovery by soft bricking.")),
			E('p', {}, _("If you cannot secure a recovery method such as UART, do not select or apply DHCP. Safe Apply's automatic rollback feature does not guarantee recovery from all configuration failures."))
		]),
		!apDhcpEnabled ? E('p', { 'class': 'alert-message notice' },
			_("DHCP clients in AP mode are disabled with the safe flag. Applies only to static IP.")) : '',
		sbair.table(rows),
		staticPreviewSection(config, draft, proto)
	]);
}

function modeSection(status, config, draft, selectedMode, detailsOpen, setMode, onChange, setDetailsOpen) {
	var managed = status.managed === true || status.managed === 1 || status.managed === '1';
	var pending = !!status.pending;
	var modeControls = [
		managed && selectedMode !== 'unmanaged'
			? E('p', {}, _("Transitions reorganize networks. The AP/Bridge switches to the set management IP."))
			: E('div', { 'class': 'alert-message notice' }, [
				E('strong', {}, _("Unmanaged (existing setting)")),
				E('p', {}, managed
					? _("Selecting and applying will only turn off sbair management, keeping your current network settings.")
					: _("Retaining your current network settings. AP/Bridge will not change until explicitly applied."))
			]),
		E('label', { 'style': 'display:block;margin:.4em 0' }, [
			E('input', { 'type': 'radio', 'name': 'sbair-mode', 'value': 'unmanaged',
				'checked': selectedMode === 'unmanaged' ? '' : null, 'disabled': pending ? '' : null,
				'change': function() { setMode('unmanaged'); } }), _("Default (uncontrolled) — accept current settings")
		]),
		E('label', { 'style': 'display:block;margin:.4em 0' }, [
			E('input', { 'type': 'radio', 'name': 'sbair-mode', 'value': 'sim',
				'checked': selectedMode === 'sim' ? '' : null, 'disabled': pending ? '' : null,
				'change': function() { setMode('sim'); } }), modeLabel.sim + ' — ' + _("restore SIM/ccmni router profile")
		]),
		E('label', { 'style': 'display:block;margin:.4em 0' }, [
			E('input', { 'type': 'radio', 'name': 'sbair-mode', 'value': 'ap', 'checked': selectedMode === 'ap' ? '' : null,
				'disabled': pending ? '' : null,
				'change': function() { setMode('ap'); } }), _("AP/Bridge — connects br-lan to the upstream network")
		]),
		E('label', { 'style': 'display:block;margin:.4em 0' }, [
			E('input', { 'type': 'radio', 'name': 'sbair-mode', 'value': 'ethwan', 'checked': selectedMode === 'ethwan' ? '' : null,
				'disabled': pending ? '' : null,
				'change': function() { setMode('ethwan'); } }), _("Floop3 ethwan — DHCP on eth1; uses network.wan and replaces cellular uplink")
		]),
		E('label', { 'style': 'display:block;margin:.4em 0' }, [
			E('input', { 'type': 'radio', 'name': 'sbair-mode', 'value': 'vlanwan', 'checked': selectedMode === 'vlanwan' ? '' : null,
				'disabled': pending ? '' : null,
				'change': function() { setMode('vlanwan'); } }), _("Our VLAN WAN — create eth0.3 (VID 3), keep cellular wan")
		])
	];
	return sbair.section(_("connection mode"), [
		sbair.softBrickWarning('netmode'),
		E('details', { 'class': 'sbair-netmode-advanced', 'open': detailsOpen ? '' : null,
			'toggle': function(ev) { setDetailsOpen(ev.target.open); } }, [
			E('summary', {}, _("Mode selection and detailed settings (currently:") + displayModeLabel(selectedMode) + '）'),
			E('div', {}, modeControls),
			configSection(config, draft, selectedMode, onChange)
		])
	]);
}

function pendingSection(pending, onConfirm, onRollback) {
	if (!pending) return '';
	return E('div', { 'class': 'cbi-section sbair-section' }, [
		E('h3', {}, _("Wait for confirmation Change network")),
		E('p', {}, displayModeLabel(pending.mode) + _("has been applied. The remaining") + valueOrDash(pending.remaining) + _("Check manually within seconds.")),
		E('button', { 'class': 'cbi-button cbi-button-positive', 'click': onConfirm }, _("Check these settings")),
		' ',
		E('button', { 'class': 'cbi-button cbi-button-negative', 'click': onRollback }, _("rollback"))
	]);
}

function page(data, draft, selectedMode, detailsOpen, handlers) {
	var status = data.status || {};
	var config = data.config || {};
	var managed = status.managed === true || status.managed === 1 || status.managed === '1';
	var pending = !!status.pending;
	if (status.error || config.error)
		return sbair.errorBox([ status.error || config.error ]);
	return [
		statusSection(status),
		warningSection(status.warnings),
		pendingSection(status.pending, handlers.confirm, handlers.rollback),
		modeSection(status, config, draft, selectedMode, detailsOpen, handlers.setMode, handlers.change, handlers.setDetailsOpen),
		E('div', { 'style': 'margin-bottom:1em' }, [
				E('button', { 'class': 'cbi-button cbi-button-action', 'click': handlers.apply,
					'disabled': (pending || (selectedMode === 'unmanaged' && !managed)) ? '' : null },
				selectedMode === 'unmanaged' && managed ? _("unmanage") : _("Apply changes")), ' ',
			E('button', { 'class': 'cbi-button cbi-button-neutral', 'click': handlers.repair,
				'disabled': pending || !managed || selectedMode === 'unmanaged' ? '' : null }, _("condition correction")), ' ',
			E('button', { 'class': 'cbi-button cbi-button-neutral', 'click': handlers.reload }, _("reload"))
		]),
		E('p', { 'style': 'opacity:.7' }, _("Wi-Fi settings will not be changed on this screen. Also maintain the vendor alias 172.16.255.254 (network.lan1)."))
	];
}

return view.extend({
	load: function() {
		return Promise.all([ callStatus(), callGetConfig() ]).then(function(values) {
			return { status: values[0], config: values[1] };
		}).catch(function(err) {
			return { status: { error: sbair.errorText(err) }, config: {} };
		});
	},

	render: function(data) {
		var self = this;
		self.data = data;
		self.draft = {};
		self.selectedMode = effectiveMode(data.status || {});
		self.detailsOpen = false;
		var container = E('div', {});

		function redraw() {
			dom.content(container, page(self.data, self.draft, self.selectedMode, self.detailsOpen, {
				setMode: function(mode) { self.selectedMode = mode; redraw(); },
				change: function(key, value) { self.draft[key] = value; redraw(); },
				setDetailsOpen: function(open) { self.detailsOpen = open; },
				reload: reload,
				repair: repair,
				apply: apply,
				confirm: confirmChange,
				rollback: rollbackChange
			}));
			if (self.data.status && self.data.status.pending && !pollTimer)
				pollTimer = setTimeout(function() { pollTimer = null; reload(); }, 2000);
		}

		function reload() {
			return Promise.all([ callStatus(), callGetConfig() ]).then(function(values) {
				self.data = { status: values[0], config: values[1] };
				self.draft = {};
				if (self.data.status.pending)
					self.selectedMode = self.data.status.pending.mode || self.selectedMode;
				else
					self.selectedMode = effectiveMode(self.data.status);
				redraw();
			}).catch(function(err) {
				ui.addNotification(null, E('p', {}, sbair.errorText(err)), 'warning');
			});
		}

		function apply() {
			var c = self.data.config || {};
			var d = self.draft;
			var status = self.data.status || {};
			var managed = status.managed === true || status.managed === 1 || status.managed === '1';
			if (self.selectedMode === 'unmanaged') {
				if (!managed) return;
				if (!confirm(_("Only disables sbair management while maintaining current network settings.\n\nEven with this transition, there is a risk of losing the management path and soft bricking it, requiring a UART for recovery. Do you want to continue?")))
					return;
				callUnmanage().then(function(res) {
					if (res && res.error) throw new Error(res.error);
					ui.addNotification(null, E('p', {}, _("Management of sbair has been cancelled. Network settings have not changed.")), 'info');
					return reload();
				}).catch(function(err) { ui.addNotification(null, E('p', {}, sbair.errorText(err)), 'danger'); });
				return;
			}
			var apDhcpEnabled = flagEnabled(c.ap_dhcp_enabled);
			var proto = d.proto !== undefined ? d.proto : (c.proto || (apDhcpEnabled ? 'dhcp' : 'static'));
			var ipaddr = rawConfigValue(c, d, 'ipaddr');
			var netmask = rawConfigValue(c, d, 'netmask');
			var gateway = d.gateway !== undefined ? d.gateway : (c.gateway || '');
			var dns = d.dns !== undefined ? d.dns : (c.dns || '');
			if (self.selectedMode === 'ap' && !apDhcpEnabled) proto = 'static';
			var confirmation = (modeLabel[self.selectedMode] || self.selectedMode) + _(" will be switched. ") +
				_("If you do not confirm within 120 seconds, we will roll back to your previous network settings.");
			if (self.selectedMode === 'ethwan')
				confirmation += _("\nUse eth1 as WAN and request DHCP. Use a wired WAN instead of a cellular WAN. Check the physical jack connected to eth1 and the current LAN DHCP status.");
			else if (self.selectedMode === 'vlanwan')
				confirmation += _("\nEnsure recorded switch port 1 is untagged in VLAN 3 and absent from VLAN 1, create eth0.3, and run DHCP on a separate ethernetwan interface. Cellular network.wan remains unchanged.");
			else
				confirmation += _("If network access is lost, UART recovery may be required.");
			if (self.selectedMode === 'ap' && proto === 'static') confirmation += '\n\n' + staticPreviewText(c, d);
			if (!confirm(confirmation + _('Continue?')))
				return;
			callApply(
				self.selectedMode,
				proto,
				ipaddr,
				netmask,
				gateway,
				dns,
				d.fallback_enabled !== undefined ? d.fallback_enabled : !!c.fallback_enabled,
				d.fallback_ip !== undefined ? d.fallback_ip : (c.fallback_ip || ''),
				d.fallback_netmask !== undefined ? d.fallback_netmask : (c.fallback_netmask || '255.255.255.0'),
				d.fallback_timeout !== undefined ? d.fallback_timeout : (c.fallback_timeout || 15),
				'',
				'',
				''
			).then(function(res) {
				if (res && res.error) throw new Error(res.error);
				ui.addNotification(null, E('p', {}, _("Started applying. Check the status of the actual machine and automatically check if there are no problems.")), 'info');
				return reload();
			}).catch(function(err) {
				ui.addNotification(null, E('p', {}, sbair.errorText(err)), 'danger');
			});
		}

		function confirmChange() {
			callConfirm().then(function(res) {
				if (res && res.error) throw new Error(res.error);
				ui.addNotification(null, E('p', {}, _("The settings have been confirmed.")), 'info');
				return reload();
			}).catch(function(err) { ui.addNotification(null, E('p', {}, sbair.errorText(err)), 'danger'); });
		}

		function rollbackChange() {
			if (!confirm(_("Cancel pending changes and revert to previous settings?"))) return;
			callRollback().then(function(res) {
				if (res && res.error) throw new Error(res.error);
				return reload();
			}).catch(function(err) { ui.addNotification(null, E('p', {}, sbair.errorText(err)), 'danger'); });
		}

		function repair() {
			callRepair().then(function(res) {
				if (res && res.error) throw new Error(res.error);
				ui.addNotification(null, E('p', {}, _("DHCP/route status was checked and corrected.")), 'info');
				return reload();
			}).catch(function(err) { ui.addNotification(null, E('p', {}, sbair.errorText(err)), 'danger'); });
		}

		redraw();
		return E('div', { 'class': 'cbi-map' }, [ container ]);
	},

	handleSave: null,
	handleSaveApply: null,
	handleReset: null
});
