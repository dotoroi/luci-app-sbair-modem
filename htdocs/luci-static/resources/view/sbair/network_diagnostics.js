// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Floop3
//
// LAN / bridge diagnostics and explicit USB host NIC membership controls.
// netmode_netdev_status remains the read-only source of device inventory.

'use strict';
'require view';
'require rpc';
'require ui';
'require dom';
'require tools.sbair as sbair';

var callStatus = rpc.declare({ object: 'sbair', method: 'netmode_netdev_status' });
var callUSBLANAdd = rpc.declare({ object: 'sbair', method: 'netmode_usb_lan_add', params: [ 'iface' ] });
var callUSBLANRemove = rpc.declare({ object: 'sbair', method: 'netmode_usb_lan_remove', params: [ 'iface' ] });

function valueOrDash(value) {
	return value === undefined || value === null || value === '' ? '-' : String(value);
}

function mbps(value) {
	value = valueOrDash(value);
	return value === '-' || value === 'unknown' || value === 'none' ? value : value + ' Mbps';
}

function networkDeviceTable(devices) {
	var rows = [ E('tr', { 'class': 'tr table-titles' }, [
		E('th', { 'class': 'th' }, _('interface')),
		E('th', { 'class': 'th' }, _('role')),
		E('th', { 'class': 'th' }, _('state / carrier')),
		E('th', { 'class': 'th' }, _('MAC / MTU')),
		E('th', { 'class': 'th' }, _('master')),
		E('th', { 'class': 'th' }, _('driver / bus')),
		E('th', { 'class': 'th' }, _("Ethernet link rate / duplex"))
	]) ];
	(devices || []).forEach(function(device) {
		rows.push(E('tr', { 'class': 'tr' }, [
			E('td', { 'class': 'td left' }, valueOrDash(device.name)),
			E('td', { 'class': 'td left' }, valueOrDash(device.role)),
			E('td', { 'class': 'td left' }, valueOrDash(device.operstate) + ' / ' + valueOrDash(device.carrier)),
			E('td', { 'class': 'td left' }, valueOrDash(device.mac) + ' / ' + valueOrDash(device.mtu)),
			E('td', { 'class': 'td left' }, valueOrDash(device.master)),
			E('td', { 'class': 'td left' }, valueOrDash(device.driver) + ' / ' + valueOrDash(device.bus_type)),
			E('td', { 'class': 'td left' }, mbps(device.link_speed) + ' / ' + valueOrDash(device.duplex))
		]));
	});
	return sbair.table(rows);
}

function confirmUSBLAN(iface, remove, onDone) {
	onDone = onDone || function() {};
	var action = remove ? callUSBLANRemove : callUSBLANAdd;
	var title = remove ? _("USB LAN port removal") : _("Add USB LAN port");
	var explanation = remove
		? iface + _("Remove the interface from br-lan. Communication for connected LAN clients may be lost.")
		: iface + _("Add the interface to br-lan. It uses the same private network and DHCP as the LAN, and the WAN settings do not change.");
	ui.showModal(title, [
		E('p', {}, explanation),
		E('p', { 'class': 'alert-message warning' }, _("Saves and reflects network settings. The USB adapter may lose link or briefly reconnect to the network.")),
		E('div', { 'style': 'text-align:right;margin-top:1em' }, [
			E('button', { 'class': 'cbi-button', 'click': function() { ui.hideModal(); } }, _("cancellation")), ' ',
			E('button', { 'class': 'cbi-button cbi-button-action', 'click': function(ev) {
				ev.target.disabled = true;
				action({ iface: iface }).then(function(result) {
					ui.hideModal();
					if (result && result.error) {
						ui.addNotification(null, E('p', {}, sbair.errorText(result.error)), 'danger');
						return;
					}
					ui.addNotification(null, E('p', {}, remove ? _("I removed the USB LAN port.") : _("Added USB LAN port to br-lan.")), 'info');
					return onDone();
				}).catch(function(err) {
					ui.hideModal();
					ui.addNotification(null, E('p', {}, sbair.errorText(err)), 'danger');
				});
			} }, remove ? _("eliminate") : _("Add to LAN"))
		])
	]);
}

function managedUSBPortTable(ports, networkDevices, onDone) {
	var byName = {};
	(networkDevices || []).forEach(function(device) { byName[device.name] = device; });
	var rows = [ E('tr', { 'class': 'tr table-titles' }, [
		E('th', { 'class': 'th' }, _("USB LAN interface")),
		E('th', { 'class': 'th' }, _("current status")),
		E('th', { 'class': 'th' }, _("setting"))
	]) ];
	(ports || []).forEach(function(name) {
		var device = byName[name];
		var state = device ? (device.master === 'br-lan' ? _("br-lan connected") : _("Detected /") + valueOrDash(device.master)) : _("Currently detached (settings retained)");
		rows.push(E('tr', { 'class': 'tr' }, [
			E('td', { 'class': 'td left' }, name),
			E('td', { 'class': 'td left' }, state),
			E('td', { 'class': 'td left' }, E('button', {
				'class': 'cbi-button cbi-button-negative',
				'click': function() { confirmUSBLAN(name, true, onDone); }
			}, _("Remove from LAN")))
		]));
	});
	return sbair.table(rows);
}

