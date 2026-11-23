// SPDX-License-Identifier: MIT
// Copyright (c) 2026 soralis0912
//
// netifd の `ql_datacall` proto を LuCI の Network → Interfaces から
// 触れるようにする。

'use strict';
'require form';
'require network';
'require tools.sbair-i18n as i18n';

var _ = i18n.translate;

// ccmni* はデータコールが作る L3 デバイス。単独の interface として
// 一覧に出さない。
network.registerPatternVirtual(/^ccmni/);

return network.registerProtocol('ql_datacall', {
	getI18n: function() {
		return _('Cellular data call (ql_datacall)');
	},

	// ベンダ同梱で opkg には無い。**null を返さないと LuCI が
	// 「luci-proto-… を入れろ」という出せないリンクを出す。**
	getOpkgPackage: function() {
		return null;
	},

	isFloating: function() {
		return true;
	},

	isVirtual: function() {
		return true;
	},

	getDevices: function() {
		return null;
	},

	containsDevice: function(ifname) {
		return (network.getIfnameOf(ifname) == this.getIfname());
	},

	renderFormOptions: function(s) {
		var o;

		// ⚠ **ここで設定しても再起動で戻る。** ベンダの /usr/bin/knsh が
		// 起動時に /etc/config/lte の値を network.wan.* へ流し込むため。
		// 永続させたいなら SIM 関連ページ (sbair) の APN 設定を使う —
		// あちらは lte.* も一緒に書く。
		o = s.taboption('general', form.Value, 'apn', _('APN'),
			_('Changes made here are temporary. The vendor knsh service overwrites this value from /etc/config/lte on reboot. Use the APN setting under SIM in the SoftBank Air menu to keep it persistent.'));
		o.placeholder = _('Example: uno.au-net.ne.jp');
		o.rmempty = false;

		o = s.taboption('general', form.ListValue, 'auth', _('Authentication method'));
		o.value('0', _('None'));
		o.value('1', 'PAP');
		o.value('2', 'CHAP');
		o.value('3', 'PAP/CHAP');
		o.default = '0';

		o = s.taboption('general', form.Value, 'username', _('Username'));
		o.depends({ auth: '1' });
		o.depends({ auth: '2' });
		o.depends({ auth: '3' });

		o = s.taboption('general', form.Value, 'password', _('Password'));
		o.password = true;
		o.depends({ auth: '1' });
		o.depends({ auth: '2' });
		o.depends({ auth: '3' });

		o = s.taboption('general', form.ListValue, 'iptype', _('IP address type'));
		o.value('1', 'IPv4');
		o.value('2', 'IPv6');
		o.value('3', 'IPv4v6');
		o.default = '3';

		// --- 詳細 ---------------------------------------------------------

		// **ここが一番の落とし穴。** 1 のままだと netifd の proto が
		// ベンダの check_auto_apn_prov を呼ぶが、その関数は SIM が完全な
		// APN を返すと永久ループする(retry がデータの欠けているときにしか
		// 減らない)。WAN の setup がそこで止まり、外からは「上がらない」と
		// しか見えない。
		o = s.taboption('advanced', form.Flag, 'auto_conf',
			_('Configure APN automatically from SIM'),
			_('Enabling this may cause the vendor routine to wait indefinitely for a SIM response and prevent the WAN from coming up. Leave it disabled when entering the APN manually.'));
		o.enabled = '1';
		o.disabled = '0';
		o.default = o.disabled;

		o = s.taboption('advanced', form.ListValue, 'rattype', _('Radio access technology'));
		o.value('0', _('Automatic (NR + LTE + UMTS)'));
		o.value('19', _('4G / 5G only'));
		o.optional = true;

		o = s.taboption('advanced', form.Value, 'plmn', _('PLMN override'));
		o.optional = true;

		o = s.taboption('advanced', form.Value, 'mtu', _('MTU'));
		o.datatype = 'range(576, 9200)';
		o.optional = true;
		o.placeholder = '0';

		o = s.taboption('advanced', form.Flag, 'dataroaming', _('Allow data while roaming'));
		o.enabled = '1';
		o.disabled = '0';
		o.default = o.disabled;

		o = s.taboption('advanced', form.Value, 'retry', _('Retry count'));
		o.datatype = 'uinteger';
		o.optional = true;
		o.placeholder = '5';

		o = s.taboption('advanced', form.Value, 'pdu_timeout_interval',
			_('PDU timeout (seconds)'));
		o.datatype = 'uinteger';
		o.optional = true;
		o.placeholder = '30';
	}
});
