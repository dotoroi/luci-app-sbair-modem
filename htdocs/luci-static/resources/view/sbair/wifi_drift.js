// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Floop3
//
// Read-only Wi-Fi configuration drift monitor. The diagnostic buttons are the
// only paths that may explicitly run knsh save or wlan restart.

'use strict';
'require view';
'require rpc';
'require ui';
'require dom';
'require tools.sbair as sbair';

var callStatus = rpc.declare({ object: 'sbair', method: 'wifi_drift_status' });
var callSet = rpc.declare({ object: 'sbair', method: 'wifi_drift_set', params: [ 'enabled' ] });
var callMarkGood = rpc.declare({ object: 'sbair', method: 'wifi_drift_mark_good' });
var callLogs = rpc.declare({ object: 'sbair', method: 'wifi_drift_logs' });
var callSaveTest = rpc.declare({ object: 'sbair', method: 'wifi_drift_save_test' });
var callRestartTest = rpc.declare({ object: 'sbair', method: 'wifi_drift_restart_test' });

var bands = [ '2.4G', '5G', '6G' ];
var bandLabel = { '2.4G': '2.4GHz', '5G': '5GHz', '6G': '6GHz' };

function value(v) {
	return v === undefined || v === null || v === '' ? '-' : String(v);
}

function badge(text, color) {
	var colors = { green: '#5cb85c', yellow: '#e6a23c', red: '#d9534f', gray: '#777' };
	return E('span', { 'class': 'ifacebadge', 'style': 'margin-left:.5em;background:' + (colors[color] || colors.gray) + ';color:#fff' }, text);
}

function statusBadge(status) {
	var labels = {
		ok: [ _("normal"), 'green' ], config_drift: [ _("There are differences in settings"), 'red' ],
		runtime_drift: [ _("Runtime difference"), 'red' ], '6g_attention': [ _("Check the 6GHz factor"), 'yellow' ],
		no_baseline: [ _("Normal state not recorded"), 'yellow' ]
	};
	var item = labels[status] || [ _("unknown"), 'gray' ];
	return badge(item[0], item[1]);
}

function featureValue(features, key) {
	var v = features && features[key];
	return v === 'on' ? badge('ON', 'gray') : (v === 'off' ? badge('OFF', 'gray') : badge(_("unknown"), 'gray'));
}

function runtimeValue(r, field) {
	if (!r) return '-';
	if (field === 'protocol') return value(r.hostapd && r.hostapd.protocol);
	if (field === 'channel') return value(r.channel);
	if (field === 'width') return value(r.width) === '-' ? '-' : value(r.width) + ' MHz';
	if (field === 'frequency') return value(r.primary_frequency) + ' / ' + value(r.center_frequency);
	if (field === 'hostapd') return r.hostapd && r.hostapd.available ? value(r.hostapd.state) : '-';
	if (field === 'mac_bssid') return value(r.mac) + ' / ' + value(r.hostapd && r.hostapd.bssid);
	if (field === 'beacon_power') return value(r.beacon_counter) + ' / ' + value(r.iwinfo_tx_power);
	return value(r[field]);
}

function bandRow(label, uci, vendor, runtime) {
	return E('tr', { 'class': 'tr' }, [
		E('td', { 'class': 'td left' }, label), E('td', { 'class': 'td left' }, value(uci)),
		E('td', { 'class': 'td left' }, value(vendor)), E('td', { 'class': 'td left' }, value(runtime))
	]);
}

function vendorValue(data) {
	var files = vendorFiles(data);
	if (!files.length) return _("Not detected (") + value(data.current && data.current.vendor_discovery) + '）';
	return _("Not analyzed (monitors only hash/mtime/size)");
}

function vendorFiles(data) {
	var files = (data.current && data.current.files) || {};
	return Object.keys(files).filter(function(path) {
		return path !== '/etc/config/wireless' && path !== '/etc/config/knos';
	}).sort();
}

function vendorFilesSection(data) {
	var files = (data.current && data.current.files) || {};
	var paths = vendorFiles(data);
	if (!paths.length)
		return E('p', {}, _("Vendor persistent not detected. It does not parse the content; it only monitors the metadata of existing files."));
	var rows = [ E('tr', { 'class': 'tr table-titles' }, [
		E('th', { 'class': 'th' }, _('path')), E('th', { 'class': 'th' }, _('sha256')),
		E('th', { 'class': 'th' }, _('mtime')), E('th', { 'class': 'th' }, _('size'))
	]) ];
	paths.forEach(function(path) {
		var file = files[path] || {};
		rows.push(E('tr', { 'class': 'tr' }, [
			E('td', { 'class': 'td left' }, path), E('td', { 'class': 'td left' }, value(file.sha256)),
			E('td', { 'class': 'td left' }, value(file.mtime)), E('td', { 'class': 'td left' }, value(file.size))
		]));
	});
	return sbair.table(rows);
}

