# Floop3の削除（Air Terminal 6）

[English](UNINSTALL-FLOOP3-EN.md) | [한국어](UNINSTALL-FLOOP3-KO.md) | [日本語](UNINSTALL-FLOOP3-JA.md)

`tools/uninstall-floop3.sh`は手動導入したFloop3のファイルと登録だけを削除します。OpenWrt、LuCI、`luci-app-air6-modem`、ネットワーク/Wi-Fi/rootアカウント設定は削除しません。端末を再起動しません。

## 実行

実機のroot SSHまたはUART rootシェルからスクリプトを実行します。

```sh
sh uninstall-floop3.sh
```

SoftBank Air 6の基板であることを確認後、現在の設定と対象ファイルを`/root/sbair-backups/floop3-removal-<UTC timestamp>/before-remove.tar.gz`へ保存します。Floop3サービスを停止・無効化し、アプリファイル、起動リンク、LuCIメニュー/RPC登録、Floop3専用firewall include、インストール時に追加した英語・日本語の言語登録を削除します。韓国語の選択は元からあったため保持します。

`/etc/config/sbair`は、インストール前のバックアップになく、すべてのUCIキーと値がインストーラーの初期値と完全一致する場合だけ削除します。ユーザー値が追加・変更されていれば保持します。`/etc/config/ql_ril_service`もログレベル初期値が完全一致する場合だけ削除します。削除前コピーはバックアップに残ります。

## 確認

```sh
ubus list | grep -x sbair        # 何も表示されないこと
ps w | grep -E 'sbair|5300'      # アプリプロセスがないこと
apk info -e luci-app-air6-modem  # Air6標準メニューパッケージが残ること
ip -4 addr show br-lan           # 既存LANアドレスが維持されること
```

`before-remove.tar.gz`と`paths.txt`は確認・復旧用です。現在の設定を上書きする恐れがあるため、アーカイブ全体を`/`へ展開しないでください。復旧時は個々のパスを確認してから戻します。
