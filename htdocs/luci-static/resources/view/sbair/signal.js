// SPDX-License-Identifier: MIT
// Copyright (c) 2026 soralis0912
//
// モバイル回線 > 状態。ubus の sbair.overview 1 本だけを叩く。

'use strict';
'require view';
'require poll';
'require rpc';
'require dom';
'require ui';
'require tools.sbair as sbair';

var callOverview    = rpc.declare({ object: 'sbair', method: 'overview' });
var callResetStart  = rpc.declare({ object: 'sbair', method: 'modem_reset' });
var callResetStatus = rpc.declare({ object: 'sbair', method: 'modem_reset_status' });
var callImsStatus   = rpc.declare({ object: 'sbair', method: 'ims_status' });
var callImsSet      = rpc.declare({ object: 'sbair', method: 'ims_set', params: [ 'on' ] });
var callBandSet     = rpc.declare({ object: 'sbair', method: 'band_set', params: [ 'lte', 'nr' ] });
var callBandStatus  = rpc.declare({ object: 'sbair', method: 'band_status' });

function subsection(title, children) {
	return E('div', { 'class': 'sbair-subsection' },
		[ E('h4', {}, title) ].concat(children));
}

// IMS。**出荷状態ではモデム側で無効。** SMS は IMS 経由で配送されるので、
// 未登録だと 1 通も届かない。
//
// ⚠ **判定に config の値を使わない。** モデムは登録しているのに
// `ims_get_config` が Off を返すことがある(書く先と読む先が違うらしい)。
// 真偽は AT+CIREG?、config は参考として小さく出すだけ。
function imsSection(self) {
	var d = self.data || {}, ims = d.ims || {};
	var on = !!ims.registered;
	var children = [];

	if (d.imsBusy)
		children.push(E('div', { 'class': 'alert-message' }, [
			E('span', { 'class': 'spinning' }, ' '), _("Transitioning…")
		]));
	else if (d.imsNote)
		children.push(E('div', { 'class': 'alert-message success' }, sbair.errorText(d.imsNote)));

	var rows = [
		sbair.row(_("registration status"), on ? _("registered") : _("Not registered"),
			on ? null : _("In this state, you will not receive SMS.")),
		sbair.row(_("Available services"), (ims.services && ims.services.length)
			? ims.services.join(' / ') : null),
	];
	// **生の応答と参考値はデバッグ表示のときだけ。** 参考値は登録状態と
	// 食い違うことがあり、並べると「どちらが本当か」を迷わせる。
	if (sbair.isDebug())
		rows.push(
			sbair.row(_("+CIREG (live)"), ims.cireg),
			sbair.row(_("Modem settings"), ims.config ? String(ims.config).trim() : null,
				_("Reference value. May be inconsistent with registration status")));
	children.push(sbair.table(rows));

	children.push(E('div', {}, [
		E('button', {
			'class': 'cbi-button ' + (on ? 'cbi-button-remove' : 'cbi-button-action'),
			'disabled': d.imsBusy ? '' : null,
			'click': ui.createHandlerFn(self, function() { return self.setIms(!on); })
		}, ims.config_on ? _("Disable IMS") : _("Use IMS"))
	]));

	children.push(E('div', { 'class': 'cbi-value-description' }, [
		E('strong', {}, _("SMS is delivered via IMS.")),
		_("If it is not registered, not a single message will arrive. Not valid as shipped."),
		E('br'),
		_("Moving on to rebooting. However, if you reset the settings, the SIM lock will return to default shipping.") +
		_("Since it is out of scope, you will not be able to register with IMS."),
		E('br'),
		_("⚠ This switch is the modem's VoLTE flag. If you activate it without registering") +
		_("Registration takes 10 to 30 seconds, but even if it is invalidated in the registered state,") +
		_("Registration and SMS over IMS may remain.")
	]));

	return subsection(_('IMS'), children);
}

function sameSet(a, b) {
	a = a || []; b = b || [];
	return a.length === b.length && a.every(function(v, i) { return v === b[i]; });
}

// 選択状態を data から作り直す。**編集中の選択を毎回の更新で消さないため**、
// モデム側の有効バンドが変わったときだけ入れ直す。
function syncBandSel(self, b) {
	var enabled = { lte: b.lte_enabled || [], nr: b.nr_enabled || [] };
	if (!self.bandSel || !self.bandApplied ||
	    !sameSet(self.bandApplied.lte, enabled.lte) ||
	    !sameSet(self.bandApplied.nr, enabled.nr)) {
		self.bandSel = { lte: enabled.lte.slice(), nr: enabled.nr.slice() };
		self.bandApplied = { lte: enabled.lte.slice(), nr: enabled.nr.slice() };
	}
}