function driftTable(data) {
	var current = data.current || {};
	var currentBands = current.bands || {};
	var rows = [ E('tr', { 'class': 'tr table-titles' }, [
		E('th', { 'class': 'th' }, _("item")), E('th', { 'class': 'th' }, _("UCI settings")),
		E('th', { 'class': 'th' }, _("Vendor persistent")), E('th', { 'class': 'th' }, _("Runtime"))
	]) ];
	bands.forEach(function(band) {
		var b = currentBands[band] || {};
		var vendor = vendorValue(data);
		var prefix = bandLabel[band] + ' ';
		rows.push(bandRow(prefix + _("Radio / AP interface"), value(b.radio) + ' / ' + value(b.ap_interface), vendor, runtimeValue(b.runtime, 'interface')));
		rows.push(bandRow(prefix + _("Enabled"), b.enabled, vendor, runtimeValue(b.runtime, 'hostapd')));
		rows.push(bandRow(prefix + _("Protocol"), b.protocol, vendor, runtimeValue(b.runtime, 'protocol')));
		rows.push(bandRow(prefix + _("HTMode"), b.htmode, vendor, '-'));
		rows.push(bandRow(prefix + _("Channel"), value(b.channel_policy) + ' / ' + value(b.configured_channel), vendor, runtimeValue(b.runtime, 'channel')));
		rows.push(bandRow(prefix + _("Bandwidth"), value(b.bandwidth_policy) + ' / ' + value(b.configured_bandwidth), vendor, runtimeValue(b.runtime, 'width')));
		rows.push(bandRow(prefix + _("Frequency (primary / center)"), '-', vendor, runtimeValue(b.runtime, 'frequency')));
		rows.push(bandRow(prefix + 'Hostapd', '-', vendor, runtimeValue(b.runtime, 'hostapd')));
		rows.push(bandRow(prefix + 'MAC / BSSID', '-', vendor, runtimeValue(b.runtime, 'mac_bssid')));
		rows.push(bandRow(prefix + _("Beacon / Tx power"), '-', vendor, runtimeValue(b.runtime, 'beacon_power')));
		rows.push(bandRow(prefix + _("Association count"), '-', vendor, runtimeValue(b.runtime, 'association_count')));
	});
	rows.push(E('tr', { 'class': 'tr' }, [ E('td', { 'class': 'td left' }, _('MLO')), E('td', { 'class': 'td left' }, '-'),
		E('td', { 'class': 'td left' }, featureValue(current.features, 'mlo')), E('td', { 'class': 'td left' }, '-') ]));
	rows.push(E('tr', { 'class': 'tr' }, [ E('td', { 'class': 'td left' }, _("Band Steering")), E('td', { 'class': 'td left' }, '-'),
		E('td', { 'class': 'td left' }, featureValue(current.features, 'bandsteering')), E('td', { 'class': 'td left' }, '-') ]));
	return sbair.table(rows);
}

function changeSummary(data) {
	var s = data.summary || {};
	var last = data.last_change || {};
	var first = last.changes && last.changes[0];
	return sbair.table([
		sbair.row(_("Date and time of last change"), value(last.timestamp)),
		sbair.row(_("Layers/Items Changed"), value(first && first.layer) + ' / ' + value(first && first.field)),
		sbair.row(_("Time of change after startup"), value(first && first.uptime_sec) + _("candle")),
		sbair.row(_("UCI hash changed?"), s.uci_hash_changed ? 'yes' : 'no'),
		sbair.row(_("Vendor persistent changed?"), s.vendor_persistent_changed ? 'yes' : 'no'),
		sbair.row(_("Runtime only changed?"), s.runtime_only_changed ? 'yes' : 'no'),
		sbair.row(_("Known-good profile"), value(data.baseline_recorded_at))
	]);
}

function details(title, children, open) {
	return E('details', { 'open': open ? '' : null }, [
		E('summary', {}, title),
		E('div', {}, children)
	]);
}

