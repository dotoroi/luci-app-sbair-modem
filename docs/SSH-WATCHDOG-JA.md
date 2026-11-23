[English](SSH-WATCHDOG-EN.md) | [한국어](SSH-WATCHDOG-KO.md) | [日本語](SSH-WATCHDOG-JA.md)

# Air6 SSH監視とモデムバンド復元

## SSH監視サービス

`air6-ssh-watchdog`は既存のvendor Dropbear復旧経路を監視し、記録済みの管理LAN経路だけを修復します。

- 15秒ごとに`br-lan`のIPv4、TCP/22 listener、`input_lan_drop_rule`を確認します。
- 現在の実装はPC `192.168.3.240/32`とルーター`192.168.3.0/24`の組み合わせに限定されています。
- 必要な場合だけPCからルーターへのTCP/22例外を復元します。
- Dropbearがlistenしていない場合、`/etc/init.d/zzzz_air6_dropbear start`を呼び出します。
- WAN SSH、他の送信元、パスワードポリシーは変更しません。

### 起動と確認

`install.sh /`はファイルと起動リンクを配置しますが、稼働中のサービスを即時起動しません。実機に適用した場合は、現在のSSH接続を維持したまま次を実行してください。

```sh
/etc/init.d/zzzzz_air6_ssh_watchdog start
/usr/bin/air6-ssh-watchdog --check
/etc/init.d/zzzzz_air6_ssh_watchdog status
```

別のLAN構成で使う前に`br-lan`、送信元IP、firewall chain、vendor Dropbear復旧スクリプトを確認してください。想定したchainがなければ、新しい規則を作らず終了します。

### ロールバック

```sh
/etc/init.d/zzzzz_air6_ssh_watchdog stop
/etc/init.d/zzzzz_air6_ssh_watchdog disable
rm -f /etc/rc.d/S99zzzzz_air6_ssh_watchdog /etc/rc.d/K01zzzzz_air6_ssh_watchdog
rm -f /etc/init.d/zzzzz_air6_ssh_watchdog /usr/bin/air6-ssh-watchdog
```

vendorの`/etc/init.d/zzzz_air6_dropbear`とその起動リンクは削除しないでください。

## 保存済みモデムバンドの復元

`AT+EPBSEH=`のLTE/NRマスクは、モデム再起動や遅延初期化後に戻る場合があります。`sbair.band.lte`と`.nr`が保存されている場合、`S95sbair-apn`は通常のAPN適用後に`air6-band-restore`を起動します。この補助スクリプトはLTE/NRマスクだけを変更し、現在のGSM/UMTSマスクを維持します。APN、SIMロック、IMS、SMS通知も扱う包括的な`sbair-modem boot`は呼び出しません。

ATサービスの起動を待って最大120秒監視し、保存値が45秒間安定すると終了します。`logread`で`air6-band-restore` tagを確認してください。

```sh
uci show sbair.band
/usr/sbin/air6-band-restore
/usr/bin/sbair-modem at -t 5 -r 'AT+EPBSEH?'
```

マスク適用時にセルラー網の再スキャンが起き、モバイルデータが一時切断されることがあります。マスクが一致しても、網登録やデータ接続の成功は保証されません。対象firmwareでは再起動後の起動経路を確認してください。
