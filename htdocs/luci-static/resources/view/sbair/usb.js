// SPDX-License-Identifier: MIT
// Copyright (c) 2026 Floop3

// USB Host inventory is intentionally read-only. Driver installation/removal is
// shown only as a disabled capability until a kernel-matched app bundle exists.

'use strict';
'require view';
'require rpc';
'require ui';
'require dom';
'require tools.sbair as sbair';

var callStatus = rpc.declare({ object: 'sbair', method: 'usb_status' });
var callNICStatus = rpc.declare({ object: 'sbair', method: 'usb_nic_status' });
var callNICEnable = rpc.declare({ object: 'sbair', method: 'usb_nic_enable', params: [ 'ack' ] });
var callNICDisable = rpc.declare({ object: 'sbair', method: 'usb_nic_disable' });

function valueOrDash(value) {
	return value === undefined || value === null || value === '' ? '-' : String(value);
}

function speed(value) {
	value = valueOrDash(value);
	return value === '-' || value === 'unknown' ? value : value + ' Mbps';
}

function list(value) {
	return value && value.length ? value.join(', ') : '-';
}

function interfaceRows(interfaces) {
	var rows = [ E('tr', { 'class': 'tr table-titles' }, [
		E('th', { 'class': 'th' }, _('interface')),
		E('th', { 'class': 'th' }, _('class / subclass / protocol')),
		E('th', { 'class': 'th' }, _('driver')),
		E('th', { 'class': 'th' }, _('netdev')),
		E('th', { 'class': 'th' }, _('block device')),
		E('th', { 'class': 'th' }, _('modalias'))
	]) ];
	(interfaces || []).forEach(function(iface) {
		rows.push(E('tr', { 'class': 'tr' }, [
			E('td', { 'class': 'td left' }, valueOrDash(iface.name)),
			E('td', { 'class': 'td left' }, [
				valueOrDash(iface.class), ' / ', valueOrDash(iface.subclass), ' / ', valueOrDash(iface.protocol)
			]),
			E('td', { 'class': 'td left' }, valueOrDash(iface.driver)),
			E('td', { 'class': 'td left' }, list(iface.netdevs)),
			E('td', { 'class': 'td left' }, list(iface.block_devices)),
			E('td', { 'class': 'td left' }, valueOrDash(iface.modalias))
		]));
	});
	return rows;
}

function driverSection(device) {
	var plan = device.driver_management || {};
	var disabledReason = valueOrDash(plan.reason);
	return sbair.section(_("USB Host Driver Management (Read Only)"), [ sbair.table([
		sbair.row(_("Judgment target"), plan.device_class_allowed ? _("Known USB Host Ethernet Candidates") : _("Excluded / Not confirmed")),
		sbair.row(_("Provenance"), valueOrDash(plan.provenance)),
		sbair.row(_("expected driver"), valueOrDash(plan.expected_driver)),
		sbair.row(_('bundle'), plan.bundle_available ? _("Yes") : _("doesn't exist")),
		sbair.row(_("reason"), disabledReason),
		E('tr', { 'class': 'tr' }, [
			E('td', { 'class': 'td left' }, _("functioning")),
			E('td', { 'class': 'td left' }, [
				E('button', { 'class': 'cbi-button cbi-button-neutral', 'disabled': '' }, _("installation")), ' ',
				E('button', { 'class': 'cbi-button cbi-button-neutral', 'disabled': '' }, _("delete")),
				E('p', { 'style': 'opacity:.7;margin:.3em 0 0' }, _("Only the app management bundle on the USB Host side is subject to manipulation. It is invalid because bundle is not currently provided."))
			])
		]) ])
	]);
}

function deviceSection(device) {
	return sbair.section(valueOrDash(device.name) + ' — ' + valueOrDash(device.kind), [
		sbair.table([
			sbair.row(_('VID:PID'), valueOrDash(device.vid_pid)),
			sbair.row(_("Manufacturer/Product"), valueOrDash(device.manufacturer) + ' / ' + valueOrDash(device.product)),
			sbair.row(_("USB speed"), speed(device.bus_speed)),
			sbair.row(_("bcdUSB / device class"), valueOrDash(device.bcd_usb) + ' / ' + valueOrDash(device.device_class)),
			sbair.row(_('parent / sysfs'), valueOrDash(device.parent) + ' / ' + valueOrDash(device.sysfs_path)),
			sbair.row(_('driver'), valueOrDash(device.driver)),
			sbair.row(_('network candidate'), device.network_candidate ? _('yes') : _('no'))
		]),
		device.interfaces && device.interfaces.length
			? sbair.table(interfaceRows(device.interfaces))
			: E('p', {}, _("USB interface not detected")),
		driverSection(device)
	]);
}

function nicValue(value) {
	return value === undefined || value === null || value === '' ? '-' : String(value);
}

function nicState(nic) {
	return nic && nic.state ? nic.state : 'unknown';
}

