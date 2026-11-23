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

### WSLを使わないWindowsネイティブビルド

[go.dev/dl](https://go.dev/dl/)からGo 1.25.5以降をインストールし、`go/bin`を`PATH`に追加します。[Git for Windows](https://git-scm.com/download/win)もインストールしてください。プロジェクトのスクリプトはPOSIX互換シェルとツールを使うため、**Git Bash**から実行します。Python 3もインストールし、`python3`または`python`がGit Bashから使えるようにします。パッケージ作成は`python3`を既定で使用します。Pythonコマンド名が`python`の場合は`PYTHON3=python`を指定します。

```sh
git clone https://github.com/Floop3/luci-app-sbair-modem.git floop3
cd floop3
./build.sh
./tools/package-release.sh vX.Y.Z
```

Pythonコマンド名が`python`の場合は`PYTHON3=python ./tools/package-release.sh vX.Y.Z`を使います。パッケージ作成コマンドはバックエンドを再ビルドし、`out/release/floop3-vX.Y.Z-air6-linux-arm64.tar.gz`と`.sha256`を作成します。`vX.Y.Z`は実際のリリースタグに置き換えてください。Git Bashで先に`go version`、利用するPythonコマンドの`--version`、`git status --short`を確認します。PowerShellだけではスクリプトが必要とするPOSIXシェルコマンドを提供しません。

事前ビルド済みバンドルは、タグ付きGitHubリリースの`.tar.gz`と`.sha256`を取得してください。ホスト上でチェックサムとバンドル内ファイルを確認します。

```sh
sha256sum -c floop3-<version>-air6-linux-arm64.tar.gz.sha256
tar -xzf floop3-<version>-air6-linux-arm64.tar.gz
cd floop3-<version>-air6-linux-arm64
sha256sum -c SHA256SUMS
```

`release-manifest.json`のバージョンとソースコミットが導入対象と一致することを確認してください。続いてルーターへコピーし、装置側でも事前検査してから導入します。

```sh
cd ..
scp -O floop3-<version>-air6-linux-arm64.tar.gz root@<AIR6_LAN_IP>:/tmp/
ssh root@<AIR6_LAN_IP>
cd /tmp
tar -xzf floop3-<version>-air6-linux-arm64.tar.gz
cd floop3-<version>-air6-linux-arm64
sha256sum -c SHA256SUMS
sh ./install.sh --check
sh ./install.sh /
```

インストーラーは、非対応ファームウェア、未適用のfirewall変更、所有者不明のネットワークhelper、`/overlay`の空き容量が24 MiB未満の場合に停止します。原因を解消して再検査し、この確認を回避しないでください。

ソースからビルドする場合はGo 1.25.5以上を使い、`./build.sh`と`sh ./tools/build-i18n.sh`を実行した後、事前検査付きの`tools/deploy-floop3.sh`を使用します。UIや翻訳が異なるソース版のGoバイナリだけをコピーしないでください。

インストール後、`http://<AIR6_LAN_IP>/cgi-bin/luci/`を開きます。アプリは**Services → SoftBank Air 6**にあります。**System → Language and Style**でEnglish、한국어、日本語を選べます。

## セキュリティと復旧

インストーラーはrootパスワードやSSH認証を作成・変更しません。固有の強いrootパスワードを設定し、SSH鍵を用意してください。SSHやHTTP管理画面を公衆WANに直接公開せず、信頼できる内部ネットワークから管理します。

インストーラーは設定バックアップを自動作成しません。導入前にLuCIの設定バックアップを保存し、UARTなど別の管理経路を確保してください。失敗時はネットワークやファイアウォールを初期化せず、SSH/UARTからログと変更ファイルを確認してください。

スクリプトはWindowsのGit Bash、またはLinux/macOSの端末から実行します。GoとGit BashをWindowsに用意すれば、WSLは必須ではありません。