function render(data, opts) {
	data = data || {};
	opts = opts || {};
	var monitor = data.monitor || {};
	var current = data.current || {};
	var body = [];
	body.push(sbair.softBrickWarning('wifi'));
	body.push(sbair.section(_("monitoring"), [ sbair.table([
		sbair.row(_("mode"), E('label', {}, [ E('input', { 'type': 'checkbox', 'checked': monitor.enabled ? '' : null,
			'change': function(ev) { opts.onEnable(ev.target.checked); } }), _("Monitor only (default)") ]),
			monitor.enabled ? badge(_("Monitoring"), 'green') : badge('OFF', 'gray'))
	]) ]));
	body.push(sbair.section(_("overall status"), [ sbair.table([
		sbair.row(_("situation"), statusBadge(data.status)),
		sbair.row(_("UCI/vendor detection"), value(current.vendor_discovery))
	]) ]));
	body.push(sbair.section(_("Recent changes / Known-good"), [ changeSummary(data) ]));
	body.push(details(_("Setting details (UCI/Vendor persistent/Runtime)"), [
		E('p', { 'style': 'opacity:.8' }, _("UCI settings, vendor persistence, and actual operation (runtime) are displayed as separate layers. The actual value of each vendor persistent band is not interpreted, but only hash/mtime/size is monitored. Even if the channel/bandwidth of AUTO changes to ACS, it is not judged as drift.")),
		sbair.section(_("Compare settings"), [ driftTable(data) ]),
		details(_("Vendor persistent metadata"), [ vendorFilesSection(data) ])
	]));

	var troubleshooting = [
		E('div', { 'class': 'sbair-button-group', 'style': 'margin-bottom:.75em' }, [
			E('button', { 'class': 'cbi-button cbi-button-positive', 'click': opts.onMarkGood }, _("Record the present as normal")),
			E('button', { 'class': 'cbi-button cbi-button-neutral', 'click': opts.onLogs }, _("View diagnostic log")),
			E('button', { 'class': 'cbi-button cbi-button-neutral', 'click': opts.onSaveTest }, _("Safe knsh save difference test")),
			E('button', { 'class': 'cbi-button cbi-button-neutral', 'disabled': data.restart_test && data.restart_test.state === 'running' ? '' : null,
				'click': opts.onRestartTest }, data.restart_test && data.restart_test.state === 'running' ? _("Wi-Fi restart Running diagnostics...") : _("After checking the difference, restart Wi-Fi and compare"))
		])
	];
	if (data.restart_test)
		troubleshooting.push(sbair.section(_("restart diagnosis"), [ sbair.table([
			sbair.row(_("situation"), value(data.restart_test.state)),
			sbair.row('knsh wlan restart', data.restart_test.command_succeeded ? _("success") : _("failure")),
			sbair.row(_("Comparison results"), value((data.restart_test.differences || []).length) + _("case"))
		]) ]));
	if (opts.logs)
		troubleshooting.push(sbair.section(_("Diagnostic log (recent)"), [ E('pre', { 'style': 'white-space:pre-wrap;max-height:30em;overflow:auto' }, opts.logs) ]));
	body.push(details(_("problem solving"), troubleshooting, !!opts.logs || !!data.restart_test));

	if (data.differences && data.differences.length) {
		var diffRows = [ E('tr', { 'class': 'tr table-titles' }, [
			E('th', { 'class': 'th' }, _('layer')), E('th', { 'class': 'th' }, _('band')), E('th', { 'class': 'th' }, _("item")), E('th', { 'class': 'th' }, _('old')), E('th', { 'class': 'th' }, _('new'))
		]) ];
		diffRows = diffRows.concat(data.differences.slice(0, 80).map(function(d) { return E('tr', { 'class': 'tr' }, [
			E('td', { 'class': 'td left' }, value(d.layer)), E('td', { 'class': 'td left' }, value(d.band)),
			E('td', { 'class': 'td left' }, value(d.field)), E('td', { 'class': 'td left' }, value(d.old)), E('td', { 'class': 'td left' }, value(d.new))
		]); }));
		body.push(details(_("Differences from Known-Good (") + data.differences.length + _("case)"), [ sbair.section(_("list of differences"), [ sbair.table(diffRows) ]) ]));
	}
	return body;
}

return view.extend({
	load: function() { return callStatus(); },
	render: function(data) {
		var self = this, container = E('div', {}), logs = null;
		function reload() {
			return callStatus().then(function(res) { self.data = res; logs = null; redraw(); })
				.catch(function(err) { ui.addNotification(null, E('p', {}, sbair.errorText(err)), 'warning'); });
		}
		function report(res) {
			if (res && res.error) ui.addNotification(null, E('p', {}, sbair.errorText(res.error)), 'danger');
			return reload();
		}
		function redraw() {
			dom.content(container, render(self.data, {
				logs: logs, onEnable: function(v) { callSet(v ? '1' : '0').then(report); },
				onMarkGood: function() { if (confirm(_("Would you like to record the current Wi-Fi status as Known-good?"))) callMarkGood().then(report); },
				onLogs: function() { callLogs().then(function(res) { logs = res && res.log || ''; redraw(); }); },
				onSaveTest: function() {
					if (!confirm(_("Just run knsh save. Wi-Fi restart does not work. Do you want to continue?"))) return;
					callSaveTest().then(function(res) { if (res && res.error) throw new Error(res.error); ui.addNotification(null, E('p', {}, _("Obtained the difference before and after knsh save. Wi-Fi restart is not performed.")), 'info'); return reload(); })
						.catch(function(err) { ui.addNotification(null, E('p', {}, sbair.errorText(err)), 'danger'); });
				},
				onRestartTest: function() {
					if (!confirm(_("Explicitly run knsh wlan restart and compare runtimes. Wi-Fi will be temporarily disconnected. Do you want to continue?"))) return;
					callRestartTest().then(report);
				}
			}));
		}
		self.data = data || {};
		redraw();
		return E('div', { 'class': 'cbi-map' }, [ E('div', { 'style': 'margin-bottom:1em' }, [
			E('button', { 'class': 'cbi-button cbi-button-neutral', 'click': reload }, _("reload"))
		]), container ]);
	},
	handleSave: null, handleSaveApply: null, handleReset: null
});