// バンド 1 個のタイル。**色だけで区別しない** — テーマによっては背景色が
// 効かないので、接続中は ● と太字、無効は薄字と、字面でも分かるようにする。
function bandTile(label, on, serving, onClick) {
	var attrs = {
		'class': 'ifacebadge',
		'style': 'margin:.15em .3em 0 0' + (on ? '' : ';opacity:.45') +
			(onClick ? ';cursor:pointer;user-select:none' : ''),
		'title': onClick ? (on ? _("Disable with a click") : _("Activate with a click"))
		                 : (on ? _("effectiveness") : _("Corresponding but invalid"))
	};
	if (onClick)
		attrs.click = onClick;
	return E('span', attrs, serving ? [ '● ', E('strong', {}, label) ] : label);
}

// **対応バンドを基準に並べる。** 有効なものだけ出すと「ほかに何があるのか」が
// 分からない。対応が取れなかったときだけ有効側で代用する。
function bandTiles(self, kind, prefix, supported, enabled, serving, editable) {
	var sup = (supported && supported.length) ? supported : (enabled || []);
	if (!sup.length)
		return null;
	var sel = self.bandSel[kind];
	var cur = {};
	(serving || []).forEach(function(v) { cur[v] = true; });

	return E('span', {}, sup.map(function(n) {
		var on = sel.indexOf(n) >= 0;
		return bandTile(prefix + n, on, cur[n], editable ? function() {
			// **最後の 1 つは外させない。** LTE が空だとバックエンドが
			// 弾くので、押した結果が拒否になるより押せないほうがよい。
			if (on && kind === 'lte' && sel.length <= 1)
				return;
			self.bandSel[kind] = on ? sel.filter(function(v) { return v !== n; })
			                        : sel.concat([ n ]).sort(function(x, y) { return x - y; });
			self.redraw();
		} : null);
	}));
}