function usbCandidateTable(devices, networkDevices, managedPorts, onDone) {
	var netdevByName = {};
	var managed = {};
	(networkDevices || []).forEach(function(device) { netdevByName[device.name] = device; });
	(managedPorts || []).forEach(function(name) { managed[name] = true; });
	var rows = [ E('tr', { 'class': 'tr table-titles' }, [
		E('th', { 'class': 'th' }, _("USB Host network candidates")),
		E('th', { 'class': 'th' }, _('VID:PID')),
		E('th', { 'class': 'th' }, _('driver')),
		E('th', { 'class': 'th' }, _("Interface/Link")),
		E('th', { 'class': 'th' }, _("LAN settings"))
	]) ];
	(devices || []).filter(function(device) { return device.network_candidate; }).forEach(function(device) {
		var ifaces = [];
		(device.interfaces || []).forEach(function(iface) {
			(iface.netdevs || []).forEach(function(name) { ifaces.push({ name: name, driver: iface.driver }); });
		});
		if (!ifaces.length) ifaces.push({ name: '', driver: _("netdev not created") });
		ifaces.forEach(function(iface) {
			var netdev = netdevByName[iface.name];
			var action = E('span', { 'style': 'opacity:.7' }, iface.name ? _("Need to check driver status") : _("Available after driver binding"));
			if (iface.name && managed[iface.name]) {
				action = E('button', { 'class': 'cbi-button cbi-button-negative', 'click': function() { confirmUSBLAN(iface.name, true, onDone); } }, _("Remove from LAN"));
			} else if (iface.name && netdev && netdev.usb_device && netdev.master === 'none' && netdev.driver !== 'unknown' && netdev.driver !== 'unbound') {
				action = E('button', { 'class': 'cbi-button cbi-button-action', 'click': function() { confirmUSBLAN(iface.name, false, onDone); } }, _("Add to LAN"));
			} else if (iface.name && netdev && netdev.master === 'br-lan') {
				action = E('span', {}, _("Already a br-lan member"));
			} else if (iface.name && netdev && netdev.master !== 'none') {
				action = E('span', {}, _("Other bridge members:") + netdev.master);
			}
			rows.push(E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td left' }, valueOrDash(device.product || device.name) + ' (' + valueOrDash(device.name) + ') / ' + mbps(device.bus_speed)),
				E('td', { 'class': 'td left' }, valueOrDash(device.vid_pid)),
				E('td', { 'class': 'td left' }, valueOrDash(iface.driver || device.driver)),
				E('td', { 'class': 'td left' }, iface.name ? iface.name + ' / ' + (netdev ? valueOrDash(netdev.operstate) + _(' / carrier ') + valueOrDash(netdev.carrier) : _("Not detected")) : '-'),
				E('td', { 'class': 'td left' }, action)
			]));
		});
	});
	return sbair.table(rows);
}

function render(data, onDone) {
	data = data || {};
	if (data.error)
		return [ sbair.errorBox([ data.error ]) ];

	var bridge = data.bridge || {};
	var devices = data.network_devices || [];
	var candidates = (data.usb_devices || []).filter(function(device) {
		return device.network_candidate;
	});
	var managedPorts = data.managed_usb_lan_ports || [];
	var sections = [
		E('p', { 'style': 'opacity:.8' },
			_("USB host Ethernet is automatically detected and displayed. This screen does not automatically connect to the network, and only connects the USB interface to br-lan when the user confirms and presses “Add to LAN”.")),
		E('p', { 'style': 'opacity:.8' },
			_("Ethernet link rate and USB bus speed are reported link/bus speeds, not application effective speeds. No iperf3 measurements are performed on this screen.")),
		sbair.section(_("Historical throughput references"), [
			E('p', { 'style': 'opacity:.8' },
				_("Historical TCP P1 iperf3 actual measurements (2026-09-21, 10 seconds each). It does not indicate the current speed. Wi-Fi value is 5GHz / 160MHz (channel 56) Client → Air6 → NAS transmission.")),
			sbair.table([
				sbair.row(_("RTL8156 raw LAN — Air6 → NAS"), '2.04 Gbit/s'),
				sbair.row(_("RTL8156 raw LAN — NAS → Air6"), '2.33 Gbit/s'),
				sbair.row(_("5GHz / 160 MHz client → NAS via Air6"), '421 Mbit/s')
			])
		]),
		sbair.section(_("Bridge"), [ sbair.table([
			sbair.row(_("Bridge"), valueOrDash(bridge.name)),
			sbair.row(_("Bridge members"), bridge.members && bridge.members.length ? bridge.members.join(', ') : _("Not detected"))
		]) ]),
		sbair.section(_("Network devices"), [
			devices.length ? networkDeviceTable(devices) : E('p', {}, _("network device not detected"))
		]),
		sbair.section(_("USB Host network candidates"), [
			candidates.length ? usbCandidateTable(candidates, devices, managedPorts, onDone) : E('p', {}, _("Candidate USB Host network device not detected (All USB Host devices can be checked in “Main Unit > USB Device”)"))
		])
	];
	if (managedPorts.length)
		sections.push(sbair.section(_("USB LAN port configured"), [
			E('p', { 'style': 'opacity:.8' }, _("LAN settings are retained even if the adapter is disconnected. When you reconnect, you will be connected to the same LAN bridge.")),
			managedUSBPortTable(managedPorts, devices, onDone)
		]));
	return sections;
}

return view.extend({
	load: function() {
		return callStatus().catch(function(err) {
			return { error: _("Network diagnostics were not obtained.") + sbair.errorText(err) };
		});
	},

	render: function(data) {
		var self = this;
		self.data = data || {};
		var container = E('div', {}, render(self.data, reload));

		function reload() {
			return callStatus().then(function(result) {
				self.data = result || {};
				dom.content(container, render(self.data, reload));
			}).catch(function(err) {
				ui.addNotification(null, E('p', {}, sbair.errorText(err)), 'warning');
			});
		}

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
