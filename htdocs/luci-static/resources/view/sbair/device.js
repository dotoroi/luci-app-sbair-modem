// SPDX-License-Identifier: MIT
// Copyright (c) 2026 soralis0912
//
// デバイスの詳細情報。sbair.overview を 1 本だけ叩く。

'use strict';
'require view';
'require rpc';
'require request';
'require ui';
'require dom';
'require tools.sbair as sbair';

var callOverview = rpc.declare({ object: 'sbair', method: 'overview' });

function loadDevice() {
	return Promise.all([
		callOverview().catch(function(err) { return { errors: [ String(err) ] }; }),
		request.get(L.resource('sbair-release.json'), { cache: false })
			.then(function(res) { return res.ok ? res.json() : {}; })
			.catch(function() { return {}; })
	]).then(function(result) {
		var data = result[0] || {};
		data.floop3Release = result[1] || {};
		return data;
	});
}

function tempTable(list) {
	if (!list || !list.length)
		return E('p', {}, _("Can't get temperature."));

	// 27 個あるので、一番熱いものを先頭に。数値にならないものは末尾へ。
	var sorted = list.slice().sort(function(a, b) {
		var x = parseFloat(a.celsius), y = parseFloat(b.celsius);
		if (isNaN(x)) return 1;
		if (isNaN(y)) return -1;
		return y - x;
	});

	var rows = [ E('tr', { 'class': 'tr table-titles' }, [
		E('th', { 'class': 'th' }, _('sensor')),
		E('th', { 'class': 'th' }, _('temperature'))
	]) ];
	sorted.forEach(function(t) {
		var v = parseFloat(t.celsius);
		rows.push(E('tr', { 'class': 'tr' }, [
			E('td', { 'class': 'td left' }, t.sensor),
			E('td', { 'class': 'td left' }, [
				isNaN(v) ? String(t.celsius) : (v.toFixed(1) + ' ℃'),
				(!isNaN(v) && v >= 80)
					? E('span', { 'class': 'ifacebadge', 'style': 'margin-left:.5em' }, _('high temperature'))
					: ''
			])
		]));
	});
	return sbair.table(rows);
}

function render(data) {
	data = data || {};
	var body = [];
	var release = data.floop3Release || {};
	body.push(sbair.section('Floop3', [ sbair.table([
		sbair.row(_('Floop3 version'), release.version || _('Build metadata unavailable')),
		sbair.row(_('Build commit'), release.source_commit)
	]) ]));

	body.push(sbair.section(_('modem'), [ sbair.table([
		sbair.row(_('Manufacturer'), data.manufacturer),
		sbair.row(_('Model'), data.model),
		sbair.row(_('firmware'), data.revision),
		sbair.row('IMEI', sbair.mask(data.imei))
	]) ]));

	// ATI は Quectel と名乗るが中身は MediaTek。セル情報系のベンダ AT は
	// この機体が答える数少ないベンダコマンドの 1 つ。
	body.push(sbair.section(_('Temperature (AT+QTEMP)'), [ tempTable(data.temperatures) ]));

	body.push(sbair.errorBox(data.errors));
	return body;
}

return view.extend({
	load: function() {
		return loadDevice();
	},

	render: function(data) {
		var self = this;
		self.data = data;

		var container = E('div', {}, render(data));
		var redraw = function() { dom.content(container, render(self.data)); };

		var reload = function() {
			return loadDevice().then(function(res) {
				self.data = res;
				redraw();
			}).catch(function(err) {
				ui.addNotification(null, E('p', {}, String(err)), 'warning');
			});
		};

		return E('div', { 'class': 'cbi-map' }, [
			sbair.revealToggle(_('Display identifier (IMEI)'), redraw),
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