// バンド。**どの AT で取れるかは機体依存**なので、対象機体で確認すること。
// ここは band.go が返した値を並べるだけ。
function bandSection(self) {
	var b = (self.data || {}).band;
	if (!b)
		return null;
	syncBandSel(self, b);

	var job = self.data.bandJob || {};
	var running = (job.state === 'running');
	var editable = !running;
	var children = [];

	if (running)
		children.push(E('div', { 'class': 'alert-message' }, [
			E('span', { 'class': 'spinning' }, ' '),
			_("Applying:") + (job.step || '') + _("— It takes 30 to 60 seconds.")
		]));
	else if (job.state === 'error')
		children.push(E('div', { 'class': 'alert-message warning' },
			(job.step ? job.step + ': ' : '') + (job.message || _("Failed."))));
	else if (job.state === 'done')
		children.push(E('div', { 'class': 'alert-message success' }, job.message || _("You are done.")));

	var serving = null;
	if (b.serving_bands && b.serving_bands.length)
		serving = (b.serving_rat ? b.serving_rat + ' ' : '') +
			b.serving_bands.map(function(n) { return 'B' + n; }).join(' + ');

	var rows = [ sbair.row(_("Band connecting"), serving,
		serving ? null : _("Modem not reporting")) ];

	// 搬送波ごとの内訳。**CA が効いているかはここでしか分からない。**
	if (b.carriers && b.carriers.length)
		rows.push(sbair.row(_("carrier"), E('span', {}, b.carriers.map(function(c, i) {
			return E('span', { 'style': 'display:inline-block;margin-right:1.2em' }, [
				E('strong', {}, c.role + ' B' + c.band),
				' EARFCN ' + c.earfcn + ' / PCI ' + c.pci
			]);
		})), b.carriers.length > 1 ? 'CA ' + b.carriers.length + _("green onion") : null));
	var lte = bandTiles(self, 'lte', 'B', b.lte_supported, b.lte_enabled, b.serving_bands, editable);
	// **5G のタイルに接続中のバンドを渡さない。** +ECBDINFO は接続中の RAT の
	// バンドしか返さないので、LTE につながっているときの 41 を n41 として光らせてしまう。
	var nr = bandTiles(self, 'nr', 'n', b.nr_supported, b.nr_enabled, null, editable);
	if (lte)
		rows.push(sbair.row(_('LTE'), lte));
	if (nr)
		rows.push(sbair.row(_('5G NR'), nr));
	if (sbair.isDebug()) {
		if (b.dmfapp)
			rows.push(sbair.row(_("+ EDMFAPP 6,3 (live)"), b.dmfapp));
		if (b.ecbdinfo)
			rows.push(sbair.row(_("+ECBDINFO (raw)"), b.ecbdinfo));
		if (b.epbseh)
			rows.push(sbair.row(_("+EPBSEH (live)"), b.epbseh));
	}
	children.push(sbair.table(rows));

	var dirty = !sameSet(self.bandSel.lte, self.bandApplied.lte) ||
	            !sameSet(self.bandSel.nr, self.bandApplied.nr);

	var buttons = [
		E('button', {
			'class': 'cbi-button cbi-button-action important',
			'disabled': (running || !dirty) ? '' : null,
			'click': ui.createHandlerFn(self, 'confirmBands')
		}, _("apply")),
		' ',
		E('button', {
			'class': 'cbi-button',
			'disabled': running ? '' : null,
			'click': ui.createHandlerFn(self, function() {
				self.bandSel = {
					lte: (b.lte_supported || self.bandApplied.lte).slice(),
					nr: (b.nr_supported || self.bandApplied.nr).slice()
				};
				self.redraw();
			})
		}, _("Select all corresponding bands"))
	];
	if (dirty)
		buttons.push(' ', E('button', {
			'class': 'cbi-button',
			'disabled': running ? '' : null,
			'click': ui.createHandlerFn(self, function() {
				self.bandSel = {
					lte: self.bandApplied.lte.slice(),
					nr: self.bandApplied.nr.slice()
				};
				self.redraw();
			})
		}, _("Cancel selection")));
	// 直前の設定はバックエンドが uci に残している。**再起動をまたいで戻せる。**
	if (!dirty && (b.prev_lte || b.prev_nr))
		buttons.push(' ', E('button', {
			'class': 'cbi-button',
			'disabled': running ? '' : null,
			'click': ui.createHandlerFn(self, function() {
				self.bandSel = { lte: (b.prev_lte || []).slice(), nr: (b.prev_nr || []).slice() };
				self.redraw();
			})
		}, _("Revert to previous combination")));
	children.push(E('div', {}, buttons));

	var note = [
		_("You can select by pressing the number. The thin number is"), E('strong', {}, _("deactivate")),
		_("The band with , ● attached is the band you are currently holding."),
		E('br'),
		E('strong', {}, _("When applied, radio waves will be interrupted for only a few seconds.")),
		_("If you do not connect to the network in time"), E('strong', {}, _("Automatically rewind to original settings")), '。',
		E('br'),
		_("Since this screen and SSH are on the LAN side, operation continues even if the bands are separated and communication is not possible."),
		E('br'),
		_("The settings on the modem side will return to the factory default upon reboot, but the selected combination will be saved.") +
		_("Automatically resets upon startup.")
	];

	// **「接続方式 NR5G」なのに接続中のバンドが LTE、は矛盾ではない。**
	// 5G NSA では LTE のアンカーに繋いだうえで NR を足す形なので、
	// NR がまだ足されていない間はアンカーの LTE バンドだけが出る。
	// 上の 5G 測定値が空なら、実際に NR が足されていない。
	if (b.serving_rat === 'LTE' && self.data.access_tech &&
	    self.data.access_tech.indexOf('NR') >= 0 && !(b.nr_rsrp && b.nr_rsrp.length))
		note.push(E('br'), E('em', {},
			_("Even if the connection method is NR5G, 5G NSA connects to the LTE anchor and then adds 5G.") +
			_("For now, measurements on the 5G side are empty, so there's no shortage yet.")));

	children.push(E('div', { 'class': 'cbi-value-description' }, note));
	return subsection(_("band"), children);
}

