// SPDX-License-Identifier: MIT
// Copyright (c) 2026 soralis0912
//
// タブで共通に使う小物。

'use strict';
'require baseclass';
'require tools.sbair-i18n as i18n';

var _ = i18n.translate;

// 識別子は既定で伏せる。IMEI / IMSI / ICCID / EID / Cell ID は
// 設置場所と契約者の特定に直結するので、画面を撮って貼る前提で既定を選ぶ。
// タブをまたいで同じ状態を使う。
var revealed = false;

// AT の生の応答は既定で伏せる。**普段の画面では読まないし、解釈済みの値と
// 並ぶと「どちらが本当か」を迷わせる。** 見たいときだけ出す。
var debugMode = false;

// Keep dynamic modem details intact while translating the stable message prefix.
var localizedErrorPrefixes = [
	{ source: 'Missing PDU in modem message: ', translated: _('Missing PDU in modem message: ') },
	{ source: 'Unable to read modem messages: ', translated: _('Unable to read modem messages: ') },
	{ source: 'Unable to delete modem message: ', translated: _('Unable to delete modem message: ') },
	{ source: 'Unable to enter PDU mode: ', translated: _('Unable to enter PDU mode: ') },
	{ source: 'Skipped because the time limit expired: ', translated: _('Skipped because the time limit expired: ') },
	{ source: 'Unable to read eSIM profiles: ', translated: _('Unable to read eSIM profiles: ') },
	{ source: 'Unable to connect to the modem: ', translated: _('Unable to connect to the modem: ') },
	{ source: 'Backup source does not exist: ', translated: _('Backup source does not exist: ') },
	{ source: 'Unable to create the backup directory: ', translated: _('Unable to create the backup directory: ') },
	{ source: 'Unable to back up the configuration: ', translated: _('Unable to back up the configuration: ') },
	{ source: 'Unable to disable SIM lock: ', translated: _('Unable to disable SIM lock: ') },
	{ source: 'SIM lock disabled (', translated: _('SIM lock disabled (') },
	{ source: 'Saved band settings differ from the requested combination (LTE ', translated: _('Saved band settings differ from the requested combination (LTE ') },
	{ source: 'Unable to read the current band settings: ', translated: _('Unable to read the current band settings: ') },
	{ source: 'Unable to prepare band settings: ', translated: _('Unable to prepare band settings: ') },
	{ source: 'Unable to write band settings: ', translated: _('Unable to write band settings: ') },
	{ source: 'Reapplied band settings (LTE ', translated: _('Reapplied band settings (LTE ') },
	{ source: 'The modem rejected the request: ', translated: _('The modem rejected the request: ') },
	{ source: 'Unable to open the eUICC: ', translated: _('Unable to open the eUICC: ') },
	{ source: 'Unable to create config file: ', translated: _('Unable to create config file: ') },
	{ source: 'Unable to apply firewall rules: ', translated: _('Unable to apply firewall rules: ') },
	{ source: 'Unable to inspect the hosts parent directory: ', translated: _('Unable to inspect the hosts parent directory: ') },
	{ source: 'Unable to write the hosts file: ', translated: _('Unable to write the hosts file: ') },
	{ source: 'Unable to remove ad-block DNAT rules: ', translated: _('Unable to remove ad-block DNAT rules: ') },
	{ source: 'Unable to write UCI settings: ', translated: _('Unable to write UCI settings: ') },
	{ source: 'Unable to read APN from the SIM: ', translated: _('Unable to read APN from the SIM: ') },
	{ source: 'Unable to parse the modem response: ', translated: _('Unable to parse the modem response: ') },
	{ source: 'Band response is too short: ', translated: _('Band response is too short: ') },
	{ source: 'Unable to parse the band number: ', translated: _('Unable to parse the band number: ') },
	{ source: 'Unable to read EID: ', translated: _('Unable to read EID: ') },
	{ source: 'Unable to read the eSIM profile: ', translated: _('Unable to read the eSIM profile: ') },
	{ source: 'Invalid ICCID: ', translated: _('Invalid ICCID: ') },
	{ source: 'eSIM operation failed: ', translated: _('eSIM operation failed: ') },
	{ source: 'Unable to query the modem: ', translated: _('Unable to query the modem: ') },
	{ source: 'Unable to change the setting: ', translated: _('Unable to change the setting: ') },
	{ source: 'Unable to safely prepare the job directory: ', translated: _('Unable to safely prepare the job directory: ') },
	{ source: 'Unable to start the job: ', translated: _('Unable to start the job: ') },
	{ source: 'Unable to determine the executable path: ', translated: _('Unable to determine the executable path: ') },
	{ source: 'Unable to save job status: ', translated: _('Unable to save job status: ') },
	{ source: 'Unable to start the worker: ', translated: _('Unable to start the worker: ') },
	{ source: 'Invalid DHCP pool start address: ', translated: _('Invalid DHCP pool start address: ') },
	{ source: 'Invalid DHCP pool end address: ', translated: _('Invalid DHCP pool end address: ') },
	{ source: 'Router IP is invalid: ', translated: _('Router IP is invalid: ') },
	{ source: 'Unable to inspect the SIM LAN DHCP range: ', translated: _('Unable to inspect the SIM LAN DHCP range: ') },
	{ source: 'PDU is not valid hexadecimal data: ', translated: _('PDU is not valid hexadecimal data: ') },
	{ source: 'Unable to get the br-lan IPv4 network: ', translated: _('Unable to get the br-lan IPv4 network: ') },
	{ source: 'Scan rejected because the connected-device list could not be verified: ', translated: _('Scan rejected because the connected-device list could not be verified: ') },
	{ source: 'AT+ESIMMAP? response is missing +ESIMMAP: ', translated: _('AT+ESIMMAP? response is missing +ESIMMAP: ') },
	{ source: 'Unable to enable PDU mode: ', translated: _('Unable to enable PDU mode: ') },
	{ source: 'Unable to read SMS: ', translated: _('Unable to read SMS: ') },
	{ source: 'Unable to read the SMS storage: ', translated: _('Unable to read the SMS storage: ') },
	{ source: 'Unable to secure the SMS database parent directory: ', translated: _('Unable to secure the SMS database parent directory: ') },
	{ source: 'Unable to securely open the SMS database: ', translated: _('Unable to securely open the SMS database: ') },
	{ source: 'Unable to inspect SQLite sidecar: ', translated: _('Unable to inspect SQLite sidecar: ') },
	{ source: 'Unable to secure SQLite sidecar permissions: ', translated: _('Unable to secure SQLite sidecar permissions: ') },
	{ source: 'Unable to open the SMS database: ', translated: _('Unable to open the SMS database: ') },
	{ source: 'Unable to save the message: ', translated: _('Unable to save the message: ') },
	{ source: 'Unable to read from the SMS database: ', translated: _('Unable to read from the SMS database: ') },
	{ source: 'Unable to delete the message: ', translated: _('Unable to delete the message: ') }
];

