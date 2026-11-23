// SPDX-License-Identifier: MIT
// Copyright (c) 2026 soralis0912
//
// SIM 関連。マッピングの切替と、eUICC の profile。

'use strict';
'require view';
'require poll';
'require rpc';
'require ui';
'require dom';
'require tools.sbair as sbair';
'require tools.sbair-i18n as i18n';

var _ = i18n.translate;

var callStatus    = rpc.declare({ object: 'sbair', method: 'esim_status' });
var callSimmapSet = rpc.declare({ object: 'sbair', method: 'simmap_set',
                                  params: [ 'mapping' ] });
var callSimmapGet = rpc.declare({ object: 'sbair', method: 'simmap_status' });
var callDownload  = rpc.declare({ object: 'sbair', method: 'esim_download',
                                  params: [ 'activation_code', 'confirmation_code' ] });
var callDlStatus  = rpc.declare({ object: 'sbair', method: 'esim_download_status' });
var callLockGet   = rpc.declare({ object: 'sbair', method: 'simlock_get' });
var callLockSet   = rpc.declare({ object: 'sbair', method: 'simlock_set', params: [ 'on' ] });
var callLockStat  = rpc.declare({ object: 'sbair', method: 'simlock_status' });
var callApnStatus = rpc.declare({ object: 'sbair', method: 'apn_status' });
var callApnSet    = rpc.declare({ object: 'sbair', method: 'apn_set',
                                  params: [ 'iccid', 'apn', 'auth', 'username',
                                            'password', 'iptype', 'label',
                                            'unlock', 'ims' ] });
var callApnApply  = rpc.declare({ object: 'sbair', method: 'apn_apply' });
var callApnDelete = rpc.declare({ object: 'sbair', method: 'apn_delete', params: [ 'iccid' ] });
var callApnProbe  = rpc.declare({ object: 'sbair', method: 'apn_probe' });
var callNickname  = rpc.declare({ object: 'sbair', method: 'esim_nickname',
                                  params: [ 'iccid', 'nickname' ] });

// ql_datacall の auth の値。proto_config_add_int auth。
var AUTH = { '0': _("doesn't exist"), '1': 'PAP', '2': 'CHAP', '3': 'PAP/CHAP' };
var callProfileOp = function(method, iccid) {
	return rpc.declare({ object: 'sbair', method: method, params: [ 'iccid' ] })(iccid);
};

var CARD = {
	none:  _("doesn't exist"),
	sim:   _("Generic SIM (not eUICC)"),
	euicc: 'eUICC'
};

function subsection(title, children) {
	return E('div', { 'class': 'sbair-subsection' },
		[ E('h4', {}, title) ].concat(children));
}

function details(title, children) {
	return E('details', {}, [
		E('summary', {}, title),
		E('div', {}, children)
	]);
}

function stateBadge(state) {
	var on = (state === 'enabled');
	return E('span', {
		'class': 'ifacebadge',
		'style': on ? 'background-color:#5b5' : ''
	}, on ? _("effectiveness") : _("deactivate"));
}

