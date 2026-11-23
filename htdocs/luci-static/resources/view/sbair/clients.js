// SPDX-License-Identifier: MIT
// Copyright (c) 2026 syado
//
// br-lan に今いる端末の一覧(有線・無線問わない)。
//
// 正はブリッジのFDB(clients.go参照)。IP/名前/メーカーは分かる範囲での
// ベストエフォート(DHCPリース・DNS逆引き・mDNS・NetBIOS・SSDP)。
// 列見出しをクリックすると並べ替えられる。メモは自由入力で、フォーカスを
// 外すと自動保存される(/etc/config/sbair)。ポートスキャンは個別に
// オンデマンドで実行する。デフォルトはよく使う約25ポートのみだが、
// 範囲(例: 1-1024)やカンマ区切りを指定して広げられる。

'use strict';
'require view';
'require rpc';
'require ui';
'require dom';
'require tools.sbair as sbair';
'require tools.sbair-i18n as i18n';

var _ = i18n.translate;

var callClientList = rpc.declare({ object: 'sbair', method: 'client_list' });
var callAdblockList = rpc.declare({ object: 'sbair', method: 'adblock_list' });
var callAdblockSet = rpc.declare({ object: 'sbair', method: 'adblock_set', params: [ 'mac', 'enabled' ] });
var callNoteSet = rpc.declare({ object: 'sbair', method: 'client_note_set', params: [ 'mac', 'note' ] });
var callScanPorts = rpc.declare({ object: 'sbair', method: 'client_scan_ports', params: [ 'ip', 'ports' ] });
var callDisconnect = rpc.declare({ object: 'sbair', method: 'client_disconnect', params: [ 'mac' ] });

var bandLabel = { '2.4G': '2.4GHz', '5G': '5GHz', '6G': '6GHz' };

function linkLabel(link) {
	if (link === 'wired')
		return _("cable");
	return bandLabel[link] || link || '-';
}

// 接続方式とSSIDは見た目には常にセットで意味を持つ(SSIDだけ見ても
// どの帯域かは分からない)ので、1カラムにまとめて表示する。
// 有線には元々SSIDが無いので方式名だけになる。
function linkCell(c) {
	var label = linkLabel(c.link);
	return c.ssid ? (label + ' (' + c.ssid + ')') : label;
}

function deviceCell(c) {
	var name = c.name || '-';
	var vendorOS = [ c.vendor, _(c.os) ].filter(function(v) { return v; }).join(' / ');
	return E('td', { 'class': 'td left' }, [
		E('div', {
			'style': 'max-width:14em;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden',
			'title': c.name || c.mac || '-'
		}, [
			E('strong', {}, name),
			vendorOS ? E('div', { 'style': 'opacity:.8;font-size:90%' }, vendorOS) : '',
			E('div', { 'style': 'opacity:.7;font-size:90%' }, c.mac || '-')
		])
	]);
}

var columns = [
	{ key: 'device', label: _("terminal") },
	{ key: 'ip', label: _("IP address"), numeric: true },
	{ key: 'link', label: _("connection") },
	{ key: 'note', label: _("reference") },
	{ key: 'adblock', label: _("ad block") }
];

function macKey(mac) {
	return mac ? String(mac).trim().toLowerCase() : '';
}

// client_listの豊富な端末情報を正とし、adblock_listのMAC単位の状態だけを
// クライアント側で重ねる。バックエンドの2つの既存RPCは変更しない。
function mergeAdblockState(clients, adblockData) {
	var states = {};
	var available = !!(adblockData && !adblockData.error && Array.isArray(adblockData.clients));
	if (available)
		adblockData.clients.forEach(function(c) {
			var mac = macKey(c.mac);
			if (mac) states[mac] = !!c.adblock;
		});

	return (clients || []).map(function(c) {
		var copy = {};
		Object.keys(c).forEach(function(key) { copy[key] = c[key]; });
		var mac = macKey(c.mac);
		copy.adblock = available && !!mac && states[mac] === true;
		copy.adblock_known = available && !!mac && Object.prototype.hasOwnProperty.call(states, mac);
		return copy;
	});
}

