// SPDX-License-Identifier: MIT
// Copyright (c) 2026 syado
//
// Wi-Fi の追加機能(Phase 3、2026-08-10)。`docs/KNSH_COMMAND_AUDIT.md` §6の
// 逆アセンブル調査と純正UI PHPソースの読み込みで裏取りした`knsh`コマンドを
// 画面化したもの。バックエンドはsbair-modemの`wifi_advanced.go`。
//
// ここのトグルはWi-Fi全体ON/OFFを除きどれもWi-Fi自体を切断しない
// (ドライバ再読み込みが不要)ため、wifi.jsのような「まとめて適用」方式ではなく
// 各項目をその場で反映する単純な作りにしている。

'use strict';

'require view';
'require rpc';
'require ui';
'require dom';
'require tools.sbair as sbair';
'require tools.sbair-i18n as i18n';

var _ = i18n.translate;

function translateWifiError(message) {
	if (String(message).indexOf('pending UCI settings exist') !== -1)
		return _('Pending wireless changes exist. Save or discard them before changing settings.');
	return sbair.errorText(message);
}

var callWifiEnabledStatus = rpc.declare({ object: 'sbair', method: 'wifi_enabled_status' });
var callWifiEnabledSet = rpc.declare({ object: 'sbair', method: 'wifi_enabled_set', params: [ 'enabled' ] });
var callBandsteeringStatus = rpc.declare({ object: 'sbair', method: 'bandsteering_status' });
var callBandsteeringSet = rpc.declare({ object: 'sbair', method: 'bandsteering_set', params: [ 'enabled' ] });
var callMloStatus = rpc.declare({ object: 'sbair', method: 'mlo_status' });
var callMloSet = rpc.declare({ object: 'sbair', method: 'mlo_set', params: [ 'enabled' ] });
var callMeshStatus = rpc.declare({ object: 'sbair', method: 'mesh_status' });
var callMeshSet = rpc.declare({ object: 'sbair', method: 'mesh_set', params: [ 'enabled' ] });
var callIsolationStatus = rpc.declare({ object: 'sbair', method: 'isolation_status' });
var callIsolationSet = rpc.declare({ object: 'sbair', method: 'isolation_set', params: [ 'kind', 'enabled' ] });
var call11rStatus = rpc.declare({ object: 'sbair', method: 'wifi_11r_status' });
var call11rSet = rpc.declare({ object: 'sbair', method: 'wifi_11r_set', params: [ 'enabled' ] });
var callMacfilterStatus = rpc.declare({ object: 'sbair', method: 'macfilter_status' });
var callMacfilterModeSet = rpc.declare({ object: 'sbair', method: 'macfilter_mode_set', params: [ 'enabled' ] });
var callMacfilterAdd = rpc.declare({ object: 'sbair', method: 'macfilter_add', params: [ 'mac', 'enabled' ] });
var callMacfilterDelete = rpc.declare({ object: 'sbair', method: 'macfilter_delete', params: [ 'mac' ] });
var callWpsStatus = rpc.declare({ object: 'sbair', method: 'wps_status' });
var callWpsRun = rpc.declare({ object: 'sbair', method: 'wps_run', params: [ 'band', 'mode', 'pin' ] });
var callWpsPinRandom = rpc.declare({ object: 'sbair', method: 'wps_pin_random' });
var callWpsReset = rpc.declare({ object: 'sbair', method: 'wps_reset', params: [ 'band' ] });
var callWifiTxPowerMax = rpc.declare({ object: 'sbair', method: 'wifi_txpower_max' });
var callWifiTxPowerDefault = rpc.declare({ object: 'sbair', method: 'wifi_txpower_default' });
var callReboot = rpc.declare({ object: 'sbair', method: 'system_reboot' });