return view.extend({
	load: function() {
		return Promise.all([
			callStatus().catch(function(err) { return { error: sbair.errorText(err) }; }),
			callSimmapGet().catch(function() { return { state: 'idle' }; }),
			callDlStatus().catch(function() { return { state: 'idle' }; }),
			callLockGet().catch(function() { return {}; }),
			callLockStat().catch(function() { return { state: 'idle' }; }),
			callApnStatus().catch(function() { return {}; })
		]).then(function(r) {
			return { status: r[0], sw: r[1], dl: r[2],
			         lock: r[3], lockJob: r[4], apn: r[5] };
		});
	},

	render: function(data) {
		var self = this;
		self.data = data;

		var container = E('div', {});
		var redraw = function() { dom.content(container, self.body()); };
		self.redraw = redraw;

		// 切替が走っている間だけ状態を見に行く。simmap_status はファイルを
		// 読むだけだが、それでも 1 回が 1 プロセスなので常時は回さない。
		self.watch = function() {
			return callSimmapGet().then(function(sw) {
				var was = self.data.sw && self.data.sw.state;
				self.data.sw = sw;
				if (sw.state !== 'running' && was === 'running') {
					poll.remove(self.watch);
					// 切替が終わったのでカードを読み直す。
					return callStatus().then(function(st) {
						self.data.status = st;
						redraw();
					});
				}
				redraw();
			}).catch(function() {});
		};
		// インストールの監視。終わったらカードを読み直して止める。
		self.watchDl = function() {
			return callDlStatus().then(function(dl) {
				var was = self.data.dl && self.data.dl.state;
				self.data.dl = dl;
				if (dl.state !== 'running' && was === 'running') {
					poll.remove(self.watchDl);
					return callStatus().then(function(st) {
						self.data.status = st;
						redraw();
					});
				}
				redraw();
			}).catch(function() {});
		};

		// SIM ロックの切替も CFUN の往復があるので監視する。
		self.watchLock = function() {
			return callLockStat().then(function(lj) {
				var was = self.data.lockJob && self.data.lockJob.state;
				self.data.lockJob = lj;
				if (lj.state !== 'running' && was === 'running') {
					poll.remove(self.watchLock);
					return Promise.all([ callLockGet(), callStatus() ]).then(function(r) {
						self.data.lock = r[0];
						self.data.status = r[1];
						redraw();
					});
				}
				redraw();
			}).catch(function() {});
		};

		if (data.sw && data.sw.state === 'running')
			poll.add(self.watch, 3);
		if (data.lockJob && data.lockJob.state === 'running')
			poll.add(self.watchLock, 3);
		if (data.dl && data.dl.state === 'running')
			poll.add(self.watchDl, 3);

		redraw();

		return E('div', { 'class': 'cbi-map' }, [
			sbair.revealToggle(_("Display identifier (EID/ICCID)"), redraw),
			container
		]);
	},

	body: function() {
		var self = this;
		var st = this.data.status || {};
		var sw = this.data.sw || {};
		var running = (sw.state === 'running');
		var body = [];

		// --- SIM マッピング -------------------------------------------------
		var rows = [
			sbair.row(_("mapping"), sbair.simMappingLabel(st.mapping)),
			sbair.row(_("card"), CARD[st.card] || st.card),
			sbair.row(_("SIM status"), st.sim_status),
			sbair.row(_("phone number"), st.msisdn ? sbair.mask(st.msisdn) : null),
			sbair.row(_('ICCID'), sbair.mask(st.iccid))
		];

		var target = (st.mapping === 1) ? 2 : 1;
		var mapChildren = [ sbair.table(rows) ];

		if (running) {
			mapChildren.push(E('div', { 'class': 'alert-message' }, [
				E('p', {}, [ E('strong', {}, _("Transitioning:")), sbair.errorText(sw.step || '') ]),
				E('p', {}, _("It takes 30 to 60 seconds. Meanwhile AT is not responding.") +
				           _("Other tabs are also temporarily unreadable."))
			]));
		} else {
			if (sw.state === 'error')
				mapChildren.push(E('div', { 'class': 'alert-message warning' },
					_("Last conversion failed (") + sbair.errorText(sw.step || '') + '): ' + sbair.errorText(sw.message || '')));
			else if (sw.state === 'done')
				mapChildren.push(E('div', { 'class': 'alert-message' },
					_("The conversion is complete.") + (sw.message ? sbair.errorText(sw.message) : '')));

			mapChildren.push(E('div', { 'style': 'margin-top:1em' }, [
				E('button', {
					'class': 'cbi-button cbi-button-action',
					'click': ui.createHandlerFn(this, function() {
						return self.confirmSwitch(target);
					})
				}, sbair.simMappingLabel(target) + _("switch to"))
			]));
			mapChildren.push(E('div', { 'class': 'cbi-value-description' },
				_("⚠ Stop propagation during transition (AT+CFUN=4).") +
				_("If the conversion destination does not have a valid profile, it will be out of service.") +
				_("Rebooting will return it to the physical slot side.")));
		}
		body.push(sbair.section(_("Current SIM"), [
			subsection(_("SIM Mapping"), mapChildren)
		]));
		body.push(this.simLockSection());
		body.push(sbair.section(_("Communication settings"), [ this.apnSection() ]));

		// --- eUICC ---------------------------------------------------------
		if (st.error) {
			body.push(E('div', { 'class': 'alert-message warning' }, st.error));
			return body;
		}

		if (!st.available) {
		body.push(sbair.section(_('eSIM'), [ subsection(_('eUICC'), [
				E('p', {}, st.reason ? sbair.errorText(st.reason) : _("There is no eUICC.")),
				(st.card === 'sim')
					? E('p', {}, _("A regular SIM has been inserted. Profile work is only possible with eUICC cards."))
					: ''
			]) ]));
			body.push(sbair.section(_("detailed operation"), [
				details(_("Add eSIM"), this.installer(running))
			]));
			return body;
		}

		body.push(sbair.section(_('eSIM'), [
			subsection(_("eUICC information"), [ sbair.table([
				sbair.row(_('EID'), sbair.mask(st.eid)),
				sbair.row(_('SGP.22'), st.svn),
				sbair.row(_('ISD-R AID'), sbair.mask(st.isdr_aid))
			]) ]),
			subsection(_("profile"), [
				st.profiles_error
					? E('div', { 'class': 'alert-message warning' }, sbair.errorText(st.profiles_error))
					: this.profileTable(st.profiles, running)
			])
		]));

		body.push(sbair.section(_("detailed operation"), [
			details(_("Add eSIM"), this.installer(running))
		]));
		return body;
	},

	// SIMロックは危険な操作だが、現在の状態は現在のSIMの近くで常に
	// 確認できるようにする。解除・再ロックのボタンだけを折りたたむ。
	simLockSection: function() {
		var lk = this.data.lock || {};
		var state = lk.locked === undefined ? _("unknown") : (lk.locked ? _("Locking") : _("cleared"));
		return sbair.section(_("SIM lock"), [
			E('p', { 'style': 'font-size:115%;font-weight:600;margin-bottom:.6em' },
				_("Current status:") + state),
			details(_("SIM lock operation indication (danger)"), this.lockSection())
		]);
	},

	// SIM ロック(ネットワークロック)。解除の鍵はファームウェア内の
	// /bin/sim_lock.sh が持っていて、こちらは持たない。
	lockSection: function() {
		var self = this;
		var lk = this.data.lock || {};
		var lj = this.data.lockJob || {};
		var busy = (lj.state === 'running');
		var locked = !!lk.locked;
		var children = [];

		if (busy) {
			children.push(E('div', { 'class': 'alert-message' }, [
				E('p', {}, [ E('strong', {}, _("Transitioning:")), sbair.errorText(lj.step || '') ]),
				E('p', {}, _("Turn off the radio waves to read the SIM again. It takes 40-60 seconds."))
			]));
			return children;
		}

		if (lj.state === 'error')
			children.push(E('div', { 'class': 'alert-message warning' },
				_("Last conversion failed (") + sbair.errorText(lj.step || '') + '): ' + sbair.errorText(lj.message || '')));
		else if (lj.state === 'done')
			children.push(E('div', { 'class': 'alert-message' }, lj.message ? sbair.errorText(lj.message) : _("The conversion is complete.")));

		var rows = [ sbair.row(_("situation"), locked ? _("Locking") : _("cleared"),
			locked ? _("Third-party SIMs cannot be used.") : null) ];
		// **残り試行回数を必ず出す。** 鍵を間違えるとここが減り、
		// 使い切ると戻せなくなる。件数(capacity)と取り違えないこと。
		(lk.categories || []).forEach(function(c) {
			if (!c.label)
				return;
			rows.push(sbair.row('　' + _(c.label),
				(c.locked ? _("Locking") : _("cleared")) +
				_("—try the rest") + c.remaining + '/' + c.max_retry +
				_(", registration") + c.entries + '/' + c.capacity + _("case")));
		});
		children.push(sbair.table(rows));

		children.push(E('div', { 'style': 'margin-top:1em' }, [
			E('button', {
				'class': 'cbi-button ' + (locked ? 'cbi-button-action' : 'cbi-button-neutral'),
				'click': ui.createHandlerFn(self, function() {
					return self.confirmLock(!locked);
				})
			}, locked ? _("unlocked") : _("reset the lock"))
		]));
		children.push(E('div', { 'class': 'cbi-value-description' },
			_("Hit AT+ESMLCK directly. After switching, the radio waves stop once to read the SIM again.")));

		return children;
	},

	confirmLock: function(on) {
		var self = this;
		var body = [ E('p', {}, on
			? _("Multiply SIM lock again. Non-SoftBank SIMs cannot be used.")
			: _("Unlock SIM. You can use a third-party SIM.")) ];
		body.push(E('ul', {}, [
			E('li', {}, _("Stop propagation once (AT+CFUN=0 → 1). communication is lost")),
			E('li', {}, _("It takes 40-60 seconds")),
			on ? '' : E('li', {}, _("Different keys reduce the number of remaining attempts. Once you use it up you can't go back"))
		]));
		return ui.showModal(_("SIM lock") + (on ? _("setting") : _("clear")), body.concat([
			E('div', { 'class': 'right' }, [
				E('button', { 'class': 'cbi-button', 'click': ui.hideModal }, _("stop")),
				' ',
				E('button', {
					'class': 'cbi-button ' + (on ? 'cbi-button-negative' : 'cbi-button-action'),
					'click': ui.createHandlerFn(self, function() {
						return callLockSet(on).then(function(res) {
							ui.hideModal();
							if (res && res.error) {
								ui.addNotification(null, E('p', {}, sbair.errorText(res.error)), 'warning');
								return;
							}
							self.data.lockJob = { state: 'running', step: _("movement") };
							poll.add(self.watchLock, 3);
							self.redraw();
						});
					})
				}, on ? _("redial") : _("clear"))
			])
		]));
	},

	// APN。**ICCID をキーに保存する** ので、SIM を差し替えても
	// そのカードに紐づいたものが自動で当たる。保存先は /etc/config/sbair。
	apnSection: function() {
		var self = this;
		var a = this.data.apn || {};
		var e = a.entry || {};
		var children = [];

		if (!a.iccid) {
			return subsection(_('APN'), [ E('p', {}, _("The SIM cannot be read and cannot be set up.")) ]);
		}

		var f = {};
		var field = function(key, label, value, ph, type) {
			f[key] = E('input', {
				'type': type || 'text',
				'class': 'cbi-input-text',
				'style': 'width:100%;max-width:24em',
				'value': value || '',
				'placeholder': ph || ''
			});
			return E('div', { 'class': 'cbi-value' }, [
				E('label', { 'class': 'cbi-value-title' }, label),
				E('div', { 'class': 'cbi-value-field' }, [ f[key] ])
			]);
		};

		var check = function(key, label, on, desc) {
			f[key] = E('input', { 'type': 'checkbox', 'checked': on ? '' : null });
			return E('div', { 'class': 'cbi-value' }, [
				E('label', { 'class': 'cbi-value-title' }, label),
				E('div', { 'class': 'cbi-value-field' }, [
					f[key],
					E('div', { 'class': 'cbi-value-description' }, desc)
				])
			]);
		};

		children.push(sbair.table([
			sbair.row(_("Target SIM"), sbair.mask(a.iccid)),
			sbair.row(_("Current WAN"), (a.wan && a.wan.apn) ? a.wan.apn : null,
				a.applied ? _("Applied") : (e.apn ? _("Not applied") : null))
		]));

		children.push(field('label', _("Name (optional)"), e.label, _("Example: au")));
		children.push(field('apn', 'APN', e.apn, _("Example: au.au-net.ne.jp")));

		var auth = E('select', { 'class': 'cbi-input-select' },
			Object.keys(AUTH).map(function(k) {
				return E('option', { 'value': k,
					'selected': (String(e.auth || '0') === k) ? '' : null }, AUTH[k]);
			}));
		f.auth = auth;
		children.push(E('div', { 'class': 'cbi-value' }, [
			E('label', { 'class': 'cbi-value-title' }, _("Authentication method")),
			E('div', { 'class': 'cbi-value-field' }, [ auth ])
		]));

		children.push(field('username', _("user name"), e.username));
		children.push(field('password', _("password"), e.password, '', 'password'));

		// **この SIM を使うのに要るモデム側の状態を、APN と一緒に持つ。**
		// 適用のたびに揃えるので、設定が出荷既定へ戻っても起動時に元に戻る。
		children.push(check('unlock', _("to unlock sim"), e.unlock == '1',
			_("Required to connect with a SIM from another company. It only moves when you hang it,") +
			_("At that time, radio waves are stopped for 40 to 60 seconds.")));
		children.push(check('ims', _("Enable IMS"), e.ims == '1',
			_("SMS is delivered via IMS. If it is unregistered, not a single message will arrive.")));

		var save = function(apply) {
			return callApnSet(a.iccid, (f.apn.value || '').trim(),
				f.auth.value, (f.username.value || '').trim(),
				f.password.value || '', '', (f.label.value || '').trim(),
				f.unlock.checked ? '1' : '0', f.ims.checked ? '1' : '0'
			).then(function(res) {
				if (res && res.error) {
					ui.addNotification(null, E('p', {}, sbair.errorText(res.error)), 'warning');
					return;
				}
				if (!apply)
					return self.reloadApn(_("Saved."));
				return callApnApply().then(function(r) {
					if (r && r.error) {
						ui.addNotification(null, E('p', {}, r.error), 'warning');
						return;
					}
					return self.reloadApn(r.note ? sbair.errorText(r.note) : _("Applied."));
				});
			});
		};

		children.push(E('div', { 'style': 'margin-top:1em' }, [
			// SIM に聞いて欄を埋める。**入れるだけで保存も適用もしない** —
			// 事業者から降ってきた値がその契約で正しいとは限らない。
			E('button', {
				'class': 'cbi-button cbi-button-neutral',
				'style': 'margin-right:.4em',
				'click': ui.createHandlerFn(self, function() {
					return callApnProbe().then(function(res) {
						if (!res || res.error) {
							ui.addNotification(null,
								E('p', {}, (res && res.error) ? sbair.errorText(res.error) : _("Unable to read from SIM.")),
								'warning');
							return;
						}
						var g = res.suggestion || {};
						if (g.apn)      f.apn.value = g.apn;
						if (g.username) f.username.value = g.username;
						if (g.password) f.password.value = g.password;
						if (g.auth)     f.auth.value = g.auth;
						ui.addNotification(null,
							E('p', {}, _("I read from SIM:") + g.apn +
								_(". Please check the contents and save.")), 'info');
					});
				})
			}, _("Reading from SIM")),
			E('button', {
				'class': 'cbi-button cbi-button-action',
				'style': 'margin-right:.4em',
				'click': ui.createHandlerFn(self, function() { return save(true); })
			}, _("Save and Apply")),
			E('button', {
				'class': 'cbi-button cbi-button-neutral',
				'style': 'margin-right:.4em',
				'click': ui.createHandlerFn(self, function() { return save(false); })
			}, _("save only")),
			e.apn ? E('button', {
				'class': 'cbi-button cbi-button-negative',
				'click': ui.createHandlerFn(self, function() {
					return callApnDelete(a.iccid).then(function() {
						return self.reloadApn(_("Deleted."));
					});
				})
			}, _("delete")) : ''
		]));
		children.push(E('div', { 'class': 'cbi-value-description' },
			_("The destination is /etc/config/sbair and remains for each ICCID.") +
			_("At startup and after switching SIMs, the one corresponding to that SIM is automatically selected.")));

		// 他の SIM の分も一覧で見せる。差し替えたときに何が入っているか分かる。
		var others = (a.entries || []).filter(function(x) { return x.iccid !== a.iccid; });
		if (others.length) {
			var rows = [ E('tr', { 'class': 'tr table-titles' }, [
				E('th', { 'class': 'th' }, _('ICCID')),
				E('th', { 'class': 'th' }, _("name")),
				E('th', { 'class': 'th' }, _('APN'))
			]) ];
			others.forEach(function(x) {
				rows.push(E('tr', { 'class': 'tr' }, [
					E('td', { 'class': 'td left' }, sbair.mask(x.iccid)),
					E('td', { 'class': 'td left' }, x.label || '-'),
					E('td', { 'class': 'td left' }, x.apn)
				]));
			});
			children.push(E('h4', { 'style': 'margin-top:1.5em' }, _("Stored on another SIM")));
			children.push(sbair.table(rows));
		}

		return subsection(_('APN'), children);
	},

	reloadApn: function(msg) {
		var self = this;
		return callApnStatus().then(function(a) {
			self.data.apn = a;
			self.redraw();
			if (msg)
				ui.addNotification(null, E('p', {}, msg), 'info');
		});
	},

	// eSIM のインストール (ES9+)。20〜30 秒かかるので、開始したら
	// esim_download_status を見に行く。
	installer: function(disabled) {
		var self = this;
		var dl = this.data.dl || {};
		var busy = (dl.state === 'running');

		if (busy) {
			return [
				E('div', { 'class': 'alert-message' }, [
					E('p', {}, [ E('strong', {}, _("Installing:")), sbair.errorText(dl.step || '') ]),
					E('p', {}, _("It takes 20 to 30 seconds for communication with SM-DP+ to end."))
				])
			];
		}

		var code = E('input', {
			'type': 'text',
			'class': 'cbi-input-text',
			'style': 'width:100%;max-width:40em',
			'placeholder': 'LPA:1$rsp.example.com$MATCHING-ID'
		});
		var cc = E('input', {
			'type': 'text',
			'class': 'cbi-input-text',
			'style': 'width:100%;max-width:20em',
			'placeholder': _("(Requested profile only)")
		});

		var children = [];
		if (dl.state === 'error')
			children.push(E('div', { 'class': 'alert-message warning' },
				_("Last installation failed (") + sbair.errorText(dl.step || '') + '): ' + sbair.errorText(dl.message || '')));
		else if (dl.state === 'done')
			children.push(E('div', { 'class': 'alert-message' }, dl.message ? sbair.errorText(dl.message) : _("Installation is complete.")));

		children.push(E('div', { 'class': 'cbi-value' }, [
			E('label', { 'class': 'cbi-value-title' }, _("Activation Code")),
			E('div', { 'class': 'cbi-value-field' }, [
				code,
				E('div', { 'class': 'cbi-value-description' },
					_("The string \"LPA:1$...\" passed to the operator. The content of the QR code is also this."))
			])
		]));
		children.push(E('div', { 'class': 'cbi-value' }, [
			E('label', { 'class': 'cbi-value-title' }, _("verification code")),
			E('div', { 'class': 'cbi-value-field' }, [ cc ])
		]));
		children.push(E('div', {}, [
			E('button', {
				'class': 'cbi-button cbi-button-action',
				'disabled': disabled ? '' : null,
				'click': ui.createHandlerFn(self, function() {
					var v = (code.value || '').trim();
					if (!v) {
						ui.addNotification(null,
							E('p', {}, _("Enter your activation code.")), 'warning');
						return;
					}
					return callDownload(v, (cc.value || '').trim()).then(function(res) {
						if (res && res.error) {
							ui.addNotification(null, E('p', {}, sbair.errorText(res.error)), 'warning');
							return;
						}
						self.data.dl = { state: 'running', step: _("movement") };
						poll.add(self.watchDl, 3);
						self.redraw();
					});
				})
			}, _("installation"))
		]));
		children.push(E('div', { 'class': 'cbi-value-description' },
			_("⚠ Downloads are often one-time, and if they fail, they are reissued to the business operator.") +
			_("You have to ask for it. SM-DP+ passes IMEI.")));

		return children;
	},

	profileTable: function(list, disabled) {
		var self = this;
		if (!list || !list.length)
			return E('p', {}, _("There is no profile."));

		var rows = [ E('tr', { 'class': 'tr table-titles' }, [
			E('th', { 'class': 'th' }, _('ICCID')),
			E('th', { 'class': 'th' }, _("situation")),
			E('th', { 'class': 'th' }, _("business person")),
			E('th', { 'class': 'th' }, _("name")),
			E('th', { 'class': 'th' }, '')
		]) ];

		list.forEach(function(p) {
			var on = (p.state === 'enabled');
			var btn = function(label, method, style) {
				return E('button', {
					'class': 'cbi-button ' + style,
					'style': 'margin-right:.4em',
					'disabled': disabled ? '' : null,
					'click': ui.createHandlerFn(self, function() {
						return self.confirmProfile(method, p);
					})
				}, label);
			};
			// 名前は付いていれば太字、無ければ profile 名を薄く出す。
			// **どちらを見ているか分かるようにする** — 名前を付けたのに
			// 変わっていないように見えるのが一番困る。
			var label = p.nickname
				? E('strong', {}, p.nickname)
				: E('span', { 'style': 'opacity:.7' }, p.name || '-');

			rows.push(E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td left' }, sbair.mask(p.iccid)),
				E('td', { 'class': 'td left' }, stateBadge(p.state)),
				E('td', { 'class': 'td left' }, p.provider || '-'),
				E('td', { 'class': 'td left' }, [
					label, ' ',
					E('button', {
						'class': 'cbi-button cbi-button-neutral',
						'style': 'padding:0 .4em;margin-left:.3em',
						'title': _("by another name"),
						'disabled': disabled ? '' : null,
						'click': ui.createHandlerFn(self, function() {
							return self.editNickname(p);
						})
					}, '✎')
				]),
				E('td', { 'class': 'td left' }, [
					on ? btn(_("deactivate"), 'esim_disable', 'cbi-button-neutral')
					   : btn(_("activate"), 'esim_enable', 'cbi-button-action'),
					btn(_("delete"), 'esim_delete', 'cbi-button-negative')
				])
			]));
		});
		return sbair.table(rows);
	},

	// 切替は電波を止めるので、必ず確認を挟む。
	confirmSwitch: function(target) {
		var self = this;
		return ui.showModal(_("Switch SIM Mapping"), [
			E('p', {}, sbair.simMappingLabel(target) + _(" will switch to the selected SIM.")),
			E('ul', {}, [
				E('li', {}, _("Stop propagation (AT+CFUN=4). communication is lost")),
				E('li', {}, _("It takes 30 to 60 seconds and AT does not respond.")),
				E('li', {}, _("If the conversion destination does not have a valid profile, it will be out of service.")),
				E('li', {}, _("The built-in eSIM doesn't have an ISD-R, so you can't manipulate the profile there."))
			]),
			E('div', { 'class': 'right' }, [
				E('button', {
					'class': 'cbi-button',
					'click': ui.hideModal
				}, _("stop")),
				' ',
				E('button', {
					'class': 'cbi-button cbi-button-action',
					'click': ui.createHandlerFn(self, function() {
						return callSimmapSet(target).then(function(res) {
							ui.hideModal();
							if (res && res.error) {
								ui.addNotification(null, E('p', {}, sbair.errorText(res.error)), 'warning');
								return;
							}
							self.data.sw = { state: 'running', step: _("movement"), target: target };
							poll.add(self.watch, 3);
							self.redraw();
						});
					})
				}, _("conversion"))
			])
		]);
	},

	// profile に名前を付ける (ES10c SetNickname)。
	// **空にすると名前が消える** — SGP.22 がそれを許すので、そのまま渡す。
	editNickname: function(p) {
		var self = this;
		var input = E('input', {
			'type': 'text',
			'class': 'cbi-input-text',
			'style': 'width:100%;max-width:24em',
			'value': p.nickname || '',
			'placeholder': p.name || '',
			'maxlength': '64'
		});
		return ui.showModal(_("profile name"), [
			E('p', {}, [
				_("The name of the business operator is"),
				E('strong', {}, p.provider || '-'), ' / ',
				E('strong', {}, p.name || '-'),
				_(". The name you give here will be saved to the card and will be displayed in addition to this screen.")
			]),
			E('div', { 'class': 'cbi-value' }, [
				E('label', { 'class': 'cbi-value-title' }, _("name")),
				E('div', { 'class': 'cbi-value-field' }, [
					input,
					E('div', { 'class': 'cbi-value-description' },
						_("If left blank, the specified name will be deleted."))
				])
			]),
			E('div', { 'class': 'right' }, [
				E('button', { 'class': 'cbi-button', 'click': ui.hideModal }, _("stop")),
				' ',
				E('button', {
					'class': 'cbi-button cbi-button-action',
					'click': ui.createHandlerFn(self, function() {
						return callNickname(p.iccid, input.value || '').then(function(res) {
							ui.hideModal();
							if (res && res.error) {
								ui.addNotification(null, E('p', {}, sbair.errorText(res.error)), 'warning');
								return;
							}
							return callStatus().then(function(st) {
								self.data.status = st;
								self.redraw();
							});
						});
					})
				}, _("save"))
			])
		]);
	},

	confirmProfile: function(method, p) {
		var self = this;
		var label = { esim_enable: _("activate"), esim_disable: _("deactivate"), esim_delete: _("delete") }[method];
		var body = [
			E('p', {}, [ E('strong', {}, p.nickname || p.name || p.iccid),
			             '~' + label + _("do.") ])
		];
		if (method === 'esim_delete')
			body.push(E('div', { 'class': 'alert-message warning' },
				_("Deletion cannot be undone. To re-enter the same profile,") +
				_("You will need to reissue the activation code.")));
		else
			body.push(E('p', {}, _("Because the card is reset (REFRESH)") +
				_("It takes a few seconds for reflection to occur.")));

		return ui.showModal(_("Profile for ") + label, body.concat([
			E('div', { 'class': 'right' }, [
				E('button', { 'class': 'cbi-button', 'click': ui.hideModal }, _("stop")),
				' ',
				E('button', {
					'class': 'cbi-button ' +
						(method === 'esim_delete' ? 'cbi-button-negative' : 'cbi-button-action'),
					'click': ui.createHandlerFn(self, function() {
						return callProfileOp(method, p.iccid).then(function(res) {
							ui.hideModal();
							if (res && res.error) {
								ui.addNotification(null, E('p', {}, sbair.errorText(res.error)), 'warning');
								return;
							}
							// enable/disable の直後はカードが REFRESH 中で
							// AT+CCHO を蹴る。少し待ってから読み直す。
							return new Promise(function(resolve) {
								window.setTimeout(resolve, res && res.refresh_pending ? 6000 : 1000);
							}).then(function() {
								return callStatus().then(function(st) {
									self.data.status = st;
									self.redraw();
								});
							});
						});
					})
				}, label)
			])
		]));
	},

	handleSave: null,
	handleSaveApply: null,
	handleReset: null
});
