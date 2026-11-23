// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Floop3
//
// OTA/FOTA controls. Keep the vendor update semantics in the existing
// maintenance backend; this view only gives the feature its own UI owner.

'use strict';
'require view';
'require rpc';
'require ui';
'require dom';
'require tools.sbair as sbair';
'require tools.sbair-i18n as i18n';

var _ = i18n.translate;

var callStatus = rpc.declare({ object: 'sbair', method: 'maintenance_status' });
var callFOTA = rpc.declare({ object: 'sbair', method: 'fota_set', params: [ 'enabled' ] });

function value(v) {
	return v === undefined || v === null || v === '' ? '-' : String(v);
}

function statusTable(rows) {
	return sbair.table(rows.map(function(row) {
		return sbair.row(row[0], row[1]);
	}));
}

function actionButton(label, enabled, action) {
	return E('button', {
		'class': enabled ? 'cbi-button cbi-button-positive' : 'cbi-button cbi-button-negative',
		'click': action
	}, label);
}

function render(data, onSet) {
	data = data || {};
	if (data.error)
		return [ sbair.errorBox([ data.error ]) ];

	var f = data.fota || {};
	return [ sbair.section(_("OTA/FOTA automatic renewal"), [
		E('p', { 'style': 'opacity:.8' }, _("Manage automatic body updates with genuine kn_fotad. It does not block servers, change binaries, or change respawn settings.")),
		statusTable([
			[ _("FOTA body"), value(f.config_enabled) ],
			[ _("Provisioning"), value(f.provision_enabled) ],
			[ _("respawn settings"), value(f.config_respawn) ],
			[ 'kn_fotad', value(f.kn_fotad) ],
			[ _("auto start"), value(f.autostart) ]
		]),
		E('div', { 'class': 'sbair-button-group', 'style': 'margin-top:.75em' }, [
			actionButton(_("Disable OTA/FOTA automatic updates"), false, function() {
				if (confirm(_("Disable OTA/FOTA automatic updates. Set fota.config.enabled and fota.provision.enabled to 0, stop kn_fotad and disable autostart. Do you want to continue?")))
					onSet(false);
			}),
			actionButton(_("Enable OTA/FOTA automatic updates"), true, function() {
				if (confirm(_("Enable OTA/FOTA automatic updates and start kn_fotad. Do you want to continue?")))
					onSet(true);
			})
		]),
		E('p', { 'style': 'opacity:.8;font-size:90%' }, _("Even when invalidated, fota.config.respawn does not change. Wait 10 seconds and make sure you restart kn_fotad."))
	]) ];
}

return view.extend({
	load: function() {
		return callStatus().catch(function(err) {
			return { error: sbair.errorText(err) };
		});
	},

	render: function(data) {
		var self = this;
		self.data = data || {};
		var container = E('div', {});

		function reload() {
			return callStatus().then(function(result) {
				self.data = result || {};
				dom.content(container, render(self.data, change));
			}).catch(function(err) {
				ui.addNotification(null, E('p', {}, sbair.errorText(err)), 'danger');
			});
		}

		function change(enabled) {
			return callFOTA(enabled).then(function(result) {
				if (result && result.error) {
					ui.addNotification(null, E('p', {}, sbair.errorText(result.error)), 'danger');
					return;
				}
				if (result && result.warning)
					ui.addNotification(null, E('p', {}, sbair.errorText(result.warning)), 'warning');
				return reload();
			}).catch(function(err) {
				ui.addNotification(null, E('p', {}, sbair.errorText(err)), 'danger');
			});
		}

		dom.content(container, render(self.data, change));
		return E('div', { 'class': 'cbi-map' }, [
			E('div', { 'style': 'margin-bottom:1em' }, [
				E('button', {
					'class': 'cbi-button cbi-button-neutral',
					'click': reload
				}, _("reload"))
			]),
			container
		]);
	},

	handleSave: null,
	handleSaveApply: null,
	handleReset: null
});