// セクションの余白。**1 回だけ差し込む。** node で描画を試すときは
// document が無いので、その場合は何もしない。
var sectionStyled = false;
function injectSectionStyle() {
	if (sectionStyled || typeof document === 'undefined')
		return;
	sectionStyled = true;
	var s = document.createElement('style');
	s.textContent =
		'.sbair-section{margin-bottom:28px}' +
		'.sbair-section > h3{margin-bottom:12px}' +
		'.sbair-button-group{display:flex;gap:8px;align-items:center;flex-wrap:wrap}' +
		'.sbair-section > .table:last-child,.sbair-section > pre:last-child,' +
		'.sbair-section > .sbair-table-scroll:last-child > .table:last-child{margin-bottom:0}';
	document.head.appendChild(s);
}

function softBrickWarning(kind) {
	var message = kind === 'wifi'
		? _("If you switch or change Wi-Fi or network settings, you may lose all network connections and end up in a soft brick state.")
		: _("If you switch connection modes or change settings, all network connections may be lost and a soft brick state may occur.");
	if (kind === 'wifi')
		return E('div', { 'class': 'alert-message warning' }, [
			E('strong', {}, _("⚠ There is a risk of soft bricks")),
			E('p', {}, message)
		]);

	return E('div', { 'class': 'alert-message warning' }, [
		E('strong', {}, _("⚠ There is a risk of soft bricks")),
		E('p', {}, message),
		E('p', {}, _("Recovery may not be possible even if you press the reset button, in which case recovery via UART connection is required.")),
		E('p', {}, _("Do not change these settings unless you have a means of recovery such as UART. Additionally, Safe Apply's automatic rollback feature does not guarantee recovery from all configuration failures.")),
		E('div', { 'class': 'sbair-recovery-details', 'style': 'margin-top:1em;padding:.75em 1em;border-top:1px solid rgba(128,128,128,.45);font-size:85%;line-height:1.5' }, [
			E('p', {}, _("In addition, we have confirmed that in the case of soft bricking, recovery is possible in the following environments.")),
			E('ul', { 'style': 'margin:.5em 0 .75em 1.5em' }, [
				E('li', {}, _("UART: FT232RL (Voltage: 1.8V)")),
				E('li', {}, _("Wiring: GND = black, RX = green, TX = white")),
				E('li', {}, _("Baud rate: 115200")),
				E('li', {}, _("Conversion: Pin socket (female) → USB-A female")),
				E('li', {}, _("Cable: Regular Micro-USB cable"))
			]),
			E('p', {}, _("We have confirmed that it is possible to return to the factory default state by executing the following command from the shell while connected to UART.")),
			E('pre', { 'style': 'white-space:pre-wrap;font-size:95%;margin:.5em 0' }, 'sync\n/sbin/firstboot -r -y'),
			E('p', { 'style': 'margin-bottom:0' }, _("※The settings and environment, including LuCI, will also be initialized, so please perform this operation as a last resort."))
		])
	]);
}