function resetSection(self) {
	var job = self.data.reset || {};
	var running = (job.state === 'running');
	var children = [];

	if (running) {
		children.push(E('div', { 'class': 'alert-message' }, [
			E('span', { 'class': 'spinning' }, ' '),
			_("Resetting:") + (job.step || '') + _("— It takes 30 to 60 seconds.")
		]));
	} else if (job.state === 'error') {
		children.push(E('div', { 'class': 'alert-message warning' },
			(job.step ? job.step + ': ' : '') + (job.message || _("Failed."))));
	} else if (job.state === 'done') {
		children.push(E('div', { 'class': 'alert-message success' },
			job.message || _("You are done.")));
	}

	children.push(E('button', {
		'class': 'cbi-button cbi-button-action',
		'disabled': running ? '' : null,
		'click': ui.createHandlerFn(self, 'confirmReset')
	}, _("Modem reset")));

	children.push(E('div', { 'class': 'cbi-value-description' }, [
		_("Drop the radio waves, raise them again (AT+CFUN=0 → 1), and spread out the WAN again."),
		E('br'),
		E('strong', {}, _("Depending on how the data call fails, the modem side session is blocked.") +
			_("netifd may not go up even if you retry.")),
		_("This is missing when the APN is correct but the connection doesn't work.")
	]));

	return children;
}

// 回線概要の先頭。**数字より先に「どのくらい入っているか」**が分かる形。
// 基準は RSRP、無ければ RSSI。**割合はバッジの中だけ** — 外にも出すと二重になる。
//
// 識別子のチェックボックスとは別に再描画する必要はないため、回線概要へまとめる。
function statusRow(self) {
	var data = self.data || {};
	var dbm = data.rsrp_dbm || data.rssi_dbm || null;
	// 余白の付け方は sbair.section と揃える。概要の情報と登録表を
	// 同じセクション内で視認できるようにする。
	return E('div', { 'style': 'margin-bottom:1em' },
		E('div', { 'style': 'display:flex;align-items:center;gap:1em;flex-wrap:wrap' }, [
			sbair.signalBadge(dbm, data.rsrp_dbm ? 'RSRP' : (data.rssi_dbm ? 'RSSI' : '')),
			E('span', {}, data.registered
				? ((data.operator || '') + ' ' + (data.access_tech || '')).trim()
				: _("Not registered"))
		]));
}

function render(self) {
	var data = self.data || {};
	var body = [];

	body.push(sbair.section(_("Line Overview"), [
		statusRow(self),
		sbair.table([
			sbair.row(_("registration status"), data.registration, data.registered ? null : _("Unable to communicate")),
			sbair.row(_("Registrar"), data.reg_domain),
			sbair.row(_("business person"), data.operator),
			sbair.row(_("Connection method"), data.access_tech),
			sbair.row(_('TAC'), data.tac),
			sbair.row(_("Cell ID"), sbair.mask(data.cell_id))
			])
	]));

	// セル情報系のベンダ拡張は無いので PCI は取りようがない。
	// +CSQ / +CESQ に加えて、AT+QNWCFG がアンテナごとの値を持っている。
	var rows = [
		sbair.row(_('RSSI'), data.rssi_dbm ? data.rssi_dbm + ' dBm' : null),
		sbair.row(_('RSRP'), data.rsrp_dbm ? data.rsrp_dbm + ' dBm' : null),
		sbair.row(_('RSRQ'), data.rsrq_db ? data.rsrq_db + ' dB' : null)
	];

	// **アンテナごとの値は +CESQ より細かい。** つながっていない RAT は
	// バックエンドが落としてくるので、来た分だけ出す。
	var band = data.band || {};
	var perAnt = function(label, arr, unit) {
		if (!arr || !arr.length)
			return;
		rows.push(sbair.row(label, arr.map(function(v) { return v + ' ' + unit; }).join(' / '),
			_("antenna") + arr.length + _("book")));
	};
	perAnt(_("RSRP (LTE each antenna)"), band.lte_rsrp, 'dBm');
	perAnt(_("SINR (LTE each antenna)"), band.lte_sinr, 'dB');
	perAnt(_("RSRP (5G each antenna)"), band.nr_rsrp, 'dBm');
	perAnt(_("SINR (5G each antenna)"), band.nr_sinr, 'dB');

	if (data.signal_note)
		rows.push(sbair.row(_("main"), data.signal_note));
	// 規格外の余りフィールドは意味を確かめていないので生で出す。
	if (sbair.isDebug() && data.cesq)
		rows.push(sbair.row(_("+CESQ (live)"), data.cesq));

	// **ネットワークに登録されていないときに素の数字だけ出さない。**
	// 登録されていなくても +CESQ は見えているセルの測定値を返すので、
	// そのまま出すと「繋がっている」ように見える。
	var signal = [];
	if (!data.registered)
		signal.push(E('div', { 'class': 'alert-message warning' },
			_("Not registered on the network. Below are the measurements of cells that can be received:") +
			_("The quality of the line during the connection is not good.")));
	signal.push(sbair.table(rows));
	body.push(sbair.section(_("spread"), signal));

	var bands = bandSection(self);
	body.push(sbair.section(_("Band / IMS"), [ bands || '', imsSection(self) ]));
	body.push(sbair.section(_("detailed operation"), [
		E('details', {}, [
			E('summary', {}, _("modem reset")),
			E('div', {}, resetSection(self))
		])
	]));
	body.push(sbair.errorBox(data.errors));
	return body;
}