function loadClientData() {
	return Promise.all([
		callClientList().catch(function(err) { return { error: sbair.errorText(err) }; }),
		callAdblockList().catch(function(err) { return { error: sbair.errorText(err) }; })
	]).then(function(values) {
		var clients = values[0] || {};
		var adblock = values[1] || {};
		var data = {};
		Object.keys(clients).forEach(function(key) { data[key] = clients[key]; });
		data.clients = mergeAdblockState(clients.clients, adblock);
		data.adblock_available = !adblock.error && Array.isArray(adblock.clients);
		if (adblock.error) data.adblock_error = adblock.error;
		return data;
	});
}

// IPは文字列比較だと "192.168.0.9" > "192.168.0.10" になってしまうので、
// オクテットごとの数値比較にする。"-"(未解決)は常に末尾へ。
function ipKey(s) {
	if (!s || s === '-')
		return null;
	var parts = s.split('.').map(Number);
	if (parts.length !== 4 || parts.some(isNaN))
		return null;
	return parts[0] * 0x1000000 + parts[1] * 0x10000 + parts[2] * 0x100 + parts[3];
}

function sortClients(list, key, dir) {
	var col = columns.filter(function(c) { return c.key === key; })[0];
	var sorted = (list || []).slice();
	sorted.sort(function(a, b) {
		var av = key === 'device' ? (a.name || a.mac) : a[key];
		var bv = key === 'device' ? (b.name || b.mac) : b[key];
		if (col && col.numeric) {
			var ak = ipKey(av), bk = ipKey(bv);
			if (ak === null && bk === null) return 0;
			if (ak === null) return 1;  // 未解決は末尾
			if (bk === null) return -1;
			return (ak - bk) * dir;
		}
		av = (av === undefined || av === null || av === '') ? '-' : String(av);
		bv = (bv === undefined || bv === null || bv === '') ? '-' : String(bv);
		if (key === 'link') { av = linkLabel(av); bv = linkLabel(bv); }
		return av.localeCompare(bv) * dir;
	});
	return sorted;
}

// showPortScanResult はスキャン結果を表示するのに加え、モーダル自身の中に
// 「範囲を指定して追加スキャン」の入力欄を持つ。閉じずに範囲を変えて
// 何度も実行できるようにするため、onRescan(ip, ports) を渡して自分自身を
// 呼び直す(モーダルの中身をその都度差し替える)。
function showPortScanResult(ip, res, onRescan) {
	var body;
	if (res.error) {
		body = E('p', { 'style': 'color:#c00' }, sbair.errorText(res.error));
	} else {
		var open = res.open || [];
		var scannedNote = res.scanned ? ('(' + res.scanned + _("check port)")) : _("(Check only about 25 frequently used ports)");
		body = !open.length
			? E('p', {}, _("No open ports found.") + scannedNote + '。')
			: sbair.table([ E('tr', { 'class': 'tr table-titles' }, [
				E('th', { 'class': 'th' }, _("port")),
				E('th', { 'class': 'th' }, _("service")),
				E('th', { 'class': 'th' }, _("banner"))
			]) ].concat(open.map(function(p) {
				return E('tr', { 'class': 'tr' }, [
					E('td', { 'class': 'td left' }, String(p.port)),
					E('td', { 'class': 'td left' }, p.service || '-'),
					E('td', { 'class': 'td left' }, p.banner || '-')
				]);
			})));
	}

	var rangeInput = E('input', {
		'class': 'cbi-input-text', 'type': 'text', 'style': 'width:12em',
		'placeholder': _("Example: 1-1024,8080")
	});
	var rescanBtn = E('button', {
		'class': 'cbi-button cbi-button-action',
		'click': function() { onRescan(ip, rangeInput.value); }
	}, _("Scan in a specified range"));

	ui.showModal(ip + _("port scan"), [
		body,
		E('div', { 'style': 'margin-top:1em;padding-top:.8em;border-top:1px solid #ccc;display:flex;gap:.5em;align-items:center;flex-wrap:wrap' }, [
			rangeInput,
			rescanBtn,
			E('span', { 'style': 'opacity:.7;font-size:.9em' }, _("If left blank, only about 25 frequently used ports will be used next time (up to a maximum of 4096 ports)."))
		]),
		E('div', { 'style': 'text-align:right;margin-top:1em' }, [
			E('button', { 'class': 'cbi-button', 'click': function() { ui.hideModal(); } }, _("close"))
		])
	]);
}