function loadAll() {
	return Promise.all([
		callWifiEnabledStatus().catch(function(e) { return { error: String(e) }; }),
		callBandsteeringStatus().catch(function(e) { return { error: String(e) }; }),
		callMloStatus().catch(function(e) { return { error: String(e) }; }),
		callMeshStatus().catch(function(e) { return { error: String(e) }; }),
		callIsolationStatus().catch(function(e) { return { error: String(e) }; }),
		call11rStatus().catch(function(e) { return { error: String(e) }; }),
		callMacfilterStatus().catch(function(e) { return { error: String(e) }; }),
		callWpsStatus().catch(function(e) { return { error: String(e) }; })
	]).then(function(r) {
		return { enabled: r[0], bandsteering: r[1], mlo: r[2], mesh: r[3], isolation: r[4], dot11r: r[5], macfilter: r[6], wps: r[7] };
	});
}

function manualRebootBox(onReboot) {
	return E('div', { 'style': 'margin:.5em 0;opacity:.8' }, [
		E('span', {}, _('Wi-Fi changes apply differently by setting. Restarting Wi-Fi or the device does not guarantee that band steering SSID changes are saved and active.')),
		' ',
		E('span', {}, _('Check the saved state first. If needed:')),
		E('button', {
			'class': 'cbi-button cbi-button-neutral',
			'style': 'margin-left:.3em',
			'click': onReboot
		}, _('Reboot device'))
	]);
}

function txPowerBox(onMax, onDefault) {
	return E('div', { 'class': 'alert-message notice', 'style': 'margin:.5em 0' }, [
		E('div', {}, _('Wireless power can be set to the maximum scale (100) supported by this SBA6D firmware. This is not a dBm value and does not change the country/region or regulatory table.')),
		E('div', { 'class': 'sbair-button-group', 'style': 'margin-top:.5em' }, [
			E('button', { 'class': 'cbi-button cbi-button-positive', 'click': onMax }, _('Set firmware maximum power')),
			E('button', { 'class': 'cbi-button cbi-button-neutral', 'click': onDefault }, _('Restore default power'))
		])
	]);
}

function details(title, children, key, open) {
	return E('details', {
		'data-sbair-details-key': key,
		'open': open ? '' : null
	}, [
		E('summary', {}, title),
		E('div', {}, children)
	]);
}

// switchRow はラベル + トグルスイッチ + 説明文の1行。onChangeはチェック状態(bool)を渡す。
function switchRow(label, desc, checked, onChange, confirmMsg, disabled) {
	var input = E('input', {
		'type': 'checkbox', 'class': 'cbi-input-checkbox',
		'checked': checked ? '' : null,
		'disabled': disabled ? '' : null
	});
	input.addEventListener('change', function() {
		if (confirmMsg && !confirm(confirmMsg)) {
			input.checked = !input.checked;
			return;
		}
		onChange(input.checked);
	});
	return E('div', { 'class': 'cbi-value' }, [
		E('label', { 'class': 'cbi-value-title' }, label),
		E('div', { 'class': 'cbi-value-field' }, [
			input,
			desc ? E('div', { 'style': 'opacity:.7;font-size:.9em;margin-top:.3em' }, desc) : ''
		])
	]);
}

function macFilterTable(list, onDelete) {
	if (!list || !list.length)
		return E('p', { 'style': 'opacity:.7' }, _('No MAC addresses registered.'));
	var rows = [ E('tr', { 'class': 'tr table-titles' }, [
		E('th', { 'class': 'th' }, _('MAC address')),
		E('th', { 'class': 'th' }, _('Status')),
		E('th', { 'class': 'th' }, '')
	]) ];
	list.forEach(function(e) {
		rows.push(E('tr', { 'class': 'tr' }, [
			E('td', { 'class': 'td left' }, e.mac),
			E('td', { 'class': 'td left' }, e.enabled ? _('Enabled') : _('Disabled')),
			E('td', { 'class': 'td left' }, [
				E('button', {
					'class': 'cbi-button cbi-button-remove',
					'click': function() { onDelete(e.mac); }
				}, _('Delete'))
			])
		]));
	});
	return sbair.table(rows);
}