function nicDisplay(kind, state) {
	var labels = {
		bundle: { missing: _("Not introduced"), installed: _("Introduce/Disable"), 'invalid-hash': _("Introduced but failed verification") },
		profile: { missing: _("Not set"), invalid: _("injustice"), valid: _("effectiveness") },
		runtime: { disabled: _("Introduce/Disable"), active: _("effectiveness"), 'preflight-ng': _("Preflight NG"), 'rollback-required': _("Rollback required") },
		preflight: { ok: _("Preflight OK"), ng: _("Preflight NG") }
	};
	return labels[kind] && labels[kind][state] ? labels[kind][state] : nicValue(state);
}

function usbNICSection(nic, reload) {
	nic = nic || {};
	var driver = nic.driver || {};
	var udc = nic.udc || {};
	var profile = nic.profile || {};
	var runtime = nic.runtime || {};
	var usb0 = nic.usb0 || {};
	var preflight = nic.preflight || {};
	var bundleState = nicState(nic.bundle);
	var profileState = nicState(profile);
	var preflightState = nicState(preflight);
	var runtimeState = nicState(runtime);
	var bundleReason = nic.bundle && nic.bundle.reason && nic.bundle.reason !== 'ok'
		? ' (' + nic.bundle.reason + ')' : '';
	var acknowledgements = [ false, false, false ];
	var enableButton;

	var warning = E('div', { 'style': 'border:2px solid #d9534f;padding:.8em;margin-bottom:1em' }, [
		E('strong', {}, _("⚠ Experimental high-risk features")),
		E('p', { 'style': 'margin:.5em 0 0' },
			_("Change the ownership state of USB UDC/ConfigFS and make Air6 act as a USB CDC-NCM gadget.") +
			_("Do not assume the USB side as the management path, but secure a recovery method such as another LAN or Wi-Fi management path and UART.")),
		E('p', { 'style': 'margin:.5em 0 0' },
			_("Disconnect the USB host device before operating it. LAN/WAN, br-lan, DHCP, Wi-Fi, and firewall do not change automatically.") +
			_("Automatic validation upon startup is also not performed."))
	]);

	var rows = [
		sbair.row(_("Bundle"), nicDisplay('bundle', bundleState) + bundleReason),
		sbair.row(_("Support level"), nicValue(nic.support_level || driver.support_level)),
		sbair.row(_("Kernel"), nicValue(nic.kernel || driver.kernel)),
		sbair.row(_("Architecture"), nicValue(nic.architecture || driver.architecture)),
		sbair.row(_("Driver SHA256"), nicValue(nic.driver_sha256 || driver.sha256)),
		sbair.row(_("Driver vermagic"), nicValue(nic.driver_vermagic || driver.vermagic)),
		sbair.row(_("License"), nicValue(nic.license || driver.license)),
		sbair.row(_("Upstream revision"), nicValue(nic.upstream_revision || driver.upstream_revision)),
		sbair.row(_('UDC'), nicValue(udc.name)),
		sbair.row(_("UDC state / speed"), nicValue(udc.state) + ' / ' + nicValue(udc.current_speed)),
		sbair.row(_("UDC binding"), nicValue(udc.bound_gadget)),
		sbair.row(_("Loaded USB modules"), nicValue(nic.loaded_usb_modules)),
		sbair.row(_("Activation profile"), nicDisplay('profile', profileState) + ' (' + nicValue(profile.path) + ')'),
		sbair.row(_("Runtime"), nicDisplay('runtime', runtimeState)),
		sbair.row(_('usb0'), nicValue(usb0.state) + ' / carrier: ' + nicValue(usb0.carrier)),
		sbair.row(_("Management path"), nicValue(nic.management_path)),
		sbair.row(_("Preflight"), nicDisplay('preflight', preflightState) + (preflight.reason ? ' (' + preflight.reason + ')' : ''))
	];

	var reason = '';
	if (bundleState !== 'installed')
		reason = _("No bundle has been introduced that satisfies fixed SHA256/vermagic.");
	else if (profileState !== 'valid')
		reason = _("Reviewed Activation profile is missing or invalid.") + (profile.reason ? ' (' + profile.reason + ')' : '') + _(". You cannot guess the value and activate it.");
	else if (preflightState !== 'ok')
		reason = _("The read-only preflight did not complete or failed.") + nicValue(preflight.reason);
	else
		reason = _("Please check all three items below before enabling.");

	var checks = [
		_("I understand that this is an experimental feature that changes USB UDC/ConfigFS."),
		_("Secure independent management path for LAN or Wi-Fi"),
		_("Disconnect the USB host and obtain a means of physical recovery.")
	].map(function(label, index) {
		return E('label', { 'style': 'display:block;margin:.4em 0' }, [
			E('input', { 'type': 'checkbox', 'class': 'cbi-input-checkbox', 'change': function(ev) {
				acknowledgements[index] = !!ev.target.checked;
				if (enableButton)
					enableButton.disabled = !canEnable();
			} }),
			' ', label
		]);
	});

	function canEnable() {
		return bundleState === 'installed' && profileState === 'valid' && preflightState === 'ok' &&
			acknowledgements[0] && acknowledgements[1] && acknowledgements[2];
	}

	enableButton = E('button', {
		'class': 'cbi-button cbi-button-action',
		'disabled': canEnable() ? null : '',
		'click': function() {
			if (!canEnable() || !confirm(_("Change USB UDC/ConfigFS. Do you have an independent management path?")))
				return;
			return callNICEnable(true).then(function(res) {
				if (res && res.error)
					ui.addNotification(null, E('p', {}, sbair.errorText(res.error)), 'error');
				return reload ? reload() : res;
			}).catch(function(err) {
				ui.addNotification(null, E('p', {}, sbair.errorText(err)), 'error');
			});
		}
	}, _("Enable"));

	var disableButton = E('button', {
		'class': 'cbi-button cbi-button-warning',
		'disabled': runtimeState === 'active' ? null : '',
		'click': function() {
			if (!confirm(_("Do you want to disable USB Gadget and delete the dedicated ConfigFS topology?")))
				return;
			return callNICDisable().then(function(res) {
				if (res && res.error)
					ui.addNotification(null, E('p', {}, sbair.errorText(res.error)), 'error');
				return reload ? reload() : res;
			}).catch(function(err) {
				ui.addNotification(null, E('p', {}, sbair.errorText(err)), 'error');
			});
		}
	}, _("Disable (limited rollback)"));

	return sbair.section(_("USB Gadget（CDC-NCM NIC）"), [
		warning,
		sbair.table(rows),
		E('p', { 'style': 'opacity:.8' }, reason),
		E('div', { 'style': 'margin:.8em 0' }, checks),
		E('div', {}, [ enableButton, ' ', disableButton ]),
		E('p', { 'style': 'font-size:90%;opacity:.75' },
			_("Candidate v1 is a live-validated binary from upstream, but the source/binary correspondence is treated as B2 provenance and is not recommended for new uses."))
	]);
}