function adblockControl(c, available, onToggle) {
	if (!available || c.adblock_known !== true)
		return E('span', { 'style': 'opacity:.7' }, available ? _("Status unknown") : _("acquisition failure"));
	return E('button', {
		'class': c.adblock ? 'cbi-button cbi-button-positive' : 'cbi-button cbi-button-neutral',
		'title': c.adblock ? _("Disable ad blocking with a click") : _("Enable ad blocking with a click"),
		'disabled': (!c.mac || c.mac === '-') ? '' : null,
		'click': function() { onToggle(c.mac, !c.adblock); }
	}, c.adblock ? _("Enable (Disable)") : _("Disable (Enable)"));
}

function clientTable(list, sortKey, sortDir, onSort, onSaveNote, onScan, onDisconnect, adblockAvailable, onToggle) {
	if (!list || !list.length)
		return E('p', {}, _("A connection device cannot be acquired (or does not exist yet)."));

	var head = columns.map(function(c) {
		var arrow = (c.key === sortKey) ? (sortDir > 0 ? ' ▲' : ' ▼') : '';
		return E('th', {
			'class': 'th',
			'style': 'cursor:pointer;user-select:none',
			'click': function() { onSort(c.key); }
		}, c.label + arrow);
	});
	head.push(E('th', { 'class': 'th' }, _("functioning")));
	var rows = [ E('tr', { 'class': 'tr table-titles' }, head) ];

	sortClients(list, sortKey, sortDir).forEach(function(c) {
		var origNote = c.note || '';
		var noteInput = E('input', {
			'class': 'cbi-input-text', 'type': 'text', 'style': 'width:10em',
			'value': origNote,
			// フォーカスを外した瞬間に保存する(値が変わっていないときは何もしない)。
			// 毎回「保存」を押す手間と、押し忘れて消える不安を両方消す狙い。
			'blur': function(ev) {
				var val = ev.target.value;
				if (val === origNote)
					return;
				origNote = val; // 連続blurでの二重保存を防ぐ
				onSaveNote(c.mac, val);
			}
		});
		// clampCell: 幅を絞って2行までに折り返し、はみ出す分は隠す。
		// title属性を必ず添えるので、隠れた分もホバーすれば全文読める。
		var clampCell = function(text, maxWidth) {
			return E('td', { 'class': 'td left' }, [
				E('div', {
					'style': 'max-width:' + maxWidth + ';display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden',
					'title': text
				}, text)
			]);
		};

		rows.push(E('tr', { 'class': 'tr' }, [
			deviceCell(c),
			E('td', { 'class': 'td left', 'title': c.ip || '-' }, c.ip || '-'),
			clampCell(linkCell(c), '10em'),
			E('td', { 'class': 'td left' }, noteInput),
			E('td', { 'class': 'td left' }, adblockControl(c, adblockAvailable, onToggle)),
			// 🔴 tdに直接display:flexを当てると、ブラウザによってはtable-cellの
			// 既定のvertical-align(メモ欄など他の素のtdが縦中央になる由来)が
			// 効かなくなり、メモ欄と縦位置がずれる。tdは素のままにして、
			// 中にflexのdivを1枚だけ入れる。
			E('td', { 'class': 'td left' }, [
				E('div', { 'class': 'sbair-button-group' }, [
					E('button', {
						'class': 'cbi-button cbi-button-action',
						'title': _("port scan"),
						'disabled': (!c.ip || c.ip === '-') ? '' : null,
						'click': function() { onScan(c.ip, ''); }
					}, '🔍'),
					E('button', {
						'class': 'cbi-button cbi-button-remove',
						'title': _("Temporary connection (Wi-Fi only, not a permanent block)"),
						// 有線接続は切断コマンドの対象外(Wi-Fiクライアントのみ)。
						// 「一時切断」= knsh経由でAP側からその場でdeauthするだけで、
						// パスワードを知っていれば端末側からすぐ再接続される。恒久的な
						// ブロックではない(そちらはMACフィルタ画面の役目)。
						// 🔌(プラグ)は「一時的」であることが伝わりにくいとの指摘で
						// ⏸(一時停止)に変更。「切る」ではなく「今だけ止める」イメージ。
						'disabled': (c.link === 'wired' || !c.mac || c.mac === '-') ? '' : null,
						'click': function() {
							if (confirm((c.name || c.mac) + _("Temporarily disconnect your device from Wi-Fi. If you know the password, you will be reconnected immediately. Are you okay?")))
								onDisconnect(c.mac);
						}
					}, '⏸')
				])
			])
		]));
	});
	return sbair.table(rows);
}

