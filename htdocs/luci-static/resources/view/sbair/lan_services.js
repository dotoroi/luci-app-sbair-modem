// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Floop3
//
// LAN services. DHCP here means the LAN DHCP *server* only; the Air 6's own
// management-IP DHCP client remains owned by netmode.

'use strict';
'require view';
'require rpc';
'require ui';
'require dom';
'require tools.sbair as sbair';
'require tools.sbair-i18n as i18n';

var _ = i18n.translate;

var callStatus = rpc.declare({ object: 'sbair', method: 'maintenance_status' });
var callDHCPServer = rpc.declare({ object: 'sbair', method: 'dhcp_server_set', params: [ 'enabled' ] });

function value(v) {
	return v === undefined || v === null || v === '' ? '-' : String(v);
}

function onOff(v) {
	if (v === true || v === 1 || v === '1' || v === 'running' || v === 'enabled')
		return _('Enabled / running');
	if (v === false || v === 0 || v === '0' || v === 'stopped' || v === 'disabled')
		return _('Disabled / stopped');
	return value(v);
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

	var d = data.dhcp_server || {};
	var enabled = d.enabled === true || d.enabled === 1 || d.enabled === '1';
	return [ sbair.section(_('LAN DHCP server'), [
		E('p', { 'style': 'opacity:.8' }, _('Manage IP addresses assigned by Air 6 to LAN clients.')),
		E('p', {}, [
			_('This setting controls the LAN DHCP server that assigns IP addresses to LAN devices.'),
			E('br'),
			_('This does not affect the DHCP client setting Air 6 uses to obtain its management IP from the upstream router.')
		]),
		statusTable([
			[ _('LAN DHCP server'), onOff(enabled) ],
			[ 'dhcp.lan.ignore', value(d.uci_ignore) ],
			[ 'UDP/67', onOff(d.udp67_listening) + ' / ' + value(d.udp67_scope) ],
			[ 'dnsmasq', value(d.dnsmasq) ],
			[ 'DNS :53', onOff(d.port53_listening) + ' / TCP: ' + value(d.port53_tcp_scope) + ' / UDP: ' + value(d.port53_udp_scope) ],
			[ 'odhcpd', value(d.odhcpd) ],
			[ 'RA / DHCPv6 / NDP', value(d.ra) + ' / ' + value(d.dhcpv6) + ' / ' + value(d.ndp) ],
			[ _('Managed by'), d.owner === 'netmode-ap' ? _('Network mode (AP / Bridge)') : _('Manual') ],
			[ _("DHCP packet guard"), onOff(d.guard_active) ],
			[ _("Safe Apply pending"), onOff(d.pending) ]
		]),
		E('div', { 'class': 'sbair-button-group', 'style': 'margin-top:.75em' }, [
			actionButton(_('Disable DHCP server'), false, function() {
				if (confirm(_('Disable DHCP for LAN clients? Devices relying on Air 6 may be unable to renew their IP addresses. Continue?')))
					onSet(false);
			}),
			actionButton(_('Enable DHCP server'), true, function() {
				if (confirm(_('Enable DHCP for LAN clients? It may conflict with another DHCP server on the same LAN. Continue?')))
					onSet(true);
			})
		]),
		E('p', { 'class': 'alert-message warning' },
			_('EasyMesh may automatically re-enable DHCP. This feature does not change EasyMesh settings.') +
			_('Before using AP / Bridge mode, check EasyMesh in the stock web UI if needed.'))
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
			return callDHCPServer(enabled).then(function(result) {
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
				}, _('Reload'))
			]),
			container
		]);
	},

	handleSave: null,
	handleSaveApply: null,
	handleReset: null
});