function render(data, opts) {
	data = data || {};
	opts = opts || {};
	var body = [];
	var detailsState = opts.detailsState || {};

	body.push(sbair.softBrickWarning('wifi'));
	body.push(sbair.errorBox([data.enabled, data.bandsteering, data.mlo, data.mesh, data.isolation, data.dot11r, data.macfilter, data.wps]
		.map(function(d) { return d && d.error; }).filter(Boolean)));

	body.push(sbair.section(_('Wi-Fi overall'), [
		switchRow(_('Wi-Fi radio'),
			_('Disables all 2.4/5/6 GHz SSIDs. Wired LAN and SSH remain available.'),
			data.enabled && data.enabled.enabled, opts.onEnabledChange,
			_('This will turn off all Wi-Fi radios. Wired LAN is unaffected. Continue?'))
	]));
	body.push(sbair.section(_('Wireless power'), [ txPowerBox(opts.onMaxPower, opts.onDefaultPower) ]));
	body.push(sbair.section(_('Band steering'), [
		switchRow(_('Band steering'),
			_('Changing this may alter SSID settings. Check saved settings and actual broadcasts in Wi-Fi diagnostics.'),
			data.bandsteering && data.bandsteering.enabled, opts.onBandsteeringChange,
			_('Change and save band steering. Turning it off also turns off MLO. A device reboot may be required. Continue?'))
	]));

	var steeringOn = !!(data.bandsteering && data.bandsteering.enabled);
	body.push(details(_('Wi-Fi 7 / Mesh'), [
		sbair.section(_('Multi-Link Operation (MLO)'), [
			switchRow(_('MLO'), _('Connects Wi-Fi 7 capable clients across multiple bands. Older WPA clients may fail to connect; stock firmware changes security settings when this is enabled.'),
				data.mlo && data.mlo.enabled, opts.onMloChange,
				_('Enabling MLO requires band steering to be enabled. Older clients may lose access. Continue?'), !steeringOn),
			steeringOn ? E('p', { 'style': 'opacity:.7' }, _('Stock constraint: turn on band steering first; MLO is locked while it is off.')) : ''
		]),
		sbair.section(_('SoftBank Mesh'), [
			switchRow(_('Mesh mode'), _('Requires a compatible SoftBank mesh node. Stock firmware may re-enable radios, change security modes, and reveal SSIDs when mesh is enabled.'),
				data.mesh && data.mesh.enabled, opts.onMeshChange,
				data.mesh && data.mesh.enabled ? _('Turning mesh off unpairs mesh nodes. Pair them again if you enable it later. Stock firmware may also disable WPS under its existing WPS/filter conditions. Continue?') : _('Turning mesh on may change radio, encryption, and SSID visibility settings. A compatible SoftBank mesh node is required. Continue?'))
		])
	], 'wifi7mesh', detailsState.wifi7mesh));

	var iso = data.isolation || {};
	body.push(sbair.section(_('Client isolation'), [
		switchRow(_('Main SSID access to wired LAN'),
			_('When off, clients on the main SSID (SSID1) cannot reach wired LAN devices. This applies only to SSID1; guest SSID2 is unaffected. This app separately maintains wired access for SSID2.'),
			iso.wlan2lan, function(v) { opts.onIsolationChange('wlan2lan', v); }),
		switchRow(_('Communication between main SSID bands'),
			_('When off, main SSIDs on 2.4, 5, and 6 GHz cannot communicate with each other.'),
			iso.intercommunication, function(v) { opts.onIsolationChange('intercommunication', v); }),
		switchRow(_('Communication between main and guest SSIDs'),
			_('When off, clients on the main SSID (SSID1) cannot communicate with guest SSID (SSID2) clients. This is guest network isolation.'),
			iso.ssid1to2, function(v) { opts.onIsolationChange('ssid1to2', v); })
	]));

	body.push(sbair.section(_('Fast roaming (802.11r)'), [
		switchRow('802.11r',
			_('Fast roaming for networks with multiple access points. It has little benefit with a single AP and applies to all SSIDs.'),
			data.dot11r && data.dot11r.enabled, opts.on11rChange)
	]));

	var mf = data.macfilter || {};
	var macFilterSection = sbair.section(_('MAC filter (allowlist)'), [
		switchRow(_('Enable filter'),
			_('Only enabled devices in this list can connect. If you enable the filter with an empty list, no device will be able to connect.'),
			mf.enabled, opts.onMacfilterModeChange,
			_('Enable the MAC allowlist. Devices not in the list will be blocked. Continue?')),
		macFilterTable(mf.list, opts.onMacfilterDelete),
		E('div', { 'style': 'display:flex;gap:.5em;align-items:center;margin-top:.5em' }, [
			opts.macInput,
			E('button', { 'class': 'cbi-button cbi-button-positive', 'click': opts.onMacfilterAdd }, _('Add'))
		])
	]);
	body.push(details(_('MAC filter (allowlist)'), [ macFilterSection ], 'macfilter', detailsState.macfilter));

	var wps = data.wps || {};
	var wpsSection = sbair.section(_('WPS'), [
		E('p', { 'style': 'opacity:.7' }, _('Push-button (PBC) mode temporarily allows anyone nearby to join the Wi-Fi network.')),
		E('p', {}, _('Current PIN: ') + (wps.pin || '-')),
		E('div', { 'class': 'sbair-button-group' }, [
			E('button', { 'class': 'cbi-button cbi-button-action', 'click': function() { opts.onWpsRun('2.4G', 'pbc'); } }, _('Start 2.4 GHz PBC')),
			E('button', { 'class': 'cbi-button cbi-button-action', 'click': function() { opts.onWpsRun('5G', 'pbc'); } }, _('Start 5 GHz PBC')),
			E('button', { 'class': 'cbi-button cbi-button-neutral', 'click': opts.onWpsPinRandom }, _('Generate new PIN')),
			E('button', { 'class': 'cbi-button cbi-button-reset', 'click': function() { opts.onWpsReset('2.4G'); } }, _('Reset 2.4 GHz WPS')),
			E('button', { 'class': 'cbi-button cbi-button-reset', 'click': function() { opts.onWpsReset('5G'); } }, _('Reset 5 GHz WPS'))
		])
	]);
	body.push(details('WPS', [ wpsSection ], 'wps', detailsState.wps));
	body.push(details(_('Troubleshooting'), [
		sbair.section(_('Device reboot'), [ manualRebootBox(opts.onReboot) ])
	], 'troubleshooting', detailsState.troubleshooting));

	return body;
}

