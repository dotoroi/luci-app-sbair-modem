# Codexを使わずにFloop3をインストールする

[English](INSTALL-NON-CODEX-EN.md) | [한국어](INSTALL-NON-CODEX-KO.md) | [日本語](INSTALL-NON-CODEX-JA.md)

一般的なLinux/macOS/WSL端末でFloop3をビルドし、Air Terminal 6へインストールする手順です。Codex機能やリモートリポジトリのアカウントは不要です。

## 推奨作業環境：UARTコンソール

初回インストールやネットワーク／ファイアウォール設定を変更する前に、**UARTコンソールを接続しておくことを強く推奨します。** Floop3のインストールではrpcdを再起動しますが、ルーター自体は再起動しません。LuCIやSSHに接続できなくなった場合、UARTは起動・サービスログを確認し、独立した復旧を試みる手段になります。インストールと初回接続確認の間はUARTログを継続して保存してください。

推奨構成はWindows 11ホスト＋WSL2 Ubuntu LTSです。ソース取得、Goビルド、翻訳チェック、SSH配備はWSL端末で行い、リポジトリは`/mnt/c`ではなくWSLのLinuxファイルシステム（例：`~/src/floop3`）に配置します。USB-UARTアダプターはWindowsに接続し、PuTTYやTera TermなどのWindowsシリアル端末でCOMポートを開きます。設定は115200 baud、8N1、フロー制御なしとし、生ログの保存を有効にします。native Ubuntu PCとシリアル端末を使う構成でも問題ありません。

現在確認できるAir 6のUART資料には、ユーザー報告による1.8 Vロジック測定値がありますが、ヘッダーのTX/RX/GNDのピン順は未確認です。**1.8 V対応アダプターまたは適切なレベル変換器を使用し、機器固有の資料と測定でピン配置・電圧を確認してから接続してください。3.3 Vアダプターを直接接続したり、UARTのVCCピンに給電したりしないでください。**

この手順ではAir 6のOpenWrtファームウェアを再ビルド／フラッシュしません。タグ付きリリースにはビルド済みGoバックエンドとインストール一式を添付できます。対象は互換性表に記載した純正SBA6Dに限り、各バージョンでの全機能検証は未完了です。

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
```

現状の`./build.sh`はGoバックエンド(`out/sbair-modem`)のみをビルドします。

ビルド済み一式は韓国語ガイドのリリース手順に従って導入できます。ソースから導入する場合はWSLで`./build.sh`を実行し、`install.sh`、`root/`、`htdocs/`、`tools/check-shell-lf.sh`、`out/sbair-modem`をアーカイブして端末の`/tmp`へSSH転送します。端末で展開後、`sh ./install.sh /`を実行してください。同じ対象チェックが適用されます。

インストール後、`http://<AIR6_LAN_IP>/cgi-bin/luci/`を開きます。アプリは**Services → SoftBank Air 6**にあります。**System → Language and Style**でEnglish、한국어、日本語を選べます。

## セキュリティと復旧

インストーラーはrootパスワードやSSH認証を作成・変更しません。固有の強いrootパスワードを設定し、SSH鍵を用意してください。SSHやHTTP管理画面を公衆WANに直接公開せず、信頼できる内部ネットワークから管理します。

インストーラーは設定バックアップを自動作成しません。導入前にLuCIの設定バックアップを保存し、UARTなど別の管理経路を確保してください。失敗時はネットワークやファイアウォールを初期化せず、SSH/UARTからログと変更ファイルを確認してください。

スクリプトはWSL/Linux/macOSで実行します。WindowsではWSL端末でプロジェクトディレクトリへ移動してください。