return baseclass.extend({
	isRevealed: function() {
		return revealed;
	},

	setRevealed: function(v) {
		revealed = !!v;
	},

	isDebug: function() {
		return debugMode;
	},

	// 生の応答の表示切替。**画面のいちばん下に置く** — 普段は使わないので。
	debugToggle: function(redraw) {
		return E('label', {
			'style': 'display:block;margin-top:2em;opacity:.7;font-size:90%'
		}, [
			E('input', {
				'type': 'checkbox',
				'class': 'cbi-input-checkbox',
				'checked': debugMode ? '' : null,
				'change': function(ev) {
					debugMode = ev.target.checked;
					redraw();
				}
			}),
			_("Show debug (show raw response from AT)")
		]);
	},

	// **短いものほど伏せる必要がある。** Cell ID はちょうど 8 文字なので、
	// 「8 文字以下は素通し」にすると一番隠したいものが常に出てしまう。
	mask: function(s) {
		if (!s)
			return '-';
		s = String(s);
		if (revealed)
			return s;
		if (s.length <= 4)
			return '*'.repeat(s.length);
		if (s.length < 12)
			return s.slice(0, 4) + '*'.repeat(s.length - 4);
		// ICCID のように長いものは末尾 2 桁だけ残す。一覧で見分けが付く。
		return s.slice(0, 4) + '*'.repeat(s.length - 6) + s.slice(-2);
	},

	// ⚠ **値を無条件に String() しないこと。** 呼び出し側はバッジの並びなど
	// DOM ノードも渡す。文字列化すると `[object HTMLSpanElement]` が並ぶ
	// (実際にバンドの行でこれを出した)。ノードはそのまま通す。
	row: function(label, value, extra) {
		var v;
		if (value === undefined || value === null || value === '')
			v = '-';
		else if (typeof Node === 'function' && value instanceof Node)
			v = value;
		else
			v = String(value);
		return E('tr', { 'class': 'tr' }, [
			E('td', { 'class': 'td left', 'width': '35%' }, label),
			E('td', { 'class': 'td left' }, [
				v,
				extra ? E('span', { 'class': 'ifacebadge', 'style': 'margin-left:.5em' }, extra) : ''
			])
		]);
	},

	// ⚠ **セクションの下の余白は表が持っている。** テーマの CSS には
	// `.cbi-section` にも `h3` にも十分な余白が無く、`.table { margin-bottom: 18px }`
	// だけが間隔を作っている。**だから表以外(説明文やボタン)で終わると
	// 次のタイトルが直に続いてしまう。**
	//
	// 余白をセクション側へ移し、**表が最後のときはその余白を消して**
	// 二重にしない。セクション間は28px、見出しから内容までは12pxに揃える。
	section: function(title, children) {
		injectSectionStyle();
		return E('div', { 'class': 'cbi-section sbair-section' },
			[ E('h3', {}, title) ].concat(children));
	},

	table: function(rows) {
		return E('table', { 'class': 'table' }, rows);
	},

	// 識別子の表示切替。押されたら再描画を呼び出し元に任せる。
	revealToggle: function(label, redraw) {
		return E('label', { 'style': 'display:block;margin-bottom:1em' }, [
			E('input', {
				'type': 'checkbox',
				'class': 'cbi-input-checkbox',
				'checked': revealed ? '' : null,
				'change': function(ev) {
					revealed = ev.target.checked;
					redraw();
				}
			}),
			' ' + label
		]);
	},

	// Network → Wireless と同じ見せ方の信号バッジ。
	// LuCI が持っている signal-*.png をそのまま使うので追加の画像は要らない。
	//
	// **セルラーには「品質 %」が無い。** Wi-Fi は signal/noise から出せるが、
	// こちらは RSRP を段階に割り当てるしかない。-110 dBm を下限、
	// -80 dBm を上限とする。
	signalPercent: function(dbm) {
		var v = parseFloat(dbm);
		if (isNaN(v))
			return null;
		return Math.max(0, Math.min(100, Math.round((v + 110) / 30 * 100)));
	},

	signalIcon: function(pct) {
		var name = 'signal-none';
		if (pct !== null) {
			if (pct <= 0)      name = 'signal-0';
			else if (pct < 25) name = 'signal-0-25';
			else if (pct < 50) name = 'signal-25-50';
			else if (pct < 75) name = 'signal-50-75';
			else               name = 'signal-75-100';
		}
		return L.resource('icons/%s.png'.format(name));
	},

	signalBadge: function(dbm, label) {
		var pct = this.signalPercent(dbm);
		return E('span', {
			'class': 'ifacebadge',
			'title': (dbm != null && dbm !== '') ? (dbm + ' dBm') : _("unknown")
		}, [
			E('img', { 'src': this.signalIcon(pct) }),
			' ',
			(pct === null) ? _("unknown") : (pct + '%'),
			label ? E('span', { 'style': 'margin-left:.5em;opacity:.7' }, label) : ''
		]);
	},

	simMappingLabel: function(n) {
		if (n === 1) return _("Physical slot (uSIM)");
		if (n === 2) return _("Built-in eSIM");
		return n ? (_("Unknown (") + n + ')') : '-';
	},

	// 取得できなかった AT を出す。モデムが黙っているのか、こちらが読めて
	// いないのかを区別できるようにするため。
	errorText: function(message) {
		var text = message && typeof message.message === 'string' ? message.message : String(message);
		for (var i = 0; i < localizedErrorPrefixes.length; i++) {
			var item = localizedErrorPrefixes[i];
			if (text.indexOf(item.source) === 0)
				return item.translated + text.substring(item.source.length);
		}
		return _(text);
	},

	errorBox: function(errors) {
		if (!errors || !errors.length)
			return '';
		injectSectionStyle();
		return E('div', { 'class': 'cbi-section sbair-section' }, [
			E('h3', {}, _("Items that cannot be obtained")),
			E('pre', { 'style': 'white-space:pre-wrap' }, errors.map(function(message) {
				return this.errorText(message);
			}, this).join('\n'))
		]);
	},

	softBrickWarning: function(kind) {
		return softBrickWarning(kind);
	}
});