return view.extend({
	load: function() {
		return loadAll();
	},

	render: function(data) {
		var self = this;
		self.data = data;

		var container = E('div', {});
		var macInput = E('input', { 'class': 'cbi-input-text', 'type': 'text', 'placeholder': 'AA:BB:CC:DD:EE:FF' });
		var detailsState = {};

		function captureDetails() {
			var nodes = container.querySelectorAll ? container.querySelectorAll('details[data-sbair-details-key]') : [];
			Array.prototype.forEach.call(nodes, function(node) {
				detailsState[node.getAttribute('data-sbair-details-key')] = !!node.open;
			});
		}

		var redraw = function() {
			captureDetails();
			dom.content(container, render(self.data, {
				macInput: macInput,
				detailsState: detailsState,
				onEnabledChange: function(v) {
					callWifiEnabledSet(v ? '1' : '0').then(reportAndReload);
				},
				onBandsteeringChange: function(v) {
					ui.addNotification(null, E('p', {}, _('Changing band steering setting...')), 'info');
					callBandsteeringSet(v ? '1' : '0').then(function(res) {
						if (res && res.error) return reportAndReload(res);
						ui.addNotification(null, E('p', {}, _('Settings saved. After reboot, check actual Wi-Fi broadcasts in diagnostics. Runtime broadcasts have not yet been verified.')), 'warning');
						return reload();
					}).catch(function(err) { ui.addNotification(null, E('p', {}, _('Settings request failed: ') + sbair.errorText(err)), 'danger'); return reload(); });
				},
				onMloChange: function(v) {
					callMloSet(v ? '1' : '0').then(reportAndReload);
				},
				onMeshChange: function(v) {
					callMeshSet(v ? '1' : '0').then(reportAndReload);
				},
				onIsolationChange: function(kind, v) {
					callIsolationSet(kind, v ? '1' : '0').then(reportAndReload);
				},
				on11rChange: function(v) {
					call11rSet(v ? '1' : '0').then(reportAndReload);
				},
				onMacfilterModeChange: function(v) {
					callMacfilterModeSet(v ? '1' : '0').then(reportAndReload);
				},
				onMacfilterAdd: function() {
					var mac = macInput.value.trim();
					if (!mac) return;
					callMacfilterAdd(mac, '1').then(function(res) {
						macInput.value = '';
						reportAndReload(res);
					});
				},
				onMacfilterDelete: function(mac) {
					callMacfilterDelete(mac).then(reportAndReload);
				},
				onWpsRun: function(band, mode) {
					var label = (band === '2.4G' ? '2.4GHz' : '5GHz');
					if (!confirm(_('Start WPS push-button setup on ') + label + _('? Nearby devices can join for a limited time. Continue?')))
						return;
					callWpsRun(band, mode, '').then(reportAndReload);
				},
				onWpsPinRandom: function() {
					callWpsPinRandom().then(reportAndReload);
				},
				onWpsReset: function(band) {
					if (!confirm(_('Reset WPS state for ') + (band === '2.4G' ? '2.4 GHz' : '5 GHz') + _('? Continue?')))
						return;
					callWpsReset(band).then(reportAndReload);
				},
				onMaxPower: setMaxPower,
				onDefaultPower: setDefaultPower,
				onReboot: doReboot
			}));
		};

		var reload = function() {
			return loadAll().then(function(res) {
				self.data = res;
				redraw();
			});
		};

		function reportAndReload(res) {
			if (res && res.error) {
				ui.addNotification(null, E('p', {}, translateWifiError(res.error)), 'danger');
			}
			return reload();
		}

		function doReboot() {
			if (!confirm(_('Reboot the device? Wi-Fi and LAN connections will drop and the WAN address may change. This button does not save pending settings. Continue?')))
				return;
			callReboot().then(function() {
				ui.addNotification(null, E('p', {}, _('Reboot requested. Check the device address and reopen this page in about two minutes.')), 'info');
			}).catch(function(err) {
				ui.addNotification(null, E('p', {}, sbair.errorText(err)), 'warning');
			});
		}

		function setMaxPower() {
			if (!confirm(_('Set wireless power to the firmware maximum scale? Country/region settings will not change. Continue?')))
				return;
			callWifiTxPowerMax().then(function(res) {
				if (res && res.error) {
					ui.addNotification(null, E('p', {}, translateWifiError(res.error)), 'danger');
					return;
				}
				ui.addNotification(null, E('p', {},
					(res && res.result === 'already_max') ? _('Already at maximum scale.') : _('Maximum scale saved; Wi-Fi restart started.')), 'info');
				return reload();
			}).catch(function(err) {
				ui.addNotification(null, E('p', {}, sbair.errorText(err)), 'danger');
			});
		}

		function setDefaultPower() {
			if (!confirm(_('Restore SBA6D firmware default wireless power? Country/region settings and regulatory table will not change. Continue?')))
				return;
			callWifiTxPowerDefault().then(function(res) {
				if (res && res.error) {
					ui.addNotification(null, E('p', {}, translateWifiError(res.error)), 'danger');
					return;
				}
				ui.addNotification(null, E('p', {},
					(res && res.result === 'already_default') ? _('Already at default power.') : _('Default power saved; Wi-Fi restart started.')), 'info');
				return reload();
			}).catch(function(err) {
				ui.addNotification(null, E('p', {}, sbair.errorText(err)), 'danger');
			});
		}

		redraw();

		return E('div', { 'class': 'cbi-map' }, [
			E('div', { 'style': 'margin-bottom:1em' }, [
				E('button', {
					'class': 'cbi-button cbi-button-neutral',
					'click': ui.createHandlerFn(this, reload)
				}, _('Reload'))
			]),
			container
		]);
	},

	handleSave: null,
	handleSaveApply: null,
	handleReset: null
});