function render(data, opts) {
	data = data || {};
	opts = opts || {};
	var body = [];
	body.push(sbair.section(_("Connection device (") + ((data.clients || []).length) + _("big)"), [
		E('div', { 'class': 'sbair-table-scroll', 'style': 'overflow-x:auto' }, [
			clientTable(data.clients, opts.sortKey, opts.sortDir, opts.onSort, opts.onSaveNote, opts.onScan, opts.onDisconnect, data.adblock_available, opts.onToggle)
		])
	]));
	body.push(E('p', { 'style': 'opacity:.8' }, [
		_("Advertising blocks are managed per device MAC address. Each terminal does not need to use the management screen."),
		E('a', { 'href': 'http://' + window.location.hostname + ':8090/?lang=' + i18n.language, 'target': '_blank' },
			'http://' + window.location.hostname + ':8090/'),
		_("If you open , you can turn on/off only your own terminal without logging in."),
		data.adblock_error ? _("I didn't get the ad blocking status.") : ''
	]));
	body.push(sbair.errorBox(data.error ? [ data.error ] : null));
	return body;
}

return view.extend({
	sortKey: 'ip',
	sortDir: 1,

	load: function() {
		return loadClientData();
	},

	render: function(data) {
		var self = this;
		self.data = data;

		var container = E('div', {});

		// showPortScanResultのモーダルから範囲を変えて再実行できるよう、
		// 自分自身を onRescan として渡す(名前付きにして自己参照する)。
		var onScan = function(ip, ports) {
			callScanPorts(ip, ports || '').then(function(res) {
				showPortScanResult(ip, res || {}, onScan);
			}).catch(function(err) {
				ui.addNotification(null, E('p', {}, sbair.errorText(err)), 'danger');
			});
		};

		var redraw = function() {
			dom.content(container, render(self.data, {
				sortKey: self.sortKey,
				sortDir: self.sortDir,
				onSort: function(key) {
					if (self.sortKey === key)
						self.sortDir = -self.sortDir;
					else {
						self.sortKey = key;
						self.sortDir = 1;
					}
					redraw();
				},
				onSaveNote: function(mac, note) {
					callNoteSet(mac, note).then(function(res) {
						if (res && res.error) {
							ui.addNotification(null, E('p', {}, sbair.errorText(res.error)), 'danger');
							return;
						}
						ui.addNotification(null, E('p', {}, _("You have saved your note.")), 'info');
						return reload();
					}).catch(function(err) {
						ui.addNotification(null, E('p', {}, sbair.errorText(err)), 'danger');
					});
				},
				onToggle: function(mac, enabled) {
					callAdblockSet(mac, enabled ? '1' : '0').then(function(res) {
						if (res && res.error) {
							ui.addNotification(null, E('p', {}, sbair.errorText(res.error)), 'danger');
							return;
						}
						return reload();
					}).catch(function(err) {
						ui.addNotification(null, E('p', {}, sbair.errorText(err)), 'danger');
					});
				},
				onScan: onScan,
				onDisconnect: function(mac) {
					callDisconnect(mac).then(function(res) {
						if (res && res.error) {
							ui.addNotification(null, E('p', {}, sbair.errorText(res.error)), 'danger');
							return;
						}
						ui.addNotification(null, E('p', {}, _("I requested amputation. It may take some time to reconnect.")), 'info');
						return reload();
					}).catch(function(err) {
						ui.addNotification(null, E('p', {}, sbair.errorText(err)), 'danger');
					});
				}
			}));
		};

		var reload = function() {
			return loadClientData().then(function(res) {
				self.data = res;
				redraw();
			}).catch(function(err) {
				ui.addNotification(null, E('p', {}, sbair.errorText(err)), 'warning');
			});
		};

		redraw();

		return E('div', { 'class': 'cbi-map' }, [
			E('div', { 'style': 'margin-bottom:1em' }, [
				E('button', {
					'class': 'cbi-button cbi-button-neutral',
					'click': ui.createHandlerFn(this, reload)
				}, _("reload"))
			]),
			container
		]);
	},

	handleSave: null,
	handleSaveApply: null,
	handleReset: null
});
