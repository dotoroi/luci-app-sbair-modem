# Codexを使わずにFloop3をインストールする

[English](INSTALL-NON-CODEX-EN.md) | [한국어](INSTALL-NON-CODEX-KO.md) | [日本語](INSTALL-NON-CODEX-JA.md)

一般的なLinux/macOS/WSL端末でFloop3をビルドし、Air Terminal 6へインストールする手順です。Codex機能やリモートリポジトリのアカウントは不要です。

## 対象と準備

- SoftBank Air 6でLuCI、rpcd、ubus、uciがすでに動作している必要があります。
- PCにGit、Bash、Go 1.25以降、Python 3、ssh、tar、sha256sumが必要です。
- root SSH接続が必要です。鍵認証を推奨します。
- インストール時にLuCIのrpcdを再起動しますが、ルーターは再起動しません。先に設定をバックアップしてください。
- `/usr/sbin/sbair-netmode`に未知の実装がある場合、インストーラーは上書きせず停止します。

Floop3はvendor MT-WiFi連携が必要なvendor OpenWrt 21.02.7を対象とします。通常、最新upstream OpenWrtには導入しないでください。

純正vendor OpenWrt 21.02.7にLuCIがない場合は、先に[LuCI bootstrap手順](../extras/luci-bootstrap/README.md)を実行してください。MT-WiFiドライバーを変更・置換せず、vendor ABIを保ったままLuCIを追加します。LuCIがすでにある場合は不要です。固定済みパッケージ一覧を別releaseやSNAPSHOTに使用しないでください。

## ビルドとインストール

公式ソースを取得してビルドします。

```sh
git clone https://github.com/Floop3/luci-app-sbair-modem.git floop3
cd floop3
./build.sh
./tools/check-i18n.sh
```

`./build.sh`は`po2lmo`があればそれを使い、なければ同梱のPython 3変換器を使います。必要なら`PO2LMO=/path/to/po2lmo`を指定します。`out/sbair-modem`と日本語・韓国語の`.lmo`カタログが生成されます。英語は原文メッセージを使います。

端末の現在のLANアドレスを指定して配備します。

```sh
bash tools/deploy-floop3.sh root@<AIR6_LAN_IP>
```

配備スクリプトはroot SSH、Air 6機種、LuCI、overlay空き容量を確認します。設定と既存Floop3パスを`/root/sbair-backups/floop3-preinstall-<UTC timestamp>/`に保存し、SSHで必要なファイルを転送して`install.sh /`を実行します。端末側のパッケージ配布サーバーへの接続は不要で、自動再起動もしません。

追加のSSHオプションには`~/.ssh/config`または`AIR6_SSH_OPTS`を使います。

```sh
AIR6_SSH_OPTS='-o ConnectTimeout=5' bash tools/deploy-floop3.sh root@<AIR6_LAN_IP>
```

インストール後、`http://<AIR6_LAN_IP>/cgi-bin/luci/`を開きます。アプリは**Services → SoftBank Air 6**にあります。**System → Language and Style**でEnglish、한국어、日本語を選べます。

## セキュリティと復旧

インストーラーはrootパスワードやSSH認証を作成・変更しません。固有の強いrootパスワードを設定し、SSH鍵を用意してください。SSHやHTTP管理画面を公衆WANに直接公開せず、信頼できる内部ネットワークから管理します。

エラー時は表示されたバックアップ先を保管してください。`before-install.tar.gz`には既存設定とインストール先のコピーがあります。ネットワークやファイアウォールを初期化せず、SSH/UARTの管理経路から内容を確認して必要なファイルだけ復元します。失敗時の診断用一時ファイルが`/tmp/floop3-deploy-*`に残ることがあります。

スクリプトはWSL/Linux/macOSで実行します。WindowsではWSL端末でプロジェクトディレクトリへ移動してください。