function safeNICStatus() {
	return callNICStatus().then(function(res) {
		if (res && res.error)
			return { result: 'ok', bundle: { state: 'missing' }, preflight: { state: 'ng', reason: 'helper-unavailable' } };
		return res;
	}).catch(function() {
		return { result: 'ok', bundle: { state: 'missing' }, preflight: { state: 'ng', reason: 'rpc-unavailable' } };
	});
}

function render(data, reload) {
	data = data || {};
	var inventory = data.inventory || data;
	var nic = data.usb_nic || {};
	if (inventory.error)
		return [ sbair.errorBox([ inventory.error ]) ];

	var devices = inventory.usb_devices || [];
	var controllers = inventory.usb_controllers || [];
	var controllerRows = [ E('tr', { 'class': 'tr table-titles' }, [
		E('th', { 'class': 'th' }, _("USB bus / root hub")),
		E('th', { 'class': 'th' }, _('driver')),
		E('th', { 'class': 'th' }, _('reported speed'))
	]) ];
	controllers.forEach(function(controller) {
		controllerRows.push(E('tr', { 'class': 'tr' }, [
			E('td', { 'class': 'td left' }, valueOrDash(controller.name)),
			E('td', { 'class': 'td left' }, valueOrDash(controller.driver)),
			E('td', { 'class': 'td left' }, speed(controller.bus_speed))
		]));
	});

	var body = [ E('p', { 'style': 'opacity:.8' },
		_("Displays all USB devices/interfaces including hub, storage, serial, vendor-specific, and unknown as USB Host (device connected to Air 6).") +
		_("USB Host Ethernet driver introduction and bridge/WAN/LAN assignment are separate functions and will not be changed on this screen. USB Gadget features are covered in other sections below.")) ];
	body.push(controllers.length
		? sbair.section(_("USB Host buses / root hubs"), [ sbair.table(controllerRows) ])
		: E('p', {}, _("USB bus not detected")));
	if (devices.length)
		body = body.concat(devices.map(deviceSection));
	else
		body.push(E('p', {}, _("USB device not detected")));
	body.push(usbNICSection(nic, reload));
	return body;
}

return view.extend({
	load: function() {
		return Promise.all([
			callStatus().catch(function(err) { return { error: sbair.errorText(err) }; }),
			safeNICStatus()
		]).then(function(values) {
			return { inventory: values[0], usb_nic: values[1] };
		});
	},

	render: function(data) {
		var self = this;
		self.data = data;
		var container;
		var reload = function() {
			return Promise.all([
				callStatus(),
				safeNICStatus()
			]).then(function(values) {
				self.data = { inventory: values[0], usb_nic: values[1] };
				dom.content(container, render(self.data, reload));
			}).catch(function(err) {
				ui.addNotification(null, E('p', {}, sbair.errorText(err)), 'warning');
			});
		};
		container = E('div', {}, render(data, reload));
		return E('div', { 'class': 'cbi-map' }, [
			E('div', { 'style': 'margin-bottom:1em' }, [
				E('button', { 'class': 'cbi-button cbi-button-neutral', 'click': ui.createHandlerFn(this, reload) }, _("reload"))
			]),
			container
		]);
	},

	handleSave: null,
	handleSaveApply: null,
	handleReset: null
});