return view.extend({
	load: function() {
		return Promise.all([
			callOverview().catch(function(err) { return { errors: [ sbair.errorText(err) ] }; }),
			callResetStatus().catch(function() { return { state: 'idle' }; }),
			callImsStatus().catch(function() { return {}; }),
			callBandStatus().catch(function() { return { state: 'idle' }; })
		]).then(function(r) {
			var d = r[0] || {};
			d.reset = r[1];
			d.ims = r[2];
			d.bandJob = r[3];
			return d;
		});
	},

	render: function(data) {
		var self = this;
		self.data = data;

		var container = E('div', {}, render(self));
		var redraw = function() {
			dom.content(container, render(self));
		};
		self.redraw = redraw;

		// リセットが走っている間だけ進捗を見に行く。**modem_reset_status は
		// ファイルを読むだけで AT を開かない** ので、ワーカーが flock を
		// 握っている最中でも答える。
		self.watchReset = function() {
			return callResetStatus().then(function(j) {
				var was = self.data.reset && self.data.reset.state;
				self.data.reset = j;
				if (j.state !== 'running' && was === 'running') {
					poll.remove(self.watchReset);
					// 終わったので電波の状態を読み直す。
					return callOverview().then(function(o) {
						o.reset = j;
						self.data = o;
						redraw();
					});
				}
				redraw();
			}).catch(function() {});
		};
		if (data.reset && data.reset.state === 'running')
			poll.add(self.watchReset, 3);

		// バンド適用の進捗。**band_status もファイルを読むだけ**なので、
		// ワーカーが flock を握っている間でも答える。
		self.watchBand = function() {
			return callBandStatus().then(function(j) {
				var was = self.data.bandJob && self.data.bandJob.state;
				self.data.bandJob = j;
				if (j.state !== 'running' && was === 'running') {
					poll.remove(self.watchBand);
					// 適用後の実際の値を読み直す。**選択もそこから作り直す。**
					return callOverview().then(function(o) {
						o.reset = self.data.reset;
						o.ims = self.data.ims;
						o.bandJob = j;
						self.data = o;
						self.bandApplied = null;
						redraw();
					});
				}
				redraw();
			}).catch(function() {});
		};
		if (data.bandJob && data.bandJob.state === 'running')
			poll.add(self.watchBand, 3);

		// 15 秒。呼び出し 1 回がプロセス 1 つ + AT セッション 1 本なので、
		// これ以上詰めるとモデムを叩き続けることになる。
		// **リセット中は回さない。** ワーカーが flock を握っているので
		// 待たされるだけで、進捗は watchReset が出す。
		poll.add(function() {
			if ((self.data.reset && self.data.reset.state === 'running') ||
			    (self.data.bandJob && self.data.bandJob.state === 'running'))
				return;
			return callOverview().then(function(res) {
				res.reset = self.data.reset;
				res.ims = self.data.ims;
				res.bandJob = self.data.bandJob;
				self.data = res;
				redraw();
			}).catch(function() { /* 次の周期で復帰させる */ });
		}, 15);

		return E('div', { 'class': 'cbi-map' }, [
			sbair.revealToggle(_("Display identifier (Cell ID)"), redraw),
			container,
			sbair.debugToggle(redraw)
		]);
	},

	// 有効化すると登録まで 10〜30 秒かかる。押しっぱなしに見えないよう、
	// 切り替えた後に何度か読み直す。
	setIms: function(on) {
		var self = this;
		self.data.imsBusy = true;
		self.data.imsNote = null;
		self.redraw();
		return callImsSet(on).then(function(res) {
			self.data.imsBusy = false;
			if (res && res.error) {
				ui.addNotification(null, E('p', {}, sbair.errorText(res.error)), 'warning');
				self.redraw();
				return;
			}
			self.data.ims = res;
		self.data.imsNote = res.note ? sbair.errorText(res.note) : null;
			self.redraw();
			if (!on) return;
			var tries = 0;
			self.imsWatch = function() {
				return callImsStatus().then(function(s) {
					self.data.ims = s;
					self.redraw();
					if (s.registered || ++tries >= 10) poll.remove(self.imsWatch);
				}).catch(function() {});
			};
			poll.add(self.imsWatch, 3);
		}).catch(function(e) {
			self.data.imsBusy = false;
			self.redraw();
			ui.addNotification(null, E('p', {}, String(e)), 'warning');
		});
	},

	// 適用の前に、何がどう変わるかを並べて見せる。
	confirmBands: function() {
		var self = this, b = self.data.band || {};
		var fmt = function(prefix, arr) {
			return (arr && arr.length) ? arr.map(function(n) { return prefix + n; }).join(' ') : _("doesn't exist");
		};
		var line = function(label, prefix, before, after) {
			var same = sameSet(before, after);
			return E('li', {}, [
				label + ': ' + fmt(prefix, before),
				same ? _("(no change)") : E('span', {}, [ ' → ', E('strong', {}, fmt(prefix, after)) ])
			]);
		};
		// 接続中のバンドを外すのは止めない(戻せるので)が、**必ず名指しする。**
		var dropping = (b.serving_bands || []).filter(function(n) {
			return self.bandSel.lte.indexOf(n) < 0;
		});

		var body = [
			E('p', {}, _("Change the band you want to activate as follows:")),
			E('ul', {}, [
				line('LTE', 'B', self.bandApplied.lte, self.bandSel.lte),
				line('5G NR', 'n', self.bandApplied.nr, self.bandSel.nr)
			])
		];
		if (dropping.length)
			body.push(E('div', { 'class': 'alert-message warning' }, [
				E('strong', {}, _("I'm holding B right now") + dropping.join(' / B') + _("Remove .")),
				_("If you cannot move to another band, it will be out of range, but in that case it will be automatically restored.")
			]));
		body.push(E('ul', {}, [
			E('li', {}, _("Radio waves will be lost for a few seconds (a rescan will be performed).")),
			E('li', {}, _("It takes 30~60 seconds")),
			E('li', {}, _("Automatically rewinds if no network connection is reached in time")),
			E('li', {}, _("This screen and SSH are on the LAN side so they don't drop out."))
		]));
		body.push(E('div', { 'class': 'right' }, [
			E('button', { 'class': 'cbi-button', 'click': ui.hideModal }, _("stop")),
			' ',
			E('button', {
				'class': 'cbi-button cbi-button-action important',
				'click': ui.createHandlerFn(self, function() {
					return callBandSet(self.bandSel.lte.join(','), self.bandSel.nr.join(','))
						.then(function(res) {
							ui.hideModal();
							if (res && res.error) {
								ui.addNotification(null, E('p', {}, sbair.errorText(res.error)), 'warning');
								return;
							}
							self.data.bandJob = { state: 'running', step: _("movement") };
							poll.add(self.watchBand, 3);
							self.redraw();
						});
				})
			}, _("Apply selected band changes"))
		]));
		return ui.showModal(_("change band"), body);
	},

	confirmReset: function() {
		var self = this;
		return ui.showModal(_("modem reset"), [
			E('p', {}, _("Turn the modem's radio waves down once and then up again to turn the WAN back on.")),
			E('ul', {}, [
				E('li', {}, _("Communication is lost (AT+CFUN=0 → 1)")),
				E('li', {}, _("It takes 30~60 seconds")),
				E('li', {}, _("APN settings will not change."))
			]),
			E('div', { 'class': 'right' }, [
				E('button', { 'class': 'cbi-button', 'click': ui.hideModal }, _("stop")),
				' ',
				E('button', {
					'class': 'cbi-button cbi-button-action',
					'click': ui.createHandlerFn(self, function() {
						return callResetStart().then(function(res) {
							ui.hideModal();
							if (res && res.error) {
								ui.addNotification(null, E('p', {}, sbair.errorText(res.error)), 'warning');
								return;
							}
							self.data.reset = { state: 'running', step: _("movement") };
							poll.add(self.watchReset, 3);
							self.redraw();
						});
					})
				}, _("reset"))
			])
		]);
	},

	handleSave: null,
	handleSaveApply: null,
	handleReset: null
});
